import { describe, it, expect, vi } from 'vitest'
import { createAudioDownloadStore } from './audioDownloads'
import { audioTracks } from './audioCatalog'

const track = audioTracks[0], other = audioTracks[1]
function setup() {
  const indexKey = 'heritage-audio-downloads-v2'
  const values = new Map(), files = new Map()
  let sequence = 0
  const filesystem = {
    readdir: vi.fn(async () => ({ files: [...files.entries()].map(([path, value]) => ({ name: path.split('/').pop(), type: 'file', size: value.size })) })),
    mkdir: vi.fn(async () => {}), getUri: vi.fn(async ({ path }) => ({ uri: `file:///${path}` })),
    stat: vi.fn(async ({ path }) => { if (!files.has(path)) throw Error('missing'); return { size: files.get(path).size } }),
    readFile: vi.fn(async ({ path }) => ({ data: btoa(files.get(path).header || 'ID3') })),
    rename: vi.fn(async ({ from, to }) => { files.set(to, files.get(from)); files.delete(from) }),
    deleteFile: vi.fn(async ({ path }) => { files.delete(path) }),
  }
  const preferences = { get: vi.fn(async ({ key }) => ({ value: values.get(key) })), set: vi.fn(async ({ key, value }) => { values.set(key, value) }) }
  const removeListener = vi.fn(async () => {})
  const transfer = { addListener: vi.fn(async () => ({ remove: removeListener })), downloadFile: vi.fn(async ({ url, path }) => {
    files.set(path.replace('file:///', ''), { size: audioTracks.find(item => item.url === url).bytes })
  }) }
  const store = createAudioDownloadStore({ filesystem, transfer, preferences, native: () => true, convertFileSrc: uri => uri, notify: vi.fn(), uuid: () => `file-${++sequence}` })
  return { store, files, values, indexKey, filesystem, preferences, transfer, removeListener }
}
describe('offline audio transactions', () => {
  it('keeps separate files/index entries for concurrent tracks and deduplicates repeat clicks', async () => {
    const s = setup()
    const first = s.store.download(track.id)
    expect(s.store.download(track.id)).toBe(first)
    await Promise.all([first, s.store.download(other.id)])
    expect((await s.store.list()).map(item => item.trackId)).toEqual([track.id, other.id])
    expect(s.transfer.downloadFile).toHaveBeenCalledTimes(2)
    expect([...s.files.keys()].every(path => path.endsWith('.mp3'))).toBe(true)
    expect(s.removeListener).toHaveBeenCalledTimes(2)
  })
  it.each(['network', 'short', 'html', 'index'])('keeps the old recording on %s failure', async failure => {
    const s = setup()
    const old = await s.store.download(track.id)
    const before = s.values.get(s.indexKey)
    if (failure === 'network') s.transfer.downloadFile.mockRejectedValueOnce(Error('offline'))
    if (failure === 'short') s.filesystem.stat.mockResolvedValueOnce({ size: 23 })
    if (failure === 'html') s.filesystem.readFile.mockResolvedValueOnce({ data: btoa('<html>not audio') })
    if (failure === 'index') s.preferences.set.mockRejectedValueOnce(Error('storage full'))
    await expect(s.store.download(track.id)).rejects.toThrow()
    expect(s.values.get(s.indexKey)).toBe(before)
    expect([...s.files.keys()]).toEqual([old.path])
    expect((await s.store.get(track.id)).path).toBe(old.path)
  })
  it('does not erase an unreadable index or say deletion succeeded on filesystem failure', async () => {
    const s = setup()
    await s.store.download(track.id)
    s.filesystem.deleteFile.mockRejectedValueOnce(Error('denied'))
    await expect(s.store.remove(track.id)).rejects.toThrow('denied')
    expect(await s.store.list()).toHaveLength(1)
    s.values.set(s.indexKey, '{broken')
    await expect(s.store.download(other.id)).rejects.toThrow()
    expect(s.values.get(s.indexKey)).toBe('{broken')
    expect(s.transfer.downloadFile).toHaveBeenCalledTimes(1)
  })
  it('falls back from missing offline file without erasing the saved record', async () => {
    const s = setup()
    const record = await s.store.download(track.id)
    s.files.delete(record.path)
    expect(await s.store.get(track.id)).toBeNull()
    expect(await s.store.list()).toHaveLength(1)
  })
  it('finds interrupted files for cleanup and never deletes a newly indexed file as an orphan', async () => {
    const s = setup()
    s.files.set('heritage-audio/interrupted.mp3.part', { size: 45 })
    expect((await s.store.list())[0]).toMatchObject({ trackId: 'orphan:interrupted.mp3.part', bytes: 45 })
    await s.store.remove('orphan:interrupted.mp3.part')
    expect(s.files.size).toBe(0)
    const saved = await s.store.download(track.id)
    expect(await s.store.remove(`orphan:${saved.path.split('/').pop()}`)).toBe(false)
    expect(s.files.has(saved.path)).toBe(true)
  })
  it('allows removal of a stale record after the file was already removed', async () => {
    const s = setup()
    await s.store.download(track.id)
    s.files.clear()
    s.filesystem.deleteFile.mockRejectedValueOnce(Object.assign(Error('missing'), { code: 'OS-PLUG-FILE-0008' }))
    expect(await s.store.remove(track.id)).toBe(true)
    expect(await s.store.list()).toEqual([])
  })
  it('adopts legacy downloads without changing files and rejects paths outside audio storage', async () => {
    const s = setup()
    s.values.set('heritage-audio-downloads', JSON.stringify({ old: { path: 'heritage-audio/old.mp3', url: track.url, label: 'Old' }, unsafe: { path: '../notes.db' } }))
    expect((await s.store.list()).map(item => item.trackId)).toEqual([track.id])
    expect(s.filesystem.rename).not.toHaveBeenCalled()
    await s.store.remove(track.id)
    expect(await s.store.list()).toEqual([])
  })
})
