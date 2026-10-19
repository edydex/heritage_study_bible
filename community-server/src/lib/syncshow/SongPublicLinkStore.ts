import { sql } from '@payloadcms/db-postgres'
import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'
import { hashOpaqueToken } from '@/lib/tokens'
import { effectiveSyncDocuments } from '@/lib/syncShowProtocol'
import {
  MAX_SONG_PUBLIC_LINK_CURSOR_BYTES,
  MAX_SONG_PUBLIC_LINK_PAGE_ITEMS,
  SONG_PUBLIC_LINK_SCHEMA_VERSION,
  SYNCSHOW_SONG_PUBLIC_LINK_READ_SCOPE,
  SYNCSHOW_SONG_PUBLIC_LINK_WRITE_SCOPE,
  SongPublicLinkError,
  buildSongPublicLinkSnapshot,
  hashSongPublicLinkIdempotencyKey,
  normalizeSongPublicLinkCreateRequest,
  normalizeSongPublicLinkId,
  parseSongPublicLinkSnapshotSource,
  serializeSongPublicLinkRecord,
  songPublicLinkOperationHash,
  type SongPublicLinkCreateRequest,
  type SongPublicLinkRecord,
  type SongPublicLinkSnapshot,
} from './SongPublicLink.ts'

type UnknownRecord = Record<string, unknown>

export type SongPublicLinkAuthority = Readonly<{
  connectionId: number
  communityId: number
  userId: number
}>

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

type CursorPosition = {
  issuedAt: string
  id: number
}

const CURSOR_DOMAIN = 'heritage-song-public-link-cursor-v1'
const IDEMPOTENCY_LOCK_DOMAIN =
  'heritage-song-public-link-idempotency-v1'

function relationId(value: unknown) {
  const raw = value && typeof value === 'object' && 'id' in value
    ? (value as { id: unknown }).id
    : value
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : 0
}

