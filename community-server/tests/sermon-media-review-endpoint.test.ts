import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import type { PayloadRequest } from 'payload'
import { managerSermonPublicationEndpoints } from '../src/endpoints/sermonPublications.ts'
import {
  createSermonRevision,
} from '../src/lib/syncshow/SermonDocument.ts'
import { sermonMediaCommunityNamespace } from '../src/lib/syncshow/SermonMediaStore.ts'
import { sermonMediaObjectKey } from '../src/lib/syncshow/SermonMediaStorage.ts'

type AnyRecord = Record<string, any>

const COMMUNITY_ID = 7
const SERMON_ID = 19
const USER_ID = 11
const REVIEW_ID = 'R'.repeat(43)
const SYNC_ID = 'sermon-manager-recording-review'

function endpoint(path: string, method: string) {
  const handler = managerSermonPublicationEndpoints.find(candidate =>
    candidate.path === path && candidate.method === method)?.handler
  assert.ok(handler, `missing ${method.toUpperCase()} ${path}`)
  return handler
}

const listRecordings = endpoint(
  '/community/sermon-publications/:syncId/managed-recordings',
  'get',
)
const getContent = endpoint(
  '/community/sermon-publications/:syncId/managed-recordings/:reviewId/content',
  'get',
)
const headContent = endpoint(
  '/community/sermon-publications/:syncId/managed-recordings/:reviewId/content',
  'head',
)
const downloadContent = endpoint(
  '/community/sermon-publications/:syncId/managed-recordings/:reviewId/download',
  'get',
)
const headDownload = endpoint(
  '/community/sermon-publications/:syncId/managed-recordings/:reviewId/download',
  'head',
)

