import { nativeCommunityBooks, readCommunityAudioFile, writeCommunityAudioFile, removeCommunityAudioFiles } from './communityBookFiles'
const PREFIX = 'heritage-community-book-v1-'
const META_URL = 'https://heritage.invalid/community-book-download'
export const COMMUNITY_BOOK_DOWNLOADS_CHANGED = 'heritage-community-book-downloads-change'
const denied = error => [401, 403, 404, 410].includes(error?.status)
const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')

export function communityBookAudioUrl(contentUrl, chapterId) {
  const url = new URL(contentUrl)
  const id = url.pathname.match(/^\/content\/books\/(\d+)$/)?.[1]
  if (!id) throw new Error('Invalid Community book address.')
  return new URL(`/api/community/books/${id}/audio/${encodeURIComponent(chapterId)}`, url).href
}

export function createCommunityBookDownloadStore({
  storage = () => globalThis.caches,
  request = (...args) => fetch(...args),
  native = nativeCommunityBooks,
  notify = () => window.dispatchEvent(new Event(COMMUNITY_BOOK_DOWNLOADS_CHANGED)),
} = {}) {
  const running = new Map()
  async function nameFor(contentUrl, options = {}) {
    const url = new URL(contentUrl)
    if (!options.authorization || url.origin !== options.authorizationOrigin || url.username || url.password
      || !/^\/content\/books\/\d+$/.test(url.pathname) || url.search || url.hash) return null
    // The issuer-bound account id survives token renewal. Tokens are never
    // persisted in the index, request keys, or downloaded responses.
    const owner = options.memberId == null ? options.authorization : `member:${options.memberId}`
    return PREFIX + await digest(new TextEncoder().encode(`${url.origin}\n${owner}\n${url.href}`))
  }
  async function open(contentUrl, options) {
    const name = await nameFor(contentUrl, options)
    return name && storage() ? { name, cache: await storage().open(name) } : null
  }
  async function fetchChecked(url, options = {}, signal) {
    const headers = {}
    if (options.authorization && new URL(url).origin === options.authorizationOrigin) headers.Authorization = options.authorization
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    const timeout = setTimeout(abort, 60000)
    try {
      const response = await request(url, { headers, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal })
      if (!response.ok) {
        const error = new Error(`The church server returned HTTP ${response.status}.`)
        error.status = response.status
        throw error
      }
      // Keep the timeout active until the body has finished, not just headers.
      return new Response(await response.arrayBuffer(), { headers: { 'Content-Type': response.headers.get('content-type') || 'application/octet-stream' } })
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  }
  async function remove(name) {
    if (!new RegExp(`^${PREFIX}[a-f0-9]{64}$`).test(name)) return false
    const job = running.get(name)
    if (job) { job.controller.abort(); await job.promise.catch(() => {}) }
    if (native()) await removeCommunityAudioFiles(name)
    const deleted = await storage()?.delete(name)
    notify()
    return Boolean(deleted)
  }
  async function invalidate(name) {
    if (native()) await removeCommunityAudioFiles(name)
    await storage()?.delete(name)
    notify()
  }
  async function loadDocument(contentUrl, options = {}) {
    const saved = await open(contentUrl, options)
    try {
      const response = await fetchChecked(contentUrl, options)
      return { value: await response.json(), source: 'network' }
    } catch (error) {
      if (denied(error)) {
        if (saved) await remove(saved.name)
        throw error
      }
      const cached = await saved?.cache.match(contentUrl)
      if (cached) return { value: await cached.json(), source: 'cache' }
      throw error
    }
  }
  const audioKey = (url, chapter) => `${url}?heritage-audio=${chapter.audioSha256}`
  async function verify(response, chapter) {
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength !== chapter.audioSize || await digest(bytes) !== chapter.audioSha256) {
      throw new Error('The audio does not match this book’s timestamps. Please retry the download.')
    }
    return new Blob([bytes], { type: 'audio/mpeg' })
  }
  async function loadAudio(contentUrl, chapter, options = {}, signal) {
    const url = communityBookAudioUrl(contentUrl, chapter.id)
    const saved = await open(contentUrl, options)
    const key = audioKey(url, chapter)
    const cached = saved && (native() ? await readCommunityAudioFile(saved.name, chapter) : await saved.cache.match(key))
    if (cached) {
      try { return await verify(cached, chapter) }
      catch { await saved.cache.delete(key) }
    }
    try { return await verify(await fetchChecked(url, options, signal), chapter) }
    catch (error) {
      if (saved && denied(error)) await remove(saved.name)
      throw error
    }
  }
  async function list() {
    if (!storage()) return []
    const names = (await storage().keys()).filter(name => name.startsWith(PREFIX))
    const results = await Promise.all(names.map(async name => {
      const cache = await storage().open(name), response = await cache.match(META_URL)
      if (!response) return null
      return { ...await response.json(), name, downloading: running.has(name) }
    }))
    return results.filter(Boolean)
  }
  async function status(contentUrl, options) {
    const name = await nameFor(contentUrl, options)
    return (await list()).find(record => record.name === name) || null
  }
  async function download(contentUrl, options, onProgress = () => {}) {
    const saved = await open(contentUrl, options)
    if (!saved) throw new Error('Sign in to your Community on this device to download this book. Offline storage must be available.')
    if (running.has(saved.name)) return running.get(saved.name).promise
    const controller = new AbortController()
    const job = { controller, promise: null }
    const promise = (async () => {
      try {
        // Every new download/resume rechecks server authorization first.
        const response = await fetchChecked(contentUrl, options, controller.signal)
        const document = await response.clone().json()
        const chapters = document.readAlong?.chapters || []
        const record = { title: document.title || 'Community book', contentUrl, bytes: Number(new TextEncoder().encode(JSON.stringify(document)).byteLength), completed: 0, total: chapters.length, complete: false }
        const write = async () => {
          await saved.cache.put(META_URL, new Response(JSON.stringify(record), { headers: { 'Content-Type': 'application/json' } }))
          onProgress({ ...record }); notify()
        }
        await saved.cache.put(contentUrl, response)
        await write()
        for (const chapter of chapters) {
          if (controller.signal.aborted) throw new DOMException('Download stopped.', 'AbortError')
          const url = communityBookAudioUrl(contentUrl, chapter.id), key = audioKey(url, chapter)
          let cached = native() ? await readCommunityAudioFile(saved.name, chapter) : await saved.cache.match(key), valid = false
          if (cached) { try { await verify(cached, chapter); valid = true } catch { await saved.cache.delete(key) } }
          if (!valid) {
            const audio = await fetchChecked(url, options, controller.signal)
            const blob = await verify(audio, chapter)
            if (controller.signal.aborted) throw new DOMException('Download stopped.', 'AbortError')
            if (native()) await writeCommunityAudioFile(saved.name, chapter, blob)
            else await saved.cache.put(key, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }))
          }
          record.completed++
          record.bytes += chapter.audioSize
          await write()
        }
        record.complete = true
        await write()
        // Remove audio from older editions only after this download succeeds.
        const keep = new Set([META_URL, contentUrl, ...chapters.map(ch => audioKey(communityBookAudioUrl(contentUrl, ch.id), ch))])
        for (const request of await saved.cache.keys()) if (!keep.has(request.url)) await saved.cache.delete(request)
        return record
      } catch (error) {
        if (denied(error)) await invalidate(saved.name)
        throw error
      } finally { running.delete(saved.name); notify() }
    })()
    job.promise = promise
    running.set(saved.name, job)
    return promise
  }
  function stopAll() { for (const job of running.values()) job.controller.abort() }
  return { download, loadDocument, loadAudio, list, status, remove, stopAll, nameFor }
}

export const communityBookDownloads = createCommunityBookDownloadStore()
if (typeof window !== 'undefined') window.addEventListener('heritage-community-session-change', () => communityBookDownloads.stopAll())
