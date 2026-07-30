import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  Sermons,
  protectPrivateSermonState,
  readSermonsByPublicationOrManager,
} from '../src/collections/Sermons.ts'
import {
  SyncShowSermonChanges,
  protectSermonChangeAuthority,
  rejectSermonChangeDeletion,
  validateSermonChangeAuthority,
} from '../src/collections/SyncShowSermonChanges.ts'
import { syncShowEndpoints } from '../src/endpoints/syncShow.ts'
import {
  MAX_SERMON_SOURCE_OBJECTS,
  MAX_SERMON_TRANSFER_JSON_BYTES,
  normalizeSermonChangePage,
  normalizeRemoteSermonEnvelope,
  type SermonWriteBody,
} from '../src/lib/syncshow/CommunitySermonWire.ts'
import {
  MAX_SERMON_SOURCE_BYTES,
  createSermonRevision,
  parseSermonDocument,
} from '../src/lib/syncshow/SermonDocument.ts'
import { createCanonicalSermon } from '../src/lib/syncshow/CanonicalSermonStore.ts'
import {
  payloadPreachedAtForServiceDate,
  serviceDateForProjectedPreachedAt,
} from '../src/lib/syncshow/SermonDateProjection.ts'
import { up as repairCanonicalSermonDateProjections } from '../src/migrations/20260729_220000_canonical_sermon_preached_date_projection.ts'
import {
  SYNCSHOW_READ_SCOPE,
  SYNCSHOW_SERMON_READ_SCOPE,
  SYNCSHOW_SERMON_WRITE_SCOPE,
  SYNCSHOW_WRITE_SCOPE,
  SyncShowProtocolError,
} from '../src/lib/syncShowProtocol.ts'
import { hashOpaqueToken } from '../src/lib/tokens.ts'

type AnyRecord = Record<string, any>
type GoldenCase = {
  document: AnyRecord
  canonicalSource: string
  revision: string
}
type GoldenFixture = {
  sermons: {
    v1: GoldenCase
    v2: GoldenCase
    v3: GoldenCase
  }
}

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/syncshow-sermon-contract-v1.json', import.meta.url),
  'utf8',
)) as GoldenFixture

const listSermons = endpoint('/community/syncshow/v1/sermons', 'get')
const createSermon = endpoint('/community/syncshow/v1/sermons', 'post')
const getSermon = endpoint('/community/syncshow/v1/sermons/:syncId', 'get')
const updateSermon = endpoint('/community/syncshow/v1/sermons/:syncId', 'put')
const archiveSermon = endpoint('/community/syncshow/v1/sermons/:syncId', 'delete')
const listSongs = endpoint('/community/syncshow/v1/songs', 'get')

function endpoint(path: string, method: string) {
  const handler = syncShowEndpoints.find(candidate => (
    candidate.path === path && candidate.method === method
  ))?.handler
  assert.ok(handler, `missing ${method.toUpperCase()} ${path}`)
  return handler
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function writeFor(golden: GoldenCase): SermonWriteBody {
  return {
    syncId: golden.document.id,
    revision: golden.revision,
    documentSource: golden.canonicalSource,
  }
}

function changedWrite(golden: GoldenCase, title: string): SermonWriteBody {
  const document = clone(golden.document)
  document.titles[document.defaultLanguage] = title
  const revision = createSermonRevision(document)
  return {
    syncId: revision.document.id,
    revision: revision.sha256,
    documentSource: revision.source,
  }
}

function publicationWrite(golden: GoldenCase, publication: AnyRecord): SermonWriteBody {
  const document = clone(golden.document)
  document.publication = publication
  const revision = createSermonRevision(document)
  return {
    syncId: revision.document.id,
    revision: revision.sha256,
    documentSource: revision.source,
  }
}

function relationValue(value: any): any {
  return value && typeof value === 'object' && 'id' in value
    ? (value as { id: unknown }).id
    : value
}

function matchesWhere(document: AnyRecord, where: AnyRecord | undefined): boolean {
  if (!where) return true
  if (Array.isArray(where.and) && !where.and.every((entry: AnyRecord) => matchesWhere(document, entry))) {
    return false
  }
  if (Array.isArray(where.or) && !where.or.some((entry: AnyRecord) => matchesWhere(document, entry))) {
    return false
  }
  for (const [field, condition] of Object.entries(where)) {
    if (field === 'and' || field === 'or') continue
    const actual = relationValue(document[field])
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
      if (actual !== condition) return false
      continue
    }
    const operation = condition as AnyRecord
    if ('equals' in operation && actual !== relationValue(operation.equals)) return false
    if ('exists' in operation) {
      const exists = actual !== undefined && actual !== null
      if (exists !== operation.exists) return false
    }
    if ('greater_than' in operation && !(actual > relationValue(operation.greater_than))) return false
    if ('in' in operation && (
      !Array.isArray(operation.in) || !operation.in.includes(actual)
    )) return false
  }
  return true
}

