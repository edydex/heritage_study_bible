import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { GET as discovery } from '../src/app/.well-known/heritage-community.json/route.ts'
import { syncShowEndpoints } from '../src/endpoints/syncShow.ts'
import {
  assertSermonMediaBinding,
  expectedSermonMediaChunk,
  normalizeSermonMediaChunkHeaders,
  normalizeSermonMediaInitRequest,
  SERMON_MEDIA_ACCEPTED_MEDIA_TYPES,
  SERMON_MEDIA_CHUNK_SIZE_BYTES,
  SERMON_MEDIA_MAXIMUM_BYTES,
  SERMON_MEDIA_SESSION_TTL_SECONDS,
  sermonMediaCapacityLimits,
  sermonMediaErrorEnvelope,
  sermonMediaIdempotencyHash,
  sermonMediaRequiredAvailableBytes,
  sermonMediaSessionExpired,
  SermonMediaError,
} from '../src/lib/syncshow/SermonMedia.ts'
import {
  createSermonRevision,
} from '../src/lib/syncshow/SermonDocument.ts'
import {
  acquireSermonMediaChunkRequestSlot,
} from '../src/lib/syncshow/SermonMediaStore.ts'

type AnyRecord = Record<string, any>

const fixture = JSON.parse(readFileSync(new URL(
  './fixtures/community-sermon-media-wire-v1.json',
  import.meta.url,
), 'utf8')) as AnyRecord

function canonicalSermon(recording = fixture.initRequest.recording) {
  return createSermonRevision({
    schemaVersion: 3,
    kind: 'syncshow-sermon',
    id: fixture.initRequest.sermon.syncId,
    titles: { en: 'Life in the Spirit' },
    defaultLanguage: 'en',
    speaker: { id: null, name: 'Pastor Example' },
    serviceDate: '2026-08-02',
    series: null,
    outline: [],
    sources: [],
    references: [],
    media: [{
      ...recording,
      status: 'pending',
      title: 'Sermon recording',
      url: recording.url ?? null,
    }],
    publication: {
      status: 'draft',
      visibility: 'private',
      publishedAt: null,
      canonicalUrl: null,
    },
    body: [],
  })
}

test('Community discovery matches the shared SyncShow sermon-media vector', async () => {
  const previous = process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED
  process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED = 'true'
  try {
    const response = discovery()
    const value = await response.json() as AnyRecord
    assert.equal(value.integrations.syncShow.schemaVersion, 2)
    assert.deepEqual(
      value.integrations.syncShow.resources.sermonMedia,
      fixture.discoveryResource,
    )
    assert.deepEqual(
      fixture.discoveryResource.acceptedMediaTypes,
      SERMON_MEDIA_ACCEPTED_MEDIA_TYPES,
    )
    assert.equal(
      fixture.discoveryResource.chunkSizeBytes,
      SERMON_MEDIA_CHUNK_SIZE_BYTES,
    )
    assert.equal(
      fixture.discoveryResource.maximumBytes,
      SERMON_MEDIA_MAXIMUM_BYTES,
    )
    assert.equal(
      fixture.discoveryResource.sessionTtlSeconds,
      SERMON_MEDIA_SESSION_TTL_SECONDS,
    )
  } finally {
    if (previous === undefined) {
      delete process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED
    } else {
      process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED = previous
    }
  }
})

test('discovery omits managed media unless explicitly enabled', async () => {
  const previous = process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED
  delete process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED
  try {
    const value = await discovery().json() as AnyRecord
    assert.equal(
      Object.hasOwn(
        value.integrations.syncShow.resources,
        'sermonMedia',
      ),
      false,
    )
    assert.equal(value.integrations.syncShow.schemaVersion, 2)
    assert.ok(value.integrations.syncShow.resources.sermons)
  } finally {
    if (previous !== undefined) {
      process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED = previous
    }
  }
})

test('device authorization cannot preapprove hidden media scopes', async () => {
  const previous = process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED
  delete process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED
  try {
    const handler = syncShowEndpoints.find(candidate =>
      candidate.path === '/community/syncshow/v1/auth/device/start'
      && candidate.method === 'post'
    )?.handler
    assert.ok(handler)
    const response = await handler({
      headers: new Headers({
        'cf-connecting-ip': 'scope-off-contract-test',
        'content-type': 'application/json',
      }),
      payload: {
        config: { cors: '*' },
        logger: { error: () => undefined },
      },
      text: async () => JSON.stringify({
        email: 'media-scope-off@example.test',
        deviceName: 'Hidden media scope test',
        scopes: [
          'syncshow:sermons:read',
          'syncshow:sermon-media:read',
        ],
        codeChallengeMethod: 'S256',
        codeChallenge: 'A'.repeat(43),
      }),
    } as any)
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      code: 'INVALID_SCOPE',
      error: 'The requested SyncShow scopes are invalid.',
    })
  } finally {
    if (previous !== undefined) {
      process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED = previous
    }
  }
})

