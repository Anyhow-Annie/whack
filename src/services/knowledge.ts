import { collection, doc, getDocs, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore'
import { getServices, isLocalPreview } from '../lib/firebase'
import { localAddUpdate, localCreateRelationship, localRelationships, localUpdates } from '../local/memory'
import type { KnowledgeNodeType, KnowledgeRelationship, ProjectUpdate, RelationshipKind } from '../types/domain'

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null
}

export async function listProjectUpdates(projectId: string): Promise<ProjectUpdate[]> {
  if (isLocalPreview()) return localUpdates(projectId)
  const snapshot = await getDocs(
    query(collection(getServices().db, 'projectUpdates'), where('projectId', '==', projectId)),
  )
  return snapshot.docs
    .map((item) => {
      const data = item.data()
      return {
        id: item.id,
        projectId: String(data.projectId ?? ''),
        authorId: String(data.authorId ?? ''),
        authorName: String(data.authorName ?? ''),
        body: String(data.body ?? ''),
        createdAt: toDate(data.createdAt),
      }
    })
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

export async function addProjectUpdate(input: {
  projectId: string
  authorId: string
  authorName: string
  body: string
}): Promise<void> {
  if (isLocalPreview()) {
    localAddUpdate(input)
    return
  }
  const ref = doc(collection(getServices().db, 'projectUpdates'))
  await setDoc(ref, {
    projectId: input.projectId,
    authorId: input.authorId,
    authorName: input.authorName.trim() || 'Employee',
    body: input.body.trim(),
    createdAt: serverTimestamp(),
  })
}

export async function listRelationships(): Promise<KnowledgeRelationship[]> {
  if (isLocalPreview()) return localRelationships()
  const snapshot = await getDocs(collection(getServices().db, 'knowledgeRelationships'))
  return snapshot.docs.map((item) => {
    const data = item.data()
    return {
      id: item.id,
      fromType: data.fromType as KnowledgeNodeType,
      fromId: String(data.fromId ?? ''),
      toType: data.toType as KnowledgeNodeType,
      toId: String(data.toId ?? ''),
      kind: data.kind as RelationshipKind,
      createdBy: String(data.createdBy ?? ''),
      createdAt: toDate(data.createdAt),
    }
  })
}

export async function createRelationship(input: {
  fromType: KnowledgeNodeType
  fromId: string
  toType: KnowledgeNodeType
  toId: string
  kind: RelationshipKind
  createdBy: string
}): Promise<void> {
  if (isLocalPreview()) {
    localCreateRelationship(input)
    return
  }
  const ref = doc(collection(getServices().db, 'knowledgeRelationships'))
  await setDoc(ref, {
    ...input,
    createdAt: serverTimestamp(),
  })
}