function makeHarness({
  rawDrizzleRows = false,
}: {
  rawDrizzleRows?: boolean
} = {}) {
  const state = {
    communities: [{
      id: 7,
      timeZone: 'America/Los_Angeles',
    }] as AnyRecord[],
    connections: [] as AnyRecord[],
    memberships: [{
      id: 1,
      community: 7,
      user: 11,
      role: 'leader',
    }] as AnyRecord[],
    songs: [] as AnyRecord[],
    sermons: [] as AnyRecord[],
    changes: [] as AnyRecord[],
    nextSermonId: 1,
    nextChangeId: 1,
    nextTransactionId: 1,
    transactions: 0,
    commits: 0,
    rollbacks: 0,
  }
  const sessions: Record<string, {
    db: {
      execute: (_query: unknown) => Promise<{ rows: AnyRecord[] }>
    }
  }> = {}

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

  async function executeSnapshotQuery(query: AnyRecord) {
    const { text, parameters } = queryParts(query)
    if (text.includes('MAX("id")')) {
      const [communityValue] = parameters
      const community = Number(communityValue)
      const latestId = state.changes
        .filter(change => Number(relationValue(change.community)) === community)
        .reduce((maximum, change) => Math.max(maximum, Number(change.id)), 0)
      return { rows: [{ highWater: String(latestId) }] }
    }
    if (text.includes('DISTINCT ON ("sync_id")')) {
      const [
        communityValue,
        checkpointValue,
        throughValue,
        afterSyncIdValue,
        limitValue,
      ] = parameters
      const community = Number(communityValue)
      const checkpoint = Number(checkpointValue)
      const through = Number(throughValue)
      const afterSyncId = String(afterSyncIdValue)
      const latestBySyncId = new Map<string, AnyRecord>()
      for (const change of state.changes) {
        const changeId = Number(change.id)
        const syncId = String(change.syncId)
        if (Number(relationValue(change.community)) !== community
          || changeId <= checkpoint
          || changeId > through
          || syncId <= afterSyncId) {
          continue
        }
        const previous = latestBySyncId.get(syncId)
        if (!previous || Number(previous.id) < changeId) {
          latestBySyncId.set(syncId, change)
        }
      }
      const rows = [...latestBySyncId.values()]
        .sort((left, right) => String(left.syncId) < String(right.syncId) ? -1 : 1)
        .slice(0, Number(limitValue))
        .map(change => ({
          ...change,
          syncVersion: String(change.syncVersion),
          changedAt: new Date(change.changedAt),
        }))
      return { rows }
    }
    throw new Error(`unexpected snapshot SQL: ${text}`)
  }

  function documentsFor(collection: string): AnyRecord[] {
    if (collection === 'syncshow-connections') return state.connections
    if (collection === 'memberships') return state.memberships
    if (collection === 'songs') return state.songs
    if (collection === 'sermons') return state.sermons
    if (collection === 'syncshow-sermon-changes') return state.changes
    return []
  }

  const payload = {
    secret: 'endpoint-test-secret',
    config: { cors: '*' },
    logger: {
      error: () => undefined,
      warn: () => undefined,
    },
    db: {
      sessions,
      drizzle: {
        execute: async (query: AnyRecord) => {
          const result = await executeSnapshotQuery(query)
          return rawDrizzleRows ? result.rows : result
        },
      },
      beginTransaction: async () => {
        const transactionId = state.nextTransactionId
        state.nextTransactionId += 1
        state.transactions += 1
        sessions[String(transactionId)] = {
          db: {
            // Advisory locks ignore rows. Sermon CAS only needs proof that its
            // already-resolved row still exists while this transaction holds it.
            execute: async query => {
              const { text, parameters } = queryParts(query as AnyRecord)
              if (text.includes('FROM "communities"')) {
                const communityId = Number(parameters[0])
                return {
                  rows: state.communities
                    .filter(community => Number(community.id) === communityId)
                    .map(community => ({ timeZone: community.timeZone })),
                }
              }
              return { rows: [{ id: state.sermons[0]?.id || 1 }] }
            },
          },
        }
        return transactionId
      },
      commitTransaction: async () => {
        state.commits += 1
      },
      rollbackTransaction: async () => {
        state.rollbacks += 1
      },
    },
    find: async (args: AnyRecord) => {
      let documents = documentsFor(String(args.collection))
        .filter(document => matchesWhere(document, args.where))
      const sortFields = Array.isArray(args.sort)
        ? args.sort
        : args.sort
          ? [args.sort]
          : []
      if (sortFields.length) {
        documents = [...documents].sort((left, right) => {
          for (const rawField of sortFields) {
            const descending = String(rawField).startsWith('-')
            const field = descending ? String(rawField).slice(1) : String(rawField)
            const a = relationValue(left[field])
            const b = relationValue(right[field])
            if (a === b) continue
            const comparison = a < b ? -1 : 1
            return descending ? -comparison : comparison
          }
          return 0
        })
      }
      const limit = Number.isSafeInteger(args.limit) ? Number(args.limit) : documents.length
      return {
        docs: documents.slice(0, limit),
        totalDocs: documents.length,
      }
    },
    create: async (args: AnyRecord) => {
      const collection = String(args.collection)
      if (collection === 'sermons') {
        const now = new Date().toISOString()
        const document = {
          id: state.nextSermonId,
          createdAt: now,
          updatedAt: now,
          ...clone(args.data),
        }
        state.nextSermonId += 1
        state.sermons.push(document)
        return document
      }
      if (collection === 'syncshow-sermon-changes') {
        const document = {
          id: state.nextChangeId,
          ...clone(args.data),
        }
        state.nextChangeId += 1
        state.changes.push(document)
        return document
      }
      throw new Error(`unexpected create collection: ${collection}`)
    },
    update: async (args: AnyRecord) => {
      const documents = documentsFor(String(args.collection))
      const document = documents.find(candidate => candidate.id === args.id)
      if (!document) throw new Error(`missing ${String(args.collection)} ${String(args.id)}`)
      Object.assign(document, clone(args.data), { updatedAt: new Date().toISOString() })
      return document
    },
  }

  function addConnection(token: string, scopes: string[]) {
    state.connections.push({
      id: state.connections.length + 1,
      community: 7,
      user: 11,
      tokenHash: hashOpaqueToken(token),
      scopes,
      expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      lastUsedAt: new Date().toISOString(),
    })
  }

  function request({
    token,
    body,
    headers = {},
    query = '',
    syncId,
  }: {
    token: string
    body?: AnyRecord
    headers?: Record<string, string>
    query?: string
    syncId?: string
  }) {
    return {
      headers: new Headers({
        authorization: `SyncShow ${token}`,
        'content-type': 'application/json',
        ...headers,
      }),
      payload,
      routeParams: syncId ? { syncId } : {},
      text: async () => JSON.stringify(body || {}),
      transactionID: undefined,
      url: `http://localhost/api/community/syncshow/v1/sermons${query}`,
    }
  }

  return { addConnection, payload, request, state }
}

async function responseJson(response: Response) {
  return await response.json() as AnyRecord
}

function signedCursorPayload(cursor: unknown) {
  if (typeof cursor !== 'string') {
    assert.fail('signed cursor must be a string')
  }
  const [encodedPayload, signature, extra] = cursor.split('.')
  assert.equal(extra, undefined)
  assert.match(encodedPayload, /^[A-Za-z0-9_-]+$/)
  assert.match(signature, /^[A-Za-z0-9_-]{43}$/)
  return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as AnyRecord
}

function assertUnavailableSources(envelopeValue: unknown) {
  const envelope = normalizeRemoteSermonEnvelope(envelopeValue)
  for (const source of envelope.sourceObjects) {
    assert.deepEqual(
      Object.keys(source).sort(),
      ['available', 'sha256', 'sizeBytes', 'sourceId'],
    )
    assert.equal(source.available, false)
  }
  return envelope
}

