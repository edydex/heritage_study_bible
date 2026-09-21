import { describe, it, expect, vi } from 'vitest'
import { createAudioPlayer, normalizeAudioProgress } from './audioPlayer'
import { audioTracks, getBookAudioTracks, nextAudioTrack } from './audioCatalog'

class FakeAudio extends EventTarget {
  src = ''; currentTime = 0; duration = 300; playbackRate = 1
  play = vi.fn(async () => this.dispatchEvent(new Event('playing')))
  pause = vi.fn(() => this.dispatchEvent(new Event('pause')))
  load = vi.fn()
  removeAttribute() { this.src = '' }
  getAttribute() { return this.src }
  event(name) { this.dispatchEvent(new Event(name)) }
}
const first = audioTracks[0], second = audioTracks[1]
function setup(saved = {}) {
  const audio = new FakeAudio(), save = vi.fn(async () => {}), offline = vi.fn(async () => null)
  const player = createAudioPlayer({ audio, save, offline, load: async () => saved, mediaSession: null })
  return { audio, save, offline, player }
}
describe('persistent audio player', () => {
  it('restores the exact track/time/rate without autoplay and seeks only after metadata', async () => {
    const s = setup({ lastTrackId: second.id, positions: { [second.id]: 137 }, rate: 1.5 })
    await s.player.initialized
    expect(s.player.getSnapshot()).toMatchObject({ trackId: second.id, position: 137, status: 'paused', rate: 1.5 })
    expect(s.audio.play).not.toHaveBeenCalled()
    await s.player.play()
    expect(s.audio.src).toBe(second.url)
    expect(s.audio.currentTime).toBe(0)
    s.audio.event('loadedmetadata')
    expect(s.audio.currentTime).toBe(137)
    expect(s.player.getSnapshot().status).toBe('playing')
    s.player.dispose()
  })
  it('keeps positions separately when switching tracks and preserves them after a network error', async () => {
    const s = setup()
    await s.player.play(first.id); s.audio.event('loadedmetadata')
    s.audio.currentTime = 87; s.audio.event('timeupdate')
    await s.player.play(second.id); s.audio.event('error')
    expect(s.player.getSnapshot().status).toBe('error')
    await s.player.play(first.id); s.audio.event('loadedmetadata')
    expect(s.audio.currentTime).toBe(87)
    await s.player.persist()
    expect(s.save.mock.lastCall[0].positions[first.id]).toBe(87)
    s.player.dispose()
  })
  it('does not let a delayed download lookup steal playback from a newer selection', async () => {
    const s = setup()
    let finish
    s.offline.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const pending = s.player.play(first.id)
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    await s.player.play(second.id)
    finish({ webPath: 'file:///old.mp3' }); await pending
    expect(s.audio.src).toBe(second.url)
    s.player.dispose()
  })
  it('cancels a pending load without autoplay when the lookup finishes', async () => {
    const s = setup()
    let finish
    s.offline.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const pending = s.player.play(first.id)
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    s.player.pause(); finish(null); await pending
    expect(s.audio.src).toBe('')
    expect(s.audio.play).not.toHaveBeenCalled()
    s.player.dispose()
  })
  it('does not overwrite saved progress when StrictMode disposes before hydration', async () => {
    let resolve
    const save = vi.fn(async () => {})
    const player = createAudioPlayer({ audio: new FakeAudio(), save, load: () => new Promise(done => { resolve = done }), mediaSession: null })
    player.dispose()
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
    resolve({ lastTrackId: first.id, positions: { [first.id]: 92 } })
    await player.initialized
    expect(save).not.toHaveBeenCalled()
  })
  it('uses local recording and unloads it safely before deletion', async () => {
    const s = setup()
    s.offline.mockResolvedValue({ webPath: 'file:///saved.mp3' })
    await s.player.play(first.id); s.audio.event('loadedmetadata'); s.player.seek(60)
    expect(s.audio.src).toBe('file:///saved.mp3')
    s.player.unload()
    expect(s.audio.src).toBe('')
    expect(s.player.getSnapshot()).toMatchObject({ position: 60, status: 'paused', offline: false })
    s.offline.mockResolvedValue(null)
    await s.player.play(); s.audio.event('loadedmetadata')
    expect(s.audio.src).toBe(first.url)
    expect(s.audio.currentTime).toBe(60)
    s.player.dispose()
  })
  it('advances across a volume boundary within a book, but never to another book', () => {
    const tracks = getBookAudioTracks('josephus-antiquities')
    const endFirstVolume = tracks.findLast(track => track.editionId === tracks[0].editionId)
    expect(nextAudioTrack(endFirstVolume.id).editionId).not.toBe(endFirstVolume.editionId)
    expect(nextAudioTrack(tracks.at(-1).id)).toBeNull()
  })
  it('rejects invalid restored IDs/positions/rates', () => {
    expect(normalizeAudioProgress({ lastTrackId: 'unknown', positions: { unknown: 42, [first.id]: -9 }, rate: 999 })).toEqual({ lastTrackId: null, positions: { [first.id]: 0 }, rate: 1 })
  })
})
