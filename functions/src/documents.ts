import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions'
import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { getEmbeddingProvider } from './ai/embeddings'
import { bucket, db } from './firebase'

const CHUNK_SIZE = 1200
const CHUNK_OVERLAP = 150
const MAX_CHUNKS = 200

function chunkText(text: string): string[] {
  const normalized = text.replace(/\u0000/g, '').trim()
  if (!normalized) return []

  const chunks: string[] = []
  let start = 0
  while (start < normalized.length && chunks.length < MAX_CHUNKS) {
    const end = Math.min(normalized.length, start + CHUNK_SIZE)
    chunks.push(normalized.slice(start, end))
    if (end === normalized.length) break
    start = end - CHUNK_OVERLAP
  }
  return chunks
}

function isTextFile(contentType: string | undefined, name: string): boolean {
  if (contentType?.startsWith('text/') || contentType === 'application/json') return true
  return /\.(md|txt|csv|json)$/i.test(name)
}

export const processUploadedDocument = onObjectFinalized(async (event) => {
  const name = event.data.name
  const match = name?.match(/^documents\/([A-Za-z0-9]+)\/([A-Za-z0-9]+)\/([^/]+)$/)
  if (!name || !match) return

  const [, projectId, documentId] = match
  const documentRef = db.collection('documents').doc(documentId)

  try {
    await documentRef.set({
      projectId,
      storagePath: name,
      status: 'processing',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })

    const existing = await db.collection('knowledgeChunks').where('documentId', '==', documentId).get()
    if (!existing.empty) {
      const batch = db.batch()
      existing.docs.forEach((chunk) => batch.delete(chunk.ref))
      await batch.commit()
    }

    const contentType = event.data.contentType
    if (!isTextFile(contentType, name)) {
      await documentRef.set({
        status: 'ready',
        extraction: 'unsupported',
        chunkCount: 0,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
      return
    }

    const [buffer] = await bucket.file(name).download()
    const chunks = chunkText(buffer.toString('utf8').slice(0, 1_000_000))
    const provider = getEmbeddingProvider()

    for (let index = 0; index < chunks.length; index += 1) {
      const chunkRef = db.collection('knowledgeChunks').doc()
      await chunkRef.set({
        documentId,
        projectId,
        text: chunks[index],
        chunkIndex: index,
        embedding: null,
        embeddingModel: provider?.name ?? null,
        createdAt: FieldValue.serverTimestamp(),
      })
    }

    await documentRef.set({
      status: 'ready',
      extraction: 'text',
      chunkCount: chunks.length,
      error: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
  } catch (error) {
    logger.error('Document processing failed', error)
    await documentRef.set({
      status: 'failed',
      error: 'Processing failed',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
  }
})