test('song-only, sermon-only, and combined grants stay resource-scoped and writes require read', async () => {
  const harness = makeHarness()
  harness.addConnection('song-only-token', [SYNCSHOW_READ_SCOPE, SYNCSHOW_WRITE_SCOPE])
  harness.addConnection('sermon-only-token', [
    SYNCSHOW_SERMON_READ_SCOPE,
    SYNCSHOW_SERMON_WRITE_SCOPE,
  ])
  harness.addConnection('combined-token', [
    SYNCSHOW_READ_SCOPE,
    SYNCSHOW_WRITE_SCOPE,
    SYNCSHOW_SERMON_READ_SCOPE,
    SYNCSHOW_SERMON_WRITE_SCOPE,
  ])
  harness.addConnection('sermon-read-token', [SYNCSHOW_SERMON_READ_SCOPE])
  harness.addConnection('sermon-write-token', [SYNCSHOW_SERMON_WRITE_SCOPE])

  assert.equal(
    (await listSongs(harness.request({ token: 'song-only-token' }) as never)).status,
    200,
  )
  assert.equal(
    (await listSermons(harness.request({ token: 'song-only-token' }) as never)).status,
    401,
  )
  assert.equal(
    (await listSermons(harness.request({ token: 'sermon-only-token' }) as never)).status,
    200,
  )
  assert.equal(
    (await listSongs(harness.request({ token: 'sermon-only-token' }) as never)).status,
    401,
  )
  assert.equal(
    (await listSermons(harness.request({ token: 'combined-token' }) as never)).status,
    200,
  )
  assert.equal(
    (await listSongs(harness.request({ token: 'combined-token' }) as never)).status,
    200,
  )

  const validBody = writeFor(fixture.sermons.v3)
  for (const token of ['sermon-read-token', 'sermon-write-token']) {
    const response = await createSermon(harness.request({
      token,
      body: validBody,
      headers: { 'idempotency-key': `scope-check-${token}` },
    }) as never)
    assert.equal(response.status, 401)
    assert.equal((await responseJson(response)).code, 'UNAUTHORIZED')
  }
  assert.equal(harness.state.transactions, 0)
  assert.equal(harness.state.sermons.length, 0)
})

test('authenticated create/get never exposes source bytes and create retries are exact', async () => {
  const harness = makeHarness()
  harness.addConnection('sermon-token', [
    SYNCSHOW_SERMON_READ_SCOPE,
    SYNCSHOW_SERMON_WRITE_SCOPE,
  ])
  const write = writeFor(fixture.sermons.v3)
  const request = () => harness.request({
    token: 'sermon-token',
    body: write,
    headers: { 'idempotency-key': 'create-sermon-v3-retry' },
  })

  const createdResponse = await createSermon(request() as never)
  assert.equal(createdResponse.status, 201)
  assert.equal(createdResponse.headers.get('etag'), '"sermon:sermon-golden-v3:1"')
  const createdBody = await responseJson(createdResponse)
  assert.deepEqual(Object.keys(createdBody), ['sermon'])
  const created = assertUnavailableSources(createdBody.sermon)
  assert.equal(created.documentSource, write.documentSource)
  assert.equal(created.revision, write.revision)
  assert.equal(created.syncVersion, 1)
  assert.equal(harness.state.sermons.length, 1)
  assert.equal(
    harness.state.sermons[0].preachedAt,
    `${fixture.sermons.v3.document.serviceDate}T19:00:00.000Z`,
  )
  assert.equal(harness.state.changes.length, 1)

  const retryResponse = await createSermon(request() as never)
  assert.equal(retryResponse.status, 200)
  assert.deepEqual((await responseJson(retryResponse)).sermon, createdBody.sermon)
  assert.equal(harness.state.sermons.length, 1)
  assert.equal(harness.state.changes.length, 1)

  const differentKeyResponse = await createSermon(harness.request({
    token: 'sermon-token',
    body: write,
    headers: { 'idempotency-key': 'create-sermon-v3-different-key' },
  }) as never)
  assert.equal(differentKeyResponse.status, 409)
  assert.equal((await responseJson(differentKeyResponse)).code, 'SYNC_ID_EXISTS')
  assert.equal(harness.state.sermons.length, 1)
  assert.equal(harness.state.changes.length, 1)

  const conflictingResponse = await createSermon(harness.request({
    token: 'sermon-token',
    body: changedWrite(fixture.sermons.v3, 'A Different Create Body'),
    headers: { 'idempotency-key': 'create-sermon-v3-retry' },
  }) as never)
  assert.equal(conflictingResponse.status, 409)
  assert.equal((await responseJson(conflictingResponse)).code, 'IDEMPOTENCY_KEY_REUSED')
  assert.equal(harness.state.sermons.length, 1)
  assert.equal(harness.state.changes.length, 1)

  const leakSentinel = 'DO_NOT_LEAK_PRIVATE_ATTACHMENT_BYTES'
  harness.state.sermons[0].syncSourceObjects = [{
    sourceId: 'hostile-storage-state',
    available: true,
    sourceBytes: leakSentinel,
  }]
  harness.state.sermons[0].media = [{ attachmentBytes: leakSentinel }]
  harness.state.sermons[0].transcript = leakSentinel
  const getResponse = await getSermon(harness.request({
    token: 'sermon-token',
    syncId: write.syncId,
  }) as never)
  assert.equal(getResponse.status, 200)
  const getBody = await responseJson(getResponse)
  assert.equal(JSON.stringify(getBody).includes(leakSentinel), false)
  const fetched = assertUnavailableSources(getBody.sermon)
  assert.equal(fetched.documentSource, write.documentSource)
  assert.equal(getResponse.headers.get('etag'), '"sermon:sermon-golden-v3:1"')
})

test('canonical date projection uses noon in the exact Community time zone', () => {
  const expectedByTimeZone = new Map([
    ['America/Los_Angeles', '2026-07-29T19:00:00.000Z'],
    ['UTC', '2026-07-29T12:00:00.000Z'],
    ['Pacific/Auckland', '2026-07-29T00:00:00.000Z'],
    ['Pacific/Kiritimati', '2026-07-28T22:00:00.000Z'],
  ])
  for (const [timeZone, expected] of expectedByTimeZone) {
    const projected = payloadPreachedAtForServiceDate('2026-07-29', timeZone)
    assert.equal(projected, expected, timeZone)
    assert.equal(
      serviceDateForProjectedPreachedAt(projected, timeZone),
      '2026-07-29',
      timeZone,
    )
  }
  assert.throws(
    () => payloadPreachedAtForServiceDate('2026-02-30', 'UTC'),
    /real calendar date/,
  )
  assert.throws(
    () => payloadPreachedAtForServiceDate('2026-07-29', 'Mars/Olympus_Mons'),
    /time zone is missing or invalid/,
  )
})

