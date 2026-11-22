import { useState, type FormEvent, type ReactNode } from 'react'
import type { OrgDocument, Project, ProjectUpdate, RelationshipKind } from '../types/domain'

type ProjectActivityProps = {
  project: Project | null
  documents: OrgDocument[]
  updates: ProjectUpdate[]
  canContribute: boolean
  canManage: boolean
  onAddUpdate: (body: string) => Promise<void>
  onLink: (input: { toProjectId: string; kind: RelationshipKind }) => Promise<void>
  projects: Project[]
  upload: ReactNode
}

const KINDS: RelationshipKind[] = ['related', 'depends_on', 'continues', 'references']

export function ProjectActivity({
  project,
  documents,
  updates,
  canContribute,
  canManage,
  onAddUpdate,
  onLink,
  projects,
  upload,
}: ProjectActivityProps) {
  const [body, setBody] = useState('')
  const [toProjectId, setToProjectId] = useState('')
  const [kind, setKind] = useState<RelationshipKind>('related')

  async function submitUpdate(event: FormEvent) {
    event.preventDefault()
    await onAddUpdate(body)
    setBody('')
  }

  async function submitLink(event: FormEvent) {
    event.preventDefault()
    await onLink({ toProjectId, kind })
    setToProjectId('')
  }

  if (!project) {
    return (
      <aside className="activity">
        <h2>Project record</h2>
        <p className="muted">Select a project to upload documents and write continuity notes.</p>
      </aside>
    )
  }

  return (
    <aside className="activity">
      <h2>{project.name}</h2>
      <p className="muted">{project.description || 'No description yet.'}</p>

      {canContribute ? upload : <p className="meta">Viewers can read documents. Members can upload them.</p>}

      <h2>Documents</h2>
      {documents.length === 0 ? <p className="muted">Nothing uploaded for this project.</p> : null}
      <ul className="project-list">
        {documents.map((document) => (
          <li key={document.id} className="update">
            <strong>{document.title}</strong>
            <p className="meta">
              {document.status}
              {document.extraction ? ` · ${document.extraction}` : ''}
              {typeof document.chunkCount === 'number' ? ` · ${document.chunkCount} chunks` : ''}
            </p>
          </li>
        ))}
      </ul>

      <h2>Continuity notes</h2>
      {updates.map((update) => (
        <article key={update.id} className="update">
          <p className="meta">{update.authorName}</p>
          <p>{update.body}</p>
        </article>
      ))}
      {canContribute ? (
        <form onSubmit={submitUpdate}>
          <label>
            What should the next person know?
            <textarea required value={body} onChange={(event) => setBody(event.target.value)} />
          </label>
          <button type="submit">Save note</button>
        </form>
      ) : null}

      {canManage ? (
        <form onSubmit={submitLink}>
          <h2>Link projects</h2>
          <label>
            Other project
            <select required value={toProjectId} onChange={(event) => setToProjectId(event.target.value)}>
              <option value="">Choose a project</option>
              {projects.filter((item) => item.id !== project.id).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            Relationship
            <select value={kind} onChange={(event) => setKind(event.target.value as RelationshipKind)}>
              {KINDS.map((item) => <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
          <button type="submit">Add to map</button>
        </form>
      ) : null}
    </aside>
  )
}
