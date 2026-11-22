import { useState, type FormEvent } from 'react'
import { ROLES, type Role } from '../types/domain'

type AccessPanelProps = {
  role: Role | null
  onClaimAdmin: () => Promise<void>
  onSetRole: (uid: string, role: Role) => Promise<void>
}

export function AccessPanel({ role, onClaimAdmin, onSetRole }: AccessPanelProps) {
  const [uid, setUid] = useState('')
  const [nextRole, setNextRole] = useState<Role>('member')
  const [pending, setPending] = useState(false)

  async function claim(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      await onClaimAdmin()
    } finally {
      setPending(false)
    }
  }

  async function grant(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    try {
      await onSetRole(uid.trim(), nextRole)
      setUid('')
    } finally {
      setPending(false)
    }
  }

  if (!role) {
    return (
      <form className="card" onSubmit={claim}>
        <h2>Waiting for access</h2>
        <p className="muted">
          Your profile can list you as a viewer, but organizational knowledge stays closed
          until a Cloud Function writes a role claim. If this Firebase project has no admin yet,
          you can claim that role. The function refuses the request once an admin exists.
        </p>
        <button type="submit" disabled={pending}>Claim initial admin</button>
      </form>
    )
  }

  if (role !== 'admin') return null

  return (
    <form className="card" onSubmit={grant}>
      <h2>Grant a role</h2>
      <p className="meta">This calls a Cloud Function. The function reads your admin claim and ignores any role sent about you.</p>
      <label>
        Employee user id
        <input required value={uid} onChange={(event) => setUid(event.target.value)} />
      </label>
      <label>
        Role
        <select value={nextRole} onChange={(event) => setNextRole(event.target.value as Role)}>
          {ROLES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <button type="submit" disabled={pending}>Update role</button>
    </form>
  )
}