test('date repair reads canonical bytes and updates only valid adopted sermon rows', async () => {
  const sourceBefore = fixture.sermons.v3.canonicalSource
  const queries: unknown[] = []
  await repairCanonicalSermonDateProjections({
    db: {
      execute: async (query: unknown) => {
        queries.push(query)
        return queries.length === 1
          ? {
              rows: [{
                sermonId: '17',
                communityId: '7',
                syncId: fixture.sermons.v3.document.id,
                documentSource: sourceBefore,
              }],
            }
          : queries.length === 2
            ? { rows: [{ timeZone: 'Pacific/Kiritimati' }] }
          : { rows: [] }
      },
    },
  } as never)
  assert.equal(queries.length, 3)
  assert.equal(fixture.sermons.v3.canonicalSource, sourceBefore)

  let corruptQueries = 0
  await assert.rejects(
    repairCanonicalSermonDateProjections({
      db: {
        execute: async () => {
          corruptQueries += 1
          return {
            rows: [{
              sermonId: '18',
              communityId: '7',
              syncId: fixture.sermons.v3.document.id,
              documentSource: '{"corrupt":true}\n',
            }],
          }
        },
      },
    } as never),
    /authoritative document is invalid/,
  )
  assert.equal(corruptQueries, 1)

  let missingZoneQueries = 0
  await assert.rejects(
    repairCanonicalSermonDateProjections({
      db: {
        execute: async () => {
          missingZoneQueries += 1
          return missingZoneQueries === 1
            ? {
                rows: [{
                  sermonId: '19',
                  communityId: '7',
                  syncId: fixture.sermons.v3.document.id,
                  documentSource: sourceBefore,
                }],
              }
            : { rows: [] }
        },
      },
    } as never),
    /Community time zone is missing or invalid/,
  )
  assert.equal(missingZoneQueries, 2)
})

test('canonical create fails closed before mutation when the Community time zone is invalid', async () => {
  const harness = makeHarness()
  harness.state.communities[0].timeZone = 'Mars/Olympus_Mons'
  harness.addConnection('invalid-zone-sermon-token', [
    SYNCSHOW_SERMON_READ_SCOPE,
    SYNCSHOW_SERMON_WRITE_SCOPE,
  ])
  const response = await createSermon(harness.request({
    token: 'invalid-zone-sermon-token',
    body: writeFor(fixture.sermons.v3),
    headers: { 'idempotency-key': 'invalid-community-time-zone' },
  }) as never)
  assert.equal(response.status, 500)
  assert.equal((await responseJson(response)).code, 'SERVER_ERROR')
  assert.equal(harness.state.sermons.length, 0)
  assert.equal(harness.state.changes.length, 0)
  assert.equal(harness.state.commits, 0)
  assert.equal(harness.state.rollbacks, 1)
})

test('manager authorization is rechecked inside create transactions before replay or mutation', async () => {
  const harness = makeHarness()
  const request = harness.request({ token: 'manager-store-test' })
  const write = writeFor(fixture.sermons.v3)
  const created = await createCanonicalSermon(
    request as never,
    7,
    write,
    'manager-create-recheck',
  )
  assert.equal(created.created, true)

  let authorizationChecks = 0
  const rejectAuthorization = async (transactionDatabase: {
    execute: (query: unknown) => Promise<unknown>
  }) => {
    authorizationChecks += 1
    assert.equal(typeof transactionDatabase.execute, 'function')
    assert.notEqual(request.transactionID, undefined)
    throw new SyncShowProtocolError(
      'MANAGER_REQUIRED',
      'The manager role changed before the sermon could be saved.',
      403,
    )
  }
  const rejectsManager = (error: unknown) => (
    error instanceof SyncShowProtocolError
    && error.code === 'MANAGER_REQUIRED'
    && error.status === 403
  )

  await assert.rejects(
    createCanonicalSermon(
      request as never,
      7,
      write,
      'manager-create-recheck',
      { authorize: rejectAuthorization },
    ),
    rejectsManager,
  )
  await assert.rejects(
    createCanonicalSermon(
      request as never,
      7,
      writeFor(fixture.sermons.v2),
      'manager-create-denied',
      { authorize: rejectAuthorization },
    ),
    rejectsManager,
  )
  assert.equal(authorizationChecks, 2)
  assert.equal(harness.state.commits, 1)
  assert.equal(harness.state.rollbacks, 2)
  assert.equal(harness.state.sermons.length, 1)
  assert.equal(harness.state.changes.length, 1)
  assert.equal(request.transactionID, undefined)
})

test('direct archived writes require the exact private tombstone shape', async () => {
  const harness = makeHarness()
  harness.addConnection('sermon-token', [
    SYNCSHOW_SERMON_READ_SCOPE,
    SYNCSHOW_SERMON_WRITE_SCOPE,
  ])
  const invalidPublications = [
    {
      status: 'archived',
      visibility: 'public',
      publishedAt: null,
      canonicalUrl: null,
    },
    {
      status: 'archived',
      visibility: 'private',
      publishedAt: '2026-07-28T12:00:00.000Z',
      canonicalUrl: null,
    },
    {
      status: 'archived',
      visibility: 'private',
      publishedAt: null,
      canonicalUrl: 'https://example.church/sermons/old',
    },
  ]
  for (const [index, publication] of invalidPublications.entries()) {
    const response = await createSermon(harness.request({
      token: 'sermon-token',
      body: publicationWrite(fixture.sermons.v1, publication),
      headers: { 'idempotency-key': `invalid-archive-create-${index}` },
    }) as never)
    assert.equal(response.status, 409)
    assert.equal((await responseJson(response)).code, 'INVALID_ARCHIVE_TOMBSTONE')
  }
  assert.equal(harness.state.sermons.length, 0)
  assert.equal(harness.state.changes.length, 0)

  const privateTombstone = {
    status: 'archived',
    visibility: 'private',
    publishedAt: null,
    canonicalUrl: null,
  }
  const archivedCreate = await createSermon(harness.request({
    token: 'sermon-token',
    body: publicationWrite(fixture.sermons.v1, privateTombstone),
    headers: { 'idempotency-key': 'valid-archive-create' },
  }) as never)
  assert.equal(archivedCreate.status, 201)
  assert.equal((await responseJson(archivedCreate)).sermon.archived, true)

  const active = writeFor(fixture.sermons.v2)
  const activeCreate = await createSermon(harness.request({
    token: 'sermon-token',
    body: active,
    headers: { 'idempotency-key': 'archive-put-create' },
  }) as never)
  assert.equal(activeCreate.status, 201)
  const invalidUpdate = await updateSermon(harness.request({
    token: 'sermon-token',
    syncId: active.syncId,
    body: publicationWrite(fixture.sermons.v2, invalidPublications[0]),
    headers: { 'if-match': '"sermon:sermon-golden-v2:1"' },
  }) as never)
  assert.equal(invalidUpdate.status, 409)
  assert.equal((await responseJson(invalidUpdate)).code, 'INVALID_ARCHIVE_TOMBSTONE')

  const validUpdate = await updateSermon(harness.request({
    token: 'sermon-token',
    syncId: active.syncId,
    body: publicationWrite(fixture.sermons.v2, privateTombstone),
    headers: { 'if-match': '"sermon:sermon-golden-v2:1"' },
  }) as never)
  assert.equal(validUpdate.status, 200)
  const archived = assertUnavailableSources((await responseJson(validUpdate)).sermon)
  assert.equal(archived.syncVersion, 2)
  assert.equal(archived.archived, true)
  assert.deepEqual(parseSermonDocument(archived.documentSource).publication, privateTombstone)
  assert.equal(harness.state.changes.length, 3)
})

