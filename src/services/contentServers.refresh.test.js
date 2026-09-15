import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { CONTENT_SERVERS_STORAGE_KEY, getContentServerSubscriptions, refreshContentCatalog, refreshStaleContentServers, removeContentServer } from './contentServers'

const manifestUrl = 'https://church.example/heritage-content.json'
const manifest = { schemaVersion: 2, kind: 'heritage-content-server', id: 'church', name: 'Church', catalogs: { songs: 'https://church.example/catalogs/songs' }, publications: {} }
const oldSong = { id: 'old', title: 'Withdrawn song', content: { url: 'https://church.example/content/songs/old' } }
const server = () => ({ enabled: true, manifestUrl, manifest, lastCheckedAt: new Date().toISOString(), catalogs: { songs: { items: [oldSong] } } })
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
beforeEach(() => { localStorage.clear(); localStorage.setItem(CONTENT_SERVERS_STORAGE_KEY, JSON.stringify([server()])); vi.stubGlobal('fetch', vi.fn(async url => json(url === manifestUrl ? manifest : { schemaVersion: 2, contentType: 'songs', items: [] }))) })
afterEach(() => vi.unstubAllGlobals())

it('ends a stalled song refresh after five seconds and preserves the saved list', async () => {
  vi.useFakeTimers()
  fetch.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))))
  try {
    const result = expect(refreshContentCatalog('church')).rejects.toThrow('too long')
    await vi.advanceTimersByTimeAsync(5000)
    await result
    expect(getContentServerSubscriptions()[0].catalogs.songs.items).toEqual([oldSong])
  } finally { vi.useRealTimers() }
})

it('replaces an obsolete catalog, leaving notes and downloaded content untouched', async () => {
  localStorage.setItem('personal-notes-sentinel', 'keep')
  await refreshContentCatalog('church')
  expect(getContentServerSubscriptions()[0].catalogs.songs.items).toEqual([])
  expect(localStorage.getItem('personal-notes-sentinel')).toBe('keep')
  expect(fetch.mock.calls.every(([, init]) => !init.headers.Authorization && init.cache === 'no-store')).toBe(true)
})
it('forces the upgrade refresh even when the old catalog was checked moments ago', async () => {
  await refreshStaleContentServers()
  expect(fetch).toHaveBeenCalledTimes(2)
  await refreshStaleContentServers()
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(getContentServerSubscriptions()[0].catalogs.songs.items).toEqual([])
})
it('retains the previous catalog if a refresh fails', async () => {
  fetch.mockRejectedValue(new TypeError('Offline'))
  await expect(refreshContentCatalog('church')).rejects.toThrow('Offline')
  expect(getContentServerSubscriptions()[0].catalogs.songs.items).toEqual([oldSong])
})
it('coalesces refreshes and does not resurrect a server removed during the request', async () => {
  let release
  fetch.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
  const first = refreshContentCatalog('church')
  const second = refreshContentCatalog('church')
  expect(first).toBe(second)
  removeContentServer('church')
  release(json(manifest))
  await first
  expect(getContentServerSubscriptions()).toEqual([])
})
