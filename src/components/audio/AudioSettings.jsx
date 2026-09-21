import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { AudioPlayerControls, useHeritageAudio } from './AudioProvider'
import { audioTracks, formatAudioBytes } from '../../services/audioCatalog'
import { canUseNativeAudioDownloads } from '../../services/audioDownloads'
import { audioDownloadQueue } from '../../services/audioDownloadQueue'
import { useAudioDownloads } from './BookAudioPanel'

export default function AudioSettings() {
  const navigate = useNavigate(), audio = useHeritageAudio()
  const { downloads } = useAudioDownloads()
  const queue = useSyncExternalStore(audioDownloadQueue.subscribe, audioDownloadQueue.getSnapshot)
  const [confirm, setConfirm] = useState(false)
  const dialog = useRef(null)
  useEffect(() => { if (confirm) dialog.current?.showModal(); else dialog.current?.close() }, [confirm])
  const tracks = audioTracks.filter(track => track.bible?.translation === 'BSB')
  const saved = new Set(downloads.map(item => item.trackId))
  const remaining = tracks.filter(track => !saved.has(track.id))
  const totalBytes = remaining.reduce((sum, track) => sum + track.bytes, 0)
  return <main className="audio-library min-h-screen dark:bg-gray-900">
    <header><button onClick={() => navigate(-1)} aria-label="Back">←</button><h1>Audio Settings</h1></header>
    <section><h2>Follow the text</h2>
      <label className="block mt-3"><input type="checkbox" checked={audio?.settings.followBible ?? true} onChange={event => audio?.updateSettings({ followBible: event.target.checked })} /> Auto-scroll Bible recordings</label>
      <p className="text-sm mt-1">Keep the spoken verse in view. While listening, tap a verse to play from its beginning. Timings are automatic; unverified passages stay unhighlighted.</p>
      <label className="block mt-4"><input type="checkbox" checked={audio?.settings.followBooks ?? true} onChange={event => audio?.updateSettings({ followBooks: event.target.checked })} /> Auto-scroll audiobooks</label>
      <p className="text-sm mt-1">Follow the playing paragraph when its matching book edition is open.</p>
    </section>
    <AudioPlayerControls />
    <section><h2>Chapters &amp; downloads</h2>
      <div className="audio-actions"><button onClick={() => navigate('/audio')}>Browse chapters and audiobooks</button><button onClick={() => navigate('/settings/storage')}>Internal Storage</button></div>
      <p className="mt-3">Berean Standard Bible · Barry Hays · {tracks.length} chapters</p>
      {canUseNativeAudioDownloads() ? <>
        <p className="text-sm mt-2">{tracks.length - remaining.length} chapters saved. Remaining download: {formatAudioBytes(totalBytes)}. Wi-Fi is recommended.</p>
        <button className="mt-3" disabled={queue.running || !remaining.length} onClick={() => setConfirm(true)}>{remaining.length ? 'Download whole BSB translation' : 'BSB downloaded'}</button>
      </> : <p className="text-sm mt-2">Offline audio downloads are available in the Android app. You can stream recordings here.</p>}
      {queue.running && <div className="mt-3"><p>{queue.completed} of {queue.total} chapters · {queue.title}</p><progress aria-label="Translation download progress" value={queue.completed} max={queue.total} /><button onClick={audioDownloadQueue.stop}>Stop after this chapter</button></div>}
      {queue.message && <p role="status" className="mt-3">{queue.message}</p>}
    </section>
    <dialog ref={dialog} onCancel={() => setConfirm(false)} onClick={event => { if (event.target === dialog.current) setConfirm(false) }} aria-label="Download BSB audio" className="word-study-dialog rounded-xl p-5 bg-white dark:bg-gray-900 dark:text-gray-100">
        <h2>Download BSB audio?</h2><p className="mt-2">Save {remaining.length} chapters ({formatAudioBytes(totalBytes)}) on this device. Downloads use your internet connection. You can stop and resume, or remove them in Internal Storage.</p>
        <div className="audio-actions"><button autoFocus onClick={() => setConfirm(false)}>Cancel</button><button onClick={() => { setConfirm(false); audioDownloadQueue.start(tracks) }}>Download</button></div>
    </dialog>
  </main>
}
