import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { getServices, isLocalPreview } from '../lib/firebase'
import { localAddProjectMember, localCreateProject, localProjects } from '../local/memory'
import type { Project, ProjectStatus } from '../types/domain'

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null
}

function toProject(id: string, data: Record<string, unknown>): Project {
  const status: ProjectStatus = data.status === 'archived' ? 'archived' : 'active'
  return {
    id,
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    status,
    ownerId: String(data.ownerId ?? ''),
    memberIds: Array.isArray(data.memberIds) ? data.memberIds.map(String) : [],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

export async function listProjects(): Promise<Project[]> {
  if (isLocalPreview()) return localProjects()
  const snapshot = await getDocs(collection(getServices().db, 'projects'))
  return snapshot.docs
    .map((item) => toProject(item.id, item.data()))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

export async function createProject(input: {
  name: string
  description: string
  ownerId: string
}): Promise<string> {
  if (isLocalPreview()) return localCreateProject(input)
  const ref = doc(collection(getServices().db, 'projects'))
  await setDoc(ref, {
    name: input.name.trim(),
    description: input.description.trim(),
    status: 'active',
    ownerId: input.ownerId,
    memberIds: [input.ownerId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function addProjectMember(project: Project, memberId: string): Promise<void> {
  if (isLocalPreview()) {
    localAddProjectMember(project.id, memberId)
    return
  }
  const memberIds = project.memberIds.includes(memberId)
    ? project.memberIds
    : [...project.memberIds, memberId]
  await updateDoc(doc(getServices().db, 'projects', project.id), {
    memberIds,
    updatedAt: serverTimestamp(),
  })
}
