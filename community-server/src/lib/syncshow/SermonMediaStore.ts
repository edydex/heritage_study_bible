import { sql } from '@payloadcms/db-postgres'
import { createHash, randomBytes } from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'
import { createOpaqueToken, hashOpaqueToken } from '@/lib/tokens'
import {
  assertSermonMediaBinding,
  expectedSermonMediaChunk,
  normalizeSermonMediaChunkHeaders,
  normalizeSermonMediaInitRequest,
  SERMON_MEDIA_CHUNK_SIZE_BYTES,
  SERMON_MEDIA_READ_SCOPE,
  SERMON_MEDIA_SCHEMA_VERSION,
  SERMON_MEDIA_SESSION_TTL_SECONDS,
  SERMON_MEDIA_WRITE_SCOPE,
  sermonMediaCapacityLimits,
  sermonMediaChunkCount,
  sermonMediaEnabled,
  sermonMediaIdempotencyHash,
  sermonMediaRequestHash,
  sermonMediaRequiredAvailableBytes,
  sermonMediaSessionExpired,
  SermonMediaError,
  type SermonMediaChunkHeaders,
  type SermonMediaInitRequest,
  type SermonMediaRecording,
  type SermonMediaUploadState,
  type SermonMediaUploadView,
} from './SermonMedia.ts'
import {
  assembleSermonMediaObject,
  cleanupSermonMediaStaging,
  sermonMediaChunkKey,
  sermonMediaFilesystemCapacity,
  sermonMediaStagingKey,
  verifySermonMediaObject,
  type StoredSermonMediaChunk,
  type StoredSermonMediaObject,
} from './SermonMediaStorage.ts'

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

export type SermonMediaAuthority = Readonly<{
  connectionId: number
  communityId: number
  userId: number
  mode: 'read' | 'write'
}>

export type SermonMediaChunkRecord = StoredSermonMediaChunk & Readonly<{
  index: number
  startByte: number
  endByte: number
  receivedAt: string
}>

export type SermonMediaChunkRequestHeaders = Readonly<{
  index: number
  contentLength: string | null
  contentRange: string | null
  sha256: string | null
}>

type Outcome<T> = Readonly<{ value: T }> | Readonly<{ error: SermonMediaError }>

const FINALIZATION_LEASE_SECONDS = 15 * 60
const MAX_CONCURRENT_CHUNK_REQUESTS_GLOBAL = 4
const MAX_CONCURRENT_CHUNK_REQUESTS_PER_CONNECTION = 1
const UPLOAD_ID_PATTERN = /^[A-Za-z0-9_-]{32,128}$/
const ACTIVE_UPLOAD_STATES = ['uploading', 'finalizing'] as const
const READ_SCOPES = [
  'syncshow:sermons:read',
  SERMON_MEDIA_READ_SCOPE,
] as const
const WRITE_SCOPES = [
  'syncshow:sermons:read',
  SERMON_MEDIA_READ_SCOPE,
  SERMON_MEDIA_WRITE_SCOPE,
] as const

const CHUNK_CONCURRENCY_KEY = '__heritageSermonMediaChunkConcurrency'
type ChunkConcurrencyState = {
  global: number
  connections: Map<number, number>
}

function chunkConcurrencyState() {
  const shared = globalThis as typeof globalThis & {
    [CHUNK_CONCURRENCY_KEY]?: ChunkConcurrencyState
  }
  shared[CHUNK_CONCURRENCY_KEY] ??= {
    global: 0,
    connections: new Map(),
  }
  return shared[CHUNK_CONCURRENCY_KEY]
}

export function acquireSermonMediaChunkRequestSlot(
  connectionId: number,
) {
  const state = chunkConcurrencyState()
  const connectionCount = state.connections.get(connectionId) || 0
  if (
    state.global >= MAX_CONCURRENT_CHUNK_REQUESTS_GLOBAL
    || connectionCount >= MAX_CONCURRENT_CHUNK_REQUESTS_PER_CONNECTION
  ) {
    throw new SermonMediaError(
      'CHUNK_REQUEST_CAPACITY',
      'The server is receiving other recording chunks. Retry shortly.',
      429,
      true,
      5,
    )
  }
  state.global += 1
  state.connections.set(connectionId, connectionCount + 1)
  let released = false
  return () => {
    if (released) return
    released = true
    state.global = Math.max(0, state.global - 1)
    const current = state.connections.get(connectionId) || 0
    if (current <= 1) state.connections.delete(connectionId)
    else state.connections.set(connectionId, current - 1)
  }
}

function row(value: unknown): UnknownRecord {
  return value as UnknownRecord
}

export function sermonMediaCommunityNamespace(communityId: number) {
  if (!Number.isSafeInteger(communityId) || communityId < 1) {
    throw new SermonMediaError(
      'INVALID_COMMUNITY_ID',
      'The private media namespace requires a valid Community identity.',
      500,
    )
  }
  // The restored database preserves this immutable relation ID while appliance
  // secrets intentionally rotate. A domain-separated digest therefore keeps
  // private object keys stable across supported backup/restore without
  // enabling cross-Community deduplication.
  return createHash('sha256')
    .update('heritage-sermon-media-community-v1\0', 'utf8')
    .update(String(communityId), 'ascii')
    .digest('hex')
}

function databaseRows(result: DatabaseResult) {
  return Array.isArray(result)
    ? result
    : Array.isArray(result.rows) ? result.rows : []
}

