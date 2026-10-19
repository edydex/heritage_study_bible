import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  buildManagerSermonPublicationTransition,
} from '../src/lib/syncshow/ManagerSermonPublication.ts'
import {
  buildPublicSermonProjection,
  derivePublicSermonId,
  serializePublicSermonCatalogItem,
} from '../src/lib/syncshow/PublicSermonPublication.ts'
import {
  publicSermonMediaOptionsResponse,
  servePublicSermonMedia,
} from '../src/lib/syncshow/PublicSermonMediaRoute.ts'
import {
  isPublicSermonMediaNamespaceUrl,
  loadActivePublicSermonMediaObject,
  parsePublicSermonMediaUrl,
  publicSermonMediaUrl,
} from '../src/lib/syncshow/SermonPublicationStore.ts'
import { createSermonRevision } from '../src/lib/syncshow/SermonDocument.ts'
import { sermonMediaCommunityNamespace } from '../src/lib/syncshow/SermonMediaStore.ts'
import { sermonMediaObjectKey } from '../src/lib/syncshow/SermonMediaStorage.ts'

type AnyRecord = Record<string, any>

const COMMUNITY_ID = 7
const SYNC_ID = 'managed-public-sermon'
const PUBLIC_ID = derivePublicSermonId(SYNC_ID)
const PUBLIC_ORIGIN = 'https://community.heritage.faith'

function digest(value: Uint8Array | string) {
  return createHash('sha256').update(value).digest('hex')
}

function queryText(query: AnyRecord) {
  let text = ''
  for (const chunk of query?.queryChunks || []) {
    text += chunk && typeof chunk === 'object' && Array.isArray(chunk.value)
      ? chunk.value.join('')
      : '?'
  }
  return text
}

async function withHarness(
  callback: (harness: Awaited<ReturnType<typeof makeHarness>>) => Promise<void>,
) {
  const root = await mkdtemp(path.join(tmpdir(), 'heritage-public-sermon-media-'))
  const previousStorage = process.env.HERITAGE_SERMON_MEDIA_PATH
  const previousPublicUrl = process.env.COMMUNITY_PUBLIC_URL
  process.env.HERITAGE_SERMON_MEDIA_PATH = root
  process.env.COMMUNITY_PUBLIC_URL = PUBLIC_ORIGIN
  try {
    await callback(await makeHarness(root))
  } finally {
    if (previousStorage === undefined) delete process.env.HERITAGE_SERMON_MEDIA_PATH
    else process.env.HERITAGE_SERMON_MEDIA_PATH = previousStorage
    if (previousPublicUrl === undefined) delete process.env.COMMUNITY_PUBLIC_URL
    else process.env.COMMUNITY_PUBLIC_URL = previousPublicUrl
    await rm(root, { recursive: true, force: true })
  }
}