function digest(value: Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

function queryParts(query: AnyRecord) {
  let text = ''
  const parameters: unknown[] = []
  for (const chunk of query?.queryChunks || []) {
    if (chunk && typeof chunk === 'object' && Array.isArray(chunk.value)) {
      text += chunk.value.join('')
    } else {
      text += '?'
      parameters.push(chunk)
    }
  }
  return { text, parameters }
}

async function withHarness(
  callback: (harness: ReturnType<typeof makeHarness>) => Promise<void>,
) {
  const root = await mkdtemp(path.join(tmpdir(), 'heritage-manager-media-review-'))
  const previous = process.env.HERITAGE_SERMON_MEDIA_PATH
  process.env.HERITAGE_SERMON_MEDIA_PATH = root
  try {
    const harness = makeHarness(root)
    await harness.ready
    await callback(harness)
  } finally {
    if (previous === undefined) delete process.env.HERITAGE_SERMON_MEDIA_PATH
    else process.env.HERITAGE_SERMON_MEDIA_PATH = previous
    await rm(root, { recursive: true, force: true })
  }
}

function makeHarness(root: string) {
  const bytes = Buffer.alloc(512)
  Buffer.from([0xff, 0xfb, 0x90, 0x64]).copy(bytes, 0)
  Buffer.from([0xff, 0xfb, 0x90, 0x64]).copy(bytes, 100)
  const sha256 = digest(bytes)
  const storageKey = sermonMediaObjectKey(
    sermonMediaCommunityNamespace(COMMUNITY_ID),
    sha256,
  )
  const document = {
    schemaVersion: 3,
    kind: 'syncshow-sermon',
    id: SYNC_ID,
    titles: { en: 'Private recording review' },
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
    body: [],
    media: [{
      id: 'post-service:recording:en',
      kind: 'audio',
      status: 'pending',
      title: 'Sunday sermon recording',
      language: 'en',
      mediaType: 'audio/mpeg',
      fileName: 'sunday-sermon.mp3',
      sha256,
      sizeBytes: bytes.byteLength,
      durationSeconds: 1800,
      url: null,
    }],
    publication: {
      status: 'ready',
      visibility: 'private',
      publishedAt: null,
      canonicalUrl: null,
    },
  } as const
  const revision = createSermonRevision(document)
  const sermon = {
    id: SERMON_ID,
    community: COMMUNITY_ID,
    syncId: SYNC_ID,
    syncVersion: 4,
    syncCurrentRevision: revision.sha256,
    syncCurrentDocumentSource: revision.source,
    syncArchived: false,
    syncPublicationStatus: 'ready',
    syncVisibility: 'private',
    syncChangedAt: '2026-08-10T20:00:00.000Z',
  }
  const row = {
    uploadId: REVIEW_ID,
    schemaVersion: '1',
    uploadCommunityId: COMMUNITY_ID,
    sermonId: SERMON_ID,
    state: 'complete',
    syncId: SYNC_ID,
    expectedSyncVersion: '4',
    expectedCurrentRevision: revision.sha256,
    recordingId: 'post-service:recording:en',
    kind: 'audio',
    language: 'en',
    mediaType: 'audio/mpeg',
    fileName: 'sunday-sermon.mp3',
    sha256,
    sizeBytes: String(bytes.byteLength),
    durationSeconds: 1800,
    completedAt: '2026-08-10 20:30:00+00',
    objectId: 31,
    objectRowId: 31,
    objectCommunityId: COMMUNITY_ID,
    objectSha256: sha256,
    objectSizeBytes: String(bytes.byteLength),
    objectMediaType: 'audio/mpeg',
    storageKey,
  }
  const state = {
    role: 'leader',
    rows: [row] as AnyRecord[],
  }
  const ready = (async () => {
    const objectPath = path.join(root, ...storageKey.split('/'))
    await mkdir(path.dirname(objectPath), { recursive: true, mode: 0o700 })
    await writeFile(objectPath, bytes, { mode: 0o600 })
  })()

  const payload = {
    config: { cors: '*' },
    logger: { error: () => undefined },
    auth: async ({ headers }: { headers: Headers }) => ({
      user: headers.get('authorization') === 'Community manager-session'
        ? { id: USER_ID, systemRole: 'member' }
        : null,
    }),
    find: async (args: AnyRecord) => {
      if (args.collection === 'communities') {
        return { docs: [{ id: COMMUNITY_ID, slug: 'local-church' }] }
      }
      if (args.collection === 'memberships') {
        return {
          docs: ['owner', 'admin', 'leader'].includes(state.role)
            ? [{ id: 1, user: USER_ID, community: COMMUNITY_ID, role: state.role }]
            : [],
        }
      }
      if (args.collection === 'sermons') {
        const requested = args.where?.and?.find((part: AnyRecord) => part.syncId)
          ?.syncId?.equals
        return { docs: requested === SYNC_ID ? [sermon] : [] }
      }
      throw new Error(`unexpected find collection ${String(args.collection)}`)
    },
    db: {
      drizzle: {
        execute: async (query: unknown) => {
          const { text, parameters } = queryParts(query as AnyRecord)
          assert.match(text, /syncshow_sermon_media_uploads/)
          const selected = parameters.find(value =>
            typeof value === 'string'
            && /^[A-Za-z0-9_-]{32,128}$/.test(value)
          )
          return {
            rows: selected
              ? state.rows.filter(candidate => candidate.uploadId === selected)
              : state.rows,
          }
        },
      },
    },
  }

  function request({
    authorization = 'Community manager-session',
    ifRange,
    preauthenticated = false,
    range,
    reviewId = REVIEW_ID,
    syncId = SYNC_ID,
  }: {
    authorization?: string
    ifRange?: string
    preauthenticated?: boolean
    range?: string
    reviewId?: string
    syncId?: string
  } = {}): PayloadRequest {
    const headers = new Headers({ authorization })
    if (ifRange !== undefined) headers.set('if-range', ifRange)
    if (range !== undefined) headers.set('range', range)
    return {
      headers,
      payload,
      routeParams: { syncId, reviewId },
      user: preauthenticated
        ? { id: USER_ID, systemRole: 'member' }
        : undefined,
      url: 'http://localhost/api/community/sermon-publications',
    } as unknown as PayloadRequest
  }

  return { bytes, payload, ready, request, revision, row, sermon, state, storageKey }
}

async function json(response: Response) {
  return await response.json() as AnyRecord
}

test('manager inventory is bounded, redacted, tenant-bound, and recomputes eligibility', async () => {
  await withHarness(async harness => {
    const response = await listRecordings(harness.request())
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    const value = await json(response)
    assert.deepEqual(Object.keys(value).sort(), ['recordings', 'schemaVersion', 'sermon'])
    assert.deepEqual(Object.keys(value.recordings[0]).sort(), [
      'completedAt',
      'durationSeconds',
      'eligibility',
      'fileName',
      'language',
      'mediaType',
      'reviewId',
      'sha256',
      'sizeBytes',
      'slotId',
      'title',
    ])
    assert.equal(value.recordings[0].eligibility, 'publishable')
    assert.equal(JSON.stringify(value).includes('storageKey'), false)
    assert.equal(JSON.stringify(value).includes('objectId'), false)

    harness.state.rows[0] = {
      ...harness.state.rows[0],
      expectedCurrentRevision: 'a'.repeat(64),
    }
    const stale = await json(await listRecordings(harness.request()))
    assert.equal(stale.recordings[0].eligibility, 'review-only')

    harness.state.rows[0] = {
      ...harness.row,
      state: 'superseded',
      recordingId: 'post-service:recording:older',
      fileName: 'older-sermon.mp3',
      expectedCurrentRevision: 'a'.repeat(64),
    }
    const historical = await json(await listRecordings(harness.request()))
    assert.equal(historical.recordings[0].eligibility, 'review-only')
    assert.equal(historical.recordings[0].title, 'older-sermon.mp3')

    harness.state.rows[0] = {
      ...harness.row,
      uploadCommunityId: COMMUNITY_ID + 1,
    }
    const wrongCommunity = await listRecordings(harness.request())
    assert.equal(wrongCommunity.status, 500)
    assert.equal(
      (await json(wrongCommunity)).code,
      'INVALID_MANAGED_RECORDING_STATE',
    )

    harness.state.rows = Array.from({ length: 101 }, (_, index) => ({
      ...harness.row,
      uploadId: `${index}`.padStart(32, 'U'),
    }))
    const oversized = await listRecordings(harness.request())
    assert.equal(oversized.status, 503)
    assert.equal((await json(oversized)).code, 'MANAGED_RECORDING_REVIEW_TOO_LARGE')
  })
})

test('manager recording routes reject anonymous, member, SyncShow, cross-sermon, and unknown selectors', async () => {
  await withHarness(async harness => {
    assert.equal((await listRecordings(harness.request({ authorization: '' }))).status, 401)
    harness.state.role = 'member'
    assert.equal((await listRecordings(harness.request())).status, 403)
    harness.state.role = 'leader'
    for (const authorization of [
      'SyncShow service-token',
      'syncshow service-token',
      'sYnCsHoW\tservice-token',
    ]) {
      assert.equal((await listRecordings(harness.request({
        authorization,
        preauthenticated: true,
      }))).status, 401, authorization)
    }
    assert.equal((await listRecordings(harness.request({ syncId: 'other-sermon' }))).status, 404)
    assert.equal((await getContent(harness.request({ reviewId: 'Z'.repeat(43) }))).status, 404)
    assert.equal((await getContent(harness.request({ reviewId: '../private' }))).status, 404)
  })
})

test('manager content and download serve exact private bytes with GET, HEAD, and single ranges', async () => {
  await withHarness(async harness => {
    const full = await getContent(harness.request())
    assert.equal(full.status, 200)
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), harness.bytes)
    assert.equal(full.headers.get('accept-ranges'), 'bytes')
    assert.equal(full.headers.get('cache-control'), 'private, no-store')
    assert.equal(full.headers.get('cross-origin-resource-policy'), 'same-origin')
    assert.equal(full.headers.get('x-robots-tag'), 'noindex, noarchive')
    assert.equal(full.headers.get('etag'), `"sha256:${harness.row.sha256}"`)
    assert.match(full.headers.get('content-disposition') || '', /^inline;/)

    const ranged = await getContent(harness.request({ range: 'bytes=12-47' }))
    assert.equal(ranged.status, 206)
    assert.equal(ranged.headers.get('content-range'), `bytes 12-47/${harness.bytes.length}`)
    assert.deepEqual(
      Buffer.from(await ranged.arrayBuffer()),
      harness.bytes.subarray(12, 48),
    )

    const suffix = await getContent(harness.request({ range: 'bytes=-16' }))
    assert.equal(suffix.status, 206)
    assert.deepEqual(
      Buffer.from(await suffix.arrayBuffer()),
      harness.bytes.subarray(harness.bytes.length - 16),
    )

    const caseInsensitive = await getContent(harness.request({ range: 'Bytes=1-8' }))
    assert.equal(caseInsensitive.status, 206)
    assert.deepEqual(
      Buffer.from(await caseInsensitive.arrayBuffer()),
      harness.bytes.subarray(1, 9),
    )

    const ifRangeMatch = await getContent(harness.request({
      ifRange: `"sha256:${harness.row.sha256}"`,
      range: 'bytes=1-8',
    }))
    assert.equal(ifRangeMatch.status, 206)

    for (const request of [
      { range: 'items=0-2' },
      { range: 'bytes=0-1,3-4' },
      { ifRange: '"different-object"', range: 'bytes=0-2' },
    ]) {
      const ignored = await getContent(harness.request(request))
      assert.equal(ignored.status, 200)
      assert.equal(ignored.headers.get('content-range'), null)
      assert.deepEqual(Buffer.from(await ignored.arrayBuffer()), harness.bytes)
    }

    const head = await headContent(harness.request({ range: 'bytes=-' }))
    assert.equal(head.status, 200)
    assert.equal(head.headers.get('content-range'), null)
    assert.equal(head.headers.get('content-length'), String(harness.bytes.length))
    assert.equal((await head.arrayBuffer()).byteLength, 0)

    const downloadHead = await headDownload(harness.request({
      ifRange: '"different-object"',
      range: 'bytes=0-31',
    }))
    assert.equal(downloadHead.status, 200)
    assert.equal(downloadHead.headers.get('content-range'), null)
    assert.equal(downloadHead.headers.get('content-length'), String(harness.bytes.length))
    assert.match(downloadHead.headers.get('content-disposition') || '', /^attachment;/)
    assert.equal((await downloadHead.arrayBuffer()).byteLength, 0)

    const download = await downloadContent(harness.request())
    assert.equal(download.status, 200)
    assert.match(download.headers.get('content-disposition') || '', /^attachment;/)
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), harness.bytes)

    for (const range of ['bytes=-0', 'bytes=999-', 'bytes=-']) {
      const invalid = await getContent(harness.request({ range }))
      assert.equal(invalid.status, 416, range)
      assert.equal(
        invalid.headers.get('content-range'),
        `bytes */${harness.bytes.length}`,
      )
    }
  })
})

test('manager content fails closed on object metadata disagreement without leaking bytes', async () => {
  await withHarness(async harness => {
    harness.state.rows[0] = {
      ...harness.state.rows[0],
      objectSizeBytes: String(harness.bytes.length + 1),
    }
    const response = await getContent(harness.request())
    assert.equal(response.status, 500)
    assert.equal((await json(response)).code, 'INVALID_MANAGED_RECORDING_STATE')
    assert.deepEqual(
      await readFile(path.join(
        process.env.HERITAGE_SERMON_MEDIA_PATH || '',
        ...harness.storageKey.split('/'),
      )),
      harness.bytes,
    )
  })
})
