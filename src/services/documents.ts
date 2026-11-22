import { collection, doc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore'
import { ref, uploadBytes } from 'firebase/storage'
import { getServices, isLocalPreview } from '../lib/firebase'
import { localDocuments, localUploadDocument } from '../local/memory'
import type { DocumentStatus, ExtractionStatus, OrgDocument } from '../types/domain'

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null
}

function toDocument(id: string, data: Record<string, unknown>): OrgDocument {
  const extraction = data.extraction === 'text' || data.extraction === 'unsupported'
    ? data.extraction as ExtractionStatus
    : undefined
  return {
    id,
    projectId: String(data.projectId ?? ''),
    title: String(data.title ?? ''),
    fileName: String(data.fileName ?? ''),
    storagePath: String(data.storagePath ?? ''),
    contentType: String(data.contentType ?? ''),
    size: typeof data.size === 'number' ? data.size : 0,
    uploadedBy: String(data.uploadedBy ?? ''),
    status: (data.status as DocumentStatus) ?? 'pending',
    extraction,
    chunkCount: typeof data.chunkCount === 'number' ? data.chunkCount : undefined,
    error: typeof data.error === 'string' ? data.error : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

export function documentLabel(file: File): string {
  return file.webkitRelativePath || file.name
}

export function contentTypeFor(file: File): string | null {
  if (file.type === 'application/pdf' || file.type === 'application/json' || file.type.startsWith('text/')) {
    return file.type
  }
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'md' || extension === 'txt' || extension === 'csv') return 'text/plain'
  if (extension === 'json') return 'application/json'
  if (extension === 'pdf') return 'application/pdf'
  return null
}

export async function listDocuments(projectId: string): Promise<OrgDocument[]> {
  if (isLocalPreview()) return localDocuments(projectId)
  const snapshot = await getDocs(
    query(collection(getServices().db, 'documents'), where('projectId', '==', projectId)),
  )
  return snapshot.docs
    .map((item) => toDocument(item.id, item.data()))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

export async function uploadProjectDocument(input: {
  projectId: string
  file: File
  uploadedBy: string
}): Promise<void> {
  const contentType = contentTypeFor(input.file)
  if (isLocalPreview()) {
    if (!contentType) throw new Error('Upload a text, Markdown, CSV, JSON, or PDF file.')
    if (input.file.size <= 0 || input.file.size >= 20 * 1024 * 1024) {
      throw new Error('Files must be under 20 MB.')
    }
    localUploadDocument(input)
    return
  }
  if (!contentType) {
    throw new Error('Upload a text, Markdown, CSV, JSON, or PDF file.')
  }
  if (input.file.size <= 0 || input.file.size >= 20 * 1024 * 1024) {
    throw new Error('Files must be under 20 MB.')
  }

  const fileName = input.file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 180)
  const documentRef = doc(collection(getServices().db, 'documents'))
  const storagePath = `documents/${input.projectId}/${documentRef.id}/${fileName}`
  const title = documentLabel(input.file).replace(/\.[^.]+$/, '').slice(0, 180) || fileName

  await setDoc(documentRef, {
    projectId: input.projectId,
    title,
    fileName,
    storagePath,
    contentType,
    size: input.file.size,
    uploadedBy: input.uploadedBy,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await uploadBytes(ref(getServices().storage, storagePath), input.file, {
    contentType,
    customMetadata: {
      uploadedBy: input.uploadedBy,
      documentId: documentRef.id,
    },
  })

  await updateDoc(documentRef, {
    status: 'uploaded',
    updatedAt: serverTimestamp(),
  })
}
