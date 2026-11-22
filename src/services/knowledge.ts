
import {
  localAddUpdate,
  localCreateRelationship,
  localRelationships,
  localUpdates,
} from '../local/memory'
import { isSupabaseConfigured } from '../lib/supabase'
import type {
  KnowledgeNodeType,
  KnowledgeRelationship,
  ProjectUpdate,
  RelationshipKind,
} from '../types/domain'

export async function listProjectUpdates(projectId: string): Promise<ProjectUpdate[]> {
  if (!isSupabaseConfigured()) return localUpdates(projectId)
  return []
}

export async function addProjectUpdate(input: {
  projectId: string
  authorId: string
  authorName: string
  body: string
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    localAddUpdate(input)
    return
  }
  throw new Error('Project updates are disabled in this demo.')
}

export async function listRelationships(): Promise<KnowledgeRelationship[]> {
  if (!isSupabaseConfigured()) return localRelationships()
  return []
}

export async function createRelationship(input: {
  fromType: KnowledgeNodeType
  fromId: string
  toType: KnowledgeNodeType
  toId: string
  kind: RelationshipKind
  createdBy: string
}): Promise<void> {
  if (!isSupabaseConfigured()) {
    localCreateRelationship(input)
    return
  }
  throw new Error('Relationship editing is disabled in this demo.')
}