test('init requests are exact, bounded, and preserve the shared wire bytes', () => {
  assert.deepEqual(
    normalizeSermonMediaInitRequest(fixture.initRequest),
    fixture.initRequest,
  )
  assert.throws(
    () => normalizeSermonMediaInitRequest({
      ...fixture.initRequest,
      localPath: '/tmp/recording.mp3',
    }),
    /unsupported or missing fields/i,
  )
  assert.throws(
    () => normalizeSermonMediaInitRequest({
      ...fixture.initRequest,
      recording: {
        ...fixture.initRequest.recording,
        mediaType: 'audio/mp4',
      },
    }),
    (error: unknown) =>
      error instanceof SermonMediaError
      && error.code === 'MEDIA_TYPE_MISMATCH'
      && error.status === 415,
  )
  assert.throws(
    () => normalizeSermonMediaInitRequest({
      ...fixture.initRequest,
      recording: {
        ...fixture.initRequest.recording,
        sizeBytes: SERMON_MEDIA_MAXIMUM_BYTES + 1,
      },
    }),
    /sizeBytes is invalid/i,
  )
})

test('canonical sermon binding requires the exact private null-URL media slot', () => {
  const request = normalizeSermonMediaInitRequest(fixture.initRequest)
  const revision = canonicalSermon()
  assert.doesNotThrow(() => assertSermonMediaBinding({
    syncId: request.sermon.syncId,
    syncVersion: request.sermon.expectedSyncVersion,
    syncCurrentRevision: request.sermon.expectedCurrentRevision,
    syncCurrentDocumentSource: revision.source,
    syncArchived: false,
  }, request.sermon, request.recording))

  assert.throws(
    () => assertSermonMediaBinding({
      syncId: request.sermon.syncId,
      syncVersion: request.sermon.expectedSyncVersion + 1,
      syncCurrentRevision: request.sermon.expectedCurrentRevision,
      syncCurrentDocumentSource: revision.source,
      syncArchived: false,
    }, request.sermon, request.recording),
    (error: unknown) =>
      error instanceof SermonMediaError
      && error.code === fixture.staleError.error.code
      && error.message === fixture.staleError.error.message
      && error.status === 412,
  )

  const publicUrlRevision = canonicalSermon({
    ...request.recording,
    url: 'https://example.test/recording.mp3',
  })
  assert.throws(
    () => assertSermonMediaBinding({
      syncId: request.sermon.syncId,
      syncVersion: request.sermon.expectedSyncVersion,
      syncCurrentRevision: request.sermon.expectedCurrentRevision,
      syncCurrentDocumentSource: publicUrlRevision.source,
      syncArchived: false,
    }, request.sermon, request.recording),
    /does not exactly match/i,
  )
})

test('chunk geometry is fixed at 8 MiB except the final chunk', () => {
  const final = expectedSermonMediaChunk(
    fixture.initRequest.recording.sizeBytes,
    fixture.secondChunk.index,
  )
  assert.deepEqual(final, {
    index: fixture.secondChunk.index,
    startByte: SERMON_MEDIA_CHUNK_SIZE_BYTES,
    endByte: fixture.initRequest.recording.sizeBytes - 1,
    totalBytes: fixture.initRequest.recording.sizeBytes,
    sizeBytes: fixture.secondChunk.sizeBytes,
  })
  assert.deepEqual(
    normalizeSermonMediaChunkHeaders({
      index: fixture.secondChunk.index,
      contentLength: String(fixture.secondChunk.sizeBytes),
      contentRange: fixture.secondChunk.contentRange,
      sha256: fixture.secondChunk.sha256,
      totalSizeBytes: fixture.initRequest.recording.sizeBytes,
    }),
    { ...final, sha256: fixture.secondChunk.sha256 },
  )
  assert.throws(
    () => normalizeSermonMediaChunkHeaders({
      index: fixture.secondChunk.index,
      contentLength: '5',
      contentRange: fixture.secondChunk.contentRange,
      sha256: fixture.secondChunk.sha256,
      totalSizeBytes: fixture.initRequest.recording.sizeBytes,
    }),
    (error: unknown) =>
      error instanceof SermonMediaError
      && error.code === 'INVALID_CONTENT_LENGTH'
      && error.status === 422,
  )
  assert.throws(
    () => normalizeSermonMediaChunkHeaders({
      index: fixture.secondChunk.index,
      contentLength: String(fixture.secondChunk.sizeBytes),
      contentRange: 'bytes 0-5/8388614',
      sha256: fixture.secondChunk.sha256,
      totalSizeBytes: fixture.initRequest.recording.sizeBytes,
    }),
    (error: unknown) =>
      error instanceof SermonMediaError
      && error.code === 'INVALID_CONTENT_RANGE',
  )
})

test('idempotency is deterministic but tenant- and operation-isolated', () => {
  const first = sermonMediaIdempotencyHash(
    7,
    'init',
    'attempt-key-0001',
  )
  assert.equal(
    first,
    sermonMediaIdempotencyHash(7, 'init', 'attempt-key-0001'),
  )
  assert.notEqual(
    first,
    sermonMediaIdempotencyHash(8, 'init', 'attempt-key-0001'),
  )
  assert.notEqual(
    first,
    sermonMediaIdempotencyHash(7, 'cancel', 'attempt-key-0001'),
  )
})

