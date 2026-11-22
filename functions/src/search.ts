import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getEmbeddingProvider } from './ai/embeddings'
import { requireRole } from './authz'

export const searchKnowledge = onCall(async (request) => {
  requireRole(request, ['admin', 'manager', 'member', 'viewer'])

  const query = request.data?.query
  if (typeof query !== 'string' || query.trim().length < 3 || query.length > 500) {
    throw new HttpsError('invalid-argument', 'Enter a search between 3 and 500 characters.')
  }

  const projectId = request.data?.projectId
  if (projectId !== undefined && (typeof projectId !== 'string' || !/^[A-Za-z0-9]+$/.test(projectId))) {
    throw new HttpsError('invalid-argument', 'Project id is invalid.')
  }

  const provider = getEmbeddingProvider()
  if (!provider) {
    return { status: 'embeddings_not_configured' as const, results: [] as const }
  }

  throw new HttpsError('failed-precondition', `Retrieval is not implemented for ${provider.name} yet.`)
})
