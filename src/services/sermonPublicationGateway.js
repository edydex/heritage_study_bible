import {
  MAX_PUBLIC_SERMON_CATALOG_BYTES,
  MAX_PUBLIC_SERMON_DETAIL_BYTES,
  SERMON_PUBLIC_MEDIA_TYPE,
  parsePublicSermonCatalogSource,
  publicSermonCacheIdentity,
  queryPublicSermonsForRange,
  sha256Hex,
  verifyPublicSermonCatalogDetail,
} from './sermonCatalog.js'

const CATALOG_MEDIA_TYPE = 'application/json'
const CACHE_KEY_VERSION = 1
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true })
const UTF8_ENCODER = new TextEncoder()
const DEFAULT_CACHE_MAX_ENTRIES = 128
const DEFAULT_CACHE_MAX_BYTES = 32 * 1024 * 1024

export class SermonPublicationGatewayError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'SermonPublicationGatewayError'
    this.code = code
    this.details = details
  }
}

function fail(code, message, details = {}) {
  throw new SermonPublicationGatewayError(code, message, details)
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

function normalizeCatalogUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes('\\')) {
    fail('INVALID_CATALOG_URL', 'A complete public sermon catalog URL is required.')
  }
  let url
  try {
    url = new URL(value)
  } catch {
    fail('INVALID_CATALOG_URL', 'The public sermon catalog URL is invalid.')
  }
  const loopback = url.hostname === 'localhost'
    || url.hostname === '127.0.0.1'
    || url.hostname === '[::1]'
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
    || !url.hostname
    || url.username
    || url.password
    || url.hash
  ) {
    fail(
      'INVALID_CATALOG_URL',
      'The public sermon catalog URL must use HTTPS, except for explicit loopback development, without credentials or a fragment.',
    )
  }
  return url.href
}

function catalogCacheKey(checksum) {
  return `public-sermon-catalog:v${CACHE_KEY_VERSION}:${checksum}`
}

function detailCacheKey(item) {
  return `public-sermon-detail:v${CACHE_KEY_VERSION}:${
    publicSermonCacheIdentity({
      publicId: item.id,
      sermonRevision: item.sermonRevision,
      checksum: item.checksum,
    })
  }`
}

function resolveDetailUrl(catalogUrl, item) {
  let url
  try {
    url = new URL(item.content.url, catalogUrl)
  } catch {
    fail('INVALID_DETAIL_URL', 'The public sermon detail URL is invalid.')
  }
  const catalogOrigin = new URL(catalogUrl).origin
  if (
    !['http:', 'https:'].includes(url.protocol)
    || url.origin !== catalogOrigin
    || url.username
    || url.password
    || url.hash
  ) {
    fail(
      'INVALID_DETAIL_URL',
      'Public sermon details must use the catalog server origin without credentials or a fragment.',
    )
  }
  return url.href
}

function normalizeContentType(rawValue, expectedMediaType, label) {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    fail('INVALID_RESPONSE_CONTENT_TYPE', `${label} response has no Content-Type header.`)
  }
  const [rawMediaType, ...rawParameters] = rawValue.split(';')
  const mediaType = rawMediaType.trim().toLowerCase()
  if (mediaType !== expectedMediaType.toLowerCase()) {
    fail(
      'INVALID_RESPONSE_CONTENT_TYPE',
      `${label} response has an unsupported Content-Type.`,
      { expected: expectedMediaType, received: rawValue },
    )
  }
  let sawCharset = false
  for (const rawParameter of rawParameters) {
    const parameter = rawParameter.trim()
    const separator = parameter.indexOf('=')
    if (separator < 1) {
      fail(
        'INVALID_RESPONSE_CONTENT_TYPE',
        `${label} response has an invalid Content-Type parameter.`,
      )
    }
    const name = parameter.slice(0, separator).trim().toLowerCase()
    const value = parameter.slice(separator + 1).trim().replace(/^"(.*)"$/, '$1').toLowerCase()
    if (name !== 'charset' || value !== 'utf-8' || sawCharset) {
      fail(
        'INVALID_RESPONSE_CONTENT_TYPE',
        `${label} response has an unsupported Content-Type parameter.`,
        { parameter },
      )
    }
    sawCharset = true
  }
}