test('CAS update accepts one exact lost-response retry, rejects stale divergence, and archives immutably', async () => {
  const harness = makeHarness()
  harness.addConnection('sermon-token', [
    SYNCSHOW_SERMON_READ_SCOPE,
    SYNCSHOW_SERMON_WRITE_SCOPE,
  ])
  const original = writeFor(fixture.sermons.v3)
  const updatedWrite = changedWrite(fixture.sermons.v3, 'Faithful Prayer — Revised')
  const staleDifferentWrite = changedWrite(fixture.sermons.v3, 'Stale Competing Revision')

  const createdResponse = await createSermon(harness.request({
    token: 'sermon-token',
    body: original,
    headers: { 'idempotency-key': 'cas-sermon-create' },
  }) as never)
  const originalEtag = createdResponse.headers.get('etag')
  assert.equal(originalEtag, '"sermon:sermon-golden-v3:1"')

  const updatedResponse = await updateSermon(harness.request({
    token: 'sermon-token',
    syncId: original.syncId,
    body: updatedWrite,
    headers: { 'if-match': String(originalEtag) },
  }) as never)
  assert.equal(updatedResponse.status, 200)
  assert.equal(updatedResponse.headers.get('etag'), '"sermon:sermon-golden-v3:2"')
  const updated = assertUnavailableSources((await responseJson(updatedResponse)).sermon)
  assert.equal(updated.syncVersion, 2)
  assert.equal(updated.revision, updatedWrite.revision)
  assert.equal(harness.state.changes.length, 2)

  const exactRetry = await updateSermon(harness.request({
    token: 'sermon-token',
    syncId: original.syncId,
    body: updatedWrite,
    headers: { 'if-match': String(originalEtag) },
  }) as never)
  assert.equal(exactRetry.status, 200)
  assert.equal(exactRetry.headers.get('etag'), '"sermon:sermon-golden-v3:2"')
  assert.equal((await responseJson(exactRetry)).sermon.syncVersion, 2)
  assert.equal(harness.state.changes.length, 2)

  const createReplayAfterAdvance = await createSermon(harness.request({
    token: 'sermon-token',
    body: original,
    headers: { 'idempotency-key': 'cas-sermon-create' },
  }) as never)
  assert.equal(createReplayAfterAdvance.status, 200)
  const replayedCurrent = assertUnavailableSources(
    (await responseJson(createReplayAfterAdvance)).sermon,
  )
  assert.equal(replayedCurrent.syncVersion, 2)
  assert.equal(replayedCurrent.revision, updatedWrite.revision)
  assert.equal(harness.state.changes.length, 2)

  const staleConflict = await updateSermon(harness.request({
    token: 'sermon-token',
    syncId: original.syncId,
    body: staleDifferentWrite,
    headers: { 'if-match': String(originalEtag) },
  }) as never)
  assert.equal(staleConflict.status, 412)
  assert.equal((await responseJson(staleConflict)).code, 'VERSION_CONFLICT')
  assert.equal(harness.state.changes.length, 2)

  const archivedResponse = await archiveSermon(harness.request({
    token: 'sermon-token',
    syncId: original.syncId,
    headers: { 'if-match': '"sermon:sermon-golden-v3:2"' },
  }) as never)
  assert.equal(archivedResponse.status, 200)
  assert.equal(archivedResponse.headers.get('etag'), '"sermon:sermon-golden-v3:3"')
  const archived = assertUnavailableSources((await responseJson(archivedResponse)).sermon)
  assert.equal(archived.syncVersion, 3)
  assert.equal(archived.archived, true)
  assert.deepEqual(parseSermonDocument(archived.documentSource).publication, {
    status: 'archived',
    visibility: 'private',
    publishedAt: null,
    canonicalUrl: null,
  })
  assert.equal(harness.state.changes.length, 3)
  assert.deepEqual(
    harness.state.changes.map(change => change.documentSource),
    [
      original.documentSource,
      updatedWrite.documentSource,
      archived.documentSource,
    ],
  )
  assert.equal(
    new Set(harness.state.changes.map(change => change.documentSource)).size,
    3,
  )
  for (const change of harness.state.changes) {
    assert.equal(
      createHash('sha256')
        .update(String(change.documentSource), 'utf8')
        .digest('hex'),
      change.revision,
    )
  }
  assert.equal(
    harness.state.sermons[0].syncCurrentDocumentSource,
    archived.documentSource,
  )

  const archiveRetry = await archiveSermon(harness.request({
    token: 'sermon-token',
    syncId: original.syncId,
    headers: { 'if-match': '"sermon:sermon-golden-v3:2"' },
  }) as never)
  assert.equal(archiveRetry.status, 200)
  assert.equal(archiveRetry.headers.get('etag'), '"sermon:sermon-golden-v3:3"')
  assert.equal((await responseJson(archiveRetry)).sermon.archived, true)
  assert.equal(harness.state.changes.length, 3)

  const ancientArchiveRetry = await archiveSermon(harness.request({
    token: 'sermon-token',
    syncId: original.syncId,
    headers: { 'if-match': '"sermon:sermon-golden-v3:1"' },
  }) as never)
  assert.equal(ancientArchiveRetry.status, 412)
  assert.equal((await responseJson(ancientArchiveRetry)).code, 'VERSION_CONFLICT')
  assert.equal(harness.state.changes.length, 3)

  const immutableResponse = await updateSermon(harness.request({
    token: 'sermon-token',
    syncId: original.syncId,
    body: staleDifferentWrite,
    headers: { 'if-match': '"sermon:sermon-golden-v3:3"' },
  }) as never)
  assert.equal(immutableResponse.status, 409)
  assert.equal((await responseJson(immutableResponse)).code, 'SERMON_ARCHIVED')
  assert.equal(harness.state.sermons[0].syncVersion, 3)
  assert.equal(harness.state.changes.length, 3)
})