async function makeHarness(root: string) {
  const bytes = Buffer.alloc(512)
  Buffer.from([0xff, 0xfb, 0x90, 0x64]).copy(bytes, 0)
  Buffer.from('exact public managed recording bytes').copy(bytes, 32)
  const sha256 = digest(bytes)
  const mediaUrl = publicSermonMediaUrl(PUBLIC_ID, sha256)
  const ready = createSermonRevision({
    schemaVersion: 3,
    kind: 'syncshow-sermon',
    id: SYNC_ID,
    titles: { en: 'Managed public sermon' },
    defaultLanguage: 'en',
    speaker: { id: null, name: 'Pastor Example' },
    serviceDate: '2026-08-10',
    series: null,
    outline: [],
    references: [{
      id: 'primary-John-3-16',
      range: {
        schemaVersion: 1,
        bookId: 'John',
        start: { chapter: 3, verse: 16 },
        end: { chapter: 3, verse: 16 },
      },
      role: 'primary',
      source: 'operator',
      reviewStatus: 'confirmed',
      enteredText: 'John 3:16',
      sourceId: null,
      sectionId: null,
      startOffset: null,
      endOffset: null,
    }],
    sources: [],
    body: [{
      id: 'written-alternative',
      kind: 'manuscript',
      language: 'en',
      sourceId: null,
      sectionId: null,
      text: 'An exact accessible written alternative.',
    }],
    media: [{
      id: 'post-service:recording:en',
      kind: 'audio',
      status: 'ready',
      title: 'Sunday sermon recording',
      language: 'en',
      mediaType: 'audio/mpeg',
      fileName: 'private-original-name.mp3',
      sha256,
      sizeBytes: bytes.byteLength,
      durationSeconds: 1800,
      url: mediaUrl,
    }],
    publication: {
      status: 'ready',
      visibility: 'private',
      publishedAt: null,
      canonicalUrl: null,
    },
  })
  const transition = buildManagerSermonPublicationTransition({
    documentSource: ready.source,
    publishedAt: '2026-08-10T21:00:00.000Z',
    selectedBodyEntryIds: ['written-alternative'],
    selectedMediaIds: ['post-service:recording:en'],
  })
  const catalogItemSource = serializePublicSermonCatalogItem(
    transition.projection.catalogItem,
  )
  const storageKey = sermonMediaObjectKey(
    sermonMediaCommunityNamespace(COMMUNITY_ID),
    sha256,
  )
  const row = {
    schemaVersion: '1',
    active: true,
    visibility: 'public',
    publicationVersion: '1',
    publishedAt: '2026-08-10 14:00:00-07',
    withdrawnAt: null,
    syncId: SYNC_ID,
    publicId: PUBLIC_ID,
    publicRevision: transition.publicRevision,
    publishedDocumentSource: transition.documentSource,
    selectedBodyEntryIds: transition.selectedBodyEntryIds,
    selectedMediaIds: transition.selectedMediaIds,
    detailChecksum: transition.projection.detailChecksum,
    detailSource: transition.projection.detailSource,
    catalogItemChecksum: digest(catalogItemSource),
    catalogItemSource,
    objectCommunityId: COMMUNITY_ID,
    objectSha256: sha256,
    objectSizeBytes: String(bytes.byteLength),
    objectMediaType: 'audio/mpeg',
    objectStorageKey: storageKey,
  }
  const state = {
    rows: [row] as AnyRecord[],
    queries: [] as string[],
  }
  const payload = {
    db: {
      drizzle: {
        execute: async (query: unknown) => {
          state.queries.push(queryText(query as AnyRecord))
          return { rows: state.rows }
        },
      },
    },
  }
  const objectPath = path.join(root, ...storageKey.split('/'))
  await mkdir(path.dirname(objectPath), { recursive: true, mode: 0o700 })
  await writeFile(objectPath, bytes, { mode: 0o600 })

  function request(range?: string, ifRange?: string) {
    const headers = new Headers()
    if (range !== undefined) headers.set('range', range)
    if (ifRange !== undefined) headers.set('if-range', ifRange)
    return new Request(`${mediaUrl}`, { headers })
  }

  async function serve({
    head = false,
    publicId = PUBLIC_ID,
    requestedSha256 = sha256,
    requestUrl,
    range,
    ifRange,
  }: {
    head?: boolean
    publicId?: string
    requestedSha256?: string
    requestUrl?: string
    range?: string
    ifRange?: string
  } = {}) {
    return await servePublicSermonMedia({
      request: requestUrl === undefined
        ? request(range, ifRange)
        : new Request(requestUrl, {
            headers: range === undefined && ifRange === undefined
              ? undefined
              : request(range, ifRange).headers,
          }),
      payload,
      communityId: COMMUNITY_ID,
      publicId,
      sha256: requestedSha256,
      head,
    })
  }

  return {
    bytes,
    mediaUrl,
    objectPath,
    payload,
    row,
    serve,
    sha256,
    state,
    storageKey,
  }
}

