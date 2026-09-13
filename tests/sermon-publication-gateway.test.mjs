import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  MAX_PUBLIC_SERMON_CATALOG_BYTES,
  PublicSermonContractError,
  SERMON_PUBLIC_MEDIA_TYPE,
  derivePublicSermonId,
  serializePublicSermonCatalog,
  serializePublicSermonDetail,
  sha256Hex,
} from '../src/services/sermonCatalog.js'
import {
  AnonymousSermonPublicationGateway,
  MemorySermonPublicationCache,
  SermonPublicationGatewayError,
} from '../src/services/sermonPublicationGateway.js'

const fixture = JSON.parse(await readFile(new URL(
  './fixtures/community-sermon-publication-conformance-v1.json',
  import.meta.url,
), 'utf8'))

const CATALOG_URL = 'https://church.example/catalogs/sermons.json'
const DETAIL_URL = `https://church.example/content/sermons/${fixture.publicationState.publicId}`

class RecordingCache {
  constructor() {
    this.entries = new Map()
    this.gets = []
    this.sets = []
    this.deletes = []
    this.readOverride = null
  }

  async get(key) {
    this.gets.push(key)
    if (this.readOverride) return this.readOverride(key)
    return this.entries.get(key)
  }

  async set(key, source) {
    this.sets.push({ key, source })
    this.entries.set(key, source)
  }

  async delete(key) {
    this.deletes.push(key)
    this.entries.delete(key)
  }
}

function publicationResponse(source, mediaType, {
  headers = {},
  status = 200,
} = {}) {
  return new Response(source, {
    status,
    headers: {
      'Content-Type': mediaType,
      ...headers,
    },
  })
}

function routedFetch({
  catalogSource = fixture.catalogSource,
  catalogResponse = null,
  detailSource = fixture.detailSource,
  detailResponse = null,
} = {}) {
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    if (url === CATALOG_URL) {
      return catalogResponse || publicationResponse(catalogSource, 'application/json; charset=utf-8')
    }
    if (url === DETAIL_URL) {
      return detailResponse || publicationResponse(detailSource, SERMON_PUBLIC_MEDIA_TYPE)
    }
    throw new Error(`Unexpected URL: ${url}`)
  }
  return { calls, fetchImpl }
}

async function expectGatewayCode(code, operation) {
  await assert.rejects(operation, error => {
    assert.equal(error instanceof SermonPublicationGatewayError, true)
    assert.equal(error.code, code)
    return true
  })
}

async function makeNextGeneration() {
  const rawDetail = JSON.parse(fixture.detailSource)
  rawDetail.sermonRevision = 'a'.repeat(64)
  rawDetail.body[0].text = `${rawDetail.body[0].text}\nA verified second generation.`
  const detailSource = await serializePublicSermonDetail(rawDetail)
  const rawCatalog = JSON.parse(fixture.catalogSource)
  rawCatalog.items[0].sermonRevision = rawDetail.sermonRevision
  rawCatalog.items[0].checksum = await sha256Hex(detailSource)
  return {
    catalogSource: await serializePublicSermonCatalog(rawCatalog),
    detailSource,
    sermonRevision: rawDetail.sermonRevision,
  }
}

async function makeTwoSermonGeneration() {
  const secondDetail = JSON.parse(fixture.detailSource)
  secondDetail.sermonId = 'Golden:Sermon:Second:2026-07-19'
  secondDetail.publicId = await derivePublicSermonId(secondDetail.sermonId)
  secondDetail.sermonRevision = 'b'.repeat(64)
  secondDetail.serviceDate = '2026-07-19'
  secondDetail.titles = { en: 'A Different Published Sermon' }
  secondDetail.defaultLanguage = 'en'
  secondDetail.body = [{
    kind: 'manuscript',
    language: 'en',
    text: 'The exact reviewed body of the second sermon.',
  }]
  const secondDetailSource = await serializePublicSermonDetail(secondDetail)
  const rawCatalog = JSON.parse(fixture.catalogSource)
  const secondItem = structuredClone(rawCatalog.items[0])
  secondItem.id = secondDetail.publicId
  secondItem.sermonId = secondDetail.sermonId
  secondItem.sermonRevision = secondDetail.sermonRevision
  secondItem.checksum = await sha256Hex(secondDetailSource)
  secondItem.title = secondDetail.titles.en
  secondItem.titles = secondDetail.titles
  secondItem.defaultLanguage = secondDetail.defaultLanguage
  secondItem.serviceDate = secondDetail.serviceDate
  secondItem.content.url = `/content/sermons/${secondDetail.publicId}`
  rawCatalog.items.push(secondItem)
  return {
    catalogSource: await serializePublicSermonCatalog(rawCatalog),
    secondDetail,
    secondDetailSource,
  }
}

