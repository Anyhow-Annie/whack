
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import {
  localAddProjectMember,
  localCreateProject,
  localProjects,
} from '../local/memory'
import type { Project } from '../types/domain'

export async function listProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured()) return localProjects()

  const supabase = getSupabase()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) throw authError
  if (!user) return []

  const { data, error } = await supabase
    .from('projects')
    .select('id, title, description, created_at')
    .order('created_at', { ascending: false })
    .returns<{
      id: string
      title: string
      description: string | null
      created_at: string | null
    }[]>()

  if (error) throw error

  return (data ?? []).map((item) => ({
    id: item.id,
    name: item.title,
    description: item.description ?? '',
    status: 'active',
    ownerId: '',
    memberIds: [user.id],
    createdAt: item.created_at ? new Date(item.created_at) : null,
    updatedAt: null,
  }))
}

export async function createProject(input: {
  name: string
  description: string
  ownerId: string
}): Promise<string> {
  if (!isSupabaseConfigured()) return localCreateProject(input)

  throw new Error(
    'Project creation is not enabled yet. It requires a secure database operation.',
  )
}

export async function addProjectMember(
  project: Project,
  memberId: string,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    localAddProjectMember(project.id, memberId)
    return
  }

  throw new Error(
    'Adding project members is not enabled yet. It requires a secure database operation.',
  )
}
