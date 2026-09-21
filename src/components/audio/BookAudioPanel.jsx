import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useHeritageAudio } from './AudioProvider'
import { audioBooks, formatAudioBytes, formatAudioTime, getBookAudioTracks } from '../../services/audioCatalog'
import { AUDIO_DOWNLOADS_CHANGED, canUseNativeAudioDownloads, downloadAudio, listDownloadedAudio } from '../../services/audioDownloads'

export function useAudioDownloads() {
  const [downloads, setDownloads] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    const refresh = () => listDownloadedAudio().then(records => { if (live) { setDownloads(records); setError('') } }).catch(() => { if (live) setError('Downloaded audio could not be listed. Existing files have been kept.') })
    refresh()
    window.addEventListener(AUDIO_DOWNLOADS_CHANGED, refresh)
    return () => { live = false; window.removeEventListener(AUDIO_DOWNLOADS_CHANGED, refresh) }
  }, [])
  return { downloads, error }
}

export default function BookAudioPanel({ bookId, editionId, full = false }) {
  const audio = useHeritageAudio()
  const navigate = useNavigate()
  const book = audioBooks.find(item => item.id === bookId)
  const tracks = useMemo(() => getBookAudioTracks(bookId, editionId), [bookId, editionId])
  const { downloads, error } = useAudioDownloads()
  const [open, setOpen] = useState(full)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [downloadProgress, setDownloadProgress] = useState(null)
  const downloaded = new Set(downloads.map(item => item.trackId))
  const activeTrack = tracks.find(track => track.id === audio?.state.trackId)
  const selectedTrack = activeTrack || tracks[0]
  if (!book || !tracks.length) return null
  const transferTracks = async toDownload => {
    setBusy(true); setMessage('Downloading…')
    try {
      for (let index = 0; index < toDownload.length; index += 1) {
        const track = toDownload[index]
        setMessage(`Downloading ${index + 1} of ${toDownload.length}: ${track.title}`)
        await downloadAudio(track.id, progress => setDownloadProgress(progress))
      }
      setMessage('Audio saved for offline listening.')
    } catch { setMessage('Download failed. Previously saved audio is still available; try again when connected.') }
    finally { setBusy(false); setDownloadProgress(null) }
  }
  return <section className="audio-library" aria-label={`Listen to ${book.title}`}>
    <h2>Listen · {book.title}</h2>
    <p>{editionId ? book.editions.find(edition => edition.id === editionId)?.title : `${tracks.length} ${book.kind === 'bible' ? 'chapters · Barry Hays' : 'tracks · LibriVox'}`}</p>
    <div className="audio-actions">
      <button type="button" disabled={!audio?.player} onClick={() => audio.player.play(selectedTrack.id)}>{activeTrack ? `Resume at ${formatAudioTime(audio.state.position)}` : 'Listen from the beginning'}</button>
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}>{open ? 'Hide tracks' : 'Choose a track'}</button>
      <button type="button" onClick={() => navigate('/audio')}>Audio library</button>
      {canUseNativeAudioDownloads() && <button type="button" disabled={busy || tracks.every(track => downloaded.has(track.id))} onClick={() => transferTracks(tracks.filter(track => !downloaded.has(track.id)))}>Download {editionId ? 'volume' : 'book'} · {formatAudioBytes(tracks.filter(track => !downloaded.has(track.id)).reduce((sum, track) => sum + track.bytes, 0))}</button>}
    </div>
    {(message || error) && <p role="status">{message || error}{downloadProgress ? ` (${Math.min(100, Math.round(downloadProgress.bytes / downloadProgress.total * 100))}%)` : ''}</p>}
    {open && <ul>{tracks.map(track => <li key={track.id} aria-current={audio?.state.trackId === track.id ? 'true' : undefined}>
      <div><strong>{track.title}</strong><small>{formatAudioTime(track.duration)} · {formatAudioBytes(track.bytes)} {downloaded.has(track.id) ? '· Downloaded' : ''}</small></div>
      <button type="button" disabled={!audio?.player} onClick={() => audio.player.play(track.id)} aria-label={`Play ${track.title}`}>Play</button>
      {canUseNativeAudioDownloads() && !downloaded.has(track.id) && <button type="button" disabled={busy} onClick={() => transferTracks([track])} aria-label={`Download ${track.title}`}>↓</button>}
    </li>)}</ul>}
    <p className="mt-3 text-xs"><a href={book.editions.find(edition => edition.id === editionId)?.sourceUrl || book.editions[0].sourceUrl} target="_blank" rel="noopener noreferrer">{book.kind === 'bible' ? 'BSB recording · Public domain (CC0) ↗' : 'Recording and readers at LibriVox ↗'}</a></p>
  </section>
}