test('catalog transport requires HTTPS except for explicit loopback development', () => {
  assert.throws(
    () => new AnonymousSermonPublicationGateway({
      catalogUrl: 'http://church.example/catalogs/sermons',
      fetchImpl: async () => {
        throw new Error('must not fetch')
      },
    }),
    error => (
      error instanceof SermonPublicationGatewayError
      && error.code === 'INVALID_CATALOG_URL'
    ),
  )
  assert.doesNotThrow(() => new AnonymousSermonPublicationGateway({
    catalogUrl: 'http://127.0.0.1:3000/catalogs/sermons',
    fetchImpl: async () => {
      throw new Error('not called')
    },
  }))
})

test('default memory cache enforces LRU entry and byte limits', async () => {
  const entryBound = new MemorySermonPublicationCache({
    maximumBytes: 100,
    maximumEntries: 2,
  })
  await entryBound.set('a', 'alpha')
  await entryBound.set('b', 'beta')
  assert.equal(await entryBound.get('a'), 'alpha')
  await entryBound.set('c', 'charlie')
  assert.equal(await entryBound.get('b'), undefined)
  assert.equal(await entryBound.get('a'), 'alpha')

  const byteBound = new MemorySermonPublicationCache({
    maximumBytes: 5,
    maximumEntries: 10,
  })
  await byteBound.set('too-large', '123456')
  assert.equal(await byteBound.get('too-large'), undefined)
  await byteBound.set('exact', '12345')
  assert.equal(await byteBound.get('exact'), '12345')
  await byteBound.clear()
  assert.equal(await byteBound.get('exact'), undefined)
})

test('anonymous gateway fetches exact bytes, queries deterministically, and caches verified detail', async () => {
  const cache = new RecordingCache()
  const transport = routedFetch()
  const gateway = new AnonymousSermonPublicationGateway({
    catalogUrl: CATALOG_URL,
    fetchImpl: transport.fetchImpl,
    cache,
  })

  await expectGatewayCode(
    'CATALOG_NOT_LOADED',
    () => gateway.querySermonsForRange(fixture.queries[0].range),
  )

  const snapshot = await gateway.refreshCatalog()
  assert.equal(snapshot.catalogChecksum, fixture.publicationState.catalogChecksum)
  assert.equal(snapshot.catalog.items[0].id, fixture.publicationState.publicId)
  assert.deepEqual(cache.sets[0], {
    key: `public-sermon-catalog:v1:${fixture.publicationState.catalogChecksum}`,
    source: fixture.catalogSource,
  })

  const query = await gateway.querySermonsForRange(fixture.queries[0].range)
  assert.equal(query.catalogChecksum, fixture.publicationState.catalogChecksum)
  assert.deepEqual(
    { primary: query.primary, mentioned: query.mentioned },
    fixture.queries[0].expected,
  )

  const first = await gateway.getSermonDetail(fixture.publicationState.publicId)
  const second = await gateway.getSermonDetail(fixture.publicationState.publicId)
  assert.deepEqual(first.detail, second.detail)
  assert.equal(first.checksum, fixture.publicationState.detailChecksum)
  assert.equal(first.catalogChecksum, fixture.publicationState.catalogChecksum)
  assert.match(first.detailCacheKey, new RegExp(
    `public-sermon:v1:${fixture.publicationState.publicId}:`
      + `${fixture.publicationState.publicRevision}:`
      + `${fixture.publicationState.detailChecksum}$`,
  ))
  assert.deepEqual(cache.sets.at(-1), {
    key: first.detailCacheKey,
    source: fixture.detailSource,
  })
  assert.equal(transport.calls.filter(call => call.url === DETAIL_URL).length, 1)

  for (const call of transport.calls) {
    assert.equal(call.options.credentials, 'omit')
    assert.equal(call.options.redirect, 'error')
    assert.equal(call.options.referrerPolicy, 'no-referrer')
    assert.equal(Object.hasOwn(call.options.headers, 'Authorization'), false)
  }
})