function row(value: unknown): UnknownRecord {
  return value as UnknownRecord
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

function requiredScopes(mode: 'read' | 'write') {
  return mode === 'write'
    ? [
        'syncshow:songs:read',
        SYNCSHOW_SONG_PUBLIC_LINK_READ_SCOPE,
        SYNCSHOW_SONG_PUBLIC_LINK_WRITE_SCOPE,
      ]
    : [
        'syncshow:songs:read',
        SYNCSHOW_SONG_PUBLIC_LINK_READ_SCOPE,
      ]
}

function requireScopes(value: unknown, mode: 'read' | 'write') {
  const granted = scopes(value)
  if (requiredScopes(mode).some(scope => !granted.includes(scope))) {
    throw new SongPublicLinkError(
      'UNAUTHORIZED',
      'This SyncShow connection lacks the required song public-link scope.',
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

export async function authorizeSongPublicLinks(
  req: PayloadRequest,
  mode: 'read' | 'write',
): Promise<SongPublicLinkAuthority> {
  const authorization = req.headers.get('authorization') || ''
  const token = authorization.startsWith('SyncShow ')
    ? authorization.slice('SyncShow '.length).trim()
    : ''
  if (!token) {
    throw new SongPublicLinkError(
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
    throw new SongPublicLinkError(
      'UNAUTHORIZED',
      'This SyncShow connection is invalid or expired.',
      401,
    )
  }
  const connection = found[0]
  requireScopes(connection.scopes, mode)
  const connectionId = relationId(connection.id)
  const communityId = relationId(connection.community)
  const userId = relationId(connection.user)
  if (
    !connectionId
    || !communityId
    || !userId
    || !await managerMembership(req, userId, communityId)
  ) {
    throw new SongPublicLinkError(
      'MANAGER_REQUIRED',
      'This connection no longer belongs to a church manager.',
      403,
    )
  }
  const lastUsed = Date.parse(String(connection.lastUsedAt || ''))
  if (!Number.isFinite(lastUsed) || lastUsed < Date.now() - 60 * 60_000) {
    await req.payload.update({
      collection: 'syncshow-connections',
      id: connectionId,
      overrideAccess: true,
      req,
      data: { lastUsedAt: new Date().toISOString() },
    })
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
    throw new SongPublicLinkError(
      'TRANSACTION_UNAVAILABLE',
      'Atomic song public-link updates are temporarily unavailable.',
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
    throw new SongPublicLinkError(
      'TRANSACTION_UNAVAILABLE',
      'Atomic song public-link updates are temporarily unavailable.',
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
  authority: SongPublicLinkAuthority,
  mode: 'read' | 'write',
) {
  const connectionRows = databaseRows(await database.execute(sql`
    SELECT
      "id",
      "community_id" AS "communityId",
      "user_id" AS "userId",
      "scopes"
    FROM "syncshow_connections"
    WHERE "id" = ${authority.connectionId}
      AND "community_id" = ${authority.communityId}
      AND "user_id" = ${authority.userId}
      AND "revoked_at" IS NULL
      AND "expires_at" > now()
    LIMIT 2
    FOR UPDATE;
  `))
  if (connectionRows.length !== 1) {
    throw new SongPublicLinkError(
      'UNAUTHORIZED',
      'This SyncShow connection is invalid or expired.',
      401,
    )
  }
  requireScopes(connectionRows[0].scopes, mode)
  const membershipRows = databaseRows(await database.execute(sql`
    SELECT "id"
    FROM "memberships"
    WHERE "community_id" = ${authority.communityId}
      AND "user_id" = ${authority.userId}
      AND "role" IN ('owner', 'admin', 'leader')
    LIMIT 2
    FOR UPDATE;
  `))
  if (membershipRows.length !== 1) {
    throw new SongPublicLinkError(
      'MANAGER_REQUIRED',
      'This connection no longer belongs to a church manager.',
      403,
    )
  }
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

async function oneByWhere(
  req: PayloadRequest,
  where: UnknownRecord,
) {
  const documents = (await req.payload.find({
    collection: 'syncshow-song-public-links' as never,
    depth: 0,
    limit: 2,
    overrideAccess: true,
    showHiddenFields: true,
    req,
    where: where as never,
  })).docs.map(row)
  if (documents.length > 1) {
    throw new SongPublicLinkError(
      'INVALID_LINK_STATE',
      'Song public-link uniqueness was violated.',
      500,
    )
  }
  return documents[0] || null
}

function sameCommunity(link: UnknownRecord, communityId: number) {
  return relationId(link.community) === communityId
}

function replayOrConflict(
  link: UnknownRecord,
  authority: SongPublicLinkAuthority,
  storedRequestHash: unknown,
  requestHash: string,
) {
  if (
    !sameCommunity(link, authority.communityId)
    || storedRequestHash !== requestHash
  ) {
    throw new SongPublicLinkError(
      'IDEMPOTENCY_CONFLICT',
      'This idempotency key was already used for a different operation.',
      409,
    )
  }
  return serializeSongPublicLinkRecord(link)
}

async function lockedSong(
  req: PayloadRequest,
  database: TransactionDatabase,
  communityId: number,
  syncId: string,
) {
  const rows = databaseRows(await database.execute(sql`
    SELECT "id"
    FROM "songs"
    WHERE "community_id" = ${communityId}
      AND "sync_id" = ${syncId}
    LIMIT 2
    FOR UPDATE;
  `))
  if (rows.length !== 1) {
    throw new SongPublicLinkError(
      rows.length ? 'INVALID_SONG_STATE' : 'SONG_NOT_FOUND',
      rows.length
        ? 'Song synchronization identity is ambiguous.'
        : 'Song not found.',
      rows.length ? 500 : 404,
    )
  }
  const id = relationId(rows[0].id)
  if (!id) {
    throw new SongPublicLinkError(
      'INVALID_SONG_STATE',
      'Stored song identity is invalid.',
      500,
    )
  }
  const song = await req.payload.findByID({
    collection: 'songs',
    id,
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
    req,
  })
  const document = row(song)
  if (
    relationId(document.community) !== communityId
    || document.syncId !== syncId
  ) {
    throw new SongPublicLinkError(
      'INVALID_SONG_STATE',
      'Stored song identity changed while creating the link.',
      500,
    )
  }
  return document
}

function auditSource(
  event: UnknownRecord,
  previous?: unknown,
) {
  let events: UnknownRecord[] = []
  if (previous !== undefined) {
    if (typeof previous !== 'string' || previous.length > 64 * 1024) {
      throw new SongPublicLinkError(
        'INVALID_LINK_STATE',
        'Stored song public-link audit is invalid.',
        500,
      )
    }
    try {
      const parsed = JSON.parse(previous) as UnknownRecord
      if (
        parsed.schemaVersion !== 1
        || !Array.isArray(parsed.events)
        || parsed.events.length < 1
        || parsed.events.length > 15
      ) {
        throw new Error('invalid')
      }
      events = parsed.events as UnknownRecord[]
    } catch {
      throw new SongPublicLinkError(
        'INVALID_LINK_STATE',
        'Stored song public-link audit is invalid.',
        500,
      )
    }
  }
  return JSON.stringify({
    schemaVersion: 1,
    events: [...events, event],
  })
}

function privateSongAttribution(song: UnknownRecord) {
  const normalizedSongText = (value: unknown) =>
    typeof value === 'string'
      ? value.replace(/\r\n?/gu, '\n').trim()
      : ''
  const copyright = typeof song.copyright === 'string'
    ? normalizedSongText(song.copyright)
    : ''
  const rightsNotes = normalizedSongText(song.rightsNotes)
  if (!rightsNotes) {
    return {
      privateAttributionExactValues: [] as string[],
      privateAttributionFragments: [] as string[],
    }
  }
  return {
    // Legacy Heritage rows synthesized manager-only rights/source notes into
    // the display-attribution scalar. Redact both the ordinary full-note form
    // and the historical 2,048-character truncation form while leaving
    // unrelated, explicitly public document attribution intact.
    privateAttributionExactValues: [
      [copyright, rightsNotes].filter(Boolean).join('\n').slice(0, 2048),
    ],
    privateAttributionFragments: [rightsNotes],
  }
}

export async function createSongPublicLink(
  req: PayloadRequest,
  authority: SongPublicLinkAuthority,
  request: SongPublicLinkCreateRequest,
  expectedSongVersion: number,
  idempotencyKey: string,
  { now = new Date() }: { now?: Date } = {},
) {
  request = normalizeSongPublicLinkCreateRequest(request, {
    enforceCurrentTime: false,
  })
  if (
    !Number.isSafeInteger(expectedSongVersion)
    || expectedSongVersion < 1
  ) {
    throw new SongPublicLinkError(
      'VERSION_CONFLICT',
      'The song changed on the server. Refresh it before creating a link.',
      412,
    )
  }
  if (!Number.isFinite(now.getTime())) {
    throw new TypeError('Song public-link clock is invalid')
  }
  const keyHash = hashSongPublicLinkIdempotencyKey(idempotencyKey, {
    connectionId: authority.connectionId,
    operation: 'create',
  })
  const requestHash = songPublicLinkOperationHash({
    expectedSongVersion,
    request,
  })
  return inTransaction(req, async database => {
    await recheckAuthority(database, authority, 'write')
    await lockIdempotencyKey(database, keyHash)
    const replay = await oneByWhere(req, {
      createIdempotencyKeyHash: { equals: keyHash },
    })
    if (replay) {
      return {
        created: false,
        link: replayOrConflict(
          replay,
          authority,
          replay.createRequestHash,
          requestHash,
        ),
      }
    }

    const song = await lockedSong(
      req,
      database,
      authority.communityId,
      request.songSyncId,
    )
    const songVersion = Number(song.syncVersion)
    if (songVersion !== expectedSongVersion) {
      throw new SongPublicLinkError(
        'VERSION_CONFLICT',
        'The song changed on the server. Refresh it before creating a link.',
        412,
      )
    }
    if (
      request.review.validThrough
      && now.getTime() > Date.parse(request.review.validThrough)
    ) {
      throw new SongPublicLinkError(
        'REVIEW_EXPIRED',
        'Song public-link rights review has expired.',
      )
    }
    const documents = effectiveSyncDocuments(song)
    const snapshot = buildSongPublicLinkSnapshot({
      songSyncId: request.songSyncId,
      songSyncVersion: songVersion,
      documents,
      ...privateSongAttribution(song),
    })
    if (snapshot.snapshot.familyRevision !== request.familyRevision) {
      throw new SongPublicLinkError(
        'FAMILY_CONFLICT',
        'The exact song family differs from the reviewed link request.',
        409,
      )
    }
    const issuedAt = now.toISOString()
    if (
      request.expiresAt
      && Date.parse(request.expiresAt) <= Date.parse(issuedAt)
    ) {
      throw new SongPublicLinkError(
        'INVALID_EXPIRY',
        'Song public-link expiration time must be in the future.',
      )
    }
    const linkId = randomBytes(32).toString('base64url')
    const created = row(await req.payload.create({
      collection: 'syncshow-song-public-links' as never,
      overrideAccess: true,
      showHiddenFields: true,
      req,
      context: { songPublicLinkInternalMutation: true },
      data: {
        community: authority.communityId,
        song: relationId(song.id),
        schemaVersion: SONG_PUBLIC_LINK_SCHEMA_VERSION,
        linkId,
        linkVersion: 1,
        songSyncId: request.songSyncId,
        songSyncVersion: songVersion,
        familyRevision: request.familyRevision,
        reviewRevision: request.reviewRevision,
        label: request.label,
        issuedAt,
        expiresAt: request.expiresAt,
        revokedAt: null,
        snapshotChecksum: snapshot.checksum,
        snapshotSource: snapshot.source,
        reviewSource: JSON.stringify(request.review),
        auditSource: auditSource({
          type: 'created',
          at: issuedAt,
          source: 'syncshow',
          userId: authority.userId,
          connectionId: authority.connectionId,
          songSyncVersion: songVersion,
          familyRevision: request.familyRevision,
          reviewRevision: request.reviewRevision,
        }),
        createIdempotencyKeyHash: keyHash,
        createRequestHash: requestHash,
        revokeIdempotencyKeyHash: null,
        revokeRequestHash: null,
      } as never,
    }))
    return {
      created: true,
      link: serializeSongPublicLinkRecord(created),
    }
  })
}

async function lockedLink(
  req: PayloadRequest,
  database: TransactionDatabase,
  authority: SongPublicLinkAuthority,
  linkId: string,
) {
  const found = await oneByWhere(req, {
    and: [
      { community: { equals: authority.communityId } },
      { linkId: { equals: linkId } },
    ],
  })
  if (!found) {
    throw new SongPublicLinkError(
      'LINK_NOT_FOUND',
      'Song public link not found.',
      404,
    )
  }
  const id = relationId(found.id)
  const locked = databaseRows(await database.execute(sql`
    SELECT "id"
    FROM "syncshow_song_public_links"
    WHERE "id" = ${id}
      AND "community_id" = ${authority.communityId}
      AND "link_id" = ${linkId}
    LIMIT 2
    FOR UPDATE;
  `))
  if (locked.length !== 1) {
    throw new SongPublicLinkError(
      locked.length ? 'INVALID_LINK_STATE' : 'LINK_NOT_FOUND',
      locked.length
        ? 'Song public-link identity is ambiguous.'
        : 'Song public link not found.',
      locked.length ? 500 : 404,
    )
  }
  const current = row(await req.payload.findByID({
    collection: 'syncshow-song-public-links' as never,
    id: id as never,
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
    req,
  }))
  if (
    !sameCommunity(current, authority.communityId)
    || current.linkId !== linkId
  ) {
    throw new SongPublicLinkError(
      'INVALID_LINK_STATE',
      'Song public-link identity changed during revocation.',
      500,
    )
  }
  return current
}

export async function revokeSongPublicLink(
  req: PayloadRequest,
  authority: SongPublicLinkAuthority,
  linkIdValue: unknown,
  expectedLinkVersion: number,
  idempotencyKey: string,
  { now = new Date() }: { now?: Date } = {},
) {
  const linkId = normalizeSongPublicLinkId(linkIdValue)
  if (
    !Number.isSafeInteger(expectedLinkVersion)
    || expectedLinkVersion < 1
  ) {
    throw new SongPublicLinkError(
      'VERSION_CONFLICT',
      'The song public link changed on the server. Refresh it before revoking.',
      412,
    )
  }
  if (!Number.isFinite(now.getTime())) {
    throw new TypeError('Song public-link clock is invalid')
  }
  const keyHash = hashSongPublicLinkIdempotencyKey(idempotencyKey, {
    connectionId: authority.connectionId,
    operation: 'revoke',
  })
  const requestHash = songPublicLinkOperationHash({
    linkId,
    expectedLinkVersion,
  })
  return inTransaction(req, async database => {
    await recheckAuthority(database, authority, 'write')
    await lockIdempotencyKey(database, keyHash)
    const replay = await oneByWhere(req, {
      revokeIdempotencyKeyHash: { equals: keyHash },
    })
    if (replay) {
      return replayOrConflict(
        replay,
        authority,
        replay.revokeRequestHash,
        requestHash,
      )
    }
    const link = await lockedLink(
      req,
      database,
      authority,
      linkId,
    )
    const currentVersion = Number(link.linkVersion)
    if (currentVersion !== expectedLinkVersion || link.revokedAt) {
      throw new SongPublicLinkError(
        'VERSION_CONFLICT',
        'The song public link changed on the server. Refresh it before revoking.',
        412,
      )
    }
    const issuedAt = new Date(String(link.issuedAt))
    if (!Number.isFinite(issuedAt.getTime())) {
      throw new SongPublicLinkError(
        'INVALID_LINK_STATE',
        'Stored song public-link creation time is invalid.',
        500,
      )
    }
    const revokedAt = new Date(
      Math.max(now.getTime(), issuedAt.getTime()),
    ).toISOString()
    const updated = row(await req.payload.update({
      collection: 'syncshow-song-public-links' as never,
      id: relationId(link.id) as never,
      overrideAccess: true,
      showHiddenFields: true,
      req,
      context: { songPublicLinkInternalMutation: true },
      data: {
        linkVersion: currentVersion + 1,
        revokedAt,
        revokeIdempotencyKeyHash: keyHash,
        revokeRequestHash: requestHash,
        auditSource: auditSource({
          type: 'revoked',
          at: revokedAt,
          source: 'syncshow',
          userId: authority.userId,
          connectionId: authority.connectionId,
        }, link.auditSource),
      } as never,
    }))
    return serializeSongPublicLinkRecord(updated)
  })
}

function cursorSecret(payload: { secret?: string }) {
  const secret = String(payload.secret || '')
  if (Buffer.byteLength(secret, 'utf8') < 16) {
    throw new SongPublicLinkError(
      'CURSOR_UNAVAILABLE',
      'Signed song public-link cursors are temporarily unavailable.',
      503,
    )
  }
  return secret
}

function cursorSignature(secret: string, encoded: string) {
  return createHmac('sha256', secret)
    .update(CURSOR_DOMAIN, 'utf8')
    .update('\0')
    .update(encoded, 'ascii')
    .digest('base64url')
}

export function encodeSongPublicLinkCursor(
  payload: { secret?: string },
  authority: SongPublicLinkAuthority,
  songSyncId: string,
  position: CursorPosition,
) {
  const encoded = Buffer.from(JSON.stringify({
    schemaVersion: 1,
    communityId: authority.communityId,
    songSyncId,
    issuedAt: new Date(position.issuedAt).toISOString(),
    id: position.id,
  }), 'utf8').toString('base64url')
  return `${encoded}.${cursorSignature(cursorSecret(payload), encoded)}`
}

export function decodeSongPublicLinkCursor(
  payload: { secret?: string },
  authority: SongPublicLinkAuthority,
  songSyncId: string,
  value: string | null,
): CursorPosition | null {
  if (!value) return null
  if (
    Buffer.byteLength(value, 'utf8') > MAX_SONG_PUBLIC_LINK_CURSOR_BYTES
    || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(value)
  ) {
    throw new SongPublicLinkError(
      'INVALID_CURSOR',
      'Song public-link cursor is invalid.',
    )
  }
  try {
    const [encoded, signature] = value.split('.')
    const expected = Buffer.from(
      cursorSignature(cursorSecret(payload), encoded),
      'base64url',
    )
    const actual = Buffer.from(signature, 'base64url')
    if (
      actual.length !== expected.length
      || !timingSafeEqual(actual, expected)
    ) {
      throw new Error('invalid')
    }
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as UnknownRecord
    const keys = Object.keys(parsed).sort()
    const id = Number(parsed.id)
    const issuedAt = String(parsed.issuedAt || '')
    if (
      keys.join(',') !==
        'communityId,id,issuedAt,schemaVersion,songSyncId'
      || parsed.schemaVersion !== 1
      || parsed.communityId !== authority.communityId
      || parsed.songSyncId !== songSyncId
      || !Number.isSafeInteger(id)
      || id < 1
      || new Date(issuedAt).toISOString() !== issuedAt
    ) {
      throw new Error('invalid')
    }
    return { issuedAt, id }
  } catch (error) {
    if (
      error instanceof SongPublicLinkError
      && error.code === 'CURSOR_UNAVAILABLE'
    ) {
      throw error
    }
    throw new SongPublicLinkError(
      'INVALID_CURSOR',
      'Song public-link cursor is invalid.',
    )
  }
}

export async function listSongPublicLinks(
  req: PayloadRequest,
  authority: SongPublicLinkAuthority,
  {
    songSyncId,
    cursor,
    limit,
  }: {
    songSyncId: string
    cursor: CursorPosition | null
    limit: number
  },
) {
  if (
    !Number.isSafeInteger(limit)
    || limit < 1
    || limit > MAX_SONG_PUBLIC_LINK_PAGE_ITEMS
  ) {
    throw new SongPublicLinkError(
      'INVALID_LIMIT',
      `Song public-link limit must be 1-${MAX_SONG_PUBLIC_LINK_PAGE_ITEMS}.`,
    )
  }
  const result = await req.payload.find({
    collection: 'syncshow-song-public-links' as never,
    depth: 0,
    limit: limit + 1,
    sort: ['-issuedAt', '-id'],
    overrideAccess: true,
    showHiddenFields: true,
    req,
    where: {
      and: [
        { community: { equals: authority.communityId } },
        { songSyncId: { equals: songSyncId } },
        ...(cursor
          ? [{
              or: [
                { issuedAt: { less_than: cursor.issuedAt } },
                {
                  and: [
                    { issuedAt: { equals: cursor.issuedAt } },
                    { id: { less_than: cursor.id } },
                  ],
                },
              ],
            }]
          : []),
      ],
    } as never,
  })
  const fetched = result.docs.map(row)
  const hasMore = fetched.length > limit
  const page = fetched.slice(0, limit)
  const items = page.map(document => {
    if (
      !sameCommunity(document, authority.communityId)
      || document.songSyncId !== songSyncId
    ) {
      throw new SongPublicLinkError(
        'INVALID_LINK_STATE',
        'Stored song public-link ownership is invalid.',
        500,
      )
    }
    return serializeSongPublicLinkRecord(document)
  })
  if (new Set(items.map(item => item.linkId)).size !== items.length) {
    throw new SongPublicLinkError(
      'INVALID_LINK_STATE',
      'Stored song public-link page repeats an identity.',
      500,
    )
  }
  const last = page.at(-1)
  return {
    items,
    hasMore,
    nextCursor: hasMore && last
      ? encodeSongPublicLinkCursor(
          req.payload,
          authority,
          songSyncId,
          {
            issuedAt: new Date(String(last.issuedAt)).toISOString(),
            id: relationId(last.id),
          },
        )
      : null,
  }
}

type AnonymousDatabaseResult = DatabaseResult

type AnonymousPayload = {
  db: {
    drizzle?: {
      execute: (query: unknown) => Promise<AnonymousDatabaseResult>
    }
  }
}

function anonymousRows(result: AnonymousDatabaseResult) {
  return databaseRows(result)
}

export async function loadActiveSongPublicLinkSnapshot(
  payload: AnonymousPayload,
  linkIdValue: unknown,
  { now = new Date() }: { now?: Date } = {},
): Promise<SongPublicLinkSnapshot | null> {
  let linkId: string
  try {
    linkId = normalizeSongPublicLinkId(linkIdValue)
  } catch {
    return null
  }
  if (!Number.isFinite(now.getTime())) {
    throw new TypeError('Song public-link clock is invalid')
  }
  const database = payload.db.drizzle
  if (!database) {
    throw new Error('Song public-link database is unavailable.')
  }
  const result = await database.execute(sql`
    SELECT
      "song_sync_id" AS "songSyncId",
      "song_sync_version" AS "songSyncVersion",
      "family_revision" AS "familyRevision",
      "snapshot_checksum" AS "snapshotChecksum",
      "snapshot_source" AS "snapshotSource",
      "expires_at" AS "expiresAt",
      "revoked_at" AS "revokedAt"
    FROM "syncshow_song_public_links"
    WHERE "link_id" = ${linkId}
      AND "revoked_at" IS NULL
      AND ("expires_at" IS NULL OR "expires_at" > ${now.toISOString()})
    LIMIT 2;
  `)
  const rows = anonymousRows(result)
  if (rows.length > 1) {
    throw new Error('Song public-link identity uniqueness was violated.')
  }
  const found = rows[0]
  if (!found || found.revokedAt) return null
  const expiresAt = found.expiresAt instanceof Date
    ? found.expiresAt
    : found.expiresAt
      ? new Date(String(found.expiresAt))
      : null
  if (
    expiresAt
    && (!Number.isFinite(expiresAt.getTime())
      || expiresAt.getTime() <= now.getTime())
  ) {
    return null
  }
  const snapshot = parseSongPublicLinkSnapshotSource(
    found.snapshotSource,
    found.snapshotChecksum,
  )
  if (
    snapshot.songSyncId !== found.songSyncId
    || snapshot.songSyncVersion !== Number(found.songSyncVersion)
    || snapshot.familyRevision !== found.familyRevision
  ) {
    throw new Error('Song public-link snapshot authority is invalid.')
  }
  return snapshot
}

export type { SongPublicLinkRecord }
