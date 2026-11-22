import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Employee, Project } from '../types/domain'

type ProjectPanelProps = {
  projects: Project[]
  selectedId: string | null
  canManage: boolean
  employee: Employee | null
  onSelect: (projectId: string) => void
  onCreate: (name: string, description: string) => Promise<void>
  onAddMember: (project: Project, memberId: string) => Promise<void>
  onSaveProfile: (input: { displayName: string; title: string; department: string }) => Promise<void>
  children?: ReactNode
}

export function ProjectPanel({
  projects,
  selectedId,
  canManage,
  employee,
  onSelect,
  onCreate,
  onAddMember,
  onSaveProfile,
  children,
}: ProjectPanelProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [memberId, setMemberId] = useState('')
  const [displayName, setDisplayName] = useState(employee?.displayName ?? '')
  const [title, setTitle] = useState(employee?.title ?? '')
  const [department, setDepartment] = useState(employee?.department ?? '')
  const selected = projects.find((project) => project.id === selectedId) ?? null

  useEffect(() => {
    setDisplayName(employee?.displayName ?? '')
    setTitle(employee?.title ?? '')
    setDepartment(employee?.department ?? '')
  }, [employee])

  async function createProject(event: FormEvent) {
    event.preventDefault()
    await onCreate(name, description)
    setName('')
    setDescription('')
  }

  async function addMember(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    await onAddMember(selected, memberId.trim())
    setMemberId('')
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    await onSaveProfile({ displayName, title, department })
  }

  return (
    <aside className="sidebar">
      <h2>Projects</h2>
      {projects.length === 0 ? <p className="muted">No projects yet.</p> : null}
      <ul className="project-list">
        {projects.map((project) => (
          <li key={project.id}>
            <button type="button" aria-current={project.id === selectedId} onClick={() => onSelect(project.id)}>
              {project.name}
              <p className="meta">{project.status}</p>
            </button>
          </li>
        ))}
      </ul>

      {canManage ? (
        <form onSubmit={createProject}>
          <h2>New project</h2>
          <label>
            Name
            <input required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <button type="submit">Create project</button>
        </form>
      ) : null}

      {canManage && selected ? (
        <form onSubmit={addMember}>
          <h2>Add a member</h2>
          <label>
            Employee user id
            <input required value={memberId} onChange={(event) => setMemberId(event.target.value)} />
          </label>
          <button type="submit">Add to {selected.name}</button>
        </form>
      ) : null}

      <form onSubmit={saveProfile}>
        <h2>Your profile</h2>
        <p className="meta">Directory role: {employee?.role ?? 'unknown'}. Access uses the server-issued role claim.</p>
        <label>
          Name
          <input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        <label>
          Title
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          Department
          <input value={department} onChange={(event) => setDepartment(event.target.value)} />
        </label>
        <button type="submit">Save profile</button>
      </form>
      {children}
    </aside>
  )
}
