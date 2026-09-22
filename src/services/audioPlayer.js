import { getStoredJson, setStoredJson } from './persistentStorage'
import { getAudioTrack, nextAudioTrack } from './audioCatalog'
import { getDownloadedAudio } from './audioDownloads'
import { communityAudioSource } from './communityAudio'

export const AUDIO_PROGRESS_KEY = 'heritage-audio-progress-v1'
const finite = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0
const rateValue = value => [0.75, 1, 1.25, 1.5, 1.75, 2].includes(Number(value)) ? Number(value) : 1
export function normalizeAudioProgress(value) {
  const positions = {}
  for (const [id, position] of Object.entries(value?.positions || {})) {
    if (getAudioTrack(id)) positions[id] = finite(position)
  }
  return { positions, lastTrackId: getAudioTrack(value?.lastTrackId)?.id || null, rate: rateValue(value?.rate) }
}

// One owner for playback across routes. The browser element is deliberately
// separate from React's render lifetime; native MediaSession support can use the
// same track IDs and progress contract.
export function createAudioPlayer({ audio = new Audio(), load = () => getStoredJson(AUDIO_PROGRESS_KEY, {}),
  save = value => setStoredJson(AUDIO_PROGRESS_KEY, value), offline = getDownloadedAudio,
  mediaSession = globalThis.navigator?.mediaSession, now = () => Date.now(),
} = {}) {
  audio.preload = 'metadata'
  let state = { trackId: null, position: 0, duration: 0, rate: 1, status: 'idle', error: '', offline: false }
  let progress = { positions: {}, lastTrackId: null, rate: 1 }
  const listeners = new Set()
  let generation = 0, ready = false, disposed = false, hydrated = false, lastSavedAt = 0, writes = Promise.resolve(), releaseSource
  const emit = patch => { state = { ...state, ...patch }; listeners.forEach(listener => listener()) }
  function remember() {
    if (state.trackId) progress.positions[state.trackId] = finite(state.position)
    progress.lastTrackId = state.trackId
    progress.rate = state.rate
  }
  function persist() {
    if (!hydrated) return Promise.resolve()
    remember()
    const snapshot = structuredClone(progress)
    writes = writes.catch(() => {}).then(() => save(snapshot)).catch(() => {
      emit({ error: 'Your listening position could not be saved on this device.' })
    })
    lastSavedAt = now()
    return writes
  }
  const initialized = Promise.resolve().then(load).then(value => {
    progress = normalizeAudioProgress(value)
    hydrated = true
    if (!disposed && generation === 0) {
      const track = getAudioTrack(progress.lastTrackId)
      emit({ trackId: track?.id || null, position: progress.positions[track?.id] || 0,
        duration: track?.duration || 0, rate: progress.rate, status: track ? 'paused' : 'idle' })
    }
  }).catch(() => { hydrated = true; if (!disposed) emit({ error: 'Saved listening progress could not be loaded.' }) })

  function updateMediaSession() {
    if (!mediaSession || !state.trackId) return
    const track = getAudioTrack(state.trackId)
    try {
      if (globalThis.MediaMetadata) mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.author, album: track.bookTitle })
      mediaSession.playbackState = state.status === 'playing' ? 'playing' : 'paused'
      if (state.duration > 0) mediaSession.setPositionState?.({ duration: state.duration, playbackRate: state.rate, position: Math.min(state.duration, state.position) })
    } catch { /* Some browser engines implement only part of Media Session. */ }
  }
  async function play(id = state.trackId, { restart = false } = {}) {
    await initialized
    const track = getAudioTrack(id)
    if (!track || disposed) return
    if (state.trackId === id && ready && !restart) {
      try { await audio.play() } catch { emit({ status: 'paused', error: 'Tap Play to start this recording.' }) }
      return
    }
    const token = ++generation
    remember()
    ready = false
    audio.pause()
    const position = restart ? 0 : progress.positions[id] || 0
    emit({ trackId: id, position, duration: track.duration || 0, status: 'loading', error: '', offline: false })
    persist()
    try {
      const downloaded = track.community ? await communityAudioSource(track) : await offline(id)
      if (disposed || token !== generation) { downloaded?.release?.(); return }
      releaseSource?.(); releaseSource = downloaded?.release
      audio.src = downloaded?.webPath || track.url
      audio.playbackRate = state.rate
      emit({ offline: downloaded?.offline ?? Boolean(downloaded) })
      audio.load()
      // The seek is applied by loadedmetadata before play; autoplay-blocked
      // engines retain the position and show a normal Play button.
    } catch { if (token === generation) emit({ status: 'error', error: 'Could not open this recording. Your saved position is kept.' }) }
  }
  function pause() {
    if (state.status === 'loading') { generation += 1; ready = false; audio.removeAttribute('src'); audio.load() }
    audio.pause()
    emit({ status: state.trackId ? 'paused' : 'idle' })
    persist(); updateMediaSession()
  }
  function seek(position) {
    const next = Math.min(state.duration || Infinity, finite(position))
    if (ready) audio.currentTime = next
    emit({ position: next }); persist(); updateMediaSession()
  }
  function setRate(rate) { const next = rateValue(rate); audio.playbackRate = next; emit({ rate: next }); persist(); updateMediaSession() }
  function skip(direction) { const next = nextAudioTrack(state.trackId, direction); if (next) return play(next.id, { restart: true }) }
  const handlers = {
    loadedmetadata: () => {
      if (state.status !== 'loading' || !state.trackId) return
      ready = true
      const duration = Number.isFinite(audio.duration) ? audio.duration : state.duration
      // A completed track resumes at its beginning instead of immediately ending.
      const position = state.position >= duration ? 0 : state.position
      audio.currentTime = position
      emit({ duration, position })
      const token = generation
      audio.play().catch(() => { if (token === generation) emit({ status: 'paused', error: 'Tap Play to start this recording.' }) })
      updateMediaSession()
    },
    playing: () => { if (ready) { emit({ status: 'playing', error: '' }); updateMediaSession() } },
    pause: () => { if (ready) { emit({ status: 'paused' }); persist(); updateMediaSession() } },
    timeupdate: () => {
      if (!ready) return
      emit({ position: finite(audio.currentTime) })
      if (now() - lastSavedAt >= 5000) persist()
      updateMediaSession()
    },
    ended: () => { if (ready) { emit({ status: 'paused', position: state.duration }); persist(); skip(1); updateMediaSession() } },
    error: () => { if (state.trackId && audio.getAttribute('src')) { ready = false; emit({ status: 'error', error: 'Audio could not load. Check your connection or try Play again. Your saved position is kept.' }); updateMediaSession() } },
  }
  Object.entries(handlers).forEach(([name, handler]) => audio.addEventListener(name, handler))
  const sessionActions = { play: () => play(), pause, stop: pause, seekbackward: event => seek(state.position - (event.seekOffset || 15)),
    seekforward: event => seek(state.position + (event.seekOffset || 15)), seekto: event => seek(event.seekTime), previoustrack: () => skip(-1), nexttrack: () => skip(1) }
  if (mediaSession) Object.entries(sessionActions).forEach(([name, handler]) => { try { mediaSession.setActionHandler(name, handler) } catch {} })
  return {
    initialized, getSnapshot: () => state, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    play, pause, seek, setRate, skip, persist,
    unload: () => { pause(); ready = false; audio.removeAttribute('src'); audio.load(); releaseSource?.(); releaseSource = null; emit({ offline: false }) },
    positionFor: id => id === state.trackId ? state.position : progress.positions[id] || 0,
    dispose: () => {
      persist(); disposed = true; generation += 1; ready = false
      Object.entries(handlers).forEach(([name, handler]) => audio.removeEventListener(name, handler))
      audio.pause(); audio.removeAttribute('src'); audio.load(); releaseSource?.(); listeners.clear()
      if (mediaSession) Object.keys(sessionActions).forEach(name => { try { mediaSession.setActionHandler(name, null) } catch {} })
    },
  }
}
