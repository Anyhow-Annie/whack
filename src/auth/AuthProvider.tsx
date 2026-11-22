import { onAuthStateChanged, signOut } from 'firebase/auth'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getServices, readFirebaseConfig } from '../lib/firebase'
import { localEmployee, PREVIEW_USER } from '../local/memory'
import { ensureEmployeeProfile, getEmployee } from '../services/employees'
import type { Employee, Role } from '../types/domain'
import { parseRole } from './access'

export type SessionUser = {
  uid: string
  email: string | null
  displayName: string | null
}

type AuthContextValue = {
  configured: boolean
  preview: boolean
  missingEnv: string[]
  useEmulators: boolean
  loading: boolean
  user: SessionUser | null
  employee: Employee | null
  role: Role | null
  profileError: string | null
  enterPreview: () => void
  refreshAccess: () => Promise<void>
  signOutUser: () => Promise<void>
  reloadEmployee: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function previewEmployee(): Employee | null {
  return localEmployee(PREVIEW_USER.uid)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [config] = useState(readFirebaseConfig)
  const preview = !config.ok
  const [loading, setLoading] = useState(config.ok)
  const [user, setUser] = useState<SessionUser | null>(preview ? PREVIEW_USER : null)
  const [employee, setEmployee] = useState<Employee | null>(preview ? previewEmployee() : null)
  const [role, setRole] = useState<Role | null>(preview ? previewEmployee()?.role ?? 'admin' : null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const requestId = useRef(0)

  function applyPreviewSession() {
    const profile = previewEmployee()
    setUser(PREVIEW_USER)
    setEmployee(profile)
    setRole(profile?.role ?? 'admin')
    setProfileError(null)
    setLoading(false)
  }

  useEffect(() => {
    if (!config.ok) return
    const auth = getServices().auth
    return onAuthStateChanged(auth, (nextUser) => {
      const current = ++requestId.current
      if (!nextUser) {
        setUser(null)
        setEmployee(null)
        setRole(null)
        setProfileError(null)
        setLoading(false)
        return
      }

      setUser({ uid: nextUser.uid, email: nextUser.email, displayName: nextUser.displayName })
      void (async () => {
        try {
          const profile = await ensureEmployeeProfile(nextUser)
          const token = await nextUser.getIdTokenResult()
          if (current !== requestId.current) return
          setEmployee(profile)
          setRole(parseRole(token.claims.role))
          setProfileError(null)
        } catch (error) {
          if (current !== requestId.current) return
          setEmployee(null)
          setRole(null)
          setProfileError(error instanceof Error ? error.message : 'Could not load your profile.')
        } finally {
          if (current === requestId.current) setLoading(false)
        }
      })()
    })
  }, [config.ok])

  const value = useMemo<AuthContextValue>(() => ({
    configured: config.ok,
    preview,
    missingEnv: config.ok ? [] : config.missing,
    useEmulators: config.ok ? config.useEmulators : false,
    loading,
    user,
    employee,
    role,
    profileError,
    enterPreview() {
      applyPreviewSession()
    },
    async refreshAccess() {
      if (preview) {
        applyPreviewSession()
        return
      }
      const currentUser = getServices().auth.currentUser
      if (!currentUser) return
      const token = await currentUser.getIdTokenResult(true)
      setRole(parseRole(token.claims.role))
      setEmployee(await getEmployee(currentUser.uid))
    },
    async signOutUser() {
      if (preview) {
        setUser(null)
        setEmployee(null)
        setRole(null)
        return
      }
      await signOut(getServices().auth)
    },
    async reloadEmployee() {
      if (!user) return
      setEmployee(await getEmployee(user.uid))
    },
  }), [config, preview, loading, user, employee, role, profileError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
