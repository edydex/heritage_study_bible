import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { hashOpaqueToken } from '../src/lib/tokens.ts'
import {
  normalizeSongMemberSharingRequest,
  songMemberSharingReviewRevision,
} from '../src/lib/syncshow/SongMemberSharing.ts'
import {
  authorizeSongMemberSharing,
  shareSongWithMembers,
} from '../src/lib/syncshow/SongMemberSharingStore.ts'
import { songPublicLinkFamilyRevision } from '../src/lib/syncshow/SongPublicLink.ts'

type AnyRecord = Record<string, any>

const token = 'member-sharing-token-000001'
const source = `---
id: exact-song
title: Exact Song
language: en
authors: ["Reviewed Author"]
---

^1
Exact reviewed lyrics
`
const documents = [{
  id: 'exact-song',
  source,
  revision: createHash('sha256').update(source).digest('hex'),
}]
const familyRevision = songPublicLinkFamilyRevision(documents)

function review(overrides: AnyRecord = {}) {
  return {
    scope: 'community-members',
    basis: 'church-license',
    evidence: 'Verified member display under church license.',
    validUntil: '2026-08-31',
    reviewedAt: '2026-07-30T18:00:00.000Z',
    familyRevision,
    ...overrides,
  }
}

function sharingRequest(overrides: AnyRecord = {}) {
  const exactReview = review()
  return normalizeSongMemberSharingRequest({
    schemaVersion: 1,
    familyRevision,
    review: exactReview,
    reviewRevision: songMemberSharingReviewRevision(exactReview),
    visibility: 'public',
    publishAt: null,
    ...overrides,
  })
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

function makeHarness() {
  const state = {
    memberships: [{ id: 1, community: 7, user: 11, role: 'leader' }],
    connections: [{
      id: 3,
      community: 7,
      user: 11,
      tokenHash: hashOpaqueToken(token),
      scopes: ['syncshow:songs:read', 'syncshow:songs:write'],
      expiresAt: '2026-08-30T00:00:00.000Z',
      revokedAt: null,
    }],
    songs: [{
      id: 5,
      community: 7,
      syncId: 'exact-song',
      syncVersion: 7,
      status: 'draft',
      visibility: 'private',
      publishAt: null,
      syncDocuments: structuredClone(documents),
    }] as AnyRecord[],
    receipts: [] as AnyRecord[],
    sql: [] as string[],
    commits: 0,
    rollbacks: 0,
  }
  const sessions: AnyRecord = {}

  async function execute(query: unknown) {
    const { text, parameters } = queryParts(query as AnyRecord)
    state.sql.push(text)
    if (text.includes('pg_advisory_xact_lock')) return { rows: [] }
    if (text.includes('FROM "syncshow_connections"')) {
      const [id, community, user] = parameters.map(Number)
      return {
        rows: state.connections
          .filter(item => (
            item.id === id
            && item.community === community
            && item.user === user
          ))
          .map(item => ({ id: item.id, scopes: item.scopes })),
      }
    }
    if (text.includes('FROM "memberships"')) {
      const [community, user] = parameters.map(Number)
      return {
        rows: state.memberships.filter(item => (
          item.community === community && item.user === user
        )).map(item => ({ id: item.id })),
      }
    }
    if (text.includes('FROM "songs"')) {
      const [community, syncId] = parameters
      return {
        rows: state.songs.filter(item => (
          item.community === Number(community)
          && item.syncId === String(syncId)
        )).map(item => ({
          id: item.id,
          syncVersion: item.syncVersion,
        })),
      }
    }
    if (text.includes('FROM "communities"')) {
      return { rows: [{ timeZone: 'America/Los_Angeles' }] }
    }
    if (text.includes('FROM "syncshow_song_member_shares"')) {
      const [community, songId] = parameters.map(Number)
      return {
        rows: state.receipts
          .filter(item => (
            item.community === community && item.song === songId
          ))
          .sort((left, right) => right.receiptVersion - left.receiptVersion)
          .slice(0, 1)
          .map(item => ({ receiptVersion: item.receiptVersion })),
      }
    }
    throw new Error(`Unexpected SQL: ${text}`)
  }

  const payload = {
    db: {
      beginTransaction: async () => {
        const id = String(Object.keys(sessions).length + 1)
        sessions[id] = { db: { execute } }
        return id
      },
      commitTransaction: async () => {
        state.commits += 1
      },
      rollbackTransaction: async () => {
        state.rollbacks += 1
      },
      sessions,
    },
    find: async (args: AnyRecord) => {
      if (args.collection === 'syncshow-connections') {
        const hash = args.where.and[0].tokenHash.equals
        return {
          docs: state.connections.filter(item => item.tokenHash === hash),
        }
      }
      if (args.collection === 'memberships') {
        return { docs: state.memberships }
      }
      if (args.collection === 'syncshow-song-member-shares') {
        const hash = args.where.idempotencyKeyHash.equals
        return {
          docs: state.receipts.filter(
            item => item.idempotencyKeyHash === hash,
          ),
        }
      }
      throw new Error(`Unexpected find collection: ${args.collection}`)
    },
    findByID: async (args: AnyRecord) => {
      assert.equal(args.collection, 'songs')
      const song = state.songs.find(item => item.id === Number(args.id))
      if (!song) throw new Error('missing song')
      return structuredClone(song)
    },
    create: async (args: AnyRecord) => {
      assert.equal(args.collection, 'syncshow-song-member-shares')
      assert.equal(args.context.songMemberSharingInternalMutation, true)
      const receipt = {
        id: state.receipts.length + 1,
        ...structuredClone(args.data),
      }
      state.receipts.push(receipt)
      return structuredClone(receipt)
    },
    update: async (args: AnyRecord) => {
      assert.equal(args.collection, 'songs')
      assert.equal(args.context.songMemberSharingInternalMutation, true)
      const song = state.songs.find(item => item.id === Number(args.id))
      if (!song) throw new Error('missing song')
      Object.assign(song, structuredClone(args.data))
      return structuredClone(song)
    },
    logger: { error: () => undefined },
  }
  const req = {
    headers: new Headers({ authorization: `SyncShow ${token}` }),
    payload,
    transactionID: undefined,
  } as never
  return { req, state }
}

test('locked transaction writes immutable receipt and exact song pointer atomically', async () => {
  const { req, state } = makeHarness()
  const authority = await authorizeSongMemberSharing(req)
  const result = await shareSongWithMembers(
    req,
    authority,
    'exact-song',
    7,
    sharingRequest(),
    'member-share-operation-0001',
    { now: new Date('2026-07-30T19:00:00.000Z') },
  )
  assert.equal(result.created, true)
  assert.equal(result.receipt.previousSongSyncVersion, 7)
  assert.equal(result.receipt.songSyncVersion, 8)
  assert.equal(result.receipt.visibility, 'public')
  assert.equal(result.receipt.timeZone, 'America/Los_Angeles')
  assert.equal(result.receipt.validThrough, '2026-09-01T06:59:59.999Z')
  assert.equal(state.songs[0].syncVersion, 8)
  assert.equal(
    state.songs[0].memberShareReceiptRevision,
    result.receipt.receiptRevision,
  )
  assert.equal(state.receipts.length, 1)
  assert.match(state.receipts[0].reviewSource, /church-license/)
  assert.match(state.receipts[0].auditSource, /connectionId/)
  assert.ok(!('reviewSource' in result.receipt))
  assert.ok(!('auditSource' in result.receipt))
  assert.equal(state.commits, 1)
  assert.equal(state.rollbacks, 0)
  assert.ok(
    state.sql.findIndex(value => value.includes('FROM "songs"'))
      > state.sql.findIndex(value => value.includes('pg_advisory_xact_lock')),
  )
})

test('lost-response replay is stable and same key with changed semantics conflicts', async () => {
  const { req, state } = makeHarness()
  const authority = await authorizeSongMemberSharing(req)
  const exactRequest = sharingRequest()
  const first = await shareSongWithMembers(
    req,
    authority,
    'exact-song',
    7,
    exactRequest,
    'member-share-operation-0002',
    { now: new Date('2026-07-30T19:00:00.000Z') },
  )
  const replay = await shareSongWithMembers(
    req,
    authority,
    'exact-song',
    7,
    exactRequest,
    'member-share-operation-0002',
    { now: new Date('2026-07-30T19:05:00.000Z') },
  )
  assert.equal(replay.created, false)
  assert.deepEqual(replay.receipt, first.receipt)
  assert.equal(state.receipts.length, 1)
  await assert.rejects(
    () => shareSongWithMembers(
      req,
      authority,
      'exact-song',
      7,
      sharingRequest({
        visibility: 'scheduled-public',
        publishAt: '2026-08-01T19:00:00.000Z',
      }),
      'member-share-operation-0002',
      { now: new Date('2026-07-30T19:05:00.000Z') },
    ),
    (error: unknown) => (
      error instanceof Error
      && 'code' in error
      && error.code === 'IDEMPOTENCY_CONFLICT'
    ),
  )
})

test('family drift and schedules beyond derived review expiry roll back', async () => {
  {
    const { req, state } = makeHarness()
    const authority = await authorizeSongMemberSharing(req)
    await assert.rejects(
      () => shareSongWithMembers(
        req,
        authority,
        'exact-song',
        7,
        sharingRequest({
          familyRevision: 'f'.repeat(64),
          review: review({ familyRevision: 'f'.repeat(64) }),
          reviewRevision: songMemberSharingReviewRevision(
            review({ familyRevision: 'f'.repeat(64) }),
          ),
        }),
        'member-share-operation-0003',
        { now: new Date('2026-07-30T19:00:00.000Z') },
      ),
      (error: unknown) => (
        error instanceof Error
        && 'code' in error
        && error.code === 'FAMILY_CONFLICT'
      ),
    )
    assert.equal(state.rollbacks, 1)
    assert.equal(state.receipts.length, 0)
  }
  {
    const { req, state } = makeHarness()
    const authority = await authorizeSongMemberSharing(req)
    await assert.rejects(
      () => shareSongWithMembers(
        req,
        authority,
        'exact-song',
        7,
        sharingRequest({
          visibility: 'scheduled-public',
          publishAt: '2026-09-02T00:00:00.000Z',
        }),
        'member-share-operation-0004',
        { now: new Date('2026-07-30T19:00:00.000Z') },
      ),
      (error: unknown) => (
        error instanceof Error
        && 'code' in error
        && error.code === 'INVALID_SCHEDULE'
      ),
    )
    assert.equal(state.rollbacks, 1)
    assert.equal(state.receipts.length, 0)
  }
})

test('invalid stored legacy sections fail as a bounded private-family conflict', async () => {
  const { req, state } = makeHarness()
  const duplicateSource = `---
id: exact-song
title: Exact Song
language: en
---

^1
First text

^1
Duplicate marker
`
  state.songs[0].syncDocuments = [{
    id: 'exact-song',
    source: duplicateSource,
    revision: createHash('sha256').update(duplicateSource).digest('hex'),
  }]
  const authority = await authorizeSongMemberSharing(req)
  await assert.rejects(
    () => shareSongWithMembers(
      req,
      authority,
      'exact-song',
      7,
      sharingRequest(),
      'member-share-operation-0005',
      { now: new Date('2026-07-30T19:00:00.000Z') },
    ),
    (error: unknown) => (
      error instanceof Error
      && 'code' in error
      && error.code === 'INVALID_SONG_FAMILY'
      && 'status' in error
      && error.status === 409
    ),
  )
  assert.equal(state.rollbacks, 1)
  assert.equal(state.receipts.length, 0)
  assert.equal(state.songs[0].visibility, 'private')
})