test('managed sermon-media URLs use one exact configured HTTPS public contract', () => {
  const previous = process.env.COMMUNITY_PUBLIC_URL
  process.env.COMMUNITY_PUBLIC_URL = PUBLIC_ORIGIN
  try {
    const sha256 = 'a'.repeat(64)
    const expected = `${PUBLIC_ORIGIN}/content/sermon-media/${PUBLIC_ID}/${sha256}`
    assert.equal(publicSermonMediaUrl(PUBLIC_ID, sha256), expected)
    assert.deepEqual(parsePublicSermonMediaUrl(expected), {
      publicId: PUBLIC_ID,
      sha256,
    })
    for (const reserved of [
      expected,
      `${expected}?token=private`,
      `${expected}#fragment`,
      `${expected}/unexpected/extra/segments`,
      `${PUBLIC_ORIGIN}/content/sermon-media/not-a-public-id/not-a-digest`,
      `${PUBLIC_ORIGIN}/content/sermon-media`,
      `${PUBLIC_ORIGIN}/content/sermon-media/`,
      `${PUBLIC_ORIGIN}/content/sermon%2Dmedia/${PUBLIC_ID}/${sha256}`,
      `${PUBLIC_ORIGIN}/content%2Fsermon-media/${PUBLIC_ID}/${sha256}`,
    ]) {
      assert.equal(isPublicSermonMediaNamespaceUrl(reserved), true, reserved)
    }
    for (const ordinary of [
      `https://other.heritage.faith/content/sermon-media/${PUBLIC_ID}/${sha256}`,
      `${PUBLIC_ORIGIN}/content/sermon-media-other/${PUBLIC_ID}/${sha256}`,
      `${PUBLIC_ORIGIN}/content/sermons/${PUBLIC_ID}`,
      'not-a-url',
    ]) {
      assert.equal(isPublicSermonMediaNamespaceUrl(ordinary), false, ordinary)
    }
    for (const unsafe of [
      `${expected}?token=private`,
      `${expected}#fragment`,
      `${PUBLIC_ORIGIN}/content/sermon-media/${'R'.repeat(43)}/${sha256}`,
      `https://other.heritage.faith/content/sermon-media/${PUBLIC_ID}/${sha256}`,
      `${expected}/private`,
    ]) {
      assert.equal(parsePublicSermonMediaUrl(unsafe), null, unsafe)
    }
    for (const invalidOrigin of [
      'http://community.heritage.faith',
      'https://user:secret@community.heritage.faith',
      'https://community.heritage.faith:8443',
      'https://community.heritage.faith/base',
      'https://community.heritage.faith?private=1',
    ]) {
      process.env.COMMUNITY_PUBLIC_URL = invalidOrigin
      assert.throws(
        () => publicSermonMediaUrl(PUBLIC_ID, sha256),
        /stable HTTPS origin/,
        invalidOrigin,
      )
      assert.throws(
        () => isPublicSermonMediaNamespaceUrl(expected),
        /stable HTTPS origin/,
        invalidOrigin,
      )
    }
  } finally {
    if (previous === undefined) delete process.env.COMMUNITY_PUBLIC_URL
    else process.env.COMMUNITY_PUBLIC_URL = previous
  }
})