test('catalog transport fails closed on status, Content-Type, declared size, and encoding', async t => {
  const cases = [
    [
      'non-2xx',
      publicationResponse('unavailable', 'application/json', { status: 503 }),
      'PUBLICATION_REQUEST_FAILED',
    ],
    [
      'wrong media type',
      publicationResponse(fixture.catalogSource, 'text/plain'),
      'INVALID_RESPONSE_CONTENT_TYPE',
    ],
    [
      'oversized Content-Length',
      publicationResponse(fixture.catalogSource, 'application/json', {
        headers: { 'Content-Length': String(MAX_PUBLIC_SERMON_CATALOG_BYTES + 1) },
      }),
      'RESPONSE_TOO_LARGE',
    ],
    [
      'UTF-8 byte-order mark',
      publicationResponse(
        new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(fixture.catalogSource)]),
        'application/json',
      ),
      'INVALID_RESPONSE_ENCODING',
    ],
    [
      'malformed UTF-8',
      publicationResponse(new Uint8Array([0xc3, 0x28]), 'application/json'),
      'INVALID_RESPONSE_ENCODING',
    ],
  ]

  for (const [label, catalogResponse, code] of cases) {
    await t.test(label, async () => {
      const cache = new RecordingCache()
      const transport = routedFetch({ catalogResponse })
      const gateway = new AnonymousSermonPublicationGateway({
        catalogUrl: CATALOG_URL,
        fetchImpl: transport.fetchImpl,
        cache,
      })
      await expectGatewayCode(code, () => gateway.refreshCatalog())
      assert.equal(cache.sets.length, 0)
    })
  }
})

test('detail transport rejects the wrong media type and never caches it', async () => {
  const cache = new RecordingCache()
  const transport = routedFetch({
    detailResponse: publicationResponse(fixture.detailSource, 'application/json'),
  })
  const gateway = new AnonymousSermonPublicationGateway({
    catalogUrl: CATALOG_URL,
    fetchImpl: transport.fetchImpl,
    cache,
  })
  await gateway.refreshCatalog()

  await expectGatewayCode(
    'INVALID_RESPONSE_CONTENT_TYPE',
    () => gateway.getSermonDetail(fixture.publicationState.publicId),
  )
  assert.equal(cache.sets.length, 1)
})

test('canonical but tampered detail bytes fail catalog checksum agreement and are never cached', async () => {
  const rawDetail = JSON.parse(fixture.detailSource)
  rawDetail.body[0].text = 'Canonical attacker-controlled replacement.'
  const tamperedSource = await serializePublicSermonDetail(rawDetail)
  const cache = new RecordingCache()
  const transport = routedFetch({ detailSource: tamperedSource })
  const gateway = new AnonymousSermonPublicationGateway({
    catalogUrl: CATALOG_URL,
    fetchImpl: transport.fetchImpl,
    cache,
  })
  await gateway.refreshCatalog()

  await assert.rejects(
    () => gateway.getSermonDetail(fixture.publicationState.publicId),
    error => {
      assert.equal(error instanceof PublicSermonContractError, true)
      assert.equal(error.code, 'PUBLIC_CATALOG_DETAIL_MISMATCH')
      return true
    },
  )
  assert.equal(cache.sets.length, 1)
})

test('a valid different sermon served from the requested URL is rejected and never cross-cached', async () => {
  const twoSermons = await makeTwoSermonGeneration()
  const cache = new RecordingCache()
  const fetchImpl = async url => {
    if (url === CATALOG_URL) {
      return publicationResponse(twoSermons.catalogSource, 'application/json')
    }
    if (url === DETAIL_URL) {
      return publicationResponse(
        twoSermons.secondDetailSource,
        SERMON_PUBLIC_MEDIA_TYPE,
      )
    }
    throw new Error(`Unexpected URL: ${url}`)
  }
  const gateway = new AnonymousSermonPublicationGateway({
    catalogUrl: CATALOG_URL,
    fetchImpl,
    cache,
  })
  await gateway.refreshCatalog()

  await expectGatewayCode(
    'PUBLIC_SERMON_ID_MISMATCH',
    () => gateway.getSermonDetail(fixture.publicationState.publicId),
  )
  assert.equal(cache.sets.length, 1)
  assert.equal(
    [...cache.entries.values()].includes(twoSermons.secondDetailSource),
    false,
  )
})