test('expiry and exact nested error envelope fail closed', () => {
  const now = new Date('2026-08-09T18:30:00.000Z')
  assert.equal(
    sermonMediaSessionExpired('2026-08-09T18:30:00.000Z', now),
    true,
  )
  assert.equal(
    sermonMediaSessionExpired('2026-08-09T18:30:00.001Z', now),
    false,
  )
  assert.equal(sermonMediaSessionExpired('not-a-date', now), true)
  const stale = new SermonMediaError(
    fixture.staleError.error.code,
    fixture.staleError.error.message,
    412,
  )
  assert.deepEqual(sermonMediaErrorEnvelope(stale), fixture.staleError)
})

test('capacity limits have conservative defaults and reject zero', () => {
  const names = [
    'HERITAGE_SERMON_MEDIA_MAX_ACTIVE_GLOBAL',
    'HERITAGE_SERMON_MEDIA_MAX_ACTIVE_PER_COMMUNITY',
    'HERITAGE_SERMON_MEDIA_MAX_ACTIVE_PER_CONNECTION',
    'HERITAGE_SERMON_MEDIA_MAX_FINALIZING_GLOBAL',
    'HERITAGE_SERMON_MEDIA_MAX_RETAINED_BYTES_PER_COMMUNITY',
    'HERITAGE_SERMON_MEDIA_MAX_RETAINED_OBJECTS_PER_COMMUNITY',
    'HERITAGE_SERMON_MEDIA_STORAGE_RESERVE_BYTES',
  ] as const
  const previous = new Map(names.map(name => [name, process.env[name]]))
  try {
    for (const name of names) delete process.env[name]
    assert.deepEqual(sermonMediaCapacityLimits(), {
      maximumActiveGlobal: 8,
      maximumActivePerCommunity: 4,
      maximumActivePerConnection: 2,
      maximumFinalizingGlobal: 1,
      maximumRetainedBytesPerCommunity: 50 * 1024 * 1024 * 1024,
      maximumRetainedObjectsPerCommunity: 2_000,
      storageReserveBytes: 5 * 1024 * 1024 * 1024,
    })
    process.env.HERITAGE_SERMON_MEDIA_MAX_ACTIVE_GLOBAL = '0'
    assert.throws(
      () => sermonMediaCapacityLimits(),
      (error: unknown) =>
        error instanceof SermonMediaError
        && error.code === 'INVALID_SERVER_CONFIGURATION'
        && error.status === 503,
    )
  } finally {
    for (const name of names) {
      const value = previous.get(name)
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
})

test('chunk request slots cap one connection and the whole process', () => {
  const releases = [
    acquireSermonMediaChunkRequestSlot(101),
    acquireSermonMediaChunkRequestSlot(102),
    acquireSermonMediaChunkRequestSlot(103),
    acquireSermonMediaChunkRequestSlot(104),
  ]
  try {
    assert.throws(
      () => acquireSermonMediaChunkRequestSlot(101),
      (error: unknown) =>
        error instanceof SermonMediaError
        && error.code === 'CHUNK_REQUEST_CAPACITY'
        && error.status === 429
        && error.retryAfterSeconds === 5,
    )
    assert.throws(
      () => acquireSermonMediaChunkRequestSlot(105),
      (error: unknown) =>
        error instanceof SermonMediaError
        && error.code === 'CHUNK_REQUEST_CAPACITY',
    )
  } finally {
    for (const release of releases) release()
  }
  const reused = acquireSermonMediaChunkRequestSlot(101)
  reused()
  reused()
})

test('storage reservation tracks only bytes that have not landed yet', () => {
  const GiB = 1024 * 1024 * 1024
  const common = {
    configuredReserveBytes: 5 * GiB,
    filesystemTotalBytes: 100 * GiB,
    additionalReservationBytes: 0,
    largestAssemblyBytes: 1 * GiB,
  }
  const admitted = sermonMediaRequiredAvailableBytes({
    ...common,
    remainingActiveBytes: 1 * GiB,
  })
  assert.equal(admitted, 17 * GiB)

  // Once half the staging bytes are present, statfs.available and the
  // remaining reservation both fall by the same amount. The safety margin
  // therefore stays constant instead of double-counting landed chunks.
  const afterHalfLanded = sermonMediaRequiredAvailableBytes({
    ...common,
    remainingActiveBytes: 512 * 1024 * 1024,
  })
  assert.equal(admitted - afterHalfLanded, 512 * 1024 * 1024)

  // Finalization reserves only its assembly temp in addition to the floor;
  // the complete staging object is already reflected in statfs.available.
  const finalizing = sermonMediaRequiredAvailableBytes({
    ...common,
    remainingActiveBytes: 0,
  })
  assert.equal(finalizing, 16 * GiB)
})