test('loader binds one active selected publication tuple to its tenant object', async () => {
  await withHarness(async harness => {
    const authority = await loadActivePublicSermonMediaObject(
      harness.payload,
      COMMUNITY_ID,
      PUBLIC_ID,
      harness.sha256,
    )
    assert.ok(authority)
    assert.deepEqual(authority, {
      publicId: PUBLIC_ID,
      sha256: harness.sha256,
      sizeBytes: harness.bytes.byteLength,
      mediaType: 'audio/mpeg',
      object: {
        storageKey: harness.storageKey,
        sha256: harness.sha256,
        sizeBytes: harness.bytes.byteLength,
      },
    })
    const query = harness.state.queries.at(-1) || ''
    assert.match(query, /FROM "syncshow_sermon_publications" p/)
    assert.match(query, /INNER JOIN "sermons" s/)
    assert.match(query, /INNER JOIN "syncshow_sermon_media_objects" o/)
    assert.match(query, /o\."community_id" = p\."community_id"/)
    assert.match(query, /p\."active" = true/)
    assert.match(query, /p\."withdrawn_at" IS NULL/)
    assert.match(query, /s\."sync_archived" IS NOT TRUE/)
    assert.doesNotMatch(query, /upload_id|file_name/)

    const before = harness.state.queries.length
    assert.equal(await loadActivePublicSermonMediaObject(
      harness.payload,
      COMMUNITY_ID,
      'R'.repeat(43),
      harness.sha256,
    ), null)
    assert.equal(harness.state.queries.length, before)
  })
})

test('public managed bytes support GET, HEAD, OPTIONS, ETag, and one range', async () => {
  await withHarness(async harness => {
    const full = await harness.serve()
    assert.equal(full.status, 200)
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), harness.bytes)
    assert.equal(full.headers.get('content-type'), 'audio/mpeg')
    assert.equal(full.headers.get('content-length'), String(harness.bytes.length))
    assert.equal(full.headers.get('accept-ranges'), 'bytes')
    assert.equal(full.headers.get('etag'), `"sha256:${harness.sha256}"`)
    assert.equal(full.headers.get('access-control-allow-origin'), '*')
    assert.equal(full.headers.get('cross-origin-resource-policy'), 'cross-origin')
    assert.equal(full.headers.get('cache-control'), 'no-store')
    assert.equal(full.headers.get('content-disposition'), null)

    const ranged = await harness.serve({ range: 'bytes=12-47' })
    assert.equal(ranged.status, 206)
    assert.equal(ranged.headers.get('content-range'), `bytes 12-47/${harness.bytes.length}`)
    assert.equal(ranged.headers.get('content-length'), '36')
    assert.deepEqual(
      Buffer.from(await ranged.arrayBuffer()),
      harness.bytes.subarray(12, 48),
    )

    const suffix = await harness.serve({ range: 'bytes=-16' })
    assert.equal(suffix.status, 206)
    assert.deepEqual(
      Buffer.from(await suffix.arrayBuffer()),
      harness.bytes.subarray(harness.bytes.length - 16),
    )

    const ifRangeMismatch = await harness.serve({
      range: 'bytes=0-2',
      ifRange: '"sha256:different"',
    })
    assert.equal(ifRangeMismatch.status, 200)
    assert.equal(ifRangeMismatch.headers.get('content-range'), null)
    assert.deepEqual(Buffer.from(await ifRangeMismatch.arrayBuffer()), harness.bytes)

    const multiple = await harness.serve({ range: 'bytes=0-1,3-4' })
    assert.equal(multiple.status, 200)
    assert.deepEqual(Buffer.from(await multiple.arrayBuffer()), harness.bytes)

    const invalid = await harness.serve({ range: 'bytes=999-' })
    assert.equal(invalid.status, 416)
    assert.equal(invalid.headers.get('content-range'), `bytes */${harness.bytes.length}`)
    assert.equal(invalid.headers.get('cache-control'), 'no-store')

    const head = await harness.serve({ head: true, range: 'bytes=0-2' })
    assert.equal(head.status, 200)
    assert.equal(head.headers.get('content-range'), null)
    assert.equal(head.headers.get('content-length'), String(harness.bytes.length))
    assert.equal((await head.arrayBuffer()).byteLength, 0)

    const options = publicSermonMediaOptionsResponse()
    assert.equal(options.status, 204)
    assert.equal(options.headers.get('allow'), 'GET, HEAD, OPTIONS')
    assert.equal(
      options.headers.get('access-control-allow-methods'),
      'GET, HEAD, OPTIONS',
    )
    assert.equal(options.headers.get('access-control-allow-origin'), '*')
    assert.equal(options.headers.get('cache-control'), 'no-store')
  })
})

