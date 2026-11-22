import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { AccessPanel } from '../components/AccessPanel'
import KnowledgeAtlas from '../components/atlas/KnowledgeAtlas'
import { formatFirebaseError } from '../lib/errors'
import { claimInitialAdmin } from '../services/callables'
import { listProjects } from '../services/projects'
import { listAtlasDocuments, listAtlasPeople } from '../services/atlas'
import type { AtlasDocument } from '../services/atlas'
import type { Employee, Project } from '../types/domain'

export function Workspace() {
  const { user, employee, role, refreshAccess, signOutUser } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [documents, setDocuments] = useState<AtlasDocument[]>([])
  const [people, setPeople] = useState<Employee[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!role) {
      setLoading(false)
      return
    }

    let cancelled = false

    void listProjects()
      .then(async (rows) => {
        const [docs, profiles] = await Promise.all([
          listAtlasDocuments(rows.map((project) => project.id)),
          listAtlasPeople(),
        ])

        if (!cancelled) {
          setProjects(rows)
          setDocuments(docs)
          setPeople(profiles)
          setError(null)
        }
      })
      .catch((caught) => {
        if (!cancelled) setError(formatFirebaseError(caught))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [role])

  const run = async (action: () => Promise<void>) => {
    try {
      await action()
    } catch (caught) {
      setError(formatFirebaseError(caught))
    }
  }

  if (!role) {
    return (
      <main className="screen span-all">
        {error && <p className="error">{error}</p>}
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
    )
  }

  if (loading) {
    return <p className="status">Opening your knowledge atlas…</p>
  }

  if (error) {
    return (
      <main className="screen span-all">
        <p className="error">{error}</p>
        <button onClick={() => window.location.reload()}>Try again</button>
      </main>
    )
  }

  return (
    <KnowledgeAtlas
      projects={projects}
      documents={documents}
      people={people}
      displayName={employee?.displayName || user?.email || 'Employee'}
      onSignOut={signOutUser}
    />
  )
}