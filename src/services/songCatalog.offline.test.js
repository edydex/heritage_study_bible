import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const saved = vi.hoisted(() => new Map())
vi.mock('./savedSongs.js', () => ({
  readSavedSong: async reference => saved.get(reference.item.content.url) || null,
  saveSong: async (reference, document) => saved.set(reference.item.content.url, structuredClone(document)),
}))
vi.mock('./communities.js', () => ({ getCommunities: () => [] }))
vi.mock('./contentServers.js', () => ({ getRemoteContentItemsForCategory: () => [{ id: '1', title: 'Offline rehearsal', sourceServerId: 'church', sourceServerName: 'Church', content: { url: 'https://church.example/content/songs/1' } }] }))
import { loadMergedSong } from './songCatalog.js'
const route = 'song-offline-rehearsal'
const original = { title: 'Offline rehearsal', lyrics: 'Saved English words', russianLyrics: 'Сохранённые слова' }
const json = value => new Response(JSON.stringify(value))
beforeEach(() => { saved.clear(); vi.stubGlobal('fetch', vi.fn(async () => json(original))) })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('opens saved bilingual words immediately and retains them after a failed refresh', async () => {
  await loadMergedSong(route)
  let rejectRefresh
  fetch.mockImplementation(() => new Promise((_resolve, reject) => { rejectRefresh = reject }))
  let sawSaved
  const immediate = new Promise(resolve => { sawSaved = resolve })
  const reopening = loadMergedSong(route, { onProgress: song => {
    if (song.languages.en.length) sawSaved(song)
  } })
  const visible = await immediate
  expect(visible.pendingSourceCount).toBe(1)
  expect(visible.languages.en[0].sections[0].lines).toEqual(['Saved English words'])
  rejectRefresh(new TypeError('Offline'))
  const result = await reopening
  expect(result.languages.ru[0].sections[0].lines).toEqual(['Сохранённые слова'])
  expect(result.loaded[0]).toMatchObject({ cached: true, document: original })
  expect(result.pendingSourceCount).toBe(0)
  expect(fetch.mock.calls.every(([, options]) => options.credentials === 'omit' && !options.headers?.Authorization)).toBe(true)
})

it('does not replace saved words with an HTTP or malformed response', async () => {
  await loadMergedSong(route)
  for (const response of [new Response('Unavailable', { status: 503 }), json({ error: 'failed' })]) {
    fetch.mockResolvedValueOnce(response)
    const song = await loadMergedSong(route)
    expect(song.loaded[0].document).toEqual(original)
    expect(song.loaded[0].error).toBeTruthy()
  }
  fetch.mockResolvedValueOnce(json({ ...original, lyrics: 'Revised words' }))
  expect((await loadMergedSong(route)).languages.en[0].sections[0].lines).toEqual(['Revised words'])
  expect([...saved.values()][0].lyrics).toBe('Revised words')
})

it('stops a stalled lyrics request after five seconds with saved words still readable', async () => {
  await loadMergedSong(route)
  vi.useFakeTimers()
  fetch.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))))
  const pending = loadMergedSong(route)
  await vi.advanceTimersByTimeAsync(5000)
  const song = await pending
  expect(song.loaded[0].error).toBeTruthy()
  expect(song.languages.en[0].sections[0].lines).toEqual(['Saved English words'])
})
