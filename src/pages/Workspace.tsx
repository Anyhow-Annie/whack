import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { canContribute, canManage } from '../auth/access'
import { useAuth } from '../auth/AuthProvider'
import { AccessPanel } from '../components/AccessPanel'
import { DocumentUpload } from '../components/DocumentUpload'
import { ProjectActivity } from '../components/ProjectActivity'
import { ProjectPanel } from '../components/ProjectPanel'
import { formatFirebaseError } from '../lib/errors'
import { buildKnowledgeGraph } from '../mindmap/graph'
import { KnowledgeMap } from '../mindmap/KnowledgeMap'
import { claimInitialAdmin, searchKnowledge, setEmployeeRole } from '../services/callables'
import { listDocuments } from '../services/documents'
import { updateEmployeeProfile } from '../services/employees'
import { addProjectUpdate, createRelationship, listProjectUpdates, listRelationships } from '../services/knowledge'
import { addProjectMember, createProject, listProjects } from '../services/projects'
import type { OrgDocument, Project, ProjectUpdate, RelationshipKind, SearchResponse } from '../types/domain'

export function Workspace() {
  const { user, employee, role, profileError, preview, useEmulators, refreshAccess, reloadEmployee, signOutUser } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [documents, setDocuments] = useState<OrgDocument[]>([])
  const [updates, setUpdates] = useState<ProjectUpdate[]>([])
  const [relationships, setRelationships] = useState<Awaited<ReturnType<typeof listRelationships>>>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null)
  const [searching, setSearching] = useState(false)

  const reloadProjects = useCallback(async () => {
    const rows = await listProjects()
    setProjects(rows)
    setSelectedId((current) => current ?? rows[0]?.id ?? null)
  }, [])

  const reloadProjectDetails = useCallback(async (projectId: string) => {
    const [docs, notes] = await Promise.all([
      listDocuments(projectId),
      listProjectUpdates(projectId),
    ])
    setDocuments(docs)
    setUpdates(notes)
  }, [])

  useEffect(() => {
    if (!role) return
    let cancelled = false
    void (async () => {
      try {
        const [rows, links] = await Promise.all([listProjects(), listRelationships()])
        if (cancelled) return
        setProjects(rows)
        setRelationships(links)
        setSelectedId((current) => current ?? rows[0]?.id ?? null)
        setError(null)
      } catch (caught) {
        if (!cancelled) setError(formatFirebaseError(caught))
      }
    })()
    return () => { cancelled = true }
  }, [role])

  useEffect(() => {
    if (!role || !selectedId) {
      setDocuments([])
      setUpdates([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const [docs, notes] = await Promise.all([
          listDocuments(selectedId),
          listProjectUpdates(selectedId),
        ])
        if (cancelled) return
        setDocuments(docs)
        setUpdates(notes)
      } catch (caught) {
        if (!cancelled) setError(formatFirebaseError(caught))
      }
    })()
    return () => { cancelled = true }
  }, [role, selectedId])

  const selected = projects.find((project) => project.id === selectedId) ?? null
  const graph = useMemo(
    () => buildKnowledgeGraph(projects, selected ? documents : [], relationships),
    [projects, documents, relationships, selected],
  )

  async function run<T>(action: () => Promise<T>) {
    try {
      setError(null)
      return await action()
    } catch (caught) {
      setError(formatFirebaseError(caught))
      return undefined
    }
  }

  async function onSearch(event: FormEvent) {
    event.preventDefault()
    setSearching(true)
    setSearchResult(null)
    try {
      setSearchResult(await searchKnowledge(query, selectedId ?? undefined))
    } catch (caught) {
      setError(formatFirebaseError(caught))
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="workspace">
      <header className="topbar">
        <div className="brand">
          <strong>Living Organizational Memory</strong>
          <span className="meta">{employee?.email}</span>
        </div>
        <div className="topbar-actions">
          {preview ? <span className="pill">Local preview</span> : null}
          {useEmulators ? <span className="pill">Emulators</span> : null}
          <span className="pill">{role ?? 'no role claim'}</span>
          <button type="button" className="secondary" onClick={() => void run(refreshAccess)}>Refresh access</button>
          <button type="button" className="ghost" onClick={() => void signOutUser()}>Sign out</button>
        </div>
      </header>

      {!role ? (
        <main className="screen span-all">
          {profileError ? <p className="error" role="alert">{profileError}</p> : null}
          {error ? <p className="error" role="alert">{error}</p> : null}
          <AccessPanel
            role={role}
            onClaimAdmin={async () => {
              await run(async () => {
                await claimInitialAdmin()
                await refreshAccess()
              })
            }}
            onSetRole={async () => undefined}
          />
        </main>
      ) : (
        <>
          <ProjectPanel
            projects={projects}
            selectedId={selectedId}
            canManage={canManage(role)}
            employee={employee}
            onSelect={setSelectedId}
            onCreate={(name, description) => run(async () => {
              if (!user) return
              const id = await createProject({ name, description, ownerId: user.uid })
              await reloadProjects()
              setSelectedId(id)
            }) ?? Promise.resolve()}
            onAddMember={(project, memberId) => run(async () => {
              await addProjectMember(project, memberId)
              await reloadProjects()
            }) ?? Promise.resolve()}
            onSaveProfile={(input) => run(async () => {
              if (!user) return
              await updateEmployeeProfile(user.uid, input)
              await reloadEmployee()
            }) ?? Promise.resolve()}
          >
            {role === 'admin' ? (
              <AccessPanel
                role={role}
                onClaimAdmin={async () => undefined}
                onSetRole={async (uid, nextRole) => {
                  await run(async () => {
                    await setEmployeeRole(uid, nextRole)
                  })
                }}
              />
            ) : null}
          </ProjectPanel>
          <section className="map-wrap">
            {error ? <p className="error" role="alert">{error}</p> : null}
            <KnowledgeMap nodes={graph.nodes} edges={graph.edges} />
            <form className="row" onSubmit={onSearch} style={{ padding: '0.8rem' }}>
              <label style={{ flex: 1 }}>
                Search knowledge
                <input
                  value={query}
                  minLength={3}
                  required
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ask across projects"
                />
              </label>
              <button type="submit" disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
            </form>
            {searchResult?.status === 'embeddings_not_configured' ? (
              <p className="banner" style={{ margin: '0 0.8rem 0.8rem' }}>
                Your role was accepted. Embedding search is not configured yet, so there are no semantic results.
              </p>
            ) : null}
          </section>
          <ProjectActivity
            project={selected}
            projects={projects}
            documents={documents}
            updates={updates}
            canContribute={canContribute(role)}
            canManage={canManage(role)}
            upload={selected && user ? (
              <DocumentUpload
                projectId={selected.id}
                uploadedBy={user.uid}
                onUploaded={async () => { await reloadProjectDetails(selected.id) }}
              />
            ) : null}
            onAddUpdate={(body) => run(async () => {
              if (!user || !selected) return
              await addProjectUpdate({
                projectId: selected.id,
                authorId: user.uid,
                authorName: employee?.displayName || user.displayName || 'Employee',
                body,
              })
              await reloadProjectDetails(selected.id)
            }) ?? Promise.resolve()}
            onLink={({ toProjectId, kind }: { toProjectId: string; kind: RelationshipKind }) => run(async () => {
              if (!user || !selected) return
              await createRelationship({
                fromType: 'project',
                fromId: selected.id,
                toType: 'project',
                toId: toProjectId,
                kind,
                createdBy: user.uid,
              })
              setRelationships(await listRelationships())
            }) ?? Promise.resolve()}
          />
        </>
      )}
    </div>
  )
}
