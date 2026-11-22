
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
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
  const configured = isSupabaseConfigured()
  const preview = !configured

  const [loading, setLoading] = useState(configured)
  const [user, setUser] = useState<SessionUser | null>(
    preview ? PREVIEW_USER : null,
  )
  const [employee, setEmployee] = useState<Employee | null>(
    preview ? previewEmployee() : null,
  )
  const [role, setRole] = useState<Role | null>(
    preview ? previewEmployee()?.role ?? 'admin' : null,
  )
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

  async function loadProfile() {
    const current = ++requestId.current

    try {
      const profile = await ensureEmployeeProfile()
      if (current !== requestId.current) return

      setEmployee(profile)
      setRole(parseRole(profile.role))
      setProfileError(null)
    } catch (error) {
      if (current !== requestId.current) return

      setEmployee(null)
      setRole(null)
      setProfileError(
        error instanceof Error ? error.message : 'Could not load your profile.',
      )
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (!configured) return

    const supabase = getSupabase()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user

      if (!nextUser) {
        requestId.current++
        setUser(null)
        setEmployee(null)
        setRole(null)
        setProfileError(null)
        setLoading(false)
        return
      }

      setUser({
        uid: nextUser.id,
        email: nextUser.email ?? null,
        displayName:
          nextUser.user_metadata?.name ??
          nextUser.user_metadata?.full_name ??
          null,
      })

      if (
        event === 'INITIAL_SESSION' ||
        event === 'SIGNED_IN' ||
        event === 'USER_UPDATED'
      ) {
        setLoading(true)
        void loadProfile()
      }
    })

    return () => subscription.unsubscribe()
  }, [configured])

  const value = useMemo<AuthContextValue>(() => ({
    configured,
    preview,
    missingEnv: configured
      ? []
      : ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    useEmulators: false,
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

      const { data, error } = await getSupabase().auth.getUser()
      if (error) throw error
      if (!data.user) return

      const profile = await getEmployee(data.user.id)
      setEmployee(profile)
      setRole(profile ? parseRole(profile.role) : null)
    },

    async signOutUser() {
      if (preview) {
        setUser(null)
        setEmployee(null)
        setRole(null)
        return
      }

      const { error } = await getSupabase().auth.signOut()
      if (error) throw error
    },

    async reloadEmployee() {
      if (!user) return

      const profile = await getEmployee(user.uid)
      setEmployee(profile)
      setRole(profile ? parseRole(profile.role) : null)
    },
  }), [configured, preview, loading, user, employee, role, profileError])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
