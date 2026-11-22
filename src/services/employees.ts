
import { getSupabase } from '../lib/supabase'
import { localEmployee, localEmployees } from '../local/memory'
import type { Employee } from '../types/domain'
import { isSupabaseConfigured } from '../lib/supabase'
import { parseRole } from '../auth/access'

function toEmployee(data: Record<string, unknown>): Employee {
  return {
    uid: String(data.id),
    email: String(data.email ?? ''),
    displayName: String(data.name ?? ''),
    title: '',
    department: String(data.department ?? ''),
    role: parseRole(data.role) ?? 'viewer',
    createdAt: data.created_at ? new Date(String(data.created_at)) : null,
    updatedAt: null,
  }
}

export async function getEmployee(uid: string): Promise<Employee | null> {
  if (!isSupabaseConfigured()) return localEmployee(uid)

  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .maybeSingle()

  if (error) throw error
  return data ? toEmployee(data) : null
}

export async function listEmployees(): Promise<Employee[]> {
  if (!isSupabaseConfigured()) return localEmployees()

  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .order('email')

  if (error) throw error
  return (data ?? []).map((item) => toEmployee(item))
}

export async function ensureEmployeeProfile(): Promise<Employee> {
  const { data: { user }, error: authError } = await getSupabase().auth.getUser()

  if (authError) throw authError
  if (!user) throw new Error('You must sign in first.')

  const profile = await getEmployee(user.id)
  if (!profile) throw new Error('Your employee profile has not been created yet.')

  return profile
}

export async function updateEmployeeProfile(
  _uid: string,
  _input: { displayName: string; title: string; department: string },
): Promise<void> {
  throw new Error('Profile editing is not available in this demo yet.')
}
