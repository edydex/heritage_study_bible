import { useEffect, useMemo, useState } from 'react'
import { BookReader } from './BookViewer'
import CommunityBookDownload from './CommunityBookDownload'
import { registerCommunityAudio } from '../services/communityAudio'

export default function CommunityBookReadAlong({ document, item, contentUrl, requestOptions }) {
  const [ready, setReady] = useState(false), [error, setError] = useState('')
  const book = useMemo(() => ({ ...item, ...document, id: item.contentKey || item.id, year: document.publishedYear || null, editionLabel: document.readAlong.synthetic ? `Synthetic narration · ${document.readAlong.voice} · ${document.readAlong.license}` : document.license }), [document, item])
  const chapters = useMemo(() => document.readAlong.chapters.map(chapter => ({ title: chapter.title, paragraphs: chapter.paragraphs.map(paragraph => paragraph.text) })), [document])
  useEffect(() => {
    let live = true
    registerCommunityAudio(document, item, requestOptions).then(() => { if (live) setReady(true) }).catch(() => { if (live) { setReady(true); setError('Audio library could not be updated. Reopen the book to retry.') } })
    return () => { live = false }
  }, [document, item, requestOptions])
  if (!ready) return <p role="status" className="p-6">Opening book…</p>
  return <BookReader key={book.id} resourceBook={book} resourceChapters={chapters} downloadControls={<>
    {error && <p role="status">{error}</p>}
    <CommunityBookDownload contentUrl={contentUrl} requestOptions={requestOptions} bytes={document.readAlong.chapters.reduce((sum, chapter) => sum + chapter.audioSize, 0)} />
  </>} />
}