function assertContentLength(response, maximumBytes, label) {
  const rawLength = response.headers.get('content-length')
  if (rawLength === null) return
  if (!/^(0|[1-9]\d*)$/.test(rawLength.trim())) {
    fail('INVALID_RESPONSE_SIZE', `${label} response has an invalid Content-Length header.`)
  }
  const contentLength = Number(rawLength)
  if (!Number.isSafeInteger(contentLength) || contentLength > maximumBytes) {
    fail(
      'RESPONSE_TOO_LARGE',
      `${label} response exceeds the verified publication size limit.`,
      { maximumBytes, contentLength },
    )
  }
}

async function readBoundedBytes(response, maximumBytes, label) {
  assertContentLength(response, maximumBytes, label)

  if (response.body?.getReader) {
    const reader = response.body.getReader()
    const chunks = []
    let sizeBytes = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!(value instanceof Uint8Array)) {
          fail('INVALID_RESPONSE_BODY', `${label} response body is not a byte stream.`)
        }
        sizeBytes += value.byteLength
        if (sizeBytes > maximumBytes) {
          try {
            await reader.cancel()
          } catch {
            // The size violation is authoritative even if cancellation fails.
          }
          fail(
            'RESPONSE_TOO_LARGE',
            `${label} response exceeds the verified publication size limit.`,
            { maximumBytes, sizeBytes },
          )
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock?.()
    }
    const bytes = new Uint8Array(sizeBytes)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    return bytes
  }

  if (typeof response.arrayBuffer !== 'function') {
    fail('INVALID_RESPONSE_BODY', `${label} response has no readable byte body.`)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > maximumBytes) {
    fail(
      'RESPONSE_TOO_LARGE',
      `${label} response exceeds the verified publication size limit.`,
      { maximumBytes, sizeBytes: bytes.byteLength },
    )
  }
  return bytes
}

function decodeExactUtf8(bytes, label) {
  if (
    bytes.byteLength >= 3
    && bytes[0] === 0xef
    && bytes[1] === 0xbb
    && bytes[2] === 0xbf
  ) {
    fail('INVALID_RESPONSE_ENCODING', `${label} response must not contain a UTF-8 byte-order mark.`)
  }
  try {
    return UTF8_DECODER.decode(bytes)
  } catch {
    fail('INVALID_RESPONSE_ENCODING', `${label} response is not valid UTF-8.`)
  }
}

function assertResponse(response, requestedUrl, expectedMediaType, label) {
  if (
    !response
    || typeof response !== 'object'
    || !Number.isInteger(response.status)
    || !response.headers
    || typeof response.headers.get !== 'function'
  ) {
    fail('INVALID_RESPONSE', `${label} request returned an invalid response.`)
  }
  if (response.status < 200 || response.status > 299) {
    fail(
      'PUBLICATION_REQUEST_FAILED',
      `${label} request failed with HTTP ${response.status}.`,
      { status: response.status },
    )
  }
  if (response.redirected || response.type === 'opaqueredirect') {
    fail('PUBLICATION_REDIRECTED', `${label} request must not follow a redirect.`)
  }
  if (response.url && response.url !== requestedUrl) {
    fail(
      'PUBLICATION_REDIRECTED',
      `${label} response URL differs from the requested publication URL.`,
    )
  }
  normalizeContentType(response.headers.get('content-type'), expectedMediaType, label)
}

