import { httpsCallable } from 'firebase/functions'
import { getServices, isLocalPreview } from '../lib/firebase'
import { localClaimAdmin, localSearch, localSetRole } from '../local/memory'
import type { Role, SearchResponse } from '../types/domain'

export async function claimInitialAdmin(): Promise<void> {
  if (isLocalPreview()) {
    localClaimAdmin()
    return
  }
  const callable = httpsCallable(getServices().functions, 'claimInitialAdmin')
  await callable()
}

export async function setEmployeeRole(uid: string, role: Role): Promise<void> {
  if (isLocalPreview()) {
    localSetRole(uid, role)
    return
  }
  const callable = httpsCallable(getServices().functions, 'setEmployeeRole')
  await callable({ uid, role })
}

export async function searchKnowledge(query: string, projectId?: string): Promise<SearchResponse> {
  if (isLocalPreview()) return localSearch()
  const callable = httpsCallable(getServices().functions, 'searchKnowledge')
  const result = await callable({ query, projectId })
  const data = result.data
  if (
    data
    && typeof data === 'object'
    && 'status' in data
    && (data as { status: unknown }).status === 'embeddings_not_configured'
  ) {
    return { status: 'embeddings_not_configured', results: [] }
  }
  throw new Error('Unexpected response from searchKnowledge.')
}
