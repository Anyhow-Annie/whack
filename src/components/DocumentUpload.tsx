import { useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { contentTypeFor, documentLabel, uploadProjectDocument } from '../services/documents'

type DocumentUploadProps = {
  projectId: string
  uploadedBy: string
  onUploaded: () => Promise<void>
}

const ACCEPT = '.txt,.md,.csv,.json,.pdf,text/plain,text/markdown,text/csv,application/json,application/pdf'
const MAX_BYTES = 20 * 1024 * 1024

function chooseFiles(list: FileList | null): { accepted: File[]; skipped: string[] } {
  const accepted: File[] = []
  const skipped: string[] = []
  for (const file of Array.from(list ?? [])) {
    const label = documentLabel(file)
    if (file.name.startsWith('.') || !contentTypeFor(file) || file.size <= 0 || file.size >= MAX_BYTES) {
      skipped.push(label)
      continue
    }
    accepted.push(file)
  }
  return { accepted, skipped }
}

export function DocumentUpload({ projectId, uploadedBy, onUploaded }: DocumentUploadProps) {
  const { preview } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [skipped, setSkipped] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function onChoose(list: FileList | null) {
    const next = chooseFiles(list)
    setFiles(next.accepted)
    setSkipped(next.skipped)
    setError(null)
    setNotice(null)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (files.length === 0) return
    setPending(true)
    setError(null)
    setNotice(null)
    const failures: string[] = []
    let uploaded = 0
    try {
      for (const [index, file] of files.entries()) {
        setProgress(`Uploading ${index + 1} of ${files.length}…`)
        try {
          await uploadProjectDocument({ projectId, file, uploadedBy })
          uploaded += 1
        } catch (caught) {
          const reason = caught instanceof Error ? caught.message : 'Upload failed.'
          failures.push(`${documentLabel(file)}: ${reason}`)
        }
      }
      if (uploaded > 0) await onUploaded()
      if (failures.length > 0) {
        setError(failures.join(' '))
      } else if (uploaded === 0) {
        setError('None of the files in that folder could be uploaded.')
      } else {
        setNotice(uploaded === 1 ? 'Uploaded 1 file.' : `Uploaded ${uploaded} files.`)
      }
      setFiles([])
      setSkipped([])
      if (inputRef.current) inputRef.current.value = ''
    } finally {
      setPending(false)
      setProgress(null)
    }
  }

  const readyLabel = files.length === 1 ? '1 file ready' : `${files.length} files ready`

  return (
    <form onSubmit={onSubmit}>
      <h2>Upload documents</h2>
      <p className="meta">
        {preview
          ? 'Choose a folder. Supported files stay in this browser tab and are not sent to Cloud Storage.'
          : 'Choose a folder. Supported files go to Cloud Storage. A Cloud Function chunks text files and leaves embeddings empty until an AI provider is connected.'}
        {' '}Text, Markdown, CSV, JSON, and PDF files are included, even in subfolders. Other files are skipped.
      </p>
      <label>
        Folder
        <input
          ref={(node) => {
            inputRef.current = node
            node?.setAttribute('webkitdirectory', '')
            node?.setAttribute('directory', '')
          }}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(event) => onChoose(event.target.files)}
        />
      </label>
      {files.length > 0 ? (
        <>
          <p className="meta">{readyLabel}</p>
          <ul className="project-list">
            {files.slice(0, 8).map((file) => (
              <li key={documentLabel(file)} className="meta">{documentLabel(file)}</li>
            ))}
          </ul>
          {files.length > 8 ? <p className="meta">and {files.length - 8} more</p> : null}
        </>
      ) : null}
      {skipped.length > 0 ? (
        <p className="meta">
          Skipped {skipped.length === 1 ? '1 unsupported file' : `${skipped.length} unsupported files`}: {skipped.slice(0, 5).join(', ')}
          {skipped.length > 5 ? '…' : ''}
        </p>
      ) : null}
      {notice ? <p className="banner">{notice}</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
      <button type="submit" disabled={files.length === 0 || pending}>
        {progress ?? (files.length > 1 ? 'Upload folder' : 'Upload')}
      </button>
    </form>
  )
}
