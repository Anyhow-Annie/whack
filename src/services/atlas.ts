import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import type { OrgDocument } from '../types/domain'
import { listDocuments } from './documents'
import { listEmployees } from './employees'

export type AtlasDocument = Pick<
  OrgDocument,
  'id' | 'title' | 'projectId' | 'createdAt'
> & {
  department: string
  subcategory: string
  season: string
  production: string
  venue: string
  documentType: string
}

export async function listAtlasDocuments(projectIds: string[]): Promise<AtlasDocument[]> {
  if (!isSupabaseConfigured()) {
    const groups = await Promise.all(projectIds.map((id) => listDocuments(id)))
    return groups.flat().map((doc) => ({
      ...doc,
      department: '',
      subcategory: '',
      season: '',
      production: '',
      venue: '',
      documentType: '',
    }))
  }

  const { data, error } = await getSupabase()
    .from('documents')
    .select('id, title, project_id, created_at, department, subcategory, season, production, venue, document_type')
    .order('created_at', { ascending: false })
    .returns<{
      id: string
      title: string
      project_id: string | null
      created_at: string | null
      department: string | null
      subcategory: string | null
      season: string | null
      production: string | null
      venue: string | null
      document_type: string | null
    }[]>()

  if (error) throw error

  return (data ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    projectId: item.project_id ?? '',
    createdAt: item.created_at ? new Date(item.created_at) : null,
    department: item.department ?? '',
    subcategory: item.subcategory ?? '',
    season: item.season ?? '',
    production: item.production ?? '',
    venue: item.venue ?? '',
    documentType: item.document_type ?? '',
  }))
}

export async function listAtlasPeople() {
  return listEmployees()
}