test('withdrawn, stale, cross-tenant, missing, inconsistent, and probing requests are identical 404s', async () => {
  await withHarness(async harness => {
    async function unavailable(overrides: Parameters<typeof harness.serve>[0] = {}) {
      const response = await harness.serve(overrides)
      assert.equal(response.status, 404)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal(response.headers.get('access-control-allow-origin'), '*')
      const body = await response.text()
      assert.equal(body, '{"error":"Not found."}\n')
      assert.equal(body.includes(harness.storageKey), false)
      assert.equal(body.includes('private-original-name.mp3'), false)
      return body
    }

    harness.state.rows = []
    const missing = await unavailable()

    harness.state.rows = [{
      ...harness.row,
      active: false,
      withdrawnAt: '2026-08-10 14:01:00-07',
    }]
    assert.equal(await unavailable(), missing)

    harness.state.rows = [{
      ...harness.row,
      objectCommunityId: COMMUNITY_ID + 1,
    }]
    assert.equal(await unavailable(), missing)

    harness.state.rows = [{
      ...harness.row,
      objectStorageKey: `objects/${'0'.repeat(64)}/sha256/${harness.sha256.slice(0, 2)}/${harness.sha256}`,
    }]
    assert.equal(await unavailable(), missing)

    harness.state.rows = [{
      ...harness.row,
      publishedDocumentSource: '{not-canonical-json',
    }]
    assert.equal(await unavailable(), missing)

    const unauthorizedDocument = JSON.parse(
      String(harness.row.publishedDocumentSource),
    )
    unauthorizedDocument.media[0].url =
      `https://media.heritage.faith/sermons/${harness.sha256}.mp3`
    const unauthorizedRevision = createSermonRevision(unauthorizedDocument)
    const unauthorizedProjection = buildPublicSermonProjection({
      documentSource: unauthorizedRevision.source,
      publicRevision: unauthorizedRevision.sha256,
      selectedBodyEntryIds: harness.row.selectedBodyEntryIds,
      selectedMediaIds: harness.row.selectedMediaIds,
    })
    const unauthorizedCatalogSource = serializePublicSermonCatalogItem(
      unauthorizedProjection.catalogItem,
    )
    harness.state.rows = [{
      ...harness.row,
      publicRevision: unauthorizedRevision.sha256,
      publishedDocumentSource: unauthorizedRevision.source,
      detailChecksum: unauthorizedProjection.detailChecksum,
      detailSource: unauthorizedProjection.detailSource,
      catalogItemChecksum: digest(unauthorizedCatalogSource),
      catalogItemSource: unauthorizedCatalogSource,
    }]
    assert.equal(await unavailable(), missing)

    harness.state.rows = [harness.row]
    assert.equal(await unavailable({ requestedSha256: 'b'.repeat(64) }), missing)
    assert.equal(await unavailable({ publicId: 'R'.repeat(43) }), missing)
    assert.equal(await unavailable({ publicId: '../private-recording' }), missing)
    assert.equal(await unavailable({ requestUrl: `${harness.mediaUrl}?alias=1` }), missing)
    assert.equal(await unavailable({ requestUrl: `${harness.mediaUrl}/` }), missing)
    assert.equal(await unavailable({
      requestUrl: harness.mediaUrl.replace('/sermon-', '/sermon%2D'),
    }), missing)
    assert.equal(await unavailable({
      requestUrl: harness.mediaUrl.replace(
        `/${harness.sha256}`,
        `/%${harness.sha256.charCodeAt(0).toString(16)}${harness.sha256.slice(1)}`,
      ),
    }), missing)

    await unlink(harness.objectPath)
    assert.equal(await unavailable(), missing)
  })
})
