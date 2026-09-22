import { webcrypto } from 'node:crypto'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createCommunityBookDownloadStore } from './communityBookDownloads'

const url = 'https://church.example/content/books/1'
const options = { authorization: 'Community test-token', authorizationOrigin: 'https://church.example', memberId: '1' }
const bytes = new TextEncoder().encode('test chapter audio')
let document, request, storage, store
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })
function cachesForTest() {
  const entries = new Map()
  const key = request => typeof request === 'string' ? request : request.url
  return {
    keys: async () => [...entries.keys()], delete: async name => entries.delete(name),
    open: async name => {
      if (!entries.has(name)) entries.set(name, new Map())
      const map = entries.get(name)
      return { put: async (request, response) => map.set(key(request), response.clone()), match: async request => map.get(key(request))?.clone(), delete: async request => map.delete(key(request)), keys: async () => [...map.keys()].map(url => ({ url })) }
    },
  }
}
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto)
  const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
  document = { id: '1', title: 'Prayer', readAlong: { chapters: [{ id: 'one', audioSize: bytes.length, audioSha256: sha }, { id: 'two', audioSize: bytes.length, audioSha256: sha }] } }
  storage = cachesForTest()
  request = vi.fn(async target => target === url ? json(document) : new Response(bytes))
  store = createCommunityBookDownloadStore({ storage: () => storage, request, notify: vi.fn(), native: () => false })
})
afterEach(() => vi.unstubAllGlobals())
it('downloads verified text and all audio, then reads and listens without the server', async () => {
  await store.download(url, options)
  expect((await store.status(url, options)).complete).toBe(true)
  expect(request.mock.calls.every(([, init]) => init.redirect === 'error' && init.headers.Authorization === options.authorization && init.credentials === 'omit')).toBe(true)
  request.mockRejectedValue(new TypeError('Offline'))
  expect(await store.loadDocument(url, options)).toEqual({ value: document, source: 'cache' })
  expect((await store.loadAudio(url, document.readAlong.chapters[0], options)).size).toBe(bytes.length)
  expect((await storage.keys()).every(name => !name.includes('test-token'))).toBe(true)
})
it('retains completed chapters on failure and resumes without downloading them again', async () => {
  request.mockImplementation(async target => { if (target.endsWith('/two')) throw new TypeError('Offline'); return target === url ? json(document) : new Response(bytes) })
  await expect(store.download(url, options)).rejects.toThrow('Offline')
  expect(await store.status(url, options)).toMatchObject({ completed: 1, total: 2, complete: false })
  request.mockClear().mockImplementation(async target => target === url ? json(document) : new Response(bytes))
  await store.download(url, options)
  expect(request.mock.calls.map(([target]) => target)).toEqual([url, 'https://church.example/api/community/books/1/audio/two'])
})
it('rejects corrupt audio and keeps it out of the saved chapters', async () => {
  request.mockImplementation(async target => target === url ? json(document) : new Response('wrong recording'))
  await expect(store.download(url, options)).rejects.toThrow('timestamps')
  expect(await store.status(url, options)).toMatchObject({ completed: 0, complete: false })
})
it('requires the same signed-in account, while allowing its renewed token', async () => {
  await store.download(url, options)
  request.mockRejectedValue(new TypeError('Offline'))
  await expect(store.loadDocument(url, {})).rejects.toThrow('Offline')
  await expect(store.loadDocument(url, { ...options, memberId: '2' })).rejects.toThrow('Offline')
  expect((await store.loadDocument(url, { ...options, authorization: 'Community renewed-token' })).source).toBe('cache')
  await expect(store.download(url, { ...options, authorizationOrigin: 'https://other.example' })).rejects.toThrow('Sign in')
})
it.each([401, 403, 404, 410])('removes a saved copy after explicit server denial %s', async status => {
  await store.download(url, options)
  request.mockResolvedValue(new Response('', { status }))
  await expect(store.loadDocument(url, options)).rejects.toMatchObject({ status })
  expect(await store.status(url, options)).toBeNull()
})
it('removes only the selected book download and keeps listening progress', async () => {
  localStorage.setItem('heritage-audio-progress-v1', 'keep')
  await store.download(url, options)
  const record = await store.status(url, options)
  await store.remove(record.name)
  expect(await store.list()).toEqual([])
  expect(localStorage.getItem('heritage-audio-progress-v1')).toBe('keep')
})
