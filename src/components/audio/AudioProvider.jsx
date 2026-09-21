import { audiobookDestination, loadAudiobookTiming } from '../../services/audiobookText'
import { bibleAudioDestination, loadBibleAudioTiming } from '../../services/bibleAudio'
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPlatformAudioPlayer } from '../../services/nativeAudioPlayer'
import { formatAudioTime, getAudioTrack, nextAudioTrack } from '../../services/audioCatalog'
import './audio.css'

const AudioContext = createContext(null)
export const useHeritageAudio = () => useContext(AudioContext)
function PlayerHost({ player, state }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const track = getAudioTrack(state.trackId)
  const bar = useRef(null)
  const [timing, setTiming] = useState(null)
  useEffect(() => {
    let cancelled = false
    setTiming(null)
    if (track) (track.bible ? loadBibleAudioTiming(track) : loadAudiobookTiming(track)).then(value => { if (!cancelled) setTiming(value) }).catch(() => {})
    return () => { cancelled = true }
  }, [track?.id])
  const destination = track?.bible ? bibleAudioDestination(track, timing, state.position) : audiobookDestination(track, timing, state.position)
  useEffect(() => {
    const persist = () => player.persist()
    window.addEventListener('pagehide', persist)
    document.addEventListener('visibilitychange', persist)
    return () => { window.removeEventListener('pagehide', persist); document.removeEventListener('visibilitychange', persist) }
  }, [player])
  useEffect(() => {
    if (!track || !bar.current) return
    const setHeight = () => document.documentElement.style.setProperty('--audio-player-height', `${bar.current?.offsetHeight || 0}px`)
    setHeight()
    const observer = new ResizeObserver(setHeight)
    observer.observe(bar.current)
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--audio-player-height') }
  }, [track?.id, expanded])
  return <>
    {track && <>
      <div className="audio-player-spacer" />
      <section ref={bar} className="audio-player" aria-label="Audio player">
        <div className="audio-player-row">
          <button type="button" className="audio-player-title" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
            <strong>{track.bookTitle}</strong><span>{track.title} · {formatAudioTime(state.position)} {state.offline ? '· Offline' : ''}</span>
          </button>
          <button type="button" onClick={() => player.seek(state.position - 15)} aria-label="Rewind 15 seconds">−15s</button>
          <button type="button" onClick={() => state.status === 'playing' || state.status === 'loading' ? player.pause() : player.play()}>
            {state.status === 'loading' ? 'Cancel' : state.status === 'playing' ? 'Pause' : 'Play'}
          </button>
          <button type="button" onClick={() => player.seek(state.position + 15)} aria-label="Forward 15 seconds">+15s</button>
        </div>
        {expanded && <div className="audio-player-expanded">
          <label className="audio-seek">Position <input aria-label="Audio position" type="range" min="0" max={state.duration || 1} step="1" value={Math.min(state.position, state.duration || 1)} onChange={event => player.seek(event.target.value)} /> {formatAudioTime(state.duration)}</label>
          <div className="audio-actions">
            <button type="button" disabled={!nextAudioTrack(track.id, -1)} onClick={() => player.skip(-1)}>Previous track</button>
            <button type="button" disabled={!nextAudioTrack(track.id, 1)} onClick={() => player.skip(1)}>Next track</button>
            <label>Speed <select aria-label="Playback speed" value={state.rate} onChange={event => player.setRate(event.target.value)}>{[0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select></label>
            <button type="button" onClick={() => destination ? navigate(destination.path, { state: destination.state }) : navigate(`/resources/books/${track.textBookId || track.bookId}`)}>{destination ? destination.state.audioParagraph ? 'Go to nearby text' : destination.state.scrollToVerse ? 'Go to playing verse' : 'Open chapter text' : 'Open book text'}</button>
            <button type="button" onClick={() => navigate('/audio')}>Audio library</button>
          </div>
        </div>}
        {state.error && <p role="status">{state.error}</p>}
      </section>
    </>}
  </>
}
const emptyState = { trackId: null }
const noSubscribe = () => () => {}
const emptySnapshot = () => emptyState
export default function AudioProvider({ children }) {
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate
  const [player, setPlayer] = useState(null)
  useEffect(() => {
    // Use the router's navigation transaction: assigning location.hash directly
    // can race its pending HomeRedirect on a fresh install.
    const instance = createPlatformAudioPlayer({ openLibrary: () => navigateRef.current('/audio') })
    setPlayer(instance)
    return () => instance.dispose()
  }, [])
  const state = useSyncExternalStore(player?.subscribe || noSubscribe, player?.getSnapshot || emptySnapshot)
  // Keep the provider and route tree stable while saved audio loads.
  return <AudioContext.Provider value={player ? { player, state } : null}>
    {children}
    {player && <PlayerHost player={player} state={state} />}
  </AudioContext.Provider>
}