test('snapshot cursors deduplicate over 1000 events and defer concurrent changes', async () => {
  const harness = makeHarness()
  harness.addConnection('sermon-token', [
    SYNCSHOW_SERMON_READ_SCOPE,
    SYNCSHOW_SERMON_WRITE_SCOPE,
  ])
  const first = writeFor(fixture.sermons.v1)
  const second = writeFor(fixture.sermons.v2)

  for (const [write, key] of [
    [first, 'pagination-first-create'],
    [second, 'pagination-second-create'],
  ] as const) {
    const response = await createSermon(harness.request({
      token: 'sermon-token',
      body: write,
      headers: { 'idempotency-key': key },
    }) as never)
    assert.equal(response.status, 201)
  }

  const revisedFirst = changedWrite(fixture.sermons.v1, 'Faithful Prayer — Later Edit')
  const revisedResponse = await updateSermon(harness.request({
    token: 'sermon-token',
    syncId: first.syncId,
    body: revisedFirst,
    headers: { 'if-match': '"sermon:sermon-golden-v1:1"' },
  }) as never)
  assert.equal(revisedResponse.status, 200)

  const firstSermon = harness.state.sermons.find(sermon => sermon.syncId === first.syncId)
  assert.ok(firstSermon)
  for (let syncVersion = 3; syncVersion <= 1102; syncVersion += 1) {
    const changedAt = new Date(Date.UTC(2026, 6, 28, 0, 0, 0, syncVersion)).toISOString()
    const revision = syncVersion === 1102
      ? revisedFirst.revision
      : syncVersion.toString(16).padStart(64, '0')
    harness.state.changes.push({
      id: harness.state.nextChangeId,
      community: 7,
      sermon: firstSermon.id,
      syncId: first.syncId,
      syncVersion,
      revision,
      archived: false,
      changedAt,
    })
    harness.state.nextChangeId += 1
    if (syncVersion === 1102) {
      firstSermon.syncVersion = syncVersion
      firstSermon.syncCurrentRevision = revision
      firstSermon.syncChangedAt = changedAt
    }
  }
  assert.equal(harness.state.changes.length, 1103)

  const firstPageResponse = await listSermons(harness.request({
    token: 'sermon-token',
    query: '?limit=1',
  }) as never)
  assert.equal(firstPageResponse.status, 200)
  const firstPageBody = await responseJson(firstPageResponse)
  assert.equal(
    firstPageBody.items.some((item: AnyRecord) => 'documentSource' in item),
    false,
  )
  const firstPage = normalizeSermonChangePage(firstPageBody)
  assert.equal(firstPage.hasMore, true)
  assert.deepEqual(
    firstPage.items.map(item => [item.syncId, item.syncVersion]),
    [[first.syncId, 1102]],
  )
  assert.deepEqual(
    signedCursorPayload(firstPage.nextCursor),
    {
      version: 1,
      lane: 'sermons',
      communityId: 7,
      checkpoint: 0,
      through: 1103,
      afterSyncId: first.syncId,
    },
  )

  const afterSnapshotWrite = changedWrite(
    fixture.sermons.v1,
    'Faithful Prayer — Committed During Pagination',
  )
  const afterSnapshotResponse = await updateSermon(harness.request({
    token: 'sermon-token',
    syncId: first.syncId,
    body: afterSnapshotWrite,
    headers: { 'if-match': '"sermon:sermon-golden-v1:1102"' },
  }) as never)
  assert.equal(afterSnapshotResponse.status, 200)
  assert.equal(harness.state.changes.length, 1104)

  const secondPage = normalizeSermonChangePage(await responseJson(await listSermons(
    harness.request({
      token: 'sermon-token',
      query: `?limit=1&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
    }) as never,
  )))
  assert.equal(secondPage.hasMore, false)
  assert.deepEqual(
    secondPage.items.map(item => [item.syncId, item.syncVersion]),
    [[second.syncId, 1]],
  )
  assert.deepEqual(
    signedCursorPayload(secondPage.nextCursor),
    {
      version: 1,
      lane: 'sermons',
      communityId: 7,
      checkpoint: 1103,
    },
  )
  assert.equal(
    new Set([...firstPage.items, ...secondPage.items].map(item => item.syncId)).size,
    firstPage.items.length + secondPage.items.length,
  )

  const nextSnapshot = normalizeSermonChangePage(await responseJson(await listSermons(
    harness.request({
      token: 'sermon-token',
      query: `?limit=1&cursor=${encodeURIComponent(secondPage.nextCursor)}`,
    }) as never,
  )))
  assert.deepEqual(
    nextSnapshot.items.map(item => [item.syncId, item.syncVersion, item.revision]),
    [[first.syncId, 1103, afterSnapshotWrite.revision]],
  )
  assert.equal(nextSnapshot.hasMore, false)
  assert.deepEqual(
    signedCursorPayload(nextSnapshot.nextCursor),
    {
      version: 1,
      lane: 'sermons',
      communityId: 7,
      checkpoint: 1104,
    },
  )

  const emptySnapshot = normalizeSermonChangePage(await responseJson(await listSermons(
    harness.request({
      token: 'sermon-token',
      query: `?limit=1&cursor=${encodeURIComponent(nextSnapshot.nextCursor)}`,
    }) as never,
  )))
  assert.deepEqual(emptySnapshot.items, [])
  assert.equal(emptySnapshot.hasMore, false)
  assert.equal(emptySnapshot.nextCursor, nextSnapshot.nextCursor)

  const [encodedPayload, signature] = firstPage.nextCursor.split('.')
  const tamperedPayload = signedCursorPayload(firstPage.nextCursor)
  tamperedPayload.afterSyncId = second.syncId
  const tamperedCursor = `${
    Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url')
  }.${signature}`
  const tamperedResponse = await listSermons(harness.request({
    token: 'sermon-token',
    query: `?limit=1&cursor=${encodeURIComponent(tamperedCursor)}`,
  }) as never)
  assert.equal(tamperedResponse.status, 400)
  assert.equal((await responseJson(tamperedResponse)).code, 'INVALID_CURSOR')
  assert.notEqual(tamperedCursor.split('.')[0], encodedPayload)

  for (const cursorObject of [
    { checkpoint: 1105 },
    { checkpoint: 1103, through: 1105, afterSyncId: first.syncId },
  ]) {
    const forgedCursor = Buffer.from(JSON.stringify(cursorObject)).toString('base64url')
    const response = await listSermons(harness.request({
      token: 'sermon-token',
      query: `?limit=1&cursor=${encodeURIComponent(forgedCursor)}`,
    }) as never)
    assert.equal(response.status, 400)
    assert.equal((await responseJson(response)).code, 'INVALID_CURSOR')
  }
})

test('real Drizzle array results drive sermon high-water and snapshot rows', async () => {
  const harness = makeHarness({ rawDrizzleRows: true })
  harness.addConnection('real-drizzle-shape-token', [
    SYNCSHOW_SERMON_READ_SCOPE,
  ])
  harness.state.changes.push({
    id: 1,
    community: 7,
    sermon: 1,
    syncId: 'real-drizzle-shape-sermon',
    syncVersion: 3,
    revision: 'a'.repeat(64),
    archived: false,
    changedAt: '2026-07-28T20:00:00.000Z',
  })

  const response = await listSermons(harness.request({
    token: 'real-drizzle-shape-token',
  }) as never)
  assert.equal(response.status, 200)
  const page = normalizeSermonChangePage(await responseJson(response))
  assert.equal(page.items.length, 1)
  assert.deepEqual(page.items[0], {
    syncId: 'real-drizzle-shape-sermon',
    syncVersion: 3,
    revision: 'a'.repeat(64),
    archived: false,
    updatedAt: '2026-07-28T20:00:00.000Z',
  })
})

test('sermon request wrapper rejects a declared body over the private transfer limit', async () => {
  assert.equal(
    MAX_SERMON_TRANSFER_JSON_BYTES,
    (MAX_SERMON_SOURCE_BYTES * 2) + (MAX_SERMON_SOURCE_OBJECTS * 512) + (64 * 1024),
  )
  const harness = makeHarness()
  harness.addConnection('sermon-token', [
    SYNCSHOW_SERMON_READ_SCOPE,
    SYNCSHOW_SERMON_WRITE_SCOPE,
  ])
  const response = await createSermon(harness.request({
    token: 'sermon-token',
    body: writeFor(fixture.sermons.v3),
    headers: {
      'content-length': String(MAX_SERMON_TRANSFER_JSON_BYTES + 1),
      'idempotency-key': 'oversized-wrapper-check',
    },
  }) as never)
  assert.equal(response.status, 413)
  assert.equal((await responseJson(response)).code, 'REQUEST_TOO_LARGE')
  assert.equal(harness.state.transactions, 0)
  assert.equal(harness.state.sermons.length, 0)
  assert.equal(harness.state.changes.length, 0)
})

test('sermon writes reject non-JSON request media before starting a transaction', async () => {
  const harness = makeHarness()
  harness.addConnection('sermon-token', [
    SYNCSHOW_SERMON_READ_SCOPE,
    SYNCSHOW_SERMON_WRITE_SCOPE,
  ])
  const response = await createSermon(harness.request({
    token: 'sermon-token',
    body: writeFor(fixture.sermons.v3),
    headers: {
      'content-type': 'text/plain',
      'idempotency-key': 'wrong-content-type',
    },
  }) as never)
  assert.equal(response.status, 415)
  assert.equal((await responseJson(response)).code, 'UNSUPPORTED_MEDIA_TYPE')
  assert.equal(harness.state.transactions, 0)
  assert.equal(harness.state.sermons.length, 0)
  assert.equal(harness.state.changes.length, 0)
})

test('sermon change authority is private, internal-only, canonical, and immutable', async () => {
  assert.equal(SyncShowSermonChanges.admin?.hidden, true)
  const read = SyncShowSermonChanges.access?.read
  assert.equal(typeof read, 'function')
  assert.equal(await (read as Function)({ req: { user: null } }), false)
  assert.equal(await (read as Function)({
    req: { user: { systemRole: 'member' } },
  }), false)
  assert.equal(await (read as Function)({
    req: { user: { systemRole: 'system-admin' } },
  }), true)
  for (const operation of ['create', 'update', 'delete'] as const) {
    const access = SyncShowSermonChanges.access?.[operation]
    assert.equal(typeof access, 'function')
    assert.equal(await (access as Function)({ req: { user: null } }), false)
  }

  const documentSource = fixture.sermons.v3.canonicalSource
  const authority = {
    syncId: fixture.sermons.v3.document.id,
    revision: fixture.sermons.v3.revision,
    documentSource,
    archived: false,
  }
  assert.deepEqual(validateSermonChangeAuthority(authority), authority)
  assert.deepEqual(protectSermonChangeAuthority({
    data: authority,
    operation: 'create',
    context: { syncShowSermonChangeMutation: true },
  } as never), authority)
  assert.throws(() => protectSermonChangeAuthority({
    data: authority,
    operation: 'create',
    context: {},
  } as never), /internal sync transaction/i)
  assert.throws(() => protectSermonChangeAuthority({
    data: authority,
    operation: 'update',
    context: { syncShowSermonChangeMutation: true },
  } as never), /append-only and immutable/i)
  assert.throws(
    () => rejectSermonChangeDeletion({} as never),
    /append-only and immutable/i,
  )
  assert.throws(
    () => validateSermonChangeAuthority({
      ...authority,
      documentSource: documentSource.trimEnd(),
    }),
    /authority is invalid/i,
  )
  assert.throws(
    () => validateSermonChangeAuthority({
      ...authority,
      revision: '0'.repeat(64),
    }),
    /authority is invalid/i,
  )
  assert.throws(
    () => validateSermonChangeAuthority({ ...authority, archived: true }),
    /authority is invalid/i,
  )

  const field = (SyncShowSermonChanges.fields as AnyRecord[])
    .find(candidate => candidate.name === 'documentSource')
  assert.ok(field)
  assert.equal(field.type, 'textarea')
  assert.equal(field.required, true)
  assert.equal(field.hidden, true)
  assert.equal(Boolean(field.access.read({ req: { user: null } })), false)
  assert.equal(Boolean(field.access.read({
    req: { user: { systemRole: 'member' } },
  })), false)
  assert.equal(Boolean(field.access.read({
    req: { user: { systemRole: 'system-admin' } },
  })), true)
})

test('private sermon authority stays protected while planning filters can query safe metadata', async () => {
  const privateFields = [
    'syncId',
    'syncVersion',
    'syncCurrentDocumentSource',
    'syncCurrentRevision',
    'syncArchived',
    'syncPublicationStatus',
    'syncVisibility',
    'syncSourceObjects',
    'syncChangedAt',
    'syncCreateIdempotencyKey',
    'syncCreateIdempotencyHash',
  ]
  const planningQueryableFields = new Set(['syncId', 'syncArchived'])
  const anonymousRequest = { user: null }
  const memberRequest = { user: { id: 2, systemRole: 'member' } }
  const fields = Sermons.fields as AnyRecord[]
  for (const name of privateFields) {
    const field = fields.find(candidate => candidate.name === name)
    assert.ok(field, `missing private field ${name}`)
    if (planningQueryableFields.has(name)) {
      assert.notEqual(field.hidden, true)
      assert.equal(field.admin?.hidden, true)
    } else {
      assert.equal(field.hidden, true)
    }
    assert.equal(
      Boolean(await field.access.read({ req: anonymousRequest })),
      planningQueryableFields.has(name),
    )
    assert.equal(
      Boolean(await field.access.read({ req: memberRequest })),
      planningQueryableFields.has(name),
    )
    assert.equal(Boolean(await field.access.read({
      req: { user: { systemRole: 'system-admin' } },
    })), true)
  }

  const original: AnyRecord = {
    syncId: 'sermon-private',
    syncVersion: 8,
    syncCurrentDocumentSource: '{"private":"canonical"}\n',
    syncCurrentRevision: 'a'.repeat(64),
    syncArchived: false,
    syncPublicationStatus: 'ready',
    syncVisibility: 'private',
    syncSourceObjects: [{ sourceId: 'private-source', available: false }],
    syncChangedAt: '2026-07-27T01:00:00.000Z',
    syncCreateIdempotencyKey: 'private-create-key',
    syncCreateIdempotencyHash: 'b'.repeat(64),
  }
  const ordinaryUpdate = protectPrivateSermonState({
    title: 'Allowed editorial title',
    status: 'published',
    syncId: 'hijacked-id',
    syncVersion: 999,
    syncCurrentDocumentSource: 'leaked replacement bytes',
    syncArchived: true,
  }, original)
  assert.equal(ordinaryUpdate.title, 'Allowed editorial title')
  assert.equal(ordinaryUpdate.status, 'draft')
  for (const name of privateFields) {
    assert.deepEqual(ordinaryUpdate[name], original[name])
  }

  const ordinaryCreate = protectPrivateSermonState({
    title: 'Legacy sermon',
    syncId: 'smuggled-id',
    syncCurrentDocumentSource: 'smuggled private bytes',
  }, undefined)
  assert.equal('syncId' in ordinaryCreate, false)
  assert.equal('syncCurrentDocumentSource' in ordinaryCreate, false)

  const internalCreate = protectPrivateSermonState({
    title: 'Canonical private sermon',
    status: 'published',
    syncId: 'internal-id',
    syncVersion: 1,
    syncCurrentDocumentSource: '{"canonical":true}\n',
  }, undefined, { syncShowSermonMutation: true })
  assert.equal(internalCreate.syncId, 'internal-id')
  assert.equal(internalCreate.syncVersion, 1)
  assert.equal(internalCreate.status, 'draft')
})

test('collection read access hides managed drafts from members while preserving legacy behavior', async () => {
  const memberships = [
    { id: 1, community: 7, user: 21, role: 'member' },
    { id: 2, community: 7, user: 22, role: 'leader' },
  ]
  const requestFor = (userId: number) => ({
    user: { id: userId, systemRole: 'member' },
    payload: {
      find: async (args: AnyRecord) => ({
        docs: memberships.filter(row => matchesWhere(row, args.where)),
      }),
    },
  })
  const managedDraft = {
    id: 1,
    community: 7,
    status: 'draft',
    syncId: 'managed-private-sermon',
  }
  const legacyDraft = {
    id: 2,
    community: 7,
    status: 'draft',
  }
  const publishedLegacy = {
    id: 3,
    community: 99,
    status: 'published',
  }
  const publishedManaged = {
    id: 4,
    community: 99,
    status: 'published',
    syncId: 'malformed-published-managed-sermon',
  }

  const anonymousAccess = await readSermonsByPublicationOrManager({
    req: { user: null },
  } as never)
  assert.notEqual(anonymousAccess, true)
  assert.equal(matchesWhere(managedDraft, anonymousAccess as AnyRecord), false)
  assert.equal(matchesWhere(publishedManaged, anonymousAccess as AnyRecord), false)
  assert.equal(matchesWhere(publishedLegacy, anonymousAccess as AnyRecord), true)

  const memberAccess = await readSermonsByPublicationOrManager({
    req: requestFor(21),
  } as never)
  assert.notEqual(memberAccess, true)
  assert.equal(matchesWhere(managedDraft, memberAccess as AnyRecord), false)
  assert.equal(matchesWhere(publishedManaged, memberAccess as AnyRecord), false)
  assert.equal(matchesWhere(legacyDraft, memberAccess as AnyRecord), true)
  assert.equal(matchesWhere(publishedLegacy, memberAccess as AnyRecord), true)

  const managerAccess = await readSermonsByPublicationOrManager({
    req: requestFor(22),
  } as never)
  assert.notEqual(managerAccess, true)
  assert.equal(matchesWhere(managedDraft, managerAccess as AnyRecord), true)
  assert.equal(matchesWhere(legacyDraft, managerAccess as AnyRecord), true)

  const updateAccess = Sermons.access?.update
  const deleteAccess = Sermons.access?.delete
  assert.equal(typeof updateAccess, 'function')
  assert.equal(typeof deleteAccess, 'function')
  const managerUpdateAccess = await updateAccess!({ req: requestFor(22) } as never)
  assert.notEqual(managerUpdateAccess, true)
  assert.equal(matchesWhere(managedDraft, managerUpdateAccess as AnyRecord), false)
  assert.equal(matchesWhere(legacyDraft, managerUpdateAccess as AnyRecord), true)

  const managerDeleteAccess = await deleteAccess!({ req: requestFor(22) } as never)
  assert.notEqual(managerDeleteAccess, true)
  assert.equal(matchesWhere(managedDraft, managerDeleteAccess as AnyRecord), false)
  assert.equal(matchesWhere(legacyDraft, managerDeleteAccess as AnyRecord), true)
})
