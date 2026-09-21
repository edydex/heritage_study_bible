import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAudioDownloads } from './BookAudioPanel'
import { useHeritageAudio } from './AudioProvider'
import { canUseNativeAudioDownloads, deleteDownloadedAudio } from '../../services/audioDownloads'
import { formatAudioBytes } from '../../services/audioCatalog'

export default function InternalStorage() {
  const navigate = useNavigate()
  const audio = useHeritageAudio()
  const { downloads, error } = useAudioDownloads()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(null)
  async function remove(records) {
    setPending(null); setBusy(true); setMessage('')
    try {
      for (const record of records) {
        if (audio?.state.trackId === record.trackId && audio.state.offline) await audio.player.unload()
        await deleteDownloadedAudio(record.trackId)
      }
      setMessage('Downloaded audio removed. Your listening positions are kept.')
    } catch { setMessage('Some audio could not be removed. The list shows the remaining saved recordings.') }
    finally { setBusy(false) }
  }
  const grouped = downloads.reduce((groups, record) => {
    const id = record.bookId || 'legacy'
    ;(groups[id] ||= []).push(record)
    return groups
  }, {})
  return <main className="audio-library min-h-screen dark:bg-gray-900">
    <header><button type="button" onClick={() => navigate('/settings/advanced')}>← Settings</button><h1>Internal Storage</h1></header>
    <h2>Downloaded audio</h2><p>{downloads.length} tracks · {formatAudioBytes(downloads.reduce((sum, record) => sum + (record.bytes || 0), 0))}</p>
    <p>Remove downloaded recordings to free space. Your notes, book text and listening positions stay on this device.</p>
    {!canUseNativeAudioDownloads() && <p className="mt-4">Offline audio downloads are available in the Android app. Browser playback streams the recording.</p>}
    {downloads.length > 0 && <button type="button" className="mt-4" disabled={busy} onClick={() => setPending(downloads)}>Delete all downloaded audio</button>}
    {pending && <section role="alertdialog" aria-label="Delete downloaded audio"><p>Delete {pending.length} downloaded {pending.length === 1 ? 'track' : 'tracks'}? You can download them again.</p><div className="audio-actions"><button type="button" onClick={() => remove(pending)}>Delete</button><button type="button" onClick={() => setPending(null)}>Cancel</button></div></section>}
    {(message || error) && <p role="status" className="mt-4">{message || error}</p>}
    {Object.entries(grouped).map(([id, records]) => <section key={id}><h2>{records[0].bookTitle || id}</h2>
      <ul>{records.map(record => <li key={record.trackId}><div>{record.label}<small>{record.bytes ? formatAudioBytes(record.bytes) : 'Saved with an earlier app version'}</small></div><button type="button" disabled={busy} onClick={() => setPending([record])} aria-label={`Delete ${record.label}`}>Delete</button></li>)}</ul>
    </section>)}
    <button type="button" className="mt-4" onClick={() => navigate('/audio')}>Open audio library</button>
  </main>
}
