import { sql } from '@payloadcms/db-postgres'
import { createHash, randomBytes } from 'node:crypto'
import type { PayloadRequest } from 'payload'
import { hashOpaqueToken } from '@/lib/tokens'
import { effectiveSyncDocuments } from '@/lib/syncShowProtocol'
import {
  SongPublicLinkError,
  songPublicLinkFamilyRevision,
} from './SongPublicLink.ts'
import {
  SONG_MEMBER_SHARING_SCHEMA_VERSION,
  SongMemberSharingError,
  memberSharingValidThrough,
  normalizeSongMemberSharingRequest,
  serializeSongMemberSharingReceipt,
  songMemberSharingReceiptRevision,
  songMemberSharingRequestRevision,
  type SongMemberSharingReceipt,
  type SongMemberSharingRequest,
} from './SongMemberSharing.ts'
import { lockedCommunityTimeZone } from './SermonDateProjection.ts'

type UnknownRecord = Record<string, unknown>
type DatabaseResult = { rows?: UnknownRecord[] } | UnknownRecord[]
type TransactionDatabase = {
  execute: (query: unknown) => Promise<DatabaseResult>
}
type TransactionAdapter = {
  beginTransaction: () => Promise<null | number | string>
  commitTransaction: (id: number | string) => Promise<void>
  rollbackTransaction: (id: number | string) => Promise<void>
  sessions?: Record<string, { db: TransactionDatabase }>
}

export type SongMemberSharingAuthority = Readonly<{
  connectionId: number
  communityId: number
  userId: number
}>

const IDEMPOTENCY_KEY_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/
const IDEMPOTENCY_LOCK_DOMAIN =
  'heritage-song-member-sharing-idempotency-v1'
const REQUIRED_SCOPES = [
  'syncshow:songs:read',
  'syncshow:songs:write',
] as const

function row(value: unknown): UnknownRecord {
  return value as UnknownRecord
}

function relationId(value: unknown) {
  const raw = value && typeof value === 'object' && 'id' in value
    ? (value as { id: unknown }).id
    : value
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : 0
}

function databaseRows(result: DatabaseResult) {
  return Array.isArray(result)
    ? result
    : Array.isArray(result.rows) ? result.rows : []
}

function scopes(value: unknown) {
  let candidate = value
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate)
    } catch {
      return []
    }
  }
  return Array.isArray(candidate) ? candidate.map(String) : []
}

function requireScopes(value: unknown) {
  const granted = scopes(value)
  if (REQUIRED_SCOPES.some(scope => !granted.includes(scope))) {
    throw new SongMemberSharingError(
      'UNAUTHORIZED',
      'This SyncShow connection lacks song read/write permission.',
      401,
    )
  }
}

async function managerMembership(
  req: PayloadRequest,
  userId: number,
  communityId: number,
) {
  return (await req.payload.find({
    collection: 'memberships',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: {
      and: [
        { user: { equals: userId } },
        { community: { equals: communityId } },
        { role: { in: ['owner', 'admin', 'leader'] } },
      ],
    },
  })).docs[0]
}

export async function authorizeSongMemberSharing(
  req: PayloadRequest,
): Promise<SongMemberSharingAuthority> {
  const authorization = req.headers.get('authorization') || ''
  const token = authorization.startsWith('SyncShow ')
    ? authorization.slice('SyncShow '.length).trim()
    : ''
  if (!token) {
    throw new SongMemberSharingError(
      'UNAUTHORIZED',
      'A SyncShow connection token is required.',
      401,
    )
  }
  const found = (await req.payload.find({
    collection: 'syncshow-connections',
    depth: 0,
    limit: 2,
    overrideAccess: true,
    showHiddenFields: true,
    req,
    where: {
      and: [
        { tokenHash: { equals: hashOpaqueToken(token) } },
        { expiresAt: { greater_than: new Date().toISOString() } },
        { revokedAt: { exists: false } },
      ],
    },
  })).docs.map(row)
  if (found.length !== 1) {
    throw new SongMemberSharingError(
      'UNAUTHORIZED',
      'This SyncShow connection is invalid or expired.',
      401,
    )
  }
  const connection = found[0]
  requireScopes(connection.scopes)
  const connectionId = relationId(connection.id)
  const communityId = relationId(connection.community)
  const userId = relationId(connection.user)
  if (
    !connectionId
    || !communityId
    || !userId
    || !await managerMembership(req, userId, communityId)
  ) {
    throw new SongMemberSharingError(
      'MANAGER_REQUIRED',
      'This connection no longer belongs to a church manager.',
      403,
    )
  }
  return Object.freeze({ connectionId, communityId, userId })
}

