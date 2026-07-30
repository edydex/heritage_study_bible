import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import {
  applyManagerSongPublicLinkRevocation,
} from '../src/collections/SyncShowSongPublicLinks.ts'
import {
  songPublicLinkEndpoints,
} from '../src/endpoints/songPublicLinks.ts'
import { syncShowEndpoints } from '../src/endpoints/syncShow.ts'
import {
  buildSongPublicLinkSnapshot,
  normalizeSongPublicLinkCreateRequest,
  renderSongPublicLinkHtml,
  songPublicLinkFamilyRevision,
  songPublicLinkReviewRevision,
  unavailableSongPublicLinkResponse,
} from '../src/lib/syncshow/SongPublicLink.ts'
import {
  authorizeSongPublicLinks,
  createSongPublicLink,
  loadActiveSongPublicLinkSnapshot,
} from '../src/lib/syncshow/SongPublicLinkStore.ts'
import { hashOpaqueToken } from '../src/lib/tokens.ts'

type AnyRecord = Record<string, any>

const token = 'song-public-link-token-000001'
const otherToken = 'song-public-link-token-000002'
const originalSource = `---
id: exact-original
title: Exact Original
language: en
authors: ["Reviewed Author"]
attribution: "Public copyright notice.\\nPrivate source: /Users/operator/permission.eml\\nManager email: internal@example.test"
privateNote: /Users/operator/private-rights.txt
---

^1
Pinned original line
`
const translationSource = `---
id: exact-translation
title: Точный перевод
language: ru
translationOf: exact-original
attribution: Public translation credit.
source: /Volumes/private/review-deck.pptx
---

^1
Закрепленная строка
`

function revision(source: string) {
  return createHash('sha256').update(source, 'utf8').digest('hex')
}

const exactDocuments = [
  {
    id: 'exact-translation',
    source: translationSource,
    revision: revision(translationSource),
  },
  {
    id: 'exact-original',
    source: originalSource,
    revision: revision(originalSource),
  },
]
const familyRevision = songPublicLinkFamilyRevision(exactDocuments)

function relationValue(value: any) {
  return value && typeof value === 'object' && 'id' in value
    ? value.id
    : value
}

