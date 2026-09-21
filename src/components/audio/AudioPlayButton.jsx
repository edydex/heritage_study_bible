import { useEffect, useRef, useState } from 'react'
import { AudioPlayerControls, useHeritageAudio } from './AudioProvider'

export default function AudioPlayButton({ track, label = 'chapter' }) {
  const audio = useHeritageAudio()
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const dialog = useRef(null)
  const press = useRef({ timer: null, handled: false })
  const clearPress = () => { clearTimeout(press.current.timer); press.current.timer = null }
  useEffect(() => () => clearPress(), [])
  useEffect(() => { setOpen(false); clearPress() }, [track?.id])
  useEffect(() => {
    if (!open) return
    dialog.current?.showModal()
    const back = event => { event.preventDefault(); setOpen(false) }
    window.addEventListener('heritage:native-back', back)
    return () => { dialog.current?.close(); window.removeEventListener('heritage:native-back', back) }
  }, [open])
  const playbackError = audio?.state.trackId === track?.id ? audio?.state.error : ''
  useEffect(() => {
    setError(playbackError || '')
    if (!playbackError) return
    const timer = setTimeout(() => setError(''), 8000)
    return () => clearTimeout(timer)
  }, [playbackError])
  if (!track) return null
  const active = audio?.state.trackId === track.id
  const playing = active && ['playing', 'loading'].includes(audio.state.status)
  const name = `${playing ? 'Pause' : 'Play'} ${label} audio`
  const showPlayer = () => { clearPress(); press.current.handled = true; setOpen(true) }
  return <><button type="button" className="reader-audio-button text-primary dark:text-blue-400" aria-label={name} aria-haspopup="dialog" aria-keyshortcuts="Shift+Enter" title={`${name}. Hold, right-click, or press Shift+Enter for player controls.`} disabled={!audio}
    onPointerDown={event => {
      if (event.button !== 0 || !event.isPrimary) return
      clearPress()
      press.current = { handled: false, x: event.clientX, y: event.clientY, timer: setTimeout(showPlayer, 500) }
    }}
    onPointerMove={event => { if (Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 10) { clearPress(); press.current.handled = true } }}
    onPointerUp={clearPress} onPointerCancel={() => { clearPress(); press.current.handled = true }} onPointerLeave={clearPress}
    onContextMenu={event => { event.preventDefault(); showPlayer() }}
    onKeyDown={event => { if (event.key === 'Enter' && event.shiftKey) { event.preventDefault(); showPlayer() } else if (event.key === 'Enter' || event.key === ' ') press.current.handled = false }}
    onClick={() => { if (press.current.handled) { press.current.handled = false; return } playing ? audio.player.pause() : audio.player.play(track.id) }}>
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">{playing ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" /> : <path d="M6 3v18l16-9z" />}</svg>
  </button>
    {open && <dialog ref={dialog} aria-label="Player controls" className="audio-player-dialog" onCancel={() => setOpen(false)} onClick={event => { if (event.target === dialog.current) setOpen(false) }}>
      <div className="audio-dialog-heading"><h2>Player controls</h2><button autoFocus type="button" onClick={() => setOpen(false)} aria-label="Close player">Close</button></div>
      <AudioPlayerControls track={track} onNavigate={() => setOpen(false)} />
    </dialog>}
    {error && <div role="status" className="fixed bottom-20 left-4 right-4 mx-auto max-w-md rounded-lg bg-gray-800 text-white p-3 text-sm shadow-lg">{error}</div>}
  </>
}
