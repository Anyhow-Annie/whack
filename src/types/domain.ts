export const ROLES = ['admin', 'manager', 'member', 'viewer'] as const

export type Role = (typeof ROLES)[number]

export type Employee = {
  uid: string
  email: string
  displayName: string
  title: string
  department: string
  role: Role
  createdAt: Date | null
  updatedAt: Date | null
}

export type ProjectStatus = 'active' | 'archived'

export type Project = {
  id: string
  name: string
  description: string
  status: ProjectStatus
  ownerId: string
  memberIds: string[]
  createdAt: Date | null
  updatedAt: Date | null
}

export type DocumentStatus = 'pending' | 'uploaded' | 'processing' | 'ready' | 'failed'
export type ExtractionStatus = 'text' | 'unsupported'

export type OrgDocument = {
  id: string
  projectId: string
  title: string
  fileName: string
  storagePath: string
  contentType: string
  size: number
  uploadedBy: string
  status: DocumentStatus
  extraction?: ExtractionStatus
  chunkCount?: number
  error?: string
  createdAt: Date | null
  updatedAt: Date | null
}

export type KnowledgeChunk = {
  id: string
  documentId: string
  projectId: string
  text: string
  chunkIndex: number
  embedding: number[] | null
  embeddingModel: string | null
  createdAt: Date | null
}

export type ProjectUpdate = {
  id: string
  projectId: string
  authorId: string
  authorName: string
  body: string
  createdAt: Date | null
}

export type KnowledgeNodeType = 'project' | 'document' | 'chunk' | 'employee'
export type RelationshipKind = 'related' | 'depends_on' | 'continues' | 'references'

export type KnowledgeRelationship = {
  id: string
  fromType: KnowledgeNodeType
  fromId: string
  toType: KnowledgeNodeType
  toId: string
  kind: RelationshipKind
  createdBy: string
  createdAt: Date | null
}

export type SearchResponse = {
  status: 'embeddings_not_configured'
  results: []
}
