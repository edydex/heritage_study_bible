import { Capacitor, registerPlugin } from '@capacitor/core'
import { getAudioTrack } from './audioCatalog'
import { createAudioPlayer } from './audioPlayer'
const HeritageAudio = registerPlugin('HeritageAudio')

// Android owns playback and persistence. Never create an HTMLAudioElement or
// write a cached WebView position back over the service's newer car/headset state.
export function createNativeAudioPlayer({ plugin = HeritageAudio, openLibrary = () => { window.location.hash = '/audio' } } = {}) {
  let state = { trackId: null, position: 0, duration: 0, rate: 1, status: 'idle', offline: false, error: '' }
  const listeners = new Set(), retiredSessions = new Set()
  let disposed = false, subscription, openSubscription, sessionId = null, revision = -1
  const emit = next => { if (!disposed) { state = next; listeners.forEach(listener => listener()) } }
  function accept(snapshot) {
    if (!snapshot || disposed || retiredSessions.has(snapshot.sessionId)) return
    if (sessionId !== snapshot.sessionId) { if (sessionId) retiredSessions.add(sessionId); sessionId = snapshot.sessionId; revision = -1 }
    if (typeof snapshot.revision !== 'number' || snapshot.revision < revision) return
    revision = snapshot.revision
    const track = getAudioTrack(snapshot.trackId)
    emit({ ...snapshot, trackId: track?.id || null,
      position: Number.isFinite(snapshot.position) ? Math.max(0, snapshot.position) : 0,
      duration: Number.isFinite(snapshot.duration) ? Math.max(0, snapshot.duration) : track?.duration || 0,
      rate: snapshot.rate || 1, error: snapshot.error || '',
    })
  }
  const failure = () => emit({ ...state, status: 'error', error: 'Android audio could not connect. Reopen the app to reconnect; your saved position is kept.' })
  const initialized = (async () => {
    subscription = await plugin.addListener('state', accept)
    if (disposed) { await subscription.remove(); return }
    openSubscription = await plugin.addListener('openLibrary', openLibrary)
    if (disposed) { await openSubscription.remove(); return }
    accept(await plugin.command({ action: 'state' }))
  })().catch(failure)
  async function command(action, args = {}) {
    await initialized
    if (disposed) return
    try { const snapshot = await plugin.command({ action, ...args }); accept(snapshot); return snapshot }
    catch (error) { failure(); throw error }
  }
  // UI controls do not need to handle rejections; destructive callers (unload
  // before deletion) do await the actual service acknowledgement.
  const control = (action, args) => command(action, args).catch(() => {})
  return {
    initialized, getSnapshot: () => state, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    play: (id = state.trackId, { restart = false } = {}) => control('play', { trackId: id, restart }),
    pause: () => control('pause'), seek: position => control('seek', { position: Math.max(0, Number(position) || 0) }),
    setRate: rate => control('rate', { rate: Number(rate) }), skip: direction => control('skip', { direction }),
    unload: () => command('unload'), persist: () => control('persist'),
    positionFor: id => id === state.trackId ? state.position : 0,
    dispose: () => { disposed = true; listeners.clear(); subscription?.remove().catch(() => {}); openSubscription?.remove().catch(() => {}) },
  }
}
export function createPlatformAudioPlayer() {
  return Capacitor.getPlatform?.() === 'android' && Capacitor.isPluginAvailable('HeritageAudio')
    ? createNativeAudioPlayer() : createAudioPlayer()
}
