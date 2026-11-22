
import { isSupabaseConfigured } from '../lib/supabase'
import {
  localClaimAdmin,
  localSearch,
  localSetRole,
} from '../local/memory'
import type { Role, SearchResponse } from '../types/domain'

export async function claimInitialAdmin(): Promise<void> {
  if (!isSupabaseConfigured()) {
    localClaimAdmin()
    return
  }
  throw new Error('Admin setup is disabled in this demo.')
}

export async function setEmployeeRole(uid: string, role: Role): Promise<void> {
  if (!isSupabaseConfigured()) {
    localSetRole(uid, role)
    return
  }
  throw new Error('Role editing is disabled in this demo.')
}

export async function searchKnowledge(
  _query: string,
  _projectId?: string,
): Promise<SearchResponse> {
  if (!isSupabaseConfigured()) return localSearch()

  return {
    status: 'embeddings_not_configured',
    results: [],
  }
}