test('malicious cached detail is deleted, reverified from the network, and replaced', async () => {
  const rawDetail = JSON.parse(fixture.detailSource)
  rawDetail.body[0].text = 'Stale cache injection.'
  const injectedSource = await serializePublicSermonDetail(rawDetail)
  const cache = new RecordingCache()
  let injected = true
  cache.readOverride = key => {
    if (key.startsWith('public-sermon-detail:') && injected) {
      injected = false
      return injectedSource
    }
    return cache.entries.get(key)
  }
  const transport = routedFetch()
  const gateway = new AnonymousSermonPublicationGateway({
    catalogUrl: CATALOG_URL,
    fetchImpl: transport.fetchImpl,
    cache,
  })
  await gateway.refreshCatalog()

  const verified = await gateway.getSermonDetail(fixture.publicationState.publicId)
  assert.equal(verified.detail.body[0].text, JSON.parse(fixture.detailSource).body[0].text)
  assert.deepEqual(cache.deletes, [verified.detailCacheKey])
  assert.deepEqual(cache.sets.at(-1), {
    key: verified.detailCacheKey,
    source: fixture.detailSource,
  })
  assert.equal(transport.calls.filter(call => call.url === DETAIL_URL).length, 1)
})

test('a new catalog generation cannot reuse a prior generation detail cache entry', async () => {
  const next = await makeNextGeneration()
  let catalogSource = fixture.catalogSource
  let detailSource = fixture.detailSource
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    if (url === CATALOG_URL) return publicationResponse(catalogSource, 'application/json')
    if (url === DETAIL_URL) return publicationResponse(detailSource, SERMON_PUBLIC_MEDIA_TYPE)
    throw new Error(`Unexpected URL: ${url}`)
  }
  const cache = new RecordingCache()
  const gateway = new AnonymousSermonPublicationGateway({
    catalogUrl: CATALOG_URL,
    fetchImpl,
    cache,
  })

  await gateway.refreshCatalog()
  const first = await gateway.getSermonDetail(fixture.publicationState.publicId)
  catalogSource = next.catalogSource
  detailSource = next.detailSource
  await gateway.refreshCatalog()
  const second = await gateway.getSermonDetail(fixture.publicationState.publicId)

  assert.notEqual(first.catalogChecksum, second.catalogChecksum)
  assert.notEqual(first.detailCacheKey, second.detailCacheKey)
  assert.equal(second.detail.sermonRevision, next.sermonRevision)
  assert.equal(calls.filter(call => call.url === DETAIL_URL).length, 2)
  assert.equal(cache.gets.includes(first.detailCacheKey), true)
  assert.equal(cache.gets.at(-1), second.detailCacheKey)
})

test('an unrelated sermon generation change reuses an unchanged verified detail', async () => {
  const firstGeneration = await makeTwoSermonGeneration()
  const changedSecond = structuredClone(firstGeneration.secondDetail)
  changedSecond.sermonRevision = 'c'.repeat(64)
  changedSecond.body[0].text += '\nA later reviewed paragraph.'
  const changedSecondSource = await serializePublicSermonDetail(changedSecond)
  const nextCatalog = JSON.parse(firstGeneration.catalogSource)
  const changedItem = nextCatalog.items.find(
    item => item.id === changedSecond.publicId,
  )
  changedItem.sermonRevision = changedSecond.sermonRevision
  changedItem.checksum = await sha256Hex(changedSecondSource)
  const nextCatalogSource = await serializePublicSermonCatalog(nextCatalog)

  let catalogSource = firstGeneration.catalogSource
  let detailCalls = 0
  let detailOffline = false
  const fetchImpl = async url => {
    if (url === CATALOG_URL) {
      return publicationResponse(catalogSource, 'application/json')
    }
    if (url === DETAIL_URL) {
      detailCalls += 1
      if (detailOffline) throw new Error('offline detail transport')
      return publicationResponse(fixture.detailSource, SERMON_PUBLIC_MEDIA_TYPE)
    }
    throw new Error(`Unexpected URL: ${url}`)
  }
  const gateway = new AnonymousSermonPublicationGateway({
    catalogUrl: CATALOG_URL,
    fetchImpl,
  })
  await gateway.refreshCatalog()
  const before = await gateway.getSermonDetail(
    fixture.publicationState.publicId,
  )

  catalogSource = nextCatalogSource
  await gateway.refreshCatalog()
  detailOffline = true
  const after = await gateway.getSermonDetail(
    fixture.publicationState.publicId,
  )

  assert.notEqual(before.catalogChecksum, after.catalogChecksum)
  assert.equal(before.detailCacheKey, after.detailCacheKey)
  assert.equal(after.detail.sermonRevision, fixture.publicationState.publicRevision)
  assert.equal(detailCalls, 1)
})

