'use client'
import { useState } from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { readAlongFolder } from '../../packages/book-readalong/index.js'
export default function BookReadAlongUpload() {
  const { id } = useDocumentInfo(),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false)
  async function upload(files: FileList | null) {
    if (!id || !files) return
    setBusy(true)
    try {
      const { readAlong, audioFiles } = await readAlongFolder(files)
      for (let i = 0; i < readAlong.chapters.length; i++) {
        const ch = readAlong.chapters[i],
          file = audioFiles.get(ch.id)!
        setStatus(
          `Uploading chapter ${i + 1} of ${readAlong.chapters.length}: ${ch.title}`,
        )
        const response = await fetch(
          `/api/community/books/${id}/audio/${ch.audioSha256}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'audio/mpeg',
              'X-File-Size': String(file.size),
            },
            body: file,
          },
        )
        if (!response.ok)
          throw new Error(
            (await response.json()).error ||
              'Audio upload failed. You can retry the folder.',
          )
      }
      const response = await fetch(`/api/community/books/${id}/readalong`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(readAlong),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setStatus(
        `Attached ${result.chapters} chapters and ${result.words} timed words. Visibility follows this book’s setting. Reload the form before making more edits.`,
      )
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section style={{ marginBlock: '2rem' }}>
      <h3>Text and audio with highlighting</h3>
      <p>
        Save the book first, then choose its read-along folder containing
        manifest.json, audio and timings. Existing audio stays attached until
        every new chapter has uploaded successfully.
      </p>
      <input
        aria-label="Read-along folder"
        type="file"
        {...{ webkitdirectory: '', directory: '' }}
        multiple
        disabled={!id || busy}
        onChange={(event) => upload(event.target.files)}
      />
      <p role="status">{status}</p>
    </section>
  )
}