function transactionDatabase(
  req: PayloadRequest,
  transactionId: number | string,
) {
  const adapter = req.payload.db as unknown as TransactionAdapter
  const database = adapter.sessions?.[String(transactionId)]?.db
  if (!database) {
    throw new SongMemberSharingError(
      'TRANSACTION_UNAVAILABLE',
      'Atomic member-sharing updates are temporarily unavailable.',
      503,
    )
  }
  return database
}

async function inTransaction<T>(
  req: PayloadRequest,
  operation: (database: TransactionDatabase) => Promise<T>,
) {
  const adapter = req.payload.db as unknown as TransactionAdapter
  const transactionId = await adapter.beginTransaction()
  if (transactionId === null || transactionId === undefined) {
    throw new SongMemberSharingError(
      'TRANSACTION_UNAVAILABLE',
      'Atomic member-sharing updates are temporarily unavailable.',
      503,
    )
  }
  const database = transactionDatabase(req, transactionId)
  const previousTransactionId = req.transactionID
  req.transactionID = transactionId
  try {
    const result = await operation(database)
    await adapter.commitTransaction(transactionId)
    return result
  } catch (error) {
    await adapter.rollbackTransaction(transactionId)
    throw error
  } finally {
    req.transactionID = previousTransactionId
  }
}

async function recheckAuthority(
  database: TransactionDatabase,
  authority: SongMemberSharingAuthority,
) {
  const connections = databaseRows(await database.execute(sql`
    SELECT "id", "scopes"
    FROM "syncshow_connections"
    WHERE "id" = ${authority.connectionId}
      AND "community_id" = ${authority.communityId}
      AND "user_id" = ${authority.userId}
      AND "revoked_at" IS NULL
      AND "expires_at" > now()
    LIMIT 2
    FOR UPDATE;
  `))
  if (connections.length !== 1) {
    throw new SongMemberSharingError(
      'UNAUTHORIZED',
      'This SyncShow connection is invalid or expired.',
      401,
    )
  }
  requireScopes(connections[0].scopes)
  const memberships = databaseRows(await database.execute(sql`
    SELECT "id"
    FROM "memberships"
    WHERE "community_id" = ${authority.communityId}
      AND "user_id" = ${authority.userId}
      AND "role" IN ('owner', 'admin', 'leader')
    LIMIT 2
    FOR UPDATE;
  `))
  if (memberships.length !== 1) {
    throw new SongMemberSharingError(
      'MANAGER_REQUIRED',
      'This connection no longer belongs to a church manager.',
      403,
    )
  }
}

function normalizeIdempotencyKey(value: unknown) {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    throw new SongMemberSharingError(
      'INVALID_IDEMPOTENCY_KEY',
      'Idempotency-Key is invalid.',
    )
  }
  return value
}

function idempotencyHash(
  value: unknown,
  authority: SongMemberSharingAuthority,
) {
  return createHash('sha256')
    .update('heritage-song-member-sharing-operation-v1\0', 'utf8')
    .update(String(authority.connectionId), 'ascii')
    .update('\0share\0', 'utf8')
    .update(normalizeIdempotencyKey(value), 'utf8')
    .digest('hex')
}

