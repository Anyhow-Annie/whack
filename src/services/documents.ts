
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { localDocuments } from '../local/memory'
import type { DocumentStatus, OrgDocument } from '../types/domain'

export function documentLabel(file: File): string {
  return file.webkitRelativePath || file.name
}

export function contentTypeFor(file: File): string | null {
  if (
    file.type === 'application/pdf' ||
    file.type === 'application/json' ||
    file.type.startsWith('text/')
  ) {
    return file.type
  }

  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'md' || extension === 'txt' || extension === 'csv') return 'text/plain'
  if (extension === 'json') return 'application/json'
  if (extension === 'pdf') return 'application/pdf'
  return null
}

export async function listDocuments(projectId: string): Promise<OrgDocument[]> {
  if (!isSupabaseConfigured()) return localDocuments(projectId)

  const { data, error } = await getSupabase()
    .from('documents')
    .select('id, project_id, title, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .returns<{
      id: string
      project_id: string | null
      title: string
      created_at: string | null
    }[]>()

  if (error) throw error

  return (data ?? []).map((item) => ({
    id: item.id,
    projectId: item.project_id ?? '',
    title: item.title,
    fileName: item.title,
    storagePath: '',
    contentType: '',
    size: 0,
    uploadedBy: '',
    status: 'uploaded' as DocumentStatus,
    createdAt: item.created_at ? new Date(item.created_at) : null,
    updatedAt: null,
  }))
}

export async function uploadProjectDocument(_input: {
  projectId: string
  file: File
  uploadedBy: string
}): Promise<void> {
  throw new Error('Document uploads are temporarily disabled for the hackathon demo.')
}