async function fetchExactSource({
  fetchImpl,
  url,
  expectedMediaType,
  maximumBytes,
  label,
  signal,
  timeoutMs,
}) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(abort, timeoutMs)
  try {
    let response
    try {
      response = await fetchImpl(url, {
        cache: 'no-store',
        credentials: 'omit',
        headers: { Accept: expectedMediaType },
        method: 'GET',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      })
    } catch (error) {
      fail(
        'PUBLICATION_REQUEST_FAILED',
        `${label} request could not be completed.`,
        { causeName: error?.name || null },
      )
    }
    assertResponse(response, url, expectedMediaType, label)
    try {
      return decodeExactUtf8(await readBoundedBytes(response, maximumBytes, label), label)
    } catch (error) {
      if (error instanceof SermonPublicationGatewayError) throw error
      fail(
        'PUBLICATION_REQUEST_FAILED',
        `${label} response body could not be read.`,
        { causeName: error?.name || null },
      )
    }
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

async function cacheRead(cache, key) {
  try {
    return await cache.get(key)
  } catch {
    return undefined
  }
}

async function cacheWrite(cache, key, source) {
  try {
    await cache.set(key, source)
  } catch {
    // A cache is an optional optimization, never a publication authority.
  }
}

async function cacheDelete(cache, key) {
  try {
    await cache.delete(key)
  } catch {
    // A broken cache must not block a verified network publication.
  }
}

export class MemorySermonPublicationCache {
  #entries = new Map()

  #maximumBytes

  #maximumEntries

  #sizeBytes = 0

  constructor({
    maximumBytes = DEFAULT_CACHE_MAX_BYTES,
    maximumEntries = DEFAULT_CACHE_MAX_ENTRIES,
  } = {}) {
    if (
      !Number.isSafeInteger(maximumBytes)
      || maximumBytes < 1
      || !Number.isSafeInteger(maximumEntries)
      || maximumEntries < 1
    ) {
      fail(
        'INVALID_GATEWAY_CONFIGURATION',
        'The in-memory sermon publication cache needs positive integer limits.',
      )
    }
    this.#maximumBytes = maximumBytes
    this.#maximumEntries = maximumEntries
  }

  async get(key) {
    const entry = this.#entries.get(key)
    if (!entry) return undefined
    this.#entries.delete(key)
    this.#entries.set(key, entry)
    return entry.source
  }

  async set(key, source) {
    if (typeof source !== 'string') return
    const sizeBytes = UTF8_ENCODER.encode(source).byteLength
    const previous = this.#entries.get(key)
    if (previous) {
      this.#sizeBytes -= previous.sizeBytes
      this.#entries.delete(key)
    }
    if (sizeBytes > this.#maximumBytes) return
    this.#entries.set(key, { sizeBytes, source })
    this.#sizeBytes += sizeBytes
    while (
      this.#entries.size > this.#maximumEntries
      || this.#sizeBytes > this.#maximumBytes
    ) {
      const oldestKey = this.#entries.keys().next().value
      if (oldestKey === undefined) break
      const oldest = this.#entries.get(oldestKey)
      this.#entries.delete(oldestKey)
      this.#sizeBytes -= oldest?.sizeBytes || 0
    }
  }

  async delete(key) {
    const previous = this.#entries.get(key)
    if (previous) this.#sizeBytes -= previous.sizeBytes
    this.#entries.delete(key)
  }

  clear() {
    this.#entries.clear()
    this.#sizeBytes = 0
  }
}

export class AnonymousSermonPublicationGateway {
  #cache

  #catalogUrl

  #fetch

  #requestTimeoutMs

  #generation = null

  #refreshSequence = 0

  constructor({
    catalogUrl,
    fetchImpl = globalThis.fetch,
    cache = new MemorySermonPublicationCache(),
    requestTimeoutMs = 15000,
  } = {}) {
    this.#catalogUrl = normalizeCatalogUrl(catalogUrl)
    if (typeof fetchImpl !== 'function') {
      fail('INVALID_GATEWAY_CONFIGURATION', 'An anonymous fetch implementation is required.')
    }
    if (
      !cache
      || typeof cache.get !== 'function'
      || typeof cache.set !== 'function'
      || typeof cache.delete !== 'function'
    ) {
      fail(
        'INVALID_GATEWAY_CONFIGURATION',
        'The sermon publication cache must provide get, set, and delete methods.',
      )
    }
    if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
      fail('INVALID_GATEWAY_CONFIGURATION', 'A positive request timeout is required.')
    }
    this.#requestTimeoutMs = requestTimeoutMs
    this.#fetch = fetchImpl
    this.#cache = cache
  }

  #requireGeneration() {
    if (!this.#generation) {
      fail(
        'CATALOG_NOT_LOADED',
        'Load the public sermon catalog before querying sermon publications.',
      )
    }
    return this.#generation
  }

  #assertCurrentGeneration(generation) {
    if (this.#generation !== generation) {
      fail(
        'CATALOG_GENERATION_CHANGED',
        'The public sermon catalog changed while a sermon detail was loading.',
      )
    }
  }

  #assertLatestRefresh(sequence) {
    if (this.#refreshSequence !== sequence) {
      fail(
        'CATALOG_REFRESH_SUPERSEDED',
        'A newer public sermon catalog refresh superseded this response.',
      )
    }
  }

  async #verifyRequestedDetail(generation, item, detailSource) {
    const verified = await verifyPublicSermonCatalogDetail({
      catalog: generation.catalog,
      detailSource,
    })
    this.#assertCurrentGeneration(generation)
    if (verified.item.id !== item.id) {
      fail(
        'PUBLIC_SERMON_ID_MISMATCH',
        'The public sermon detail does not match the requested catalog item.',
        {
          requestedPublicId: item.id,
          receivedPublicId: verified.item.id,
        },
      )
    }
    return verified
  }

  async refreshCatalog({ signal } = {}) {
    const refreshSequence = ++this.#refreshSequence
    const source = await fetchExactSource({
      fetchImpl: this.#fetch,
      timeoutMs: this.#requestTimeoutMs,
      url: this.#catalogUrl,
      expectedMediaType: CATALOG_MEDIA_TYPE,
      maximumBytes: MAX_PUBLIC_SERMON_CATALOG_BYTES,
      label: 'Public sermon catalog',
      signal,
    })
    const catalog = await parsePublicSermonCatalogSource(source)
    const checksum = await sha256Hex(source)
    this.#assertLatestRefresh(refreshSequence)
    const existingGeneration = this.#generation
    if (existingGeneration?.catalogChecksum === checksum) {
      await cacheWrite(this.#cache, existingGeneration.catalogCacheKey, source)
      this.#assertLatestRefresh(refreshSequence)
      return this.getCatalogSnapshot()
    }
    const generation = deepFreeze({
      catalog,
      catalogCacheKey: catalogCacheKey(checksum),
      catalogChecksum: checksum,
      catalogUrl: this.#catalogUrl,
    })
    await cacheWrite(this.#cache, generation.catalogCacheKey, source)
    this.#assertLatestRefresh(refreshSequence)
    this.#generation = generation
    return this.getCatalogSnapshot()
  }

  getCatalogSnapshot() {
    const generation = this.#requireGeneration()
    return deepFreeze({
      catalog: generation.catalog,
      catalogCacheKey: generation.catalogCacheKey,
      catalogChecksum: generation.catalogChecksum,
      catalogUrl: generation.catalogUrl,
    })
  }

  async querySermonsForRange(range) {
    const generation = this.#requireGeneration()
    const matches = await queryPublicSermonsForRange(generation.catalog, range)
    this.#assertCurrentGeneration(generation)
    return deepFreeze({
      catalogChecksum: generation.catalogChecksum,
      primary: matches.primary,
      mentioned: matches.mentioned,
    })
  }

  async getSermonDetail(publicId, { signal } = {}) {
    const generation = this.#requireGeneration()
    const item = generation.catalog.items.find(candidate => candidate.id === publicId)
    if (!item) {
      fail('SERMON_NOT_IN_CATALOG', 'The requested sermon is not in the active public catalog.')
    }
    const cacheKey = detailCacheKey(item)
    const cachedSource = await cacheRead(this.#cache, cacheKey)
    this.#assertCurrentGeneration(generation)

    if (cachedSource !== undefined && cachedSource !== null) {
      if (typeof cachedSource === 'string') {
        try {
          const verified = await this.#verifyRequestedDetail(
            generation,
            item,
            cachedSource,
          )
          return deepFreeze({
            ...verified,
            catalogChecksum: generation.catalogChecksum,
            detailCacheKey: cacheKey,
          })
        } catch (error) {
          if (
            error instanceof SermonPublicationGatewayError
            && error.code === 'CATALOG_GENERATION_CHANGED'
          ) {
            throw error
          }
        }
      }
      await cacheDelete(this.#cache, cacheKey)
      this.#assertCurrentGeneration(generation)
    }

    const detailUrl = resolveDetailUrl(this.#catalogUrl, item)
    const detailSource = await fetchExactSource({
      fetchImpl: this.#fetch,
      timeoutMs: this.#requestTimeoutMs,
      url: detailUrl,
      expectedMediaType: SERMON_PUBLIC_MEDIA_TYPE,
      maximumBytes: MAX_PUBLIC_SERMON_DETAIL_BYTES,
      label: 'Public sermon detail',
      signal,
    })
    const verified = await this.#verifyRequestedDetail(
      generation,
      item,
      detailSource,
    )
    await cacheWrite(this.#cache, cacheKey, detailSource)
    this.#assertCurrentGeneration(generation)
    return deepFreeze({
      ...verified,
      catalogChecksum: generation.catalogChecksum,
      detailCacheKey: cacheKey,
    })
  }
}

export function createAnonymousSermonPublicationGateway(options) {
  return new AnonymousSermonPublicationGateway(options)
}
