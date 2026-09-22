import { useEffect, useState } from 'react'
import { communityBookDownloads, COMMUNITY_BOOK_DOWNLOADS_CHANGED } from '../services/communityBookDownloads'
import { formatAudioBytes, getAudioTrack } from '../services/audioCatalog'
import { useHeritageAudio } from './audio/AudioProvider'

export default function CommunityBookDownload({ contentUrl, requestOptions, bytes = 0 }) {
  const audio = useHeritageAudio()
  const [record, setRecord] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  useEffect(() => {
    let live = true
    const refresh = () => communityBookDownloads.status(contentUrl, requestOptions).then(row => { if (live) setRecord(row) }).catch(() => {})
    refresh(); window.addEventListener(COMMUNITY_BOOK_DOWNLOADS_CHANGED, refresh)
    return () => { live = false; window.removeEventListener(COMMUNITY_BOOK_DOWNLOADS_CHANGED, refresh) }
  }, [contentUrl, requestOptions])
  async function download() {
    setBusy(true); setMessage('Downloading text and audio…')
    try {
      await communityBookDownloads.download(contentUrl, requestOptions, row => setMessage(`Saved ${row.completed} of ${row.total} audio chapters…`))
      setMessage('Book and audio downloaded. You can read and listen offline on this device.')
    } catch (error) {
      setMessage(error.name === 'AbortError' ? 'Download stopped. Saved chapters are kept; resume whenever you like.' : 'Download failed. Saved chapters are kept; try again to resume.')
    } finally { setBusy(false) }
  }
  async function remove() {
    if (!record) return
    setBusy(true)
    try {
      if (getAudioTrack(audio?.state.trackId)?.community?.contentUrl === contentUrl) await audio.player.unload()
      await communityBookDownloads.remove(record.name)
      setMessage('Download removed. Your reading and listening positions are kept.')
    } catch { setMessage('Could not remove this download. Please try again.') }
    finally { setBusy(false) }
  }
  return <section className="mb-4 rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-sm text-gray-700 dark:text-gray-200" aria-label="Book download">
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={busy || record?.downloading || record?.complete} onClick={download} className="font-semibold text-primary dark:text-blue-300 disabled:opacity-60">
        {record?.complete ? 'Downloaded' : busy || record?.downloading ? 'Downloading…' : record ? 'Resume download' : `Download book & audio${bytes ? ` · ${formatAudioBytes(bytes)}` : ''}`}
      </button>
      {record && <button type="button" disabled={busy || record.downloading} onClick={remove}>Remove download</button>}
      {(busy || record?.downloading) && <button type="button" onClick={() => communityBookDownloads.stopAll()}>Stop download</button>}
    </div>
    {message && <p role="status" className="mt-2">{message}</p>}
  </section>
}