test('an in-flight old-generation detail cannot publish into a refreshed generation', async () => {
  const next = await makeNextGeneration()
  let catalogSource = fixture.catalogSource
  let releaseDetail
  let detailRequested
  const detailStarted = new Promise(resolve => {
    detailRequested = resolve
  })
  const fetchImpl = async url => {
    if (url === CATALOG_URL) return publicationResponse(catalogSource, 'application/json')
    if (url === DETAIL_URL) {
      detailRequested()
      return new Promise(resolve => {
        releaseDetail = resolve
      })
    }
    throw new Error(`Unexpected URL: ${url}`)
  }
  const cache = new RecordingCache()
  const gateway = new AnonymousSermonPublicationGateway({
    catalogUrl: CATALOG_URL,
    fetchImpl,
    cache,
  })
  await gateway.refreshCatalog()

  const staleLoad = gateway.getSermonDetail(fixture.publicationState.publicId)
  await detailStarted
  catalogSource = next.catalogSource
  await gateway.refreshCatalog()
  releaseDetail(publicationResponse(fixture.detailSource, SERMON_PUBLIC_MEDIA_TYPE))

  await expectGatewayCode('CATALOG_GENERATION_CHANGED', () => staleLoad)
  assert.equal(
    cache.sets.some(entry => entry.source === fixture.detailSource),
    false,
  )
})

test('a slower older catalog refresh cannot roll back a newer completed generation', async () => {
  const next = await makeNextGeneration()
  const releases = []
  const fetchImpl = async url => {
    if (url !== CATALOG_URL) throw new Error(`Unexpected URL: ${url}`)
    return new Promise(resolve => releases.push(resolve))
  }
  const gateway = new AnonymousSermonPublicationGateway({
    catalogUrl: CATALOG_URL,
    fetchImpl,
  })

  const olderRefresh = gateway.refreshCatalog()
  const newerRefresh = gateway.refreshCatalog()
  assert.equal(releases.length, 2)
  releases[1](publicationResponse(next.catalogSource, 'application/json'))
  const newerSnapshot = await newerRefresh
  releases[0](publicationResponse(fixture.catalogSource, 'application/json'))

  await expectGatewayCode('CATALOG_REFRESH_SUPERSEDED', () => olderRefresh)
  assert.equal(
    gateway.getCatalogSnapshot().catalogChecksum,
    newerSnapshot.catalogChecksum,
  )
  assert.equal(
    gateway.getCatalogSnapshot().catalog.items[0].sermonRevision,
    next.sermonRevision,
  )
})

test('an exact same-generation refresh does not invalidate an in-flight detail', async () => {
  let releaseDetail
  let detailRequested
  const detailStarted = new Promise(resolve => {
    detailRequested = resolve
  })
  const fetchImpl = async url => {
    if (url === CATALOG_URL) {
      return publicationResponse(fixture.catalogSource, 'application/json')
    }
    if (url === DETAIL_URL) {
      detailRequested()
      return new Promise(resolve => {
        releaseDetail = resolve
      })
    }
    throw new Error(`Unexpected URL: ${url}`)
  }
  const gateway = new AnonymousSermonPublicationGateway({
    catalogUrl: CATALOG_URL,
    fetchImpl,
  })
  await gateway.refreshCatalog()

  const detailLoad = gateway.getSermonDetail(
    fixture.publicationState.publicId,
  )
  await detailStarted
  const beforeRefresh = gateway.getCatalogSnapshot()
  const afterRefresh = await gateway.refreshCatalog()
  assert.equal(afterRefresh.catalogChecksum, beforeRefresh.catalogChecksum)
  releaseDetail(publicationResponse(
    fixture.detailSource,
    SERMON_PUBLIC_MEDIA_TYPE,
  ))

  const verified = await detailLoad
  assert.equal(verified.detail.publicId, fixture.publicationState.publicId)
  assert.equal(verified.catalogChecksum, beforeRefresh.catalogChecksum)
})

test('an unresponsive publication request is cancelled instead of leaving the reader loading indefinitely', async () => {
  let aborted = false
  const gateway = new AnonymousSermonPublicationGateway({
    catalogUrl: 'https://church.example/publications/sermons/catalog.json',
    requestTimeoutMs: 10,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
    }),
  })
  await assert.rejects(gateway.refreshCatalog(), { code: 'PUBLICATION_REQUEST_FAILED' })
  assert.equal(aborted, true)
})