async function lockIdempotencyKey(
  database: TransactionDatabase,
  keyHash: string,
) {
  await database.execute(sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`${IDEMPOTENCY_LOCK_DOMAIN}:${keyHash}`}, 0)
    );
  `)
}

async function receiptByIdempotencyKey(
  req: PayloadRequest,
  keyHash: string,
) {
  const found = (await req.payload.find({
    collection: 'syncshow-song-member-shares' as never,
    depth: 0,
    limit: 2,
    overrideAccess: true,
    showHiddenFields: true,
    req,
    where: {
      idempotencyKeyHash: { equals: keyHash },
    } as never,
  })).docs.map(row)
  if (found.length > 1) {
    throw new SongMemberSharingError(
      'INVALID_RECEIPT_STATE',
      'Member-sharing idempotency uniqueness was violated.',
      500,
    )
  }
  return found[0] || null
}

async function lockedSong(
  req: PayloadRequest,
  database: TransactionDatabase,
  communityId: number,
  syncId: string,
) {
  const locked = databaseRows(await database.execute(sql`
    SELECT "id", "sync_version" AS "syncVersion"
    FROM "songs"
    WHERE "community_id" = ${communityId}
      AND "sync_id" = ${syncId}
    LIMIT 2
    FOR UPDATE;
  `))
  if (locked.length !== 1) {
    throw new SongMemberSharingError(
      locked.length ? 'INVALID_SONG_STATE' : 'SONG_NOT_FOUND',
      locked.length
        ? 'Song synchronization identity is ambiguous.'
        : 'Song not found.',
      locked.length ? 500 : 404,
    )
  }
  const song = row(await req.payload.findByID({
    collection: 'songs',
    id: relationId(locked[0].id),
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
    req,
  }))
  if (
    relationId(song.community) !== communityId
    || song.syncId !== syncId
    || Number(song.syncVersion) !== Number(locked[0].syncVersion)
  ) {
    throw new SongMemberSharingError(
      'INVALID_SONG_STATE',
      'Stored song identity changed during member-sharing review.',
      500,
    )
  }
  return song
}

async function nextReceiptVersion(
  database: TransactionDatabase,
  communityId: number,
  songId: number,
) {
  const rows = databaseRows(await database.execute(sql`
    SELECT "receipt_version" AS "receiptVersion"
    FROM "syncshow_song_member_shares"
    WHERE "community_id" = ${communityId}
      AND "song_id" = ${songId}
    ORDER BY "receipt_version" DESC
    LIMIT 1;
  `))
  const previous = rows.length ? Number(rows[0].receiptVersion) : 0
  if (!Number.isSafeInteger(previous) || previous < 0) {
    throw new SongMemberSharingError(
      'INVALID_RECEIPT_STATE',
      'Stored member-sharing receipt version is invalid.',
      500,
    )
  }
  return previous + 1
}

function activeSongReceiptFields(
  receipt: SongMemberSharingReceipt,
) {
  return {
    memberShareReceiptId: receipt.receiptId,
    memberShareReceiptVersion: receipt.receiptVersion,
    memberSharePreviousSongSyncVersion: receipt.previousSongSyncVersion,
    memberShareSongSyncVersion: receipt.songSyncVersion,
    memberShareFamilyRevision: receipt.familyRevision,
    memberShareReviewRevision: receipt.reviewRevision,
    memberShareVisibility: receipt.visibility,
    memberSharePublishAt: receipt.publishAt,
    memberShareTimeZone: receipt.timeZone,
    memberShareValidThrough: receipt.validThrough,
    memberShareReviewedAt: receipt.reviewedAt,
    memberShareConfirmedAt: receipt.confirmedAt,
    memberShareRequestRevision: receipt.requestRevision,
    memberShareReceiptRevision: receipt.receiptRevision,
  }
}

export async function shareSongWithMembers(
  req: PayloadRequest,
  authority: SongMemberSharingAuthority,
  songSyncId: string,
  expectedSongSyncVersion: number,
  rawRequest: SongMemberSharingRequest,
  idempotencyKey: string,
  { now = new Date() }: { now?: Date } = {},
) {
  const request = normalizeSongMemberSharingRequest(rawRequest)
  if (
    !Number.isSafeInteger(expectedSongSyncVersion)
    || expectedSongSyncVersion < 1
  ) {
    throw new SongMemberSharingError(
      'VERSION_CONFLICT',
      'The song changed on the server. Refresh it before sharing.',
      412,
    )
  }
  if (!Number.isFinite(now.getTime())) {
    throw new TypeError('Song member-sharing clock is invalid')
  }
  const keyHash = idempotencyHash(idempotencyKey, authority)
  const requestRevision = songMemberSharingRequestRevision({
    songSyncId,
    expectedSongSyncVersion,
    request,
  })
  return inTransaction(req, async database => {
    await recheckAuthority(database, authority)
    await lockIdempotencyKey(database, keyHash)
    const replay = await receiptByIdempotencyKey(req, keyHash)
    if (replay) {
      if (
        relationId(replay.community) !== authority.communityId
        || replay.requestHash !== requestRevision
      ) {
        throw new SongMemberSharingError(
          'IDEMPOTENCY_CONFLICT',
          'This idempotency key was already used for another member-sharing operation.',
          409,
        )
      }
      return {
        created: false,
        receipt: serializeSongMemberSharingReceipt(replay),
      }
    }

    const song = await lockedSong(
      req,
      database,
      authority.communityId,
      songSyncId,
    )
    const currentVersion = Number(song.syncVersion)
    if (currentVersion !== expectedSongSyncVersion) {
      throw new SongMemberSharingError(
        'VERSION_CONFLICT',
        'The song changed on the server. Refresh it before sharing.',
        412,
      )
    }
    if (song.status === 'archived') {
      throw new SongMemberSharingError(
        'SONG_ARCHIVED',
        'Archived songs cannot be shared with members.',
        409,
      )
    }
    let familyRevision: string
    try {
      familyRevision = songPublicLinkFamilyRevision(
        effectiveSyncDocuments(song),
      )
    } catch (error) {
      if (error instanceof SongPublicLinkError) {
        throw new SongMemberSharingError(
          'INVALID_SONG_FAMILY',
          'This stored exact song family cannot be reviewed for member sharing. Save a corrected private family first.',
          409,
        )
      }
      throw error
    }
    if (familyRevision !== request.familyRevision) {
      throw new SongMemberSharingError(
        'FAMILY_CONFLICT',
        'The exact song family differs from the reviewed member-sharing request.',
        409,
      )
    }

    const timeZone = await lockedCommunityTimeZone(
      database,
      authority.communityId,
    )
    const validThrough = memberSharingValidThrough(
      request.review.validUntil,
      timeZone,
    )
    const nowTime = now.getTime()
    if (Date.parse(request.review.reviewedAt) > nowTime) {
      throw new SongMemberSharingError(
        'INVALID_REVIEW',
        'Member-sharing review time is too far in the future.',
      )
    }
    if (validThrough && nowTime > Date.parse(validThrough)) {
      throw new SongMemberSharingError(
        'REVIEW_EXPIRED',
        'Member-sharing rights review has expired.',
        409,
      )
    }
    if (request.publishAt) {
      const publishAt = Date.parse(request.publishAt)
      if (publishAt <= nowTime) {
        throw new SongMemberSharingError(
          'INVALID_SCHEDULE',
          'Scheduled member sharing must begin in the future.',
        )
      }
      if (validThrough && publishAt > Date.parse(validThrough)) {
        throw new SongMemberSharingError(
          'INVALID_SCHEDULE',
          'Scheduled member sharing cannot begin after its rights review expires.',
        )
      }
    }

    const songId = relationId(song.id)
    const receiptVersion = await nextReceiptVersion(
      database,
      authority.communityId,
      songId,
    )
    const confirmedAt = now.toISOString()
    const receiptWithoutRevision = Object.freeze({
      schemaVersion: SONG_MEMBER_SHARING_SCHEMA_VERSION as 1,
      receiptId: randomBytes(32).toString('base64url'),
      receiptVersion,
      songSyncId,
      previousSongSyncVersion: currentVersion,
      songSyncVersion: currentVersion + 1,
      familyRevision,
      reviewRevision: request.reviewRevision,
      visibility: request.visibility,
      publishAt: request.publishAt,
      timeZone,
      validThrough,
      reviewedAt: request.review.reviewedAt,
      confirmedAt,
      requestRevision,
    })
    const receipt = Object.freeze({
      ...receiptWithoutRevision,
      receiptRevision:
        songMemberSharingReceiptRevision(receiptWithoutRevision),
    })
    await req.payload.create({
      collection: 'syncshow-song-member-shares' as never,
      overrideAccess: true,
      showHiddenFields: true,
      req,
      context: { songMemberSharingInternalMutation: true },
      data: {
        community: authority.communityId,
        song: songId,
        ...receipt,
        reviewSource: JSON.stringify(request.review),
        auditSource: JSON.stringify({
          schemaVersion: 1,
          events: [{
            type: 'member-sharing-confirmed',
            at: confirmedAt,
            source: 'syncshow',
            userId: authority.userId,
            connectionId: authority.connectionId,
            previousSongSyncVersion: currentVersion,
            songSyncVersion: currentVersion + 1,
            familyRevision,
            reviewRevision: request.reviewRevision,
            visibility: request.visibility,
            publishAt: request.publishAt,
            timeZone,
            validThrough,
          }],
        }),
        idempotencyKeyHash: keyHash,
        requestHash: requestRevision,
      } as never,
    })
    const updated = row(await req.payload.update({
      collection: 'songs',
      id: songId,
      overrideAccess: true,
      showHiddenFields: true,
      req,
      context: {
        songMemberSharingInternalMutation: true,
        syncShowReservedVersion: currentVersion + 1,
      },
      data: {
        visibility: request.visibility,
        publishAt: request.publishAt,
        status: 'published',
        syncVersion: currentVersion + 1,
        ...activeSongReceiptFields(receipt),
      } as never,
    }))
    if (
      Number(updated.syncVersion) !== receipt.songSyncVersion
      || updated.memberShareReceiptRevision !== receipt.receiptRevision
    ) {
      throw new SongMemberSharingError(
        'INVALID_SONG_STATE',
        'Member-sharing receipt was not attached to the exact song revision.',
        500,
      )
    }
    return { created: true, receipt }
  })
}
