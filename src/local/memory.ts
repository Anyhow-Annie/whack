import type {
  Employee,
  KnowledgeRelationship,
  OrgDocument,
  Project,
  ProjectUpdate,
  RelationshipKind,
  Role,
  SearchResponse,
} from '../types/domain'

export const PREVIEW_USER = {
  uid: 'preview-user',
  email: 'preview@local.test',
  displayName: 'Preview employee',
}

type Memory = {
  employees: Employee[]
  projects: Project[]
  documents: OrgDocument[]
  updates: ProjectUpdate[]
  relationships: KnowledgeRelationship[]
}

function seed(): Memory {
  const createdAt = new Date('2026-03-02T15:00:00Z')
  return {
    employees: [{
      uid: PREVIEW_USER.uid,
      email: PREVIEW_USER.email,
      displayName: PREVIEW_USER.displayName,
      title: 'Knowledge lead',
      department: 'Operations',
      role: 'admin',
      createdAt,
      updatedAt: createdAt,
    }],
    projects: [
      {
        id: 'project-onboarding',
        name: 'Employee onboarding',
        description: 'How a new hire finds the accounts, rituals, and documents for their first month.',
        status: 'active',
        ownerId: PREVIEW_USER.uid,
        memberIds: [PREVIEW_USER.uid],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: 'project-launch',
        name: 'Northwind launch',
        description: 'Decisions from the last client launch, kept so the next team does not rediscover them.',
        status: 'active',
        ownerId: PREVIEW_USER.uid,
        memberIds: [PREVIEW_USER.uid],
        createdAt,
        updatedAt: createdAt,
      },
    ],
    documents: [{
      id: 'doc-handbook',
      projectId: 'project-onboarding',
      title: 'First-month handbook',
      fileName: 'first-month-handbook.md',
      storagePath: 'local/project-onboarding/doc-handbook/first-month-handbook.md',
      contentType: 'text/markdown',
      size: 2400,
      uploadedBy: PREVIEW_USER.uid,
      status: 'ready',
      extraction: 'text',
      chunkCount: 0,
      createdAt,
      updatedAt: createdAt,
    }],
    updates: [{
      id: 'update-welcome',
      projectId: 'project-onboarding',
      authorId: PREVIEW_USER.uid,
      authorName: PREVIEW_USER.displayName,
      body: 'The handbook is the source of truth for account access. Add a note here when that process changes.',
      createdAt,
    }],
    relationships: [{
      id: 'link-onboarding-launch',
      fromType: 'project',
      fromId: 'project-onboarding',
      toType: 'project',
      toId: 'project-launch',
      kind: 'related',
      createdBy: PREVIEW_USER.uid,
      createdAt,
    }],
  }
}

const memory = seed()

function nextId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function copyEmployee(employee: Employee): Employee {
  return { ...employee }
}

function copyProject(project: Project): Project {
  return { ...project, memberIds: [...project.memberIds] }
}

function copyDocument(document: OrgDocument): OrgDocument {
  return { ...document }
}

function copyUpdate(update: ProjectUpdate): ProjectUpdate {
  return { ...update }
}

function copyRelationship(relationship: KnowledgeRelationship): KnowledgeRelationship {
  return { ...relationship }
}

export function localEmployees(): Employee[] {
  return memory.employees.map(copyEmployee).sort((a, b) => a.email.localeCompare(b.email))
}

export function localEmployee(uid: string): Employee | null {
  const employee = memory.employees.find((item) => item.uid === uid)
  return employee ? copyEmployee(employee) : null
}

export function localUpdateEmployee(
  uid: string,
  input: { displayName: string; title: string; department: string },
): void {
  const employee = localEmployee(uid)
  if (!employee) return
  employee.displayName = input.displayName.trim()
  employee.title = input.title.trim()
  employee.department = input.department.trim()
  employee.updatedAt = new Date()
}

export function localProjects(): Project[] {
  return memory.projects
    .map(copyProject)
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

export function localCreateProject(input: { name: string; description: string; ownerId: string }): string {
  const id = nextId('project')
  const now = new Date()
  memory.projects.push({
    id,
    name: input.name.trim(),
    description: input.description.trim(),
    status: 'active',
    ownerId: input.ownerId,
    memberIds: [input.ownerId],
    createdAt: now,
    updatedAt: now,
  })
  return id
}

export function localAddProjectMember(projectId: string, memberId: string): void {
  const project = memory.projects.find((item) => item.id === projectId)
  if (!project || project.memberIds.includes(memberId)) return
  project.memberIds = [...project.memberIds, memberId]
  project.updatedAt = new Date()
}

export function localDocuments(projectId: string): OrgDocument[] {
  return memory.documents
    .filter((document) => document.projectId === projectId)
    .map(copyDocument)
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

export function localUploadDocument(input: {
  projectId: string
  file: File
  uploadedBy: string
}): void {
  const now = new Date()
  const id = nextId('doc')
  const fileName = input.file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 180)
  const sourceName = input.file.webkitRelativePath || input.file.name
  memory.documents.push({
    id,
    projectId: input.projectId,
    title: sourceName.replace(/\.[^.]+$/, '').slice(0, 180) || fileName,
    fileName,
    storagePath: `local/${input.projectId}/${id}/${fileName}`,
    contentType: input.file.type || 'application/octet-stream',
    size: input.file.size,
    uploadedBy: input.uploadedBy,
    status: 'uploaded',
    createdAt: now,
    updatedAt: now,
  })
}

export function localUpdates(projectId: string): ProjectUpdate[] {
  return memory.updates
    .filter((update) => update.projectId === projectId)
    .map(copyUpdate)
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

export function localAddUpdate(input: {
  projectId: string
  authorId: string
  authorName: string
  body: string
}): void {
  memory.updates.push({
    id: nextId('update'),
    projectId: input.projectId,
    authorId: input.authorId,
    authorName: input.authorName.trim() || 'Employee',
    body: input.body.trim(),
    createdAt: new Date(),
  })
}

export function localRelationships(): KnowledgeRelationship[] {
  return memory.relationships.map(copyRelationship)
}

export function localCreateRelationship(input: {
  fromType: KnowledgeRelationship['fromType']
  fromId: string
  toType: KnowledgeRelationship['toType']
  toId: string
  kind: RelationshipKind
  createdBy: string
}): void {
  memory.relationships.push({
    id: nextId('link'),
    ...input,
    createdAt: new Date(),
  })
}

export function localClaimAdmin(): void {
  const employee = localEmployee(PREVIEW_USER.uid)
  if (employee) employee.role = 'admin'
}

export function localSetRole(uid: string, role: Role): void {
  const existing = localEmployee(uid)
  if (existing) {
    existing.role = role
    existing.updatedAt = new Date()
    return
  }
  const now = new Date()
  memory.employees.push({
    uid,
    email: '',
    displayName: uid,
    title: '',
    department: '',
    role,
    createdAt: now,
    updatedAt: now,
  })
}

export function localSearch(): SearchResponse {
  return { status: 'embeddings_not_configured', results: [] }
}