function relationId(value: unknown) {
  const raw = value && typeof value === 'object' && 'id' in value
    ? (value as { id: unknown }).id
    : value
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : 0
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

function requireScopes(value: unknown, mode: 'read' | 'write') {
  const granted = scopes(value)
  const required = mode === 'write' ? WRITE_SCOPES : READ_SCOPES
  if (required.some(scope => !granted.includes(scope))) {
    throw new SermonMediaError(
      'UNAUTHORIZED',
      `This SyncShow connection lacks sermon-media ${mode} permission.`,
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

export async function authorizeSermonMedia(
  req: PayloadRequest,
  mode: 'read' | 'write',
): Promise<SermonMediaAuthority> {
  const authorization = req.headers.get('authorization') || ''
  const token = authorization.startsWith('SyncShow ')
    ? authorization.slice('SyncShow '.length).trim()
    : ''
  if (!token) {
    throw new SermonMediaError(
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
    throw new SermonMediaError(
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
    throw new SermonMediaError(
      'MANAGER_REQUIRED',
      'This connection no longer belongs to a church manager.',
      403,
    )
  }
  return Object.freeze({ connectionId, communityId, userId, mode })
}

function transactionDatabase(
  req: PayloadRequest,
  transactionId: number | string,
) {
  const adapter = req.payload.db as unknown as TransactionAdapter
  const database = adapter.sessions?.[String(transactionId)]?.db
  if (!database) {
    throw new SermonMediaError(
      'TRANSACTION_UNAVAILABLE',
      'Atomic recording upload operations are temporarily unavailable.',
      503,
      true,
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
    throw new SermonMediaError(
      'TRANSACTION_UNAVAILABLE',
      'Atomic recording upload operations are temporarily unavailable.',
      503,
      true,
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

function unwrap<T>(outcome: Outcome<T>) {
  if ('error' in outcome) throw outcome.error
  return outcome.value
}

async function cleanupTerminalStaging(uploadId: string) {
  try {
    await cleanupSermonMediaStaging(uploadId)
  } catch (cause) {
    const error = new SermonMediaError(
      'STAGING_CLEANUP_FAILED',
      'The terminal recording is safe, but its private staging files could not be cleaned. Retry the same operation.',
      503,
      true,
    )
    Object.defineProperty(error, 'cause', {
      configurable: true,
      value: cause,
    })
    throw error
  }
}

async function cleanupForTerminalOutcome<T>(
  outcome: Outcome<T>,
  uploadId: string,
) {
  if (
    'error' in outcome
    && ['STALE_SERMON_BINDING', 'UPLOAD_EXPIRED'].includes(
      outcome.error.code,
    )
  ) {
    await cleanupTerminalStaging(uploadId)
  }
  return unwrap(outcome)
}

async function recheckAuthority(
  database: TransactionDatabase,
  authority: SermonMediaAuthority,
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
    throw new SermonMediaError(
      'UNAUTHORIZED',
      'This SyncShow connection is invalid or expired.',
      401,
    )
  }
  requireScopes(connections[0].scopes, authority.mode)
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
    throw new SermonMediaError(
      'MANAGER_REQUIRED',
      'This connection no longer belongs to a church manager.',
      403,
    )
  }
}

async function enforceSermonMediaAdmission(
  database: TransactionDatabase,
  authority: SermonMediaAuthority,
  request: SermonMediaInitRequest,
) {
  const limits = sermonMediaCapacityLimits()
  const expired = databaseRows(await database.execute(sql`
    UPDATE "syncshow_sermon_media_uploads"
    SET
      "state" = 'expired',
      "expired_at" = now(),
      "finalization_lease_token_hash" = NULL,
      "finalization_lease_expires_at" = NULL,
      "updated_at" = now()
    WHERE "expires_at" <= now()
      AND (
        "state" = 'uploading'
        OR (
          "state" = 'finalizing'
          AND "finalization_lease_expires_at" <= now()
        )
      )
    RETURNING "upload_id" AS "uploadId";
  `))
  const counts = databaseRows(await database.execute(sql`
    SELECT
      COUNT(*) FILTER (
        WHERE "state" IN ('uploading', 'finalizing')
      ) AS "activeGlobal",
      COUNT(*) FILTER (
        WHERE "state" IN ('uploading', 'finalizing')
          AND "community_id" = ${authority.communityId}
      ) AS "activeCommunity",
      COUNT(*) FILTER (
        WHERE "state" IN ('uploading', 'finalizing')
          AND "connection_id" = ${authority.connectionId}
      ) AS "activeConnection",
      COALESCE(MAX("size_bytes") FILTER (
        WHERE "state" IN ('uploading', 'finalizing')
      ), 0) AS "largestActiveBytes"
    FROM "syncshow_sermon_media_uploads";
  `))
  if (counts.length !== 1) {
    throw new SermonMediaError(
      'CAPACITY_UNAVAILABLE',
      'Recording upload capacity could not be measured.',
      503,
      true,
    )
  }
  const capacity = counts[0]
  if (Number(capacity.activeGlobal) >= limits.maximumActiveGlobal) {
    throw new SermonMediaError(
      'ACTIVE_UPLOAD_CAPACITY',
      'This Community server is at its active recording-upload limit.',
      429,
      true,
      60,
    )
  }
  if (
    Number(capacity.activeCommunity)
      >= limits.maximumActivePerCommunity
  ) {
    throw new SermonMediaError(
      'COMMUNITY_UPLOAD_CAPACITY',
      'This Community is at its active recording-upload limit.',
      429,
      true,
      60,
    )
  }
  if (
    Number(capacity.activeConnection)
      >= limits.maximumActivePerConnection
  ) {
    throw new SermonMediaError(
      'CONNECTION_UPLOAD_CAPACITY',
      'This SyncShow connection is at its active recording-upload limit.',
      429,
      true,
      60,
    )
  }

  const retained = databaseRows(await database.execute(sql`
    WITH "active_unique" AS (
      SELECT "sha256", MAX("size_bytes") AS "size_bytes"
      FROM "syncshow_sermon_media_uploads"
      WHERE "community_id" = ${authority.communityId}
        AND "state" IN ('uploading', 'finalizing')
      GROUP BY "sha256"
    )
    SELECT
      COALESCE((
        SELECT SUM("size_bytes")
        FROM "syncshow_sermon_media_objects"
        WHERE "community_id" = ${authority.communityId}
      ), 0) AS "retainedBytes",
      COALESCE((
        SELECT COUNT(*)
        FROM "syncshow_sermon_media_objects"
        WHERE "community_id" = ${authority.communityId}
      ), 0) AS "retainedObjects",
      COALESCE((
        SELECT SUM("active_unique"."size_bytes")
        FROM "active_unique"
        WHERE NOT EXISTS (
          SELECT 1
          FROM "syncshow_sermon_media_objects" AS "object"
          WHERE "object"."community_id" = ${authority.communityId}
            AND "object"."sha256" = "active_unique"."sha256"
        )
      ), 0) AS "reservedUniqueBytes",
      COALESCE((
        SELECT COUNT(*)
        FROM "active_unique"
        WHERE NOT EXISTS (
          SELECT 1
          FROM "syncshow_sermon_media_objects" AS "object"
          WHERE "object"."community_id" = ${authority.communityId}
            AND "object"."sha256" = "active_unique"."sha256"
        )
      ), 0) AS "reservedUniqueObjects",
      (
        EXISTS (
          SELECT 1
          FROM "syncshow_sermon_media_objects"
          WHERE "community_id" = ${authority.communityId}
            AND "sha256" = ${request.recording.sha256}
        )
        OR EXISTS (
          SELECT 1
          FROM "active_unique"
          WHERE "sha256" = ${request.recording.sha256}
        )
      ) AS "alreadyRetainedOrReserved";
  `))
  if (retained.length !== 1) {
    throw new SermonMediaError(
      'CAPACITY_UNAVAILABLE',
      'Community recording retention could not be measured.',
      503,
      true,
    )
  }
  const alreadyRetained =
    retained[0].alreadyRetainedOrReserved === true
    || retained[0].alreadyRetainedOrReserved === 'true'
  const requestedRetainedBytes = alreadyRetained
    ? 0
    : request.recording.sizeBytes
  const projectedRetained =
    Number(retained[0].retainedBytes)
    + Number(retained[0].reservedUniqueBytes)
    + requestedRetainedBytes
  const projectedObjects =
    Number(retained[0].retainedObjects)
    + Number(retained[0].reservedUniqueObjects)
    + (alreadyRetained ? 0 : 1)
  if (
    !Number.isSafeInteger(projectedRetained)
    || projectedRetained
      > limits.maximumRetainedBytesPerCommunity
    || !Number.isSafeInteger(projectedObjects)
    || projectedObjects
      > limits.maximumRetainedObjectsPerCommunity
  ) {
    throw new SermonMediaError(
      'COMMUNITY_MEDIA_QUOTA',
      'This recording would exceed the Community private-media quota.',
      507,
    )
  }

  await enforceSermonMediaStorageReserve(
    database,
    request.recording.sizeBytes,
    Math.max(
      Number(capacity.largestActiveBytes),
      request.recording.sizeBytes,
    ),
  )
  return expired.map(item => String(item.uploadId))
}

async function lockSermonMediaAdmission(
  database: TransactionDatabase,
) {
  // One global admission lock makes expiry + count + byte reservation + insert
  // a serializable decision across every Community on this appliance.
  await database.execute(sql`
    SELECT pg_advisory_xact_lock(hashtextextended(
      'heritage-sermon-media-global-admission-v1',
      0
    ));
  `)
}

async function expireDueSermonMediaAdmissionRows(
  req: PayloadRequest,
) {
  return await inTransaction(req, async database => {
    await lockSermonMediaAdmission(database)
    return databaseRows(await database.execute(sql`
      UPDATE "syncshow_sermon_media_uploads"
      SET
        "state" = 'expired',
        "expired_at" = now(),
        "finalization_lease_token_hash" = NULL,
        "finalization_lease_expires_at" = NULL,
        "updated_at" = now()
      WHERE "expires_at" <= now()
        AND (
          "state" = 'uploading'
          OR (
            "state" = 'finalizing'
            AND "finalization_lease_expires_at" <= now()
          )
        )
      RETURNING "upload_id" AS "uploadId";
    `)).map(item => String(item.uploadId))
  })
}

async function enforceSermonMediaStorageReserve(
  database: TransactionDatabase,
  additionalReservationBytes = 0,
  proposedLargestBytes = 0,
) {
  const limits = sermonMediaCapacityLimits()
  const rows = databaseRows(await database.execute(sql`
    WITH "received" AS (
      SELECT
        "upload_id",
        COALESCE(SUM("size_bytes"), 0) AS "received_bytes"
      FROM "syncshow_sermon_media_chunks"
      GROUP BY "upload_id"
    )
    SELECT
      COALESCE(SUM(
        GREATEST(
          "upload"."size_bytes"
            - COALESCE("received"."received_bytes", 0),
          0
        )
      ), 0) AS "remainingBytes",
      COALESCE(MAX("upload"."size_bytes"), 0) AS "largestBytes"
    FROM "syncshow_sermon_media_uploads" AS "upload"
    LEFT JOIN "received"
      ON "received"."upload_id" = "upload"."id"
    WHERE "upload"."state" IN ('uploading', 'finalizing');
  `))
  if (rows.length !== 1) {
    throw new SermonMediaError(
      'CAPACITY_UNAVAILABLE',
      'Recording storage reservations could not be measured.',
      503,
      true,
    )
  }
  const filesystem = await sermonMediaFilesystemCapacity()
  const largestBytes = Math.max(
    Number(rows[0].largestBytes),
    proposedLargestBytes,
  )
  const requiredFreeBytes = sermonMediaRequiredAvailableBytes({
    configuredReserveBytes: limits.storageReserveBytes,
    filesystemTotalBytes: filesystem.totalBytes,
    remainingActiveBytes: Number(rows[0].remainingBytes),
    additionalReservationBytes,
    largestAssemblyBytes: largestBytes,
  })
  if (
    !Number.isSafeInteger(requiredFreeBytes)
    || filesystem.availableBytes < requiredFreeBytes
  ) {
    throw new SermonMediaError(
      'STORAGE_RESERVE',
      'This recording would consume the server private-storage reserve.',
      507,
      true,
    )
  }
}

async function enforceFinalizationAdmission(
  database: TransactionDatabase,
) {
  const limits = sermonMediaCapacityLimits()
  await database.execute(sql`
    SELECT pg_advisory_xact_lock(hashtextextended(
      'heritage-sermon-media-finalization-admission-v1',
      0
    ));
  `)
  const rows = databaseRows(await database.execute(sql`
    SELECT COUNT(*) AS "finalizing"
    FROM "syncshow_sermon_media_uploads"
    WHERE "state" = 'finalizing'
      AND "finalization_lease_expires_at" > now();
  `))
  if (
    rows.length !== 1
    || !Number.isSafeInteger(Number(rows[0].finalizing))
  ) {
    throw new SermonMediaError(
      'CAPACITY_UNAVAILABLE',
      'Recording finalization capacity could not be measured.',
      503,
      true,
    )
  }
  if (Number(rows[0].finalizing) >= limits.maximumFinalizingGlobal) {
    throw new SermonMediaError(
      'FINALIZATION_CAPACITY',
      'The server is finalizing other recordings. Retry shortly.',
      429,
      true,
      15,
    )
  }
}

function normalizeUploadId(value: unknown) {
  const uploadId = String(value || '')
  if (!UPLOAD_ID_PATTERN.test(uploadId)) {
    throw new SermonMediaError(
      'UPLOAD_NOT_FOUND',
      'Recording upload not found.',
      404,
    )
  }
  return uploadId
}

function uploadSelection() {
  return sql`
    "id",
    "upload_id" AS "uploadId",
    "community_id" AS "communityId",
    "connection_id" AS "connectionId",
    "sermon_id" AS "sermonId",
    "schema_version" AS "schemaVersion",
    "state",
    "sync_id" AS "syncId",
    "expected_sync_version" AS "expectedSyncVersion",
    "expected_current_revision" AS "expectedCurrentRevision",
    "recording_id" AS "recordingId",
    "kind",
    "language",
    "media_type" AS "mediaType",
    "file_name" AS "fileName",
    "sha256",
    "size_bytes" AS "sizeBytes",
    "duration_seconds" AS "durationSeconds",
    "chunk_size_bytes" AS "chunkSizeBytes",
    "chunk_count" AS "chunkCount",
    "staging_key" AS "stagingKey",
    "object_id" AS "objectId",
    "init_idempotency_key_hash" AS "initIdempotencyKeyHash",
    "init_request_hash" AS "initRequestHash",
    "complete_idempotency_key_hash" AS "completeIdempotencyKeyHash",
    "complete_request_hash" AS "completeRequestHash",
    "cancel_idempotency_key_hash" AS "cancelIdempotencyKeyHash",
    "cancel_request_hash" AS "cancelRequestHash",
    "finalization_lease_token_hash" AS "finalizationLeaseTokenHash",
    "finalization_lease_expires_at" AS "finalizationLeaseExpiresAt",
    "expires_at" AS "expiresAt",
    "completed_at" AS "completedAt",
    "updated_at" AS "updatedAt"
  `
}

async function lockedUpload(
  database: TransactionDatabase,
  authority: SermonMediaAuthority,
  value: unknown,
) {
  const uploadId = normalizeUploadId(value)
  const found = databaseRows(await database.execute(sql`
    SELECT ${uploadSelection()}
    FROM "syncshow_sermon_media_uploads"
    WHERE "upload_id" = ${uploadId}
      AND "community_id" = ${authority.communityId}
    LIMIT 2
    FOR UPDATE;
  `))
  if (found.length !== 1) {
    throw new SermonMediaError(
      'UPLOAD_NOT_FOUND',
      'Recording upload not found.',
      404,
    )
  }
  return found[0]
}

/**
 * Global mutation lock order:
 * connection/membership -> sermon -> upload -> chunks/objects.
 *
 * Init already has the first two identities in its request. Existing-upload
 * routes first peek at immutable tenant/binding identity without a row lock,
 * then take the same parent locks before locking the upload. This prevents an
 * init holding a sermon while waiting on an upload from cycling with a chunk
 * or completion holding that upload while waiting on the sermon.
 */
async function lockedAuthorizedUpload(
  database: TransactionDatabase,
  authority: SermonMediaAuthority,
  value: unknown,
) {
  await recheckAuthority(database, authority)
  const uploadId = normalizeUploadId(value)
  const peeked = databaseRows(await database.execute(sql`
    SELECT ${uploadSelection()}
    FROM "syncshow_sermon_media_uploads"
    WHERE "upload_id" = ${uploadId}
      AND "community_id" = ${authority.communityId}
    LIMIT 2;
  `))
  if (peeked.length !== 1) {
    throw new SermonMediaError(
      'UPLOAD_NOT_FOUND',
      'Recording upload not found.',
      404,
    )
  }
  try {
    await lockedSermon(
      database,
      authority.communityId,
      String(peeked[0].syncId),
    )
  } catch (error) {
    if (
      !(error instanceof SermonMediaError)
      || error.code !== 'SERMON_NOT_FOUND'
    ) {
      throw error
    }
    // validateLiveUpload will lock the upload, persist superseded, and return
    // the same bounded stale-binding response when the parent was removed.
  }
  return await lockedUpload(database, authority, uploadId)
}

function uploadRecording(upload: UnknownRecord): SermonMediaRecording {
  const duration = upload.durationSeconds
  return Object.freeze({
    id: String(upload.recordingId),
    kind: 'audio',
    language: String(upload.language),
    mediaType: String(upload.mediaType) as SermonMediaRecording['mediaType'],
    fileName: String(upload.fileName),
    sha256: String(upload.sha256),
    sizeBytes: Number(upload.sizeBytes),
    durationSeconds: duration === null || duration === undefined
      ? null
      : Number(duration),
  })
}

async function uploadChunks(
  database: TransactionDatabase,
  uploadDatabaseId: number,
) {
  return databaseRows(await database.execute(sql`
    SELECT
      "chunk_index" AS "index",
      "start_byte" AS "startByte",
      "end_byte" AS "endByte",
      "size_bytes" AS "sizeBytes",
      "sha256",
      "storage_key" AS "storageKey",
      "received_at" AS "receivedAt",
      "idempotency_key_hash" AS "idempotencyKeyHash",
      "request_hash" AS "requestHash"
    FROM "syncshow_sermon_media_chunks"
    WHERE "upload_id" = ${uploadDatabaseId}
    ORDER BY "chunk_index" ASC;
  `))
}

async function uploadView(
  database: TransactionDatabase,
  upload: UnknownRecord,
): Promise<SermonMediaUploadView> {
  const chunks = await uploadChunks(database, Number(upload.id))
  return Object.freeze({
    id: String(upload.uploadId),
    state: String(upload.state) as SermonMediaUploadState,
    sermon: Object.freeze({
      syncId: String(upload.syncId),
      syncVersion: Number(upload.expectedSyncVersion),
      currentRevision: String(upload.expectedCurrentRevision),
    }),
    recording: uploadRecording(upload),
    chunkSizeBytes: Number(upload.chunkSizeBytes),
    chunkCount: Number(upload.chunkCount),
    receivedChunks: Object.freeze(chunks.map(chunk => Number(chunk.index))),
    receivedBytes: chunks.reduce(
      (total, chunk) => total + Number(chunk.sizeBytes),
      0,
    ),
    expiresAt: new Date(String(upload.expiresAt)).toISOString(),
    completedAt: upload.completedAt
      ? new Date(String(upload.completedAt)).toISOString()
      : null,
  })
}

async function lockedSermon(
  database: TransactionDatabase,
  communityId: number,
  syncId: string,
) {
  const sermons = databaseRows(await database.execute(sql`
    SELECT
      "id",
      "sync_id" AS "syncId",
      "sync_version" AS "syncVersion",
      "sync_current_revision" AS "syncCurrentRevision",
      "sync_current_document_source" AS "syncCurrentDocumentSource",
      "sync_archived" AS "syncArchived"
    FROM "sermons"
    WHERE "community_id" = ${communityId}
      AND "sync_id" = ${syncId}
    LIMIT 2
    FOR UPDATE;
  `))
  if (sermons.length !== 1) {
    throw new SermonMediaError(
      sermons.length ? 'INVALID_SERMON_STATE' : 'SERMON_NOT_FOUND',
      sermons.length
        ? 'Canonical sermon identity is ambiguous.'
        : 'Sermon not found.',
      sermons.length ? 500 : 404,
    )
  }
  return sermons[0]
}

async function transitionUpload(
  database: TransactionDatabase,
  uploadDatabaseId: number,
  state: 'expired' | 'superseded' | 'internal',
) {
  const timestampColumn = state === 'expired'
    ? sql`"expired_at"`
    : state === 'superseded'
      ? sql`"superseded_at"`
      : sql`"internal_at"`
  await database.execute(sql`
    UPDATE "syncshow_sermon_media_uploads"
    SET
      "state" = ${state},
      ${timestampColumn} = now(),
      "finalization_lease_token_hash" = NULL,
      "finalization_lease_expires_at" = NULL,
      "updated_at" = now()
    WHERE "id" = ${uploadDatabaseId};
  `)
}

async function validateLiveUpload(
  database: TransactionDatabase,
  authority: SermonMediaAuthority,
  upload: UnknownRecord,
): Promise<SermonMediaError | null> {
  await recheckAuthority(database, authority)
  const state = String(upload.state) as SermonMediaUploadState
  if (
    ACTIVE_UPLOAD_STATES.includes(
      state as typeof ACTIVE_UPLOAD_STATES[number],
    )
    && sermonMediaSessionExpired(upload.expiresAt)
    && (
      state === 'uploading'
      || Date.parse(String(upload.finalizationLeaseExpiresAt || ''))
        <= Date.now()
    )
  ) {
    await transitionUpload(database, Number(upload.id), 'expired')
    upload.state = 'expired'
    return new SermonMediaError(
      'UPLOAD_EXPIRED',
      'This recording upload session expired.',
      410,
    )
  }
  if (state === 'expired') {
    return new SermonMediaError(
      'UPLOAD_EXPIRED',
      'This recording upload session expired.',
      410,
    )
  }

  let sermon: UnknownRecord
  try {
    sermon = await lockedSermon(
      database,
      authority.communityId,
      String(upload.syncId),
    )
    assertSermonMediaBinding(
      sermon,
      {
        syncId: String(upload.syncId),
        expectedSyncVersion: Number(upload.expectedSyncVersion),
        expectedCurrentRevision: String(upload.expectedCurrentRevision),
      },
      uploadRecording(upload),
    )
    if (Number(sermon.id) !== Number(upload.sermonId)) {
      throw new SermonMediaError(
        'STALE_SERMON_BINDING',
        'The sermon or recording no longer matches this upload.',
        412,
      )
    }
  } catch (error) {
    if (
      error instanceof SermonMediaError
      && ['SERMON_NOT_FOUND', 'STALE_SERMON_BINDING',
        'MEDIA_SLOT_NOT_FOUND', 'MEDIA_SLOT_CONFLICT',
        'SERMON_ARCHIVED'].includes(error.code)
    ) {
      if (!['cancelled', 'expired', 'internal'].includes(state)) {
        await transitionUpload(
          database,
          Number(upload.id),
          'superseded',
        )
        upload.state = 'superseded'
      }
      return new SermonMediaError(
        'STALE_SERMON_BINDING',
        'The sermon or recording no longer matches this upload.',
        412,
      )
    }
    throw error
  }
  return null
}

function initRequestHash(request: SermonMediaInitRequest) {
  return sermonMediaRequestHash('init', request)
}

export async function initializeSermonMediaUpload(
  req: PayloadRequest,
  authority: SermonMediaAuthority,
  rawRequest: SermonMediaInitRequest,
  idempotencyKey: string,
) {
  let cleanupUploadIds: string[] = []
  const admissionCleanupUploadIds =
    await expireDueSermonMediaAdmissionRows(req)
  const request = normalizeSermonMediaInitRequest(rawRequest)
  const idempotencyKeyHash = sermonMediaIdempotencyHash(
    authority.communityId,
    'init',
    idempotencyKey,
  )
  const requestHash = initRequestHash(request)
  let result: Outcome<{
    upload: SermonMediaUploadView
    created: boolean
  }>
  try {
    result = await inTransaction(req, async database => {
      await recheckAuthority(database, authority)
      await lockSermonMediaAdmission(database)
      // A client can lose the accepted init response before persisting the
      // upload ID. Peek without a row lock so we can lock the original sermon
      // before the upload row, then return that exact identity even if its
      // canonical binding has since become terminal.
      const replayCandidate = databaseRows(await database.execute(sql`
        SELECT ${uploadSelection()}
        FROM "syncshow_sermon_media_uploads"
        WHERE "init_idempotency_key_hash" = ${idempotencyKeyHash}
        LIMIT 2;
      `))
      if (replayCandidate.length > 1) {
        throw new SermonMediaError(
          'INVALID_UPLOAD_STATE',
          'Recording upload idempotency uniqueness was violated.',
          500,
        )
      }
      const candidate = replayCandidate[0]
      const lockedSyncId = candidate
        ? String(candidate.syncId)
        : request.sermon.syncId
      const lockedRecordingId = candidate
        ? String(candidate.recordingId)
        : request.recording.id
      let sermon: UnknownRecord | null = null
      try {
        sermon = await lockedSermon(
          database,
          authority.communityId,
          lockedSyncId,
        )
      } catch (error) {
        if (
          !candidate
          || !(error instanceof SermonMediaError)
          || error.code !== 'SERMON_NOT_FOUND'
        ) {
          throw error
        }
      }
      await database.execute(sql`
        SELECT pg_advisory_xact_lock(hashtextextended(
          ${[
            'heritage-sermon-media-active-slot-v1',
            authority.communityId,
            lockedSyncId,
            lockedRecordingId,
          ].join(':')},
          0
        ));
      `)
      const replay = databaseRows(await database.execute(sql`
        SELECT ${uploadSelection()}
        FROM "syncshow_sermon_media_uploads"
        WHERE "init_idempotency_key_hash" = ${idempotencyKeyHash}
        LIMIT 2
        FOR UPDATE;
      `))
      if (replay.length > 1) {
        throw new SermonMediaError(
          'INVALID_UPLOAD_STATE',
          'Recording upload idempotency uniqueness was violated.',
          500,
        )
      }
      if (replay.length === 1) {
        const upload = replay[0]
        if (
          Number(upload.communityId) !== authority.communityId
          || String(upload.initRequestHash) !== requestHash
        ) {
          throw new SermonMediaError(
            'IDEMPOTENCY_KEY_REUSED',
            'This Idempotency-Key was already used for a different recording upload.',
            409,
          )
        }
        const liveError = await validateLiveUpload(
          database,
          authority,
          upload,
        )
        if (liveError) {
          cleanupUploadIds = [String(upload.uploadId)]
          return { error: liveError } as Outcome<never>
        }
        if ([
          'internal',
          'cancelled',
          'superseded',
          'expired',
          'complete',
        ].includes(String(upload.state))) {
          cleanupUploadIds = [String(upload.uploadId)]
        }
        return {
          value: {
            upload: await uploadView(database, upload),
            created: false,
          },
        } as Outcome<{
          upload: SermonMediaUploadView
          created: boolean
        }>
      }
      if (!sermon) {
        throw new SermonMediaError(
          'SERMON_NOT_FOUND',
          'Sermon not found.',
          404,
        )
      }
      assertSermonMediaBinding(
        sermon,
        request.sermon,
        request.recording,
      )

      const existing = databaseRows(await database.execute(sql`
        SELECT ${uploadSelection()}
        FROM "syncshow_sermon_media_uploads"
        WHERE "community_id" = ${authority.communityId}
          AND "sermon_id" = ${Number(sermon.id)}
          AND "recording_id" = ${request.recording.id}
          AND "state" IN ('uploading', 'finalizing', 'complete')
      LIMIT 2
      FOR UPDATE;
    `))
    if (existing.length) {
      const sameBinding = existing.find(upload =>
        String(upload.syncId) === request.sermon.syncId
          && Number(upload.expectedSyncVersion)
            === request.sermon.expectedSyncVersion
          && String(upload.expectedCurrentRevision)
            === request.sermon.expectedCurrentRevision
          && String(upload.sha256) === request.recording.sha256
          && Number(upload.sizeBytes) === request.recording.sizeBytes
          && String(upload.mediaType) === request.recording.mediaType
          && String(upload.language) === request.recording.language
          && String(upload.fileName) === request.recording.fileName
          && (
            upload.durationSeconds === request.recording.durationSeconds
            || Number(upload.durationSeconds)
            === request.recording.durationSeconds
        )
      )
      if (sameBinding) {
        const liveError = await validateLiveUpload(
          database,
          authority,
          sameBinding,
        )
        if (liveError) {
          cleanupUploadIds = [String(sameBinding.uploadId)]
          return { error: liveError } as Outcome<never>
        }
        if (sameBinding.state === 'complete') {
          cleanupUploadIds = [String(sameBinding.uploadId)]
          return {
            value: {
              upload: await uploadView(database, sameBinding),
              created: false,
            },
          } as Outcome<{
            upload: SermonMediaUploadView
            created: boolean
          }>
        }
        if (
          sameBinding.state === 'finalizing'
          && Date.parse(
            String(sameBinding.finalizationLeaseExpiresAt || ''),
          ) > Date.now()
        ) {
          throw new SermonMediaError(
            'FINALIZATION_IN_PROGRESS',
            'The current recording is being finalized. Retry replacement shortly.',
            409,
            true,
            15,
          )
        }
        throw new SermonMediaError(
          'UPLOAD_ALREADY_EXISTS',
          'This exact sermon recording is active under another Idempotency-Key. Resume only with the upload ID and attempt identity already held by that operation.',
          409,
        )
      }
      const leasedFinalization = existing.find(upload =>
        upload.state === 'finalizing'
        && Date.parse(String(upload.finalizationLeaseExpiresAt || ''))
          > Date.now()
      )
      if (leasedFinalization) {
        throw new SermonMediaError(
          'FINALIZATION_IN_PROGRESS',
          'The current recording is being finalized. Retry replacement shortly.',
          409,
          true,
          15,
        )
      }
      cleanupUploadIds = existing.map(upload => String(upload.uploadId))
      }
      await database.execute(sql`
        UPDATE "syncshow_sermon_media_uploads"
        SET
          "state" = 'superseded',
          "superseded_at" = now(),
          "finalization_lease_token_hash" = NULL,
          "finalization_lease_expires_at" = NULL,
          "updated_at" = now()
        WHERE "community_id" = ${authority.communityId}
          AND "sermon_id" = ${Number(sermon.id)}
          AND "recording_id" = ${request.recording.id}
          AND "state" IN ('uploading', 'finalizing', 'complete');
      `)
      cleanupUploadIds.push(
        ...await enforceSermonMediaAdmission(database, authority, request),
      )

      const uploadId = createOpaqueToken()
      const expiresAt = new Date(
        Date.now() + SERMON_MEDIA_SESSION_TTL_SECONDS * 1000,
      ).toISOString()
      const inserted = databaseRows(await database.execute(sql`
        INSERT INTO "syncshow_sermon_media_uploads" (
          "upload_id",
          "community_id",
          "connection_id",
          "sermon_id",
          "schema_version",
          "state",
          "sync_id",
          "expected_sync_version",
          "expected_current_revision",
          "recording_id",
          "kind",
          "language",
          "media_type",
          "file_name",
          "sha256",
          "size_bytes",
          "duration_seconds",
          "chunk_size_bytes",
          "chunk_count",
          "staging_key",
          "init_idempotency_key_hash",
          "init_request_hash",
          "expires_at",
          "updated_at",
          "created_at"
        ) VALUES (
          ${uploadId},
          ${authority.communityId},
          ${authority.connectionId},
          ${Number(sermon.id)},
          ${SERMON_MEDIA_SCHEMA_VERSION},
          'uploading',
          ${request.sermon.syncId},
          ${request.sermon.expectedSyncVersion},
          ${request.sermon.expectedCurrentRevision},
          ${request.recording.id},
          ${request.recording.kind},
          ${request.recording.language},
          ${request.recording.mediaType},
          ${request.recording.fileName},
          ${request.recording.sha256},
          ${request.recording.sizeBytes},
          ${request.recording.durationSeconds},
          ${SERMON_MEDIA_CHUNK_SIZE_BYTES},
          ${sermonMediaChunkCount(request.recording.sizeBytes)},
          ${sermonMediaStagingKey(uploadId)},
          ${idempotencyKeyHash},
          ${requestHash},
          ${expiresAt},
          now(),
          now()
        )
        RETURNING ${uploadSelection()};
      `))
      if (inserted.length !== 1) {
        throw new SermonMediaError(
          'INVALID_UPLOAD_STATE',
          'The recording upload was not created atomically.',
          500,
        )
      }
      return {
        value: {
          upload: await uploadView(database, inserted[0]),
          created: true,
        },
      } as Outcome<{
        upload: SermonMediaUploadView
        created: boolean
      }>
    })
  } finally {
    for (const uploadId of admissionCleanupUploadIds) {
      await cleanupTerminalStaging(uploadId)
    }
  }
  for (const uploadId of cleanupUploadIds) {
    await cleanupTerminalStaging(uploadId)
  }
  return unwrap(result)
}

export async function getSermonMediaUpload(
  req: PayloadRequest,
  authority: SermonMediaAuthority,
  uploadId: string,
) {
  const result = await inTransaction(req, async database => {
    const upload = await lockedAuthorizedUpload(
      database,
      authority,
      uploadId,
    )
    const liveError = await validateLiveUpload(
      database,
      authority,
      upload,
    )
    if (liveError) return { error: liveError } as Outcome<never>
    return {
      value: await uploadView(database, upload),
    } as Outcome<SermonMediaUploadView>
  })
  return await cleanupForTerminalOutcome(result, uploadId)
}

function chunkRequestHash(
  uploadId: string,
  headers: SermonMediaChunkHeaders,
) {
  return sermonMediaRequestHash('chunk', {
    uploadId,
    index: headers.index,
    startByte: headers.startByte,
    endByte: headers.endByte,
    totalBytes: headers.totalBytes,
    sizeBytes: headers.sizeBytes,
    sha256: headers.sha256,
  })
}

function chunkRecord(value: UnknownRecord): SermonMediaChunkRecord {
  return Object.freeze({
    index: Number(value.index),
    startByte: Number(value.startByte),
    endByte: Number(value.endByte),
    sizeBytes: Number(value.sizeBytes),
    sha256: String(value.sha256),
    storageKey: String(value.storageKey),
    receivedAt: new Date(String(value.receivedAt)).toISOString(),
  })
}

/**
 * Store and register one bounded chunk while holding the upload row lock.
 * Cancellation/replacement therefore waits for the file rename and matching
 * database row to commit. If the process dies after rename but before commit,
 * the deterministic file is verified and reused by the idempotent retry.
 */
export async function putSermonMediaChunk(
  req: PayloadRequest,
  authority: SermonMediaAuthority,
  uploadId: string,
  rawHeaders: SermonMediaChunkRequestHeaders,
  idempotencyKey: string,
  store: (
    headers: SermonMediaChunkHeaders,
  ) => Promise<StoredSermonMediaChunk>,
) {
  const releaseRequestSlot = acquireSermonMediaChunkRequestSlot(
    authority.connectionId,
  )
  try {
  const normalizedUploadId = normalizeUploadId(uploadId)
  const result = await inTransaction(req, async database => {
    await database.execute(sql`SET LOCAL lock_timeout = '5s';`)
    const upload = await lockedAuthorizedUpload(
      database,
      authority,
      normalizedUploadId,
    )
    const liveError = await validateLiveUpload(
      database,
      authority,
      upload,
    )
    if (liveError) return { error: liveError } as Outcome<never>
    const headers = normalizeSermonMediaChunkHeaders({
      ...rawHeaders,
      totalSizeBytes: Number(upload.sizeBytes),
    })
    const idempotencyKeyHash = sermonMediaIdempotencyHash(
      authority.communityId,
      `chunk:${normalizedUploadId}:${headers.index}`,
      idempotencyKey,
    )
    const requestHash = chunkRequestHash(normalizedUploadId, headers)
    if (upload.state !== 'uploading') {
      throw new SermonMediaError(
        'UPLOAD_NOT_RECEIVING',
        'This recording upload is not accepting chunks.',
        409,
        upload.state === 'finalizing',
      )
    }
    const expected = expectedSermonMediaChunk(
      Number(upload.sizeBytes),
      headers.index,
    )
    if (
      expected.startByte !== headers.startByte
      || expected.endByte !== headers.endByte
      || expected.totalBytes !== headers.totalBytes
      || expected.sizeBytes !== headers.sizeBytes
    ) {
      throw new SermonMediaError(
        'INVALID_CONTENT_RANGE',
        'The chunk range does not match this upload.',
        422,
      )
    }
    const byKey = databaseRows(await database.execute(sql`
      SELECT
        "chunk_index" AS "index",
        "start_byte" AS "startByte",
        "end_byte" AS "endByte",
        "size_bytes" AS "sizeBytes",
        "sha256",
        "storage_key" AS "storageKey",
        "received_at" AS "receivedAt",
        "request_hash" AS "requestHash",
        "upload_id" AS "uploadDatabaseId"
      FROM "syncshow_sermon_media_chunks"
      WHERE "idempotency_key_hash" = ${idempotencyKeyHash}
      LIMIT 2
      FOR UPDATE;
    `))
    if (byKey.length > 1) {
      throw new SermonMediaError(
        'INVALID_CHUNK_STATE',
        'Recording chunk idempotency uniqueness was violated.',
        500,
      )
    }
    if (byKey.length === 1) {
      if (
        Number(byKey[0].uploadDatabaseId) !== Number(upload.id)
        || Number(byKey[0].index) !== headers.index
        || String(byKey[0].requestHash) !== requestHash
      ) {
        throw new SermonMediaError(
          'IDEMPOTENCY_KEY_REUSED',
          'This Idempotency-Key was already used for a different recording chunk.',
          409,
        )
      }
      return {
        value: {
          chunk: chunkRecord(byKey[0]),
          upload: await uploadView(database, upload),
          created: false,
        },
      } as Outcome<{
        chunk: SermonMediaChunkRecord
        upload: SermonMediaUploadView
        created: boolean
      }>
    }
    const byIndex = databaseRows(await database.execute(sql`
      SELECT "id"
      FROM "syncshow_sermon_media_chunks"
      WHERE "upload_id" = ${Number(upload.id)}
        AND "chunk_index" = ${headers.index}
      LIMIT 2
      FOR UPDATE;
    `))
    if (byIndex.length) {
      throw new SermonMediaError(
        'CHUNK_ALREADY_EXISTS',
        'This chunk index was already stored. Retry with its original Idempotency-Key.',
        409,
      )
    }

    await enforceSermonMediaStorageReserve(database)
    const stored = await store(headers)
    if (
      stored.sha256 !== headers.sha256
      || stored.sizeBytes !== headers.sizeBytes
      || stored.storageKey !== sermonMediaChunkKey(
        normalizedUploadId,
        headers.index,
        headers.sha256,
      )
    ) {
      throw new SermonMediaError(
        'INVALID_CHUNK_STATE',
        'The verified chunk does not match its request.',
        500,
      )
    }
    const inserted = databaseRows(await database.execute(sql`
      INSERT INTO "syncshow_sermon_media_chunks" (
        "upload_id",
        "chunk_index",
        "start_byte",
        "end_byte",
        "size_bytes",
        "sha256",
        "storage_key",
        "idempotency_key_hash",
        "request_hash",
        "received_at",
        "updated_at",
        "created_at"
      ) VALUES (
        ${Number(upload.id)},
        ${headers.index},
        ${headers.startByte},
        ${headers.endByte},
        ${headers.sizeBytes},
        ${headers.sha256},
        ${stored.storageKey},
        ${idempotencyKeyHash},
        ${requestHash},
        now(),
        now(),
        now()
      )
      RETURNING
        "chunk_index" AS "index",
        "start_byte" AS "startByte",
        "end_byte" AS "endByte",
        "size_bytes" AS "sizeBytes",
        "sha256",
        "storage_key" AS "storageKey",
        "received_at" AS "receivedAt";
    `))
    if (inserted.length !== 1) {
      throw new SermonMediaError(
        'INVALID_CHUNK_STATE',
        'The recording chunk was not recorded atomically.',
        500,
      )
    }
    return {
      value: {
        chunk: chunkRecord(inserted[0]),
        upload: await uploadView(database, upload),
        created: true,
      },
    } as Outcome<{
      chunk: SermonMediaChunkRecord
      upload: SermonMediaUploadView
      created: boolean
    }>
  })
  return await cleanupForTerminalOutcome(result, normalizedUploadId)
  } catch (error) {
    if ((error as { code?: unknown })?.code === '55P03') {
      throw new SermonMediaError(
        'CHUNK_LOCK_CAPACITY',
        'The recording upload is busy. Retry this chunk shortly.',
        429,
        true,
        5,
      )
    }
    throw error
  } finally {
    releaseRequestSlot()
  }
}

function completeRequestHash(uploadId: string) {
  return sermonMediaRequestHash('complete', {
    schemaVersion: SERMON_MEDIA_SCHEMA_VERSION,
    uploadId,
  })
}

type FinalizationClaim = Readonly<{
  replay: boolean
  inProgress?: boolean
  upload: SermonMediaUploadView
  uploadDatabaseId?: number
  leaseToken?: string
  chunks?: readonly SermonMediaChunkRecord[]
  recording?: SermonMediaRecording
}>

function completeSermonMediaChunks(
  upload: UnknownRecord,
  chunks: readonly UnknownRecord[],
) {
  const expectedCount = Number(upload.chunkCount)
  return chunks.length === expectedCount
    && chunks.every((chunk, index) => {
      const expected = expectedSermonMediaChunk(
        Number(upload.sizeBytes),
        index,
      )
      return Number(chunk.index) === index
        && Number(chunk.startByte) === expected.startByte
        && Number(chunk.endByte) === expected.endByte
        && Number(chunk.sizeBytes) === expected.sizeBytes
    })
}

async function claimSermonMediaFinalization(
  req: PayloadRequest,
  authority: SermonMediaAuthority,
  uploadId: string,
  idempotencyKey: string,
): Promise<FinalizationClaim> {
  const keyHash = sermonMediaIdempotencyHash(
    authority.communityId,
    `complete:${uploadId}`,
    idempotencyKey,
  )
  const requestHash = completeRequestHash(uploadId)
  const result = await inTransaction(req, async database => {
    const upload = await lockedAuthorizedUpload(
      database,
      authority,
      uploadId,
    )
    const liveError = await validateLiveUpload(
      database,
      authority,
      upload,
    )
    if (liveError) return { error: liveError } as Outcome<never>
    if (upload.state === 'complete') {
      if (
        upload.completeIdempotencyKeyHash !== keyHash
        || upload.completeRequestHash !== requestHash
      ) {
        throw new SermonMediaError(
          'UPLOAD_ALREADY_COMPLETE',
          'This recording upload is complete. Retry with its original Idempotency-Key.',
          409,
        )
      }
      return {
        value: {
          replay: true,
          upload: await uploadView(database, upload),
        },
      } as Outcome<FinalizationClaim>
    }
    if (upload.state === 'cancelled') {
      throw new SermonMediaError(
        'UPLOAD_CANCELLED',
        'This recording upload was cancelled.',
        409,
      )
    }
    if (upload.state === 'internal') {
      throw new SermonMediaError(
        'UPLOAD_INTERNAL',
        'This recording upload requires administrator attention.',
        500,
      )
    }
    if (!ACTIVE_UPLOAD_STATES.includes(
      upload.state as typeof ACTIVE_UPLOAD_STATES[number],
    )) {
      throw new SermonMediaError(
        'UPLOAD_NOT_FINALIZABLE',
        'This recording upload cannot be completed.',
        409,
      )
    }
    const chunks = await uploadChunks(database, Number(upload.id))
    if (!completeSermonMediaChunks(upload, chunks)) {
      throw new SermonMediaError(
        'UPLOAD_INCOMPLETE',
        'Every recording chunk must be uploaded before completion.',
        409,
        true,
      )
    }
    if (upload.state === 'finalizing') {
      if (
        upload.completeIdempotencyKeyHash !== keyHash
        || upload.completeRequestHash !== requestHash
      ) {
        throw new SermonMediaError(
          'FINALIZATION_IN_PROGRESS',
          'This recording upload is already being finalized.',
          409,
          true,
        )
      }
      if (
        Date.parse(String(upload.finalizationLeaseExpiresAt || ''))
          > Date.now()
      ) {
        return {
          value: {
            replay: false,
            inProgress: true,
            upload: await uploadView(database, upload),
          },
        } as Outcome<FinalizationClaim>
      }
    }
    await enforceSermonMediaStorageReserve(database)
    await enforceFinalizationAdmission(database)
    const leaseToken = randomBytes(32).toString('base64url')
    const leaseHash = createHash('sha256').update(leaseToken).digest('hex')
    const leaseExpiresAt = new Date(
      Date.now() + FINALIZATION_LEASE_SECONDS * 1000,
    ).toISOString()
    await database.execute(sql`
      UPDATE "syncshow_sermon_media_uploads"
      SET
        "state" = 'finalizing',
        "complete_idempotency_key_hash" = ${keyHash},
        "complete_request_hash" = ${requestHash},
        "finalization_lease_token_hash" = ${leaseHash},
        "finalization_lease_expires_at" = ${leaseExpiresAt},
        "updated_at" = now()
      WHERE "id" = ${Number(upload.id)};
    `)
    upload.state = 'finalizing'
    upload.completeIdempotencyKeyHash = keyHash
    upload.completeRequestHash = requestHash
    upload.finalizationLeaseTokenHash = leaseHash
    upload.finalizationLeaseExpiresAt = leaseExpiresAt
    return {
      value: {
        replay: false,
        upload: await uploadView(database, upload),
        uploadDatabaseId: Number(upload.id),
        leaseToken,
        chunks: chunks.map(chunkRecord),
        recording: uploadRecording(upload),
      },
    } as Outcome<FinalizationClaim>
  })
  return await cleanupForTerminalOutcome(result, uploadId)
}

async function markSermonMediaInternal(
  req: PayloadRequest,
  authority: SermonMediaAuthority,
  uploadId: string,
) {
  await inTransaction(req, async database => {
    const upload = await lockedAuthorizedUpload(
      database,
      authority,
      uploadId,
    )
    if (upload.state === 'finalizing') {
      await transitionUpload(database, Number(upload.id), 'internal')
    }
  })
  await cleanupTerminalStaging(uploadId)
}

async function finishSermonMediaFinalization(
  req: PayloadRequest,
  authority: SermonMediaAuthority,
  uploadId: string,
  leaseToken: string,
  object: StoredSermonMediaObject,
) {
  if (!await verifySermonMediaObject(object)) {
    throw new SermonMediaError(
      'STORAGE_VERIFICATION_FAILED',
      'The completed recording failed private-storage verification.',
      500,
    )
  }
  const leaseHash = createHash('sha256').update(leaseToken).digest('hex')
  const result = await inTransaction(req, async database => {
    const upload = await lockedAuthorizedUpload(
      database,
      authority,
      uploadId,
    )
    const liveError = await validateLiveUpload(
      database,
      authority,
      upload,
    )
    if (liveError) return { error: liveError } as Outcome<never>
    if (upload.state === 'complete') {
      return {
        value: await uploadView(database, upload),
      } as Outcome<SermonMediaUploadView>
    }
    if (
      upload.state !== 'finalizing'
      || upload.finalizationLeaseTokenHash !== leaseHash
    ) {
      throw new SermonMediaError(
        'FINALIZATION_LEASE_LOST',
        'The recording finalization lease is no longer current.',
        409,
        true,
      )
    }
    if (
      object.sha256 !== upload.sha256
      || object.sizeBytes !== Number(upload.sizeBytes)
    ) {
      await transitionUpload(database, Number(upload.id), 'internal')
      return {
        error: new SermonMediaError(
          'OBJECT_HASH_MISMATCH',
          'The complete recording does not match the sermon slot.',
          422,
        ),
      } as Outcome<never>
    }
    const objects = databaseRows(await database.execute(sql`
      INSERT INTO "syncshow_sermon_media_objects" (
        "community_id",
        "sha256",
        "size_bytes",
        "media_type",
        "storage_key",
        "verified_at",
        "updated_at",
        "created_at"
      ) VALUES (
        ${authority.communityId},
        ${object.sha256},
        ${object.sizeBytes},
        ${String(upload.mediaType)},
        ${object.storageKey},
        now(),
        now(),
        now()
      )
      ON CONFLICT ("community_id", "sha256") DO UPDATE
      SET "verified_at" = now(), "updated_at" = now()
      RETURNING
        "id",
        "community_id" AS "communityId",
        "sha256",
        "size_bytes" AS "sizeBytes",
        "media_type" AS "mediaType",
        "storage_key" AS "storageKey";
    `))
    if (
      objects.length !== 1
      || Number(objects[0].communityId) !== authority.communityId
      || objects[0].sha256 !== object.sha256
      || Number(objects[0].sizeBytes) !== object.sizeBytes
      || objects[0].mediaType !== upload.mediaType
      || objects[0].storageKey !== object.storageKey
    ) {
      await transitionUpload(database, Number(upload.id), 'internal')
      return {
        error: new SermonMediaError(
          'INVALID_OBJECT_STATE',
          'Private recording object identity is inconsistent.',
          500,
        ),
      } as Outcome<never>
    }
    const completed = databaseRows(await database.execute(sql`
      UPDATE "syncshow_sermon_media_uploads"
      SET
        "state" = 'complete',
        "object_id" = ${Number(objects[0].id)},
        "completed_at" = now(),
        "finalization_lease_token_hash" = NULL,
        "finalization_lease_expires_at" = NULL,
        "updated_at" = now()
      WHERE "id" = ${Number(upload.id)}
      RETURNING ${uploadSelection()};
    `))
    if (completed.length !== 1) {
      throw new SermonMediaError(
        'INVALID_UPLOAD_STATE',
        'The recording upload was not completed atomically.',
        500,
      )
    }
    return {
      value: await uploadView(database, completed[0]),
    } as Outcome<SermonMediaUploadView>
  })
  return await cleanupForTerminalOutcome(result, uploadId)
}

type SermonMediaFinalizationJob = Readonly<{
  payload: Payload
  authority: SermonMediaAuthority
  uploadId: string
  uploadDatabaseId: number
  leaseToken: string
  chunks: readonly SermonMediaChunkRecord[]
  recording: SermonMediaRecording
}>

const FINALIZATION_WORKER_KEY = '__heritageSermonMediaFinalizationWorker'
type FinalizationWorkerState = {
  running: boolean
  queue: SermonMediaFinalizationJob[]
}

function finalizationWorkerState() {
  const shared = globalThis as typeof globalThis & {
    [FINALIZATION_WORKER_KEY]?: FinalizationWorkerState
  }
  shared[FINALIZATION_WORKER_KEY] ??= {
    running: false,
    queue: [],
  }
  return shared[FINALIZATION_WORKER_KEY]
}

function finalizationRequest(payload: Payload) {
  return {
    headers: new Headers(),
    payload,
    routeParams: {},
    transactionID: undefined,
  } as PayloadRequest
}

async function runSermonMediaFinalization(
  job: SermonMediaFinalizationJob,
) {
  const req = finalizationRequest(job.payload)
  let object: StoredSermonMediaObject
  try {
    object = await assembleSermonMediaObject({
      uploadId: job.uploadId,
      communityNamespace: sermonMediaCommunityNamespace(
        job.authority.communityId,
      ),
      chunks: job.chunks,
      expectedSha256: job.recording.sha256,
      expectedSizeBytes: job.recording.sizeBytes,
      expectedMediaType: job.recording.mediaType,
    })
  } catch (error) {
    if (
      error instanceof SermonMediaError
      && [
        'OBJECT_HASH_MISMATCH',
        'OBJECT_LENGTH_MISMATCH',
        'INVALID_MEDIA_CONTAINER',
      ].includes(error.code)
    ) {
      await markSermonMediaInternal(
        req,
        job.authority,
        job.uploadId,
      ).catch(() => undefined)
    }
    throw error
  }
  await finishSermonMediaFinalization(
    req,
    job.authority,
    job.uploadId,
    job.leaseToken,
    object,
  )
  await cleanupTerminalStaging(job.uploadId)
}

async function drainSermonMediaFinalizationQueue(
  state: FinalizationWorkerState,
) {
  try {
    while (state.queue.length) {
      const job = state.queue.shift() as SermonMediaFinalizationJob
      try {
        await runSermonMediaFinalization(job)
      } catch (error) {
        job.payload.logger.error(
          {
            err: error,
            sermonMediaUploadId: job.uploadId,
            sermonMediaUploadDatabaseId: job.uploadDatabaseId,
          },
          'Private sermon-media background finalization failed',
        )
      }
    }
  } finally {
    state.running = false
  }
}

function enqueueSermonMediaFinalization(
  job: SermonMediaFinalizationJob,
) {
  const state = finalizationWorkerState()
  state.queue.push(job)
  if (state.running) return
  state.running = true
  setImmediate(() => {
    void drainSermonMediaFinalizationQueue(state)
  })
}

export type SermonMediaCompletionAcceptance = Readonly<{
  upload: SermonMediaUploadView
  accepted: boolean
}>

export async function completeSermonMediaUpload(
  req: PayloadRequest,
  authority: SermonMediaAuthority,
  uploadId: string,
  idempotencyKey: string,
) {
  const claim = await claimSermonMediaFinalization(
    req,
    authority,
    normalizeUploadId(uploadId),
    idempotencyKey,
  )
  if (claim.replay) {
    await cleanupTerminalStaging(uploadId)
    return Object.freeze({
      upload: claim.upload,
      accepted: false,
    })
  }
  if (!claim.inProgress) {
    enqueueSermonMediaFinalization(Object.freeze({
      payload: req.payload,
      authority,
      uploadId,
      uploadDatabaseId: claim.uploadDatabaseId as number,
      leaseToken: claim.leaseToken as string,
      chunks: claim.chunks as readonly SermonMediaChunkRecord[],
      recording: claim.recording as SermonMediaRecording,
    }))
  }
  return Object.freeze({
    upload: claim.upload,
    accepted: true,
  })
}

function cancelRequestHash(uploadId: string) {
  return sermonMediaRequestHash('cancel', { uploadId })
}

export async function cancelSermonMediaUpload(
  req: PayloadRequest,
  authority: SermonMediaAuthority,
  uploadId: string,
  idempotencyKey: string,
) {
  const normalizedUploadId = normalizeUploadId(uploadId)
  const keyHash = sermonMediaIdempotencyHash(
    authority.communityId,
    `cancel:${normalizedUploadId}`,
    idempotencyKey,
  )
  const requestHash = cancelRequestHash(normalizedUploadId)
  const result = await inTransaction(req, async database => {
    const upload = await lockedAuthorizedUpload(
      database,
      authority,
      normalizedUploadId,
    )
    const liveError = await validateLiveUpload(
      database,
      authority,
      upload,
    )
    if (liveError) return { error: liveError } as Outcome<never>
    if (upload.state === 'cancelled') {
      if (
        upload.cancelIdempotencyKeyHash !== keyHash
        || upload.cancelRequestHash !== requestHash
      ) {
        throw new SermonMediaError(
          'UPLOAD_CANCELLED',
          'This recording upload was cancelled. Retry with its original Idempotency-Key.',
          409,
        )
      }
      return {
        value: await uploadView(database, upload),
      } as Outcome<SermonMediaUploadView>
    }
    if (upload.state === 'complete') {
      throw new SermonMediaError(
        'UPLOAD_ALREADY_COMPLETE',
        'A completed private recording cannot be cancelled.',
        409,
      )
    }
    if (
      upload.state === 'finalizing'
      && Date.parse(String(upload.finalizationLeaseExpiresAt || ''))
        > Date.now()
    ) {
      throw new SermonMediaError(
        'FINALIZATION_IN_PROGRESS',
        'This recording is being finalized. Retry cancellation shortly.',
        409,
        true,
        15,
      )
    }
    if (upload.state === 'internal') {
      throw new SermonMediaError(
        'UPLOAD_INTERNAL',
        'This recording upload requires administrator attention.',
        500,
      )
    }
    if (!ACTIVE_UPLOAD_STATES.includes(
      upload.state as typeof ACTIVE_UPLOAD_STATES[number],
    )) {
      throw new SermonMediaError(
        'UPLOAD_NOT_CANCELLABLE',
        'This recording upload cannot be cancelled.',
        409,
      )
    }
    const cancelled = databaseRows(await database.execute(sql`
      UPDATE "syncshow_sermon_media_uploads"
      SET
        "state" = 'cancelled',
        "cancel_idempotency_key_hash" = ${keyHash},
        "cancel_request_hash" = ${requestHash},
        "cancelled_at" = now(),
        "finalization_lease_token_hash" = NULL,
        "finalization_lease_expires_at" = NULL,
        "updated_at" = now()
      WHERE "id" = ${Number(upload.id)}
      RETURNING ${uploadSelection()};
    `))
    if (cancelled.length !== 1) {
      throw new SermonMediaError(
        'INVALID_UPLOAD_STATE',
        'The recording upload was not cancelled atomically.',
        500,
      )
    }
    return {
      value: await uploadView(database, cancelled[0]),
    } as Outcome<SermonMediaUploadView>
  })
  const value = await cleanupForTerminalOutcome(
    result,
    normalizedUploadId,
  )
  await cleanupTerminalStaging(normalizedUploadId)
  return value
}

export type SermonMediaMaintenanceStatus = Readonly<{
  expiredUploads: number
  cleanedStaging: number
  activeUploads: number
  finalizingUploads: number
  reservedBytes: number
  retainedObjects: number
  retainedBytes: number
}>

async function inPayloadTransaction<T>(
  payload: Payload,
  operation: (database: TransactionDatabase) => Promise<T>,
) {
  const adapter = payload.db as unknown as TransactionAdapter
  const transactionId = await adapter.beginTransaction()
  if (transactionId === null || transactionId === undefined) {
    throw new SermonMediaError(
      'TRANSACTION_UNAVAILABLE',
      'Atomic recording maintenance is temporarily unavailable.',
      503,
      true,
    )
  }
  const database = adapter.sessions?.[String(transactionId)]?.db
  if (!database) {
    await adapter.rollbackTransaction(transactionId)
    throw new SermonMediaError(
      'TRANSACTION_UNAVAILABLE',
      'Atomic recording maintenance is temporarily unavailable.',
      503,
      true,
    )
  }
  try {
    const result = await operation(database)
    await adapter.commitTransaction(transactionId)
    return result
  } catch (error) {
    await adapter.rollbackTransaction(transactionId)
    throw error
  }
}

export async function recoverSermonMediaFinalization(
  payload: Payload,
) {
  const finalizationEnabled = sermonMediaEnabled()
  let cleanupUploadId: string | null = null
  const outcome = await inPayloadTransaction(payload, async database => {
    // This is a non-locking identity peek. Recovery then locks
    // connection/membership -> sermon -> upload before replacing the lease or
    // expiring an upload whose original authority is definitively invalid.
    const candidates = databaseRows(await database.execute(sql`
      SELECT
        "upload"."upload_id" AS "uploadId",
        "upload"."community_id" AS "communityId",
        "upload"."connection_id" AS "connectionId",
        "upload"."sync_id" AS "syncId",
        "connection"."user_id" AS "userId"
      FROM "syncshow_sermon_media_uploads" AS "upload"
      JOIN "syncshow_connections" AS "connection"
        ON "connection"."id" = "upload"."connection_id"
      WHERE "upload"."state" = 'finalizing'
        AND "upload"."finalization_lease_expires_at" <= now()
      ORDER BY
        "upload"."finalization_lease_expires_at",
        "upload"."id"
      LIMIT 1;
    `))
    if (!candidates.length) {
      return { value: null } as Outcome<SermonMediaFinalizationJob | null>
    }
    const candidate = candidates[0]
    const authority: SermonMediaAuthority = Object.freeze({
      connectionId: Number(candidate.connectionId),
      communityId: Number(candidate.communityId),
      userId: Number(candidate.userId),
      mode: 'write',
    })
    const uploadId = String(candidate.uploadId)
    const connections = databaseRows(await database.execute(sql`
      SELECT
        "id",
        "scopes",
        "revoked_at" AS "revokedAt",
        ("expires_at" > now()) AS "unexpired"
      FROM "syncshow_connections"
      WHERE "id" = ${authority.connectionId}
        AND "community_id" = ${authority.communityId}
        AND "user_id" = ${authority.userId}
      LIMIT 2
      FOR UPDATE;
    `))
    let authorityValid = connections.length === 1
      && !connections[0].revokedAt
      && (
        connections[0].unexpired === true
        || connections[0].unexpired === 'true'
      )
    if (authorityValid) {
      try {
        requireScopes(connections[0].scopes, 'write')
      } catch {
        authorityValid = false
      }
    }
    const memberships = databaseRows(await database.execute(sql`
      SELECT "id"
      FROM "memberships"
      WHERE "community_id" = ${authority.communityId}
        AND "user_id" = ${authority.userId}
        AND "role" IN ('owner', 'admin', 'leader')
      LIMIT 2
      FOR UPDATE;
    `))
    if (memberships.length !== 1) authorityValid = false
    try {
      await lockedSermon(
        database,
        authority.communityId,
        String(candidate.syncId),
      )
    } catch (error) {
      if (
        !(error instanceof SermonMediaError)
        || error.code !== 'SERMON_NOT_FOUND'
      ) {
        throw error
      }
    }
    const upload = await lockedUpload(
      database,
      authority,
      uploadId,
    )
    if (
      upload.state !== 'finalizing'
      || Date.parse(String(upload.finalizationLeaseExpiresAt || ''))
        > Date.now()
    ) {
      return { value: null } as Outcome<SermonMediaFinalizationJob | null>
    }
    if (!authorityValid) {
      await transitionUpload(database, Number(upload.id), 'expired')
      cleanupUploadId = uploadId
      return { value: null } as Outcome<SermonMediaFinalizationJob | null>
    }
    // Feature shutdown must never restart object assembly. We still classify
    // and clean a stale lease whose original authority is definitively gone,
    // above, so revocation cannot leave quiesced backup blocked forever.
    if (!finalizationEnabled) {
      return { value: null } as Outcome<SermonMediaFinalizationJob | null>
    }
    const liveError = await validateLiveUpload(
      database,
      authority,
      upload,
    )
    if (liveError) {
      cleanupUploadId = uploadId
      return { error: liveError } as Outcome<never>
    }
    const chunks = await uploadChunks(database, Number(upload.id))
    if (!completeSermonMediaChunks(upload, chunks)) {
      await transitionUpload(database, Number(upload.id), 'internal')
      cleanupUploadId = uploadId
      return {
        error: new SermonMediaError(
          'UPLOAD_INCOMPLETE',
          'A claimed recording finalization no longer has every chunk.',
          500,
        ),
      } as Outcome<never>
    }
    await enforceSermonMediaStorageReserve(database)
    await enforceFinalizationAdmission(database)
    const leaseToken = randomBytes(32).toString('base64url')
    const leaseHash = createHash('sha256').update(leaseToken).digest('hex')
    const leaseExpiresAt = new Date(
      Date.now() + FINALIZATION_LEASE_SECONDS * 1000,
    ).toISOString()
    await database.execute(sql`
      UPDATE "syncshow_sermon_media_uploads"
      SET
        "finalization_lease_token_hash" = ${leaseHash},
        "finalization_lease_expires_at" = ${leaseExpiresAt},
        "updated_at" = now()
      WHERE "id" = ${Number(upload.id)};
    `)
    return {
      value: Object.freeze({
        payload,
        authority,
        uploadId,
        uploadDatabaseId: Number(upload.id),
        leaseToken,
        chunks: chunks.map(chunkRecord),
        recording: uploadRecording(upload),
      }),
    } as Outcome<SermonMediaFinalizationJob>
  })
  if (cleanupUploadId) {
    await cleanupTerminalStaging(cleanupUploadId)
  }
  if ('error' in outcome || !outcome.value) return false
  enqueueSermonMediaFinalization(outcome.value)
  return true
}

export async function sermonMediaMaintenanceTablesReady(
  payload: Payload,
) {
  return await inPayloadTransaction(payload, async database => {
    const rows = databaseRows(await database.execute(sql`
      SELECT to_regclass(
        'public.syncshow_sermon_media_uploads'
      ) IS NOT NULL AS "ready";
    `))
    return rows.length === 1
      && (rows[0].ready === true || rows[0].ready === 'true')
  })
}

/**
 * Runtime cleanup is deliberately bounded and SKIP LOCKED. It never expires a
 * live finalization lease or removes completed objects. Expiry commits before
 * a second transaction locks terminal rows and removes confined staging, so a
 * crash can leave cleanup pending for retry but cannot roll an upload back to
 * an active state after its staging bytes have been deleted.
 */
export async function sweepSermonMediaUploads(
  payload: Payload,
  limit = 32,
): Promise<SermonMediaMaintenanceStatus> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 256) {
    throw new SermonMediaError(
      'INVALID_MAINTENANCE_LIMIT',
      'The sermon-media maintenance batch must be between 1 and 256.',
      500,
    )
  }
  const expiredUploads = await inPayloadTransaction(
    payload,
    async database => {
      const expired = databaseRows(await database.execute(sql`
        WITH "candidates" AS (
          SELECT "id"
          FROM "syncshow_sermon_media_uploads"
          WHERE "expires_at" <= now()
            AND (
              "state" = 'uploading'
              OR (
                "state" = 'finalizing'
                AND "finalization_lease_expires_at" <= now()
              )
            )
          ORDER BY "expires_at", "id"
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        )
        UPDATE "syncshow_sermon_media_uploads" AS "upload"
        SET
          "state" = 'expired',
          "expired_at" = now(),
          "finalization_lease_token_hash" = NULL,
          "finalization_lease_expires_at" = NULL,
          "updated_at" = now()
        FROM "candidates"
        WHERE "upload"."id" = "candidates"."id"
        RETURNING "upload"."upload_id" AS "uploadId";
      `))
      return expired.length
    },
  )
  return await inPayloadTransaction(payload, async database => {
    const terminal = databaseRows(await database.execute(sql`
      SELECT "id", "upload_id" AS "uploadId"
      FROM "syncshow_sermon_media_uploads"
      WHERE "state" IN (
          'internal',
          'complete',
          'cancelled',
          'superseded',
          'expired'
        )
        AND "staging_cleaned_at" IS NULL
      ORDER BY "updated_at", "id"
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit};
    `))
    for (const upload of terminal) {
      await cleanupSermonMediaStaging(String(upload.uploadId))
      await database.execute(sql`
        UPDATE "syncshow_sermon_media_uploads"
        SET
          "staging_cleaned_at" = now(),
          "updated_at" = now()
        WHERE "id" = ${Number(upload.id)};
      `)
    }
    const capacity = databaseRows(await database.execute(sql`
      SELECT
        COUNT(*) FILTER (
          WHERE "state" IN ('uploading', 'finalizing')
        ) AS "activeUploads",
        COUNT(*) FILTER (
          WHERE "state" = 'finalizing'
        ) AS "finalizingUploads",
        COALESCE(SUM("size_bytes") FILTER (
          WHERE "state" IN ('uploading', 'finalizing')
        ), 0) AS "reservedBytes"
      FROM "syncshow_sermon_media_uploads";
    `))
    const retained = databaseRows(await database.execute(sql`
      SELECT
        COUNT(*) AS "retainedObjects",
        COALESCE(SUM("size_bytes"), 0) AS "retainedBytes"
      FROM "syncshow_sermon_media_objects";
    `))
    if (capacity.length !== 1 || retained.length !== 1) {
      throw new SermonMediaError(
        'MAINTENANCE_STATUS_UNAVAILABLE',
        'Private recording maintenance status could not be measured.',
        500,
      )
    }
    return Object.freeze({
      expiredUploads,
      cleanedStaging: terminal.length,
      activeUploads: Number(capacity[0].activeUploads),
      finalizingUploads: Number(capacity[0].finalizingUploads),
      reservedBytes: Number(capacity[0].reservedBytes),
      retainedObjects: Number(retained[0].retainedObjects),
      retainedBytes: Number(retained[0].retainedBytes),
    })
  })
}