function matchesWhere(document: AnyRecord, where: AnyRecord | undefined): boolean {
  if (!where) return true
  if (
    Array.isArray(where.and)
    && !where.and.every((part: AnyRecord) => matchesWhere(document, part))
  ) {
    return false
  }
  if (
    Array.isArray(where.or)
    && !where.or.some((part: AnyRecord) => matchesWhere(document, part))
  ) {
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
    if (
      'equals' in operation
      && actual !== relationValue(operation.equals)
    ) {
      return false
    }
    if ('exists' in operation) {
      const exists = actual !== undefined && actual !== null
      if (exists !== operation.exists) return false
    }
    if ('greater_than' in operation && !(actual > operation.greater_than)) {
      return false
    }
    if ('less_than' in operation && !(actual < operation.less_than)) {
      return false
    }
  }
  return true
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

function makeHarness({
  rawTransactionRows = false,
}: {
  rawTransactionRows?: boolean
} = {}) {
  const now = new Date()
  const state = {
    memberships: [
      { id: 1, community: 7, user: 11, role: 'leader' },
      { id: 2, community: 8, user: 12, role: 'leader' },
    ] as AnyRecord[],
    connections: [
      {
        id: 1,
        community: 7,
        user: 11,
        tokenHash: hashOpaqueToken(token),
        scopes: [
          'syncshow:songs:read',
          'syncshow:song-public-links:read',
          'syncshow:song-public-links:write',
        ],
        expiresAt: new Date(now.getTime() + 60 * 60_000).toISOString(),
        revokedAt: null,
        lastUsedAt: now.toISOString(),
      },
      {
        id: 2,
        community: 8,
        user: 12,
        tokenHash: hashOpaqueToken(otherToken),
        scopes: [
          'syncshow:songs:read',
          'syncshow:song-public-links:read',
          'syncshow:song-public-links:write',
        ],
        expiresAt: new Date(now.getTime() + 60 * 60_000).toISOString(),
        revokedAt: null,
        lastUsedAt: now.toISOString(),
      },
    ] as AnyRecord[],
    songs: [
      {
        id: 1,
        community: 7,
        syncId: 'exact-song',
        syncVersion: 7,
        syncDocuments: structuredClone(exactDocuments),
        title: 'Exact Original',
        copyright: 'Public copyright notice.',
        rightsNotes:
          'Private source: /Users/operator/permission.eml\r\nManager email: internal@example.test',
      },
      {
        id: 2,
        community: 8,
        syncId: 'exact-song',
        syncVersion: 3,
        syncDocuments: structuredClone(exactDocuments),
        title: 'Other Community Song',
      },
    ] as AnyRecord[],
    links: [] as AnyRecord[],
    nextLinkId: 1,
    nextTransactionId: 1,
    commits: 0,
    rollbacks: 0,
    anonymousSql: '',
  }
  const sessions: Record<string, {
    db: {
      execute: (
        query: unknown,
      ) => Promise<{ rows: AnyRecord[] } | AnyRecord[]>
    }
  }> = {}

  function transactionResult(rows: AnyRecord[]) {
    return rawTransactionRows ? rows : { rows }
  }

  async function transactionQuery(query: unknown) {
    const { text, parameters } = queryParts(query as AnyRecord)
    if (text.includes('pg_advisory_xact_lock')) return transactionResult([])
    if (text.includes('FROM "syncshow_connections"')) {
      const [id, communityId, userId] = parameters.map(Number)
      const connection = state.connections.find(candidate =>
        candidate.id === id
        && candidate.community === communityId
        && candidate.user === userId
        && !candidate.revokedAt
        && Date.parse(candidate.expiresAt) > Date.now())
      return transactionResult(connection
        ? [{
            id: connection.id,
            communityId: connection.community,
            userId: connection.user,
            scopes: connection.scopes,
          }]
        : [])
    }
    if (text.includes('FROM "memberships"')) {
      const [communityId, userId] = parameters.map(Number)
      const membership = state.memberships.find(candidate =>
        candidate.community === communityId
        && candidate.user === userId
        && ['owner', 'admin', 'leader'].includes(candidate.role))
      return transactionResult(membership ? [{ id: membership.id }] : [])
    }
    if (text.includes('FROM "songs"')) {
      const communityId = Number(parameters[0])
      const syncId = String(parameters[1])
      return transactionResult(state.songs
        .filter(song =>
          song.community === communityId && song.syncId === syncId)
        .map(song => ({ id: song.id })))
    }
    if (
      text.includes('FROM "syncshow_song_public_links"')
      && text.includes('FOR UPDATE')
    ) {
      const id = Number(parameters[0])
      const communityId = Number(parameters[1])
      const linkId = String(parameters[2])
      return transactionResult(state.links
        .filter(link =>
          link.id === id
          && link.community === communityId
          && link.linkId === linkId)
        .map(link => ({ id: link.id })))
    }
    throw new Error(`unexpected transaction query: ${text}`)
  }

  function documents(collection: string) {
    if (collection === 'memberships') return state.memberships
    if (collection === 'syncshow-connections') return state.connections
    if (collection === 'songs') return state.songs
    if (collection === 'syncshow-song-public-links') return state.links
    return []
  }

  const payload = {
    secret: 'song-public-link-cursor-test-secret',
    config: { cors: '*' },
    logger: {
      error: () => undefined,
      warn: () => undefined,
    },
    db: {
      sessions,
      beginTransaction: async () => {
        const id = state.nextTransactionId
        state.nextTransactionId += 1
        sessions[String(id)] = {
          db: { execute: transactionQuery },
        }
        return id
      },
      commitTransaction: async () => {
        state.commits += 1
      },
      rollbackTransaction: async () => {
        state.rollbacks += 1
      },
      drizzle: {
        execute: async (query: unknown) => {
          const { text, parameters } = queryParts(query as AnyRecord)
          state.anonymousSql = text
          assert.match(text, /snapshot_source/)
          assert.doesNotMatch(
            text,
            /review_source|audit_source|label|idempotency/i,
          )
          const linkId = String(parameters[0])
          const requestedAt = Date.parse(String(parameters[1]))
          return {
            rows: state.links
              .filter(link =>
                link.linkId === linkId
                && !link.revokedAt
                && (!link.expiresAt
                  || Date.parse(link.expiresAt) > requestedAt))
              .map(link => ({
                songSyncId: link.songSyncId,
                songSyncVersion: link.songSyncVersion,
                familyRevision: link.familyRevision,
                snapshotChecksum: link.snapshotChecksum,
                snapshotSource: link.snapshotSource,
                expiresAt: link.expiresAt,
                revokedAt: link.revokedAt,
              })),
          }
        },
      },
    },
    find: async ({
      collection,
      where,
      limit = 10,
      sort,
    }: {
      collection: string
      where?: AnyRecord
      limit?: number
      sort?: string[]
    }) => {
      let found = documents(collection)
        .filter(document => matchesWhere(document, where))
      if (Array.isArray(sort)) {
        found = [...found].sort((left, right) => {
          for (const fieldWithDirection of sort) {
            const descending = fieldWithDirection.startsWith('-')
            const field = descending
              ? fieldWithDirection.slice(1)
              : fieldWithDirection
            if (left[field] === right[field]) continue
            const comparison = left[field] < right[field] ? -1 : 1
            return descending ? -comparison : comparison
          }
          return 0
        })
      }
      return { docs: found.slice(0, limit).map(document => structuredClone(document)) }
    },
    findByID: async ({
      collection,
      id,
    }: {
      collection: string
      id: number
    }) => {
      const found = documents(collection)
        .find(document => document.id === Number(id))
      if (!found) throw new Error(`missing ${collection} ${id}`)
      return structuredClone(found)
    },
    create: async ({
      collection,
      data,
    }: {
      collection: string
      data: AnyRecord
    }) => {
      assert.equal(collection, 'syncshow-song-public-links')
      const link = {
        id: state.nextLinkId,
        ...structuredClone(data),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      state.nextLinkId += 1
      state.links.push(link)
      return structuredClone(link)
    },
    update: async ({
      collection,
      id,
      data,
    }: {
      collection: string
      id: number
      data: AnyRecord
    }) => {
      const list = documents(collection)
      const index = list.findIndex(document => document.id === Number(id))
      if (index < 0) throw new Error(`missing ${collection} ${id}`)
      list[index] = {
        ...list[index],
        ...structuredClone(data),
        updatedAt: new Date().toISOString(),
      }
      return structuredClone(list[index])
    },
  }

  function request({
    accessToken = token,
    body,
    idempotencyKey,
    ifMatch,
    method = 'GET',
    path = '/api/community/syncshow/v1/song-public-links',
    routeParams,
  }: {
    accessToken?: string
    body?: AnyRecord
    idempotencyKey?: string
    ifMatch?: string
    method?: string
    path?: string
    routeParams?: AnyRecord
  }) {
    const headers = new Headers({
      Authorization: `SyncShow ${accessToken}`,
    })
    if (body) headers.set('Content-Type', 'application/json')
    if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey)
    if (ifMatch) headers.set('If-Match', ifMatch)
    return {
      headers,
      method,
      payload,
      routeParams,
      text: async () => JSON.stringify(body || {}),
      transactionID: undefined,
      url: `http://localhost${path}`,
    }
  }

  return { state, payload, request }
}

function endpoint(path: string, method: string) {
  const handler = songPublicLinkEndpoints.find(candidate =>
    candidate.path === path && candidate.method === method)?.handler
  assert.ok(handler, `missing ${method.toUpperCase()} ${path}`)
  return handler
}

const listLinks = endpoint(
  '/community/syncshow/v1/song-public-links',
  'get',
)
const createLink = endpoint(
  '/community/syncshow/v1/song-public-links',
  'post',
)
const revokeLink = endpoint(
  '/community/syncshow/v1/song-public-links/:linkId',
  'delete',
)

const startDeviceGrant = syncShowEndpoints.find(candidate =>
  candidate.path === '/community/syncshow/v1/auth/device/start'
  && candidate.method === 'post')?.handler
assert.ok(startDeviceGrant)

function publicReview() {
  return {
    scope: 'public-link',
    basis: 'direct-permission',
    evidence: 'Written permission covering anonymous web display.',
    validUntil: null,
    validThrough: null,
    reviewedAt: '2026-07-28T19:00:00.000Z',
    familyRevision,
  }
}

function createBody(label = 'Tuesday home group') {
  const review = publicReview()
  return {
    songSyncId: 'exact-song',
    familyRevision,
    review,
    reviewRevision: songPublicLinkReviewRevision(review),
    label,
    expiresAt: null,
  }
}

test('device grants require explicit dependent public-link scopes', async () => {
  const created: AnyRecord[] = []
  const payload = {
    config: { cors: '*' },
    logger: {
      error: () => undefined,
      warn: () => undefined,
    },
    find: async ({ collection }: { collection: string }) => ({
      docs: collection === 'communities' ? [{ id: 7 }] : [],
    }),
    create: async ({
      collection,
      data,
    }: {
      collection: string
      data: AnyRecord
    }) => {
      assert.equal(collection, 'syncshow-device-grants')
      created.push(structuredClone(data))
      return data
    },
  }
  let requestNumber = 0
  const request = (scopes: string[]) => {
    requestNumber += 1
    return {
      headers: new Headers({
        'cf-connecting-ip': `song-link-scope-${requestNumber}`,
        'content-type': 'application/json',
      }),
      payload,
      text: async () => JSON.stringify({
        email: 'manager@example.test',
        deviceName: 'Public-link scope test',
        scopes,
        codeChallengeMethod: 'S256',
        codeChallenge: 'c'.repeat(43),
      }),
      url: 'http://localhost/api/community/syncshow/v1/auth/device/start',
    }
  }

  for (const invalidScopes of [
    ['syncshow:song-public-links:read'],
    [
      'syncshow:songs:read',
      'syncshow:song-public-links:write',
    ],
  ]) {
    const response = await startDeviceGrant(request(invalidScopes) as never)
    assert.equal(response.status, 400)
    assert.equal((await response.json() as AnyRecord).code, 'INVALID_SCOPE')
  }

  const validScopes = [
    'syncshow:songs:read',
    'syncshow:song-public-links:read',
    'syncshow:song-public-links:write',
  ]
  const response = await startDeviceGrant(request(validScopes) as never)
  assert.equal(response.status, 200)
  assert.deepEqual(created[0].scopes, [...validScopes].sort())
})

test('create is CAS-bound and exactly idempotent while changed-body reuse conflicts', async () => {
  const harness = makeHarness()
  const first = await createLink(harness.request({
    body: createBody(),
    idempotencyKey: 'song-link-create-0001',
    ifMatch: '"song:exact-song:7"',
    method: 'POST',
  }) as never)
  assert.equal(first.status, 201)
  const firstBody = await first.json() as AnyRecord
  assert.deepEqual(Object.keys(firstBody), ['link'])
  assert.deepEqual(Object.keys(firstBody.link).sort(), [
    'createdAt',
    'expiresAt',
    'familyRevision',
    'label',
    'linkId',
    'linkVersion',
    'reviewRevision',
    'revokedAt',
    'schemaVersion',
    'songSyncId',
    'songSyncVersion',
  ])
  assert.match(firstBody.link.linkId, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(Buffer.from(firstBody.link.linkId, 'base64url').length, 32)
  assert.equal(harness.state.links.length, 1)

  const replay = await createLink(harness.request({
    body: createBody(),
    idempotencyKey: 'song-link-create-0001',
    ifMatch: '"song:exact-song:7"',
    method: 'POST',
  }) as never)
  assert.equal(replay.status, 200)
  assert.equal((await replay.json() as AnyRecord).link.linkId, firstBody.link.linkId)
  assert.equal(harness.state.links.length, 1)

  const changedCasReplay = await createLink(harness.request({
    body: createBody(),
    idempotencyKey: 'song-link-create-0001',
    ifMatch: '"song:exact-song:6"',
    method: 'POST',
  }) as never)
  assert.equal(changedCasReplay.status, 409)
  assert.equal(
    (await changedCasReplay.json() as AnyRecord).code,
    'IDEMPOTENCY_CONFLICT',
  )

  const changed = await createLink(harness.request({
    body: createBody('Changed operation'),
    idempotencyKey: 'song-link-create-0001',
    ifMatch: '"song:exact-song:7"',
    method: 'POST',
  }) as never)
  assert.equal(changed.status, 409)
  assert.equal((await changed.json() as AnyRecord).code, 'IDEMPOTENCY_CONFLICT')

  const stale = await createLink(harness.request({
    body: createBody('Stale request'),
    idempotencyKey: 'song-link-create-0002',
    ifMatch: '"song:exact-song:6"',
    method: 'POST',
  }) as never)
  assert.equal(stale.status, 412)
  assert.equal((await stale.json() as AnyRecord).code, 'VERSION_CONFLICT')
  assert.equal(harness.state.links.length, 1)
})

test('exact create replay survives link and review expiry', async () => {
  const harness = makeHarness()
  const finiteReview = {
    ...publicReview(),
    validUntil: '2026-07-28',
    validThrough: '2026-07-28T20:00:00.000Z',
    reviewedAt: '2026-07-28T18:00:00.000Z',
  }
  const request = normalizeSongPublicLinkCreateRequest({
    ...createBody('Expiring retry'),
    review: finiteReview,
    reviewRevision: songPublicLinkReviewRevision(finiteReview),
    expiresAt: '2026-07-28T19:30:00.000Z',
  }, {
    enforceCurrentTime: false,
  })
  const authority = await authorizeSongPublicLinks(
    harness.request({}) as never,
    'write',
  )
  const first = await createSongPublicLink(
    harness.request({}) as never,
    authority,
    request,
    7,
    'song-link-expiring-retry',
    { now: new Date('2026-07-28T19:00:00.000Z') },
  )
  assert.equal(first.created, true)

  const replay = await createSongPublicLink(
    harness.request({}) as never,
    authority,
    request,
    7,
    'song-link-expiring-retry',
    { now: new Date('2026-07-28T20:30:00.000Z') },
  )
  assert.equal(replay.created, false)
  assert.equal(replay.link.linkId, first.link.linkId)

  await assert.rejects(
    createSongPublicLink(
      harness.request({}) as never,
      authority,
      request,
      7,
      'song-link-expired-new-key',
      { now: new Date('2026-07-28T20:30:00.000Z') },
    ),
    (error: AnyRecord) => error.code === 'REVIEW_EXPIRED',
  )
})

test('transactions accept the raw row-array shape returned by Payload Drizzle', async () => {
  const harness = makeHarness({ rawTransactionRows: true })
  const created = await createLink(harness.request({
    body: createBody('Raw row-array result'),
    idempotencyKey: 'song-link-raw-rows-001',
    ifMatch: '"song:exact-song:7"',
    method: 'POST',
  }) as never)
  assert.equal(created.status, 201)
  const link = (await created.json() as AnyRecord).link

  const revoked = await revokeLink(harness.request({
    idempotencyKey: 'song-link-raw-rows-002',
    ifMatch: `"song-public-link:${link.linkId}:1"`,
    method: 'DELETE',
    path: `/api/community/syncshow/v1/song-public-links/${link.linkId}`,
    routeParams: { linkId: link.linkId },
  }) as never)
  assert.equal(revoked.status, 200)
  assert.equal((await revoked.json() as AnyRecord).link.linkVersion, 2)
})

test('idempotency keys are scoped by connection and operation', async () => {
  const harness = makeHarness()
  const sharedKey = 'same-raw-operation-key'
  const first = await createLink(harness.request({
    body: createBody('Community seven'),
    idempotencyKey: sharedKey,
    ifMatch: '"song:exact-song:7"',
    method: 'POST',
  }) as never)
  assert.equal(first.status, 201)
  const second = await createLink(harness.request({
    accessToken: otherToken,
    body: createBody('Community eight'),
    idempotencyKey: sharedKey,
    ifMatch: '"song:exact-song:3"',
    method: 'POST',
  }) as never)
  assert.equal(second.status, 201)
  const firstLink = (await first.json() as AnyRecord).link
  const secondLink = (await second.json() as AnyRecord).link
  assert.notEqual(firstLink.linkId, secondLink.linkId)
  assert.notEqual(
    harness.state.links[0].createIdempotencyKeyHash,
    harness.state.links[1].createIdempotencyKeyHash,
  )

  const revoked = await revokeLink(harness.request({
    idempotencyKey: sharedKey,
    ifMatch: `"song-public-link:${firstLink.linkId}:1"`,
    method: 'DELETE',
    path: `/api/community/syncshow/v1/song-public-links/${firstLink.linkId}`,
    routeParams: { linkId: firstLink.linkId },
  }) as never)
  assert.equal(revoked.status, 200)
  assert.notEqual(
    harness.state.links[0].createIdempotencyKeyHash,
    harness.state.links[0].revokeIdempotencyKeyHash,
  )
})

test('bounded list remains scoped by community and advances an opaque cursor', async () => {
  const harness = makeHarness()
  for (const [index, label] of ['First', 'Second'].entries()) {
    const response = await createLink(harness.request({
      body: createBody(label),
      idempotencyKey: `song-link-list-000${index + 1}`,
      ifMatch: '"song:exact-song:7"',
      method: 'POST',
    }) as never)
    assert.equal(response.status, 201)
    // Guarantee a deterministic descending tie-break through the numeric id.
    const latest = harness.state.links.at(-1)
    assert.ok(latest)
    latest.issuedAt = '2026-07-28T20:00:00.000Z'
  }
  const foreignSnapshot = buildSongPublicLinkSnapshot({
    songSyncId: 'exact-song',
    songSyncVersion: 3,
    documents: exactDocuments,
  })
  harness.state.links.push({
    ...structuredClone(harness.state.links[0]),
    id: 99,
    community: 8,
    song: 2,
    linkId: Buffer.alloc(32, 9).toString('base64url'),
    label: 'Other church private label',
    songSyncVersion: 3,
    snapshotChecksum: foreignSnapshot.checksum,
    snapshotSource: foreignSnapshot.source,
  })

  const first = await listLinks(harness.request({
    path: '/api/community/syncshow/v1/song-public-links?songSyncId=exact-song&limit=1',
  }) as never)
  assert.equal(first.status, 200)
  const firstPage = await first.json() as AnyRecord
  assert.equal(firstPage.items.length, 1)
  assert.equal(firstPage.items[0].label, 'Second')
  assert.equal(firstPage.hasMore, true)
  assert.equal(typeof firstPage.nextCursor, 'string')
  assert.doesNotMatch(firstPage.nextCursor, /Second|exact-song/)

  const second = await listLinks(harness.request({
    path:
      `/api/community/syncshow/v1/song-public-links?songSyncId=exact-song&limit=1&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
  }) as never)
  assert.equal(second.status, 200)
  const secondPage = await second.json() as AnyRecord
  assert.deepEqual(secondPage.items.map((item: AnyRecord) => item.label), ['First'])
  assert.equal(secondPage.hasMore, false)
  assert.equal(secondPage.nextCursor, null)
})

test('revocation uses link CAS and one operation key without deleting history', async () => {
  const harness = makeHarness()
  const created = await createLink(harness.request({
    body: createBody(),
    idempotencyKey: 'song-link-revoke-create',
    ifMatch: '"song:exact-song:7"',
    method: 'POST',
  }) as never)
  const link = (await created.json() as AnyRecord).link

  const stale = await revokeLink(harness.request({
    idempotencyKey: 'song-link-revoke-0001',
    ifMatch: `"song-public-link:${link.linkId}:9"`,
    method: 'DELETE',
    path: `/api/community/syncshow/v1/song-public-links/${link.linkId}`,
    routeParams: { linkId: link.linkId },
  }) as never)
  assert.equal(stale.status, 412)
  assert.equal(harness.state.links[0].revokedAt, null)

  const revoked = await revokeLink(harness.request({
    idempotencyKey: 'song-link-revoke-0001',
    ifMatch: `"song-public-link:${link.linkId}:1"`,
    method: 'DELETE',
    path: `/api/community/syncshow/v1/song-public-links/${link.linkId}`,
    routeParams: { linkId: link.linkId },
  }) as never)
  assert.equal(revoked.status, 200)
  const tombstone = (await revoked.json() as AnyRecord).link
  assert.equal(tombstone.linkVersion, 2)
  assert.equal(typeof tombstone.revokedAt, 'string')
  assert.equal(harness.state.links.length, 1)

  const replay = await revokeLink(harness.request({
    idempotencyKey: 'song-link-revoke-0001',
    ifMatch: `"song-public-link:${link.linkId}:1"`,
    method: 'DELETE',
    path: `/api/community/syncshow/v1/song-public-links/${link.linkId}`,
    routeParams: { linkId: link.linkId },
  }) as never)
  assert.equal(replay.status, 200)
  assert.equal((await replay.json() as AnyRecord).link.linkVersion, 2)
})

test('later song edits never retarget anonymous snapshot bytes', async () => {
  const harness = makeHarness()
  const created = await createLink(harness.request({
    body: createBody(),
    idempotencyKey: 'song-link-snapshot-0001',
    ifMatch: '"song:exact-song:7"',
    method: 'POST',
  }) as never)
  const link = (await created.json() as AnyRecord).link
  const storedSource = harness.state.links[0].snapshotSource

  const changedSource = originalSource.replace(
    'Pinned original line',
    'Later mutable edit',
  )
  harness.state.songs[0].syncDocuments = [{
    id: 'exact-original',
    source: changedSource,
    revision: revision(changedSource),
  }]
  harness.state.songs[0].syncVersion = 8

  const snapshot = await loadActiveSongPublicLinkSnapshot(
    harness.payload as never,
    link.linkId,
  )
  assert.ok(snapshot)
  const html = renderSongPublicLinkHtml(snapshot)
  assert.match(html, /Pinned original line/)
  assert.doesNotMatch(html, /Later mutable edit/)
  assert.equal(harness.state.links[0].snapshotSource, storedSource)
  assert.doesNotMatch(
    html,
    /Written permission|private-rights|review-deck|permission\.eml|internal@example\.test|Tuesday home group/,
  )
  assert.match(html, /Public translation credit/)
})

test('unknown, expired, and revoked capabilities are equally unavailable', async () => {
  const harness = makeHarness()
  const created = await createLink(harness.request({
    body: createBody(),
    idempotencyKey: 'song-link-anonymous-001',
    ifMatch: '"song:exact-song:7"',
    method: 'POST',
  }) as never)
  const link = (await created.json() as AnyRecord).link
  harness.state.links[0].expiresAt =
    new Date(Date.now() - 60_000).toISOString()

  assert.equal(
    await loadActiveSongPublicLinkSnapshot(
      harness.payload as never,
      link.linkId,
    ),
    null,
  )
  assert.equal(
    await loadActiveSongPublicLinkSnapshot(
      harness.payload as never,
      Buffer.alloc(32, 12).toString('base64url'),
    ),
    null,
  )
  harness.state.links[0].expiresAt = null
  harness.state.links[0].revokedAt = new Date().toISOString()
  assert.equal(
    await loadActiveSongPublicLinkSnapshot(
      harness.payload as never,
      link.linkId,
    ),
    null,
  )

  const unavailable = unavailableSongPublicLinkResponse()
  const secondUnavailable = unavailableSongPublicLinkResponse()
  assert.equal(unavailable.status, 404)
  assert.equal(await unavailable.text(), await secondUnavailable.text())
  assert.equal(unavailable.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(
    unavailable.headers.get('X-Robots-Tag'),
    'noindex, nofollow, noarchive',
  )
})

test('cross-community tokens and lost manager or scope authority fail closed', async () => {
  const harness = makeHarness()
  const created = await createLink(harness.request({
    body: createBody('Known foreign link'),
    idempotencyKey: 'song-link-cross-community-create',
    ifMatch: '"song:exact-song:7"',
    method: 'POST',
  }) as never)
  assert.equal(created.status, 201)
  const foreignLink = (await created.json() as AnyRecord).link
  const crossCommunityRevoke = await revokeLink(harness.request({
    accessToken: otherToken,
    idempotencyKey: 'song-link-cross-community-revoke',
    ifMatch: `"song-public-link:${foreignLink.linkId}:1"`,
    method: 'DELETE',
    path:
      `/api/community/syncshow/v1/song-public-links/${foreignLink.linkId}`,
    routeParams: { linkId: foreignLink.linkId },
  }) as never)
  assert.equal(crossCommunityRevoke.status, 404)
  assert.deepEqual(await crossCommunityRevoke.json(), {
    code: 'LINK_NOT_FOUND',
    error: 'Song public link not found.',
  })
  assert.equal(harness.state.links[0].revokedAt, null)

  const authority = await authorizeSongPublicLinks(
    harness.request({}) as never,
    'write',
  )
  harness.state.memberships[0].role = 'member'
  await assert.rejects(
    createSongPublicLink(
      harness.request({}) as never,
      authority,
      createBody() as never,
      7,
      'song-link-auth-loss-01',
    ),
    (error: AnyRecord) => error.code === 'MANAGER_REQUIRED',
  )
  harness.state.memberships[0].role = 'leader'
  harness.state.connections[0].scopes = [
    'syncshow:songs:read',
    'syncshow:song-public-links:read',
  ]
  await assert.rejects(
    createSongPublicLink(
      harness.request({}) as never,
      authority,
      createBody() as never,
      7,
      'song-link-scope-loss-1',
    ),
    (error: AnyRecord) => error.code === 'UNAUTHORIZED',
  )

  const readOnlyWrite = await createLink(harness.request({
    body: createBody(),
    idempotencyKey: 'song-link-read-only-01',
    ifMatch: '"song:exact-song:7"',
    method: 'POST',
  }) as never)
  assert.equal(readOnlyWrite.status, 401)

  const otherCommunityList = await listLinks(harness.request({
    accessToken: otherToken,
    path: '/api/community/syncshow/v1/song-public-links?songSyncId=exact-song',
  }) as never)
  assert.equal(otherCommunityList.status, 200)
  assert.deepEqual((await otherCommunityList.json() as AnyRecord).items, [])
})

test('Community admin revocation is one-way and advances the same link version', () => {
  const createdAt = '2026-07-28T19:00:00.000Z'
  const original = {
    linkVersion: 1,
    revokedAt: null,
    auditSource: JSON.stringify({
      schemaVersion: 1,
      events: [{ type: 'created', at: createdAt }],
    }),
  }
  const transitioned = applyManagerSongPublicLinkRevocation({
    data: { revokedAt: '2099-01-01T00:00:00.000Z' },
    originalDoc: original,
    userId: 11,
    now: new Date('2026-07-28T20:00:00.000Z'),
  })
  assert.equal(transitioned.linkVersion, 2)
  assert.equal(transitioned.revokedAt, '2026-07-28T20:00:00.000Z')
  assert.match(String(transitioned.auditSource), /community-admin/)
  assert.deepEqual(
    applyManagerSongPublicLinkRevocation({
      data: { revokedAt: null },
      originalDoc: {
        ...original,
        revokedAt: transitioned.revokedAt,
        linkVersion: transitioned.linkVersion,
        auditSource: transitioned.auditSource,
      },
      userId: 11,
    }),
    { revokedAt: transitioned.revokedAt },
  )
  assert.throws(
    () => applyManagerSongPublicLinkRevocation({
      data: { label: 'Retargeted' },
      originalDoc: original,
      userId: 11,
    }),
    /immutable/i,
  )
})
