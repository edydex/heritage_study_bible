import { describe, it, expect, vi } from 'vitest'
import { createNativeAudioPlayer } from './nativeAudioPlayer'
import { audioTracks } from './audioCatalog'
const trackId = audioTracks[0].id
function setup() {
  const callbacks = new Map(), removes = []
  const state = { trackId, position: 73, duration: 300, rate: 1.5, status: 'playing', error: '', offline: true, revision: 1, sessionId: 'a' }
  const plugin = { addListener: vi.fn(async (name, callback) => { callbacks.set(name, callback); const remove = vi.fn(async () => {}); removes.push(remove); return { remove } }), command: vi.fn(async () => state), watchPositions: vi.fn(async () => {}) }
  const player = createNativeAudioPlayer({ plugin, openLibrary: vi.fn() })
  return { plugin, player, callbacks, state, removes }
}
describe('native audio controller', () => {
  it('registers exact boundaries without changing position and serializes chapter cleanup', async () => {
    const s = setup(); await s.player.initialized
    const stop = s.player.watchPositions(trackId, [4.642, 15.342])
    await vi.waitFor(() => expect(s.plugin.watchPositions).toHaveBeenCalledWith({ trackId, positions: [4.642, 15.342] }))
    stop()
    const stopNext = s.player.watchPositions(trackId, [22.042, 33.402])
    await vi.waitFor(() => expect(s.plugin.watchPositions).toHaveBeenCalledTimes(3))
    expect(s.plugin.watchPositions.mock.calls.map(call => call[0])).toEqual([
      { trackId, positions: [4.642, 15.342] }, { trackId: null, positions: [] }, { trackId, positions: [22.042, 33.402] },
    ])
    expect(s.player.getSnapshot().position).toBe(73)
    expect(s.plugin.command).toHaveBeenCalledTimes(1)
    stopNext(); s.player.dispose()
  })
  it('adopts the native car/headset position without reading or writing stale WebView progress', async () => {
    localStorage.setItem('heritage-audio-progress-v1', 'stale web cache')
    const s = setup(); await s.player.initialized
    expect(s.player.getSnapshot()).toMatchObject({ position: 73, status: 'playing', offline: true })
    expect(localStorage.getItem('heritage-audio-progress-v1')).toBe('stale web cache')
    expect(s.plugin.command.mock.calls).toEqual([[{ action: 'state' }]])
    s.player.dispose()
    expect(s.plugin.command).toHaveBeenCalledTimes(1) // Closing UI must not pause native playback.
  })
  it('ignores out-of-order snapshots and previous service instances after reconnect', async () => {
    const s = setup(); await s.player.initialized
    const emit = s.callbacks.get('state')
    emit({ ...s.state, revision: 3, position: 98 })
    emit({ ...s.state, revision: 2, position: 82 })
    expect(s.player.getSnapshot().position).toBe(98)
    emit({ ...s.state, sessionId: 'b', revision: 1, position: 100 })
    emit({ ...s.state, revision: 20, position: 101 })
    expect(s.player.getSnapshot()).toMatchObject({ sessionId: 'b', position: 100 })
    s.player.dispose()
  })
  it('waits for unload acknowledgement before permitting local file removal', async () => {
    const s = setup(); await s.player.initialized
    s.plugin.command.mockRejectedValueOnce(Error('disconnected'))
    await expect(s.player.unload()).rejects.toThrow('disconnected')
    expect(s.player.getSnapshot()).toMatchObject({ trackId, position: 73, status: 'error' })
    s.player.dispose()
  })
  it('unsubscribes if disposed while a listener is still registering', async () => {
    let register
    const remove = vi.fn(async () => {})
    const plugin = { addListener: vi.fn(() => new Promise(resolve => { register = resolve })), command: vi.fn() }
    const player = createNativeAudioPlayer({ plugin })
    player.dispose(); register({ remove }); await player.initialized
    expect(remove).toHaveBeenCalledOnce()
    expect(plugin.command).not.toHaveBeenCalled()
  })
  it('routes app controls to the shared native session', async () => {
    const s = setup(); await s.player.initialized
    await s.player.play(trackId, { restart: true }); await s.player.seek(24); await s.player.setRate('1.25'); await s.player.pause()
    expect(s.plugin.command.mock.calls.slice(1)).toEqual([
      [{ action: 'play', trackId, restart: true }], [{ action: 'seek', position: 24 }], [{ action: 'rate', rate: 1.25 }], [{ action: 'pause' }],
    ])
    s.player.dispose()
  })
})
