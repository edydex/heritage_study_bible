import {
  headersWithCors,
  type Endpoint,
  type PayloadRequest,
  type RequiredDataFromCollectionSlug,
} from 'payload'
import { sql } from '@payloadcms/db-postgres'
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { communityPublicConfig } from '@/lib/publicConfig'
import { createOpaqueToken, hashOpaqueToken } from '@/lib/tokens'
import {
  deviceGrantPollingStatus,
  listEtag,
  normalizeEmail,
  normalizePkceChallenge,
  normalizeSongMutation,
  pkceChallengeMatches,
  serializeSongForSync,
  songEtag,
  syncShowAccessToken,
  SYNCSHOW_MAX_PAGE_SIZE,
  SYNCSHOW_MAX_REQUEST_BYTES,
  SYNCSHOW_PROTOCOL_VERSION,
  SYNCSHOW_READ_SCOPE,
  SYNCSHOW_SCOPES,
  SYNCSHOW_SERVICE_DOCUMENT_READ_SCOPE,
  SYNCSHOW_SERVICE_DOCUMENT_WRITE_SCOPE,
  SYNCSHOW_SERVICE_PLAN_READ_SCOPE,
  SYNCSHOW_SERMON_PUBLICATION_READ_SCOPE,
  SYNCSHOW_SERMON_MEDIA_READ_SCOPE,
  SYNCSHOW_SERMON_MEDIA_WRITE_SCOPE,
  SYNCSHOW_SERMON_READ_SCOPE,
  SYNCSHOW_SERMON_WRITE_SCOPE,
  SYNCSHOW_SONG_PUBLIC_LINK_READ_SCOPE,
  SYNCSHOW_SONG_PUBLIC_LINK_WRITE_SCOPE,
  SyncShowProtocolError,
  SYNCSHOW_WRITE_SCOPE,
} from '@/lib/syncShowProtocol'
import {
  COMMUNITY_SERMON_WIRE_SCHEMA_VERSION,
  CommunitySermonWireError,
  MAX_SERMON_CHANGE_ITEMS,
  MAX_SERMON_CURSOR_BYTES,
  MAX_SERMON_TRANSFER_JSON_BYTES,
  buildSermonIdempotencyHeaders,
  normalizeRemoteSermonEnvelope,
  normalizeSermonChangePage,
  normalizeSermonWriteRequest,
  type SermonWriteBody,
} from '@/lib/syncshow/CommunitySermonWire'
import {
  normalizeSermonDocument,
  serializeSermonDocument,
  type CanonicalSermonDocument,
} from '@/lib/syncshow/SermonDocument'
import {
  lockedCommunityTimeZone,
  payloadPreachedAtForServiceDate,
} from '@/lib/syncshow/SermonDateProjection'
import {
  deactivateSermonPublicationForArchive,
  findSermonPublication,
  loadStoredPublicSermonCatalog,
  validateSermonPublicationRow,
} from '@/lib/syncshow/SermonPublicationStore'
import {
  buildCommunitySermonPublicationState,
} from '@/lib/syncshow/CommunitySermonPublicationState'
import {
  createCanonicalSermon,
  findCanonicalSermon,
} from '@/lib/syncshow/CanonicalSermonStore'
import {
  MAX_COMMUNITY_SERVICE_PLAN_CURSOR_BYTES,
  MAX_COMMUNITY_SERVICE_PLAN_PAGE_ITEMS,
  normalizeCommunityServicePlanEnvelope,
  normalizeCommunityServicePlanPage,
  normalizeCommunityServicePlanSummary,
} from '@/lib/syncshow/CommunityServicePlan'
import { sermonMediaEnabled } from '@/lib/syncshow/SermonMedia'
import {
  HeritageServiceDocumentServerError,
  MAX_SERVICE_DOCUMENT_CURSOR_BYTES,
  MAX_SERVICE_DOCUMENT_PAGE_ITEMS,
  MAX_SERVICE_DOCUMENT_TRANSFER_BYTES,
  normalizeServiceDocumentWrite,
  serviceDocumentChangePage,
  serviceDocumentEtag,
  serviceDocumentIdempotencyKey,
  serviceDocumentListPage,
  serviceDocumentResponse,
  serviceDocumentRouteId,
  serviceDocumentSummary,
  type ServiceDocumentWrite,
} from '@/lib/syncshow/HeritageServiceDocumentServer'
import {
  ServiceDocumentAssetError,
  readServiceDocumentAsset,
  serviceDocumentAssetId,
  storeServiceDocumentAsset,
} from '@/lib/syncshow/ServiceDocumentAssetStore'
import serviceCore from '../../packages/service-core/node.js'

const DEVICE_GRANT_MINUTES = 10
const CONNECTION_DAYS = 180
const TOKEN_RETRY_MINUTES = 15
const DEVICE_POLL_SECONDS = 3
const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const RATE_WINDOW_MS = 15 * 60_000
const rateLimits = new Map<string, { count: number; resetAt: number }>()

type RequestDoc = Record<string, unknown>
export type SyncShowAuth = {
  connection: RequestDoc
  communityId: number
  userId: number
}

function cors(req: PayloadRequest, extra: HeadersInit = {}) {
  const headers = headersWithCors({ headers: new Headers(extra), req })
  headers.set('Cache-Control', 'private, no-store')
  headers.set('Vary', 'Authorization')
  return headers
}

function json(req: PayloadRequest, value: unknown, init: ResponseInit = {}) {
  return Response.json(value, { ...init, headers: cors(req, init.headers) })
}

function protocolError(req: PayloadRequest, error: unknown) {
  if (error instanceof SyncShowProtocolError) {
    return json(req, { code: error.code, error: error.message }, { status: error.status })
  }
  if (error instanceof CommunitySermonWireError && error.code === 'INVALID_INPUT') {
    return json(req, { code: error.code, error: error.message }, { status: 400 })
  }
  if (error instanceof HeritageServiceDocumentServerError) {
    return json(req, { code: error.code, error: error.message }, { status: error.status })
  }
  if (error instanceof ServiceDocumentAssetError) {
    return json(req, { code: error.code, error: error.message }, {
      status: error.status,
      headers: error.retryable ? { 'Retry-After': '5' } : {},
    })
  }
  req.payload.logger.error({ err: error }, 'SyncShow Community endpoint failed')
  return json(req, { code: 'SERVER_ERROR', error: 'The Community server could not complete the SyncShow request.' }, { status: 500 })
}

function relationId(value: unknown) {
  const raw = value && typeof value === 'object' && 'id' in value
    ? (value as { id: unknown }).id
    : value
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : 0
}

function requestDoc(value: unknown): RequestDoc {
  return value as RequestDoc
}

function clientAddress(req: PayloadRequest) {
  return req.headers.get('cf-connecting-ip')
    || 'local'
}

function consumeRateLimit(key: string, maximum: number) {
  const now = Date.now()
  const bucket = rateLimits.get(key)
  if (!bucket || bucket.resetAt <= now) {
    if (rateLimits.size > 5000) {
      for (const [candidate, value] of rateLimits) {
        if (value.resetAt <= now) rateLimits.delete(candidate)
      }
    }
    while (rateLimits.size >= 5000) {
      const oldest = rateLimits.keys().next().value
      if (!oldest) break
      rateLimits.delete(oldest)
    }
    rateLimits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return 0
  }
  if (bucket.count >= maximum) return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  bucket.count += 1
  return 0
}

function rateLimited(req: PayloadRequest, seconds: number) {
  const headers = cors(req)
  headers.set('Retry-After', String(seconds))
  return Response.json(
    { code: 'RATE_LIMITED', error: 'Too many SyncShow connection attempts. Please wait and try again.' },
    { status: 429, headers },
  )
}

async function boundedJson(req: PayloadRequest, maximum = SYNCSHOW_MAX_REQUEST_BYTES) {
  const contentType = String(req.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
  if (contentType !== 'application/json') {
    throw new SyncShowProtocolError(
      'UNSUPPORTED_MEDIA_TYPE',
      'SyncShow request bodies must use application/json.',
      415,
    )
  }
  const length = Number(req.headers.get('content-length') || 0)
  if (Number.isFinite(length) && length > maximum) {
    throw new SyncShowProtocolError('REQUEST_TOO_LARGE', `Request body must be ${maximum} bytes or fewer.`, 413)
  }
  if (!req.text) throw new SyncShowProtocolError('INVALID_REQUEST', 'This request has no readable body.')
  const text = await req.text()
  if (Buffer.byteLength(text, 'utf8') > maximum) {
    throw new SyncShowProtocolError('REQUEST_TOO_LARGE', `Request body must be ${maximum} bytes or fewer.`, 413)
  }
  try {
    const parsed = JSON.parse(text || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
    return parsed as RequestDoc
  } catch {
    throw new SyncShowProtocolError('INVALID_JSON', 'Request body must be a JSON object.')
  }
}

function makeUserCode() {
  let result = ''
  const bytes = randomBytes(8)
  for (let index = 0; index < bytes.length; index += 1) {
    result += USER_CODE_ALPHABET[bytes[index] % USER_CODE_ALPHABET.length]
  }
  return result
}

function normalizeUserCode(value: unknown) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

function displayUserCode(value: string) {
  return `${value.slice(0, 4)}-${value.slice(4)}`
}

function requestedScopes(
  value: unknown,
  { allowDisabledMedia = false }: { allowDisabledMedia?: boolean } = {},
) {
  if (!Array.isArray(value) || value.length < 1 || value.length > SYNCSHOW_SCOPES.length) {
    throw new SyncShowProtocolError('INVALID_SCOPE', 'Request at least one supported SyncShow resource scope.')
  }
  const scopes = [...new Set(value.map(String))].sort()
  if (scopes.some(scope => !SYNCSHOW_SCOPES.includes(scope as typeof SYNCSHOW_SCOPES[number]))
    || (
      !allowDisabledMedia
      && !sermonMediaEnabled()
      && (
        scopes.includes(SYNCSHOW_SERMON_MEDIA_READ_SCOPE)
        || scopes.includes(SYNCSHOW_SERMON_MEDIA_WRITE_SCOPE)
      )
    )
    || (scopes.includes(SYNCSHOW_WRITE_SCOPE) && !scopes.includes(SYNCSHOW_READ_SCOPE))
    || (scopes.includes(SYNCSHOW_SERMON_WRITE_SCOPE)
      && !scopes.includes(SYNCSHOW_SERMON_READ_SCOPE))
    || (scopes.includes(SYNCSHOW_SERMON_PUBLICATION_READ_SCOPE)
      && !scopes.includes(SYNCSHOW_SERMON_READ_SCOPE))
    || (scopes.includes(SYNCSHOW_SERMON_MEDIA_READ_SCOPE)
      && !scopes.includes(SYNCSHOW_SERMON_READ_SCOPE))
    || (scopes.includes(SYNCSHOW_SERMON_MEDIA_WRITE_SCOPE)
      && (
        !scopes.includes(SYNCSHOW_SERMON_READ_SCOPE)
        || !scopes.includes(SYNCSHOW_SERMON_MEDIA_READ_SCOPE)
      ))
    || (scopes.includes(SYNCSHOW_SONG_PUBLIC_LINK_READ_SCOPE)
      && !scopes.includes(SYNCSHOW_READ_SCOPE))
    || (scopes.includes(SYNCSHOW_SONG_PUBLIC_LINK_WRITE_SCOPE)
      && (
        !scopes.includes(SYNCSHOW_READ_SCOPE)
        || !scopes.includes(SYNCSHOW_SONG_PUBLIC_LINK_READ_SCOPE)
      ))
    || (scopes.includes(SYNCSHOW_SERVICE_DOCUMENT_WRITE_SCOPE)
      && !scopes.includes(SYNCSHOW_SERVICE_DOCUMENT_READ_SCOPE))) {
    throw new SyncShowProtocolError('INVALID_SCOPE', 'The requested SyncShow scopes are invalid.')
  }
  return scopes
}

function escapeHtml(value: unknown) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function html(value: string, status = 200) {
  return new Response(value, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      'Content-Type': 'text/html; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  })
}

async function managerMembership(req: PayloadRequest, userId: number | string, communityId: number | string) {
  return (await req.payload.find({
    collection: 'memberships',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [
        { user: { equals: userId } },
        { community: { equals: communityId } },
        { role: { in: ['owner', 'admin', 'leader'] } },
      ],
    },
  })).docs[0]
}

async function configuredCommunity(req: PayloadRequest) {
  const communityId = await getConfiguredCommunityId(req.payload)
  if (communityId == null) {
    throw new SyncShowProtocolError('COMMUNITY_NOT_READY', 'This Community has not finished setup.', 503)
  }
  return communityId
}

async function authenticatedBrowserUser(req: PayloadRequest) {
  if (req.user) return requestDoc(req.user)
  let headers = req.headers
  if (headers.get('origin') === 'null' && headers.get('sec-fetch-site') === 'same-origin') {
    // Payload treats a literal opaque Origin as an explicit cross-origin value
    // and never reaches its Sec-Fetch-Site fallback. Firefox emits this pair
    // for the no-referrer approval form, so preserve the protected fetch
    // metadata while presenting the opaque origin as absent to Payload auth.
    headers = new Headers(headers)
    headers.delete('origin')
  }
  const result = await req.payload.auth({ headers })
  return result.user ? requestDoc(result.user) : null
}

export async function authorizeSyncShow(req: PayloadRequest, scope: string): Promise<SyncShowAuth> {
  const authorization = req.headers.get('authorization') || ''
  const token = authorization.startsWith('SyncShow ')
    ? authorization.slice('SyncShow '.length).trim()
    : ''
  if (!token) throw new SyncShowProtocolError('UNAUTHORIZED', 'A SyncShow connection token is required.', 401)
  const foundConnection = (await req.payload.find({
    collection: 'syncshow-connections',
    depth: 0,
    limit: 1,
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
  })).docs[0]
  const connection = foundConnection ? requestDoc(foundConnection) : undefined
  const scopes = Array.isArray(connection?.scopes) ? connection.scopes.map(String) : []
  const requiredScopes = scope === SYNCSHOW_WRITE_SCOPE
    ? [SYNCSHOW_READ_SCOPE, SYNCSHOW_WRITE_SCOPE]
    : scope === SYNCSHOW_SERMON_WRITE_SCOPE
      ? [SYNCSHOW_SERMON_READ_SCOPE, SYNCSHOW_SERMON_WRITE_SCOPE]
      : scope === SYNCSHOW_SERMON_PUBLICATION_READ_SCOPE
        ? [SYNCSHOW_SERMON_READ_SCOPE, SYNCSHOW_SERMON_PUBLICATION_READ_SCOPE]
      : scope === SYNCSHOW_SERVICE_DOCUMENT_WRITE_SCOPE
        ? [
            SYNCSHOW_SERVICE_DOCUMENT_READ_SCOPE,
            SYNCSHOW_SERVICE_DOCUMENT_WRITE_SCOPE,
          ]
      : [scope]
  if (!connection || requiredScopes.some(requiredScope => !scopes.includes(requiredScope))) {
    throw new SyncShowProtocolError('UNAUTHORIZED', 'This SyncShow connection is invalid, expired, or lacks the required scope.', 401)
  }
  const communityId = relationId(connection.community)
  const userId = relationId(connection.user)
  if (!communityId || !userId || !await managerMembership(req, userId, communityId)) {
    throw new SyncShowProtocolError('MANAGER_REQUIRED', 'This connection no longer belongs to a church manager.', 403)
  }
  const lastUsed = Date.parse(String(connection.lastUsedAt || ''))
  if (!Number.isFinite(lastUsed) || lastUsed < Date.now() - 60 * 60_000) {
    await req.payload.update({
      collection: 'syncshow-connections',
      id: connection.id as number | string,
      overrideAccess: true,
      data: { lastUsedAt: new Date().toISOString() },
    })
  }
  return { connection, communityId, userId }
}

async function findDeviceGrant(req: PayloadRequest, data: RequestDoc) {
  const deviceId = String(data.deviceId || '').trim()
  const deviceSecret = String(data.deviceSecret || '').trim()
  if (!deviceId || deviceId.length > 256 || deviceSecret.length < 16 || deviceSecret.length > 16_384) return null
  const grant = (await req.payload.find({
    collection: 'syncshow-device-grants',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    showHiddenFields: true,
    req,
    where: {
      and: [
        { deviceId: { equals: deviceId } },
        { deviceSecretHash: { equals: hashOpaqueToken(deviceSecret) } },
      ],
    },
  })).docs[0]
  return grant ? requestDoc(grant) : undefined
}

function decodeCursor(value: string | null) {
  if (!value) return null
  if (value.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new SyncShowProtocolError('INVALID_CURSOR', 'The song sync cursor is invalid.')
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as RequestDoc
    const updatedAt = String(parsed.updatedAt || '')
    const id = Number(parsed.id)
    if (!Number.isFinite(Date.parse(updatedAt)) || !Number.isSafeInteger(id) || id < 1) throw new Error('invalid')
    return { updatedAt: new Date(updatedAt).toISOString(), id }
  } catch {
    throw new SyncShowProtocolError('INVALID_CURSOR', 'The song sync cursor is invalid.')
  }
}

function encodeCursor(song: RequestDoc) {
  return Buffer.from(JSON.stringify({
    updatedAt: new Date(String(song.updatedAt)).toISOString(),
    id: Number(song.id),
  })).toString('base64url')
}

async function findSong(req: PayloadRequest, communityId: number, syncId: string) {
  const song = (await req.payload.find({
    collection: 'songs',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    showHiddenFields: true,
    req,
    where: {
      and: [
        { community: { equals: communityId } },
        { syncId: { equals: syncId } },
      ],
    },
  })).docs[0]
  return song ? requestDoc(song) : undefined
}

function routeSyncId(req: PayloadRequest) {
  const syncId = String(req.routeParams?.syncId || '')
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(syncId)) {
    throw new SyncShowProtocolError('INVALID_SYNC_ID', 'The song syncId is invalid.')
  }
  return syncId
}

async function updateSongWithCas(
  req: PayloadRequest,
  song: RequestDoc,
  expectedVersion: number,
  data: RequestDoc,
) {
  const adapter = req.payload.db as unknown as {
    beginTransaction: () => Promise<null | number | string>
    commitTransaction: (id: number | string) => Promise<void>
    rollbackTransaction: (id: number | string) => Promise<void>
    sessions?: Record<string, { db: { execute: (query: unknown) => Promise<{ rows?: Array<{ sync_version?: unknown }> }> } }>
  }
  const transactionId = await adapter.beginTransaction()
  if (!transactionId || !adapter.sessions?.[String(transactionId)]?.db) {
    throw new SyncShowProtocolError('CAS_UNAVAILABLE', 'Atomic song updates are temporarily unavailable.', 503)
  }
  const previousTransactionId = req.transactionID
  try {
    const result = await adapter.sessions[String(transactionId)].db.execute(sql`
      SELECT "sync_version"
      FROM "songs"
      WHERE "id" = ${Number(song.id)}
      FOR UPDATE;
    `)
    if (Number(result.rows?.[0]?.sync_version) !== expectedVersion) {
      await adapter.rollbackTransaction(transactionId)
      return null
    }
    req.transactionID = transactionId
    const updated = await req.payload.update({
      collection: 'songs',
      id: Number(song.id),
      overrideAccess: true,
      data: { ...data, syncVersion: expectedVersion + 1 },
      context: { syncShowReservedVersion: expectedVersion + 1 },
      req,
    })
    await adapter.commitTransaction(transactionId)
    return requestDoc(updated)
  } catch (error) {
    await adapter.rollbackTransaction(transactionId)
    throw error
  } finally {
    req.transactionID = previousTransactionId
  }
}

type SermonTransactionAdapter = {
  beginTransaction: () => Promise<null | number | string>
  commitTransaction: (id: number | string) => Promise<void>
  rollbackTransaction: (id: number | string) => Promise<void>
  sessions?: Record<string, {
    db: { execute: (query: unknown) => Promise<{ rows?: RequestDoc[] }> }
  }>
}

type SermonSnapshotCursor = {
  checkpoint: number
  through: number | null
  afterSyncId: string | null
}

const SERMON_CURSOR_SCHEMA_VERSION = 1
const SERMON_CURSOR_LANE = 'sermons'
const SERMON_CURSOR_HMAC_DOMAIN = 'heritage-syncshow-sermon-cursor-v1'

function routeSermonSyncId(req: PayloadRequest) {
  const syncId = String(req.routeParams?.syncId || '')
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(syncId)) {
    throw new SyncShowProtocolError('INVALID_SYNC_ID', 'The sermon syncId is invalid.')
  }
  return syncId
}

function sermonEtag(sermon: RequestDoc) {
  const syncId = String(sermon.syncId || '')
  const syncVersion = Number(sermon.syncVersion)
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(syncId)
    || !Number.isSafeInteger(syncVersion)
    || syncVersion < 1) {
    throw new SyncShowProtocolError(
      'INVALID_SERMON_STATE',
      'The stored sermon synchronization state is invalid.',
      500,
    )
  }
  return `"sermon:${syncId}:${syncVersion}"`
}

function parseSermonIfMatch(req: PayloadRequest, syncId: string) {
  const value = req.headers.get('if-match')
  if (!value) {
    throw new SyncShowProtocolError(
      'PRECONDITION_REQUIRED',
      'If-Match is required for sermon updates and archival.',
      428,
    )
  }
  const match = /^"sermon:([A-Za-z0-9][A-Za-z0-9._:-]{0,127}):([1-9]\d*)"$/.exec(value)
  const version = Number(match?.[2])
  if (!match || match[1] !== syncId || !Number.isSafeInteger(version)) {
    throw new SyncShowProtocolError(
      'VERSION_CONFLICT',
      'The sermon changed on the server. Refresh it before saving.',
      412,
    )
  }
  return version
}

function sermonDocument(write: SermonWriteBody) {
  return normalizeSermonDocument(JSON.parse(write.documentSource))
}

function unavailableSourceObjects(document: CanonicalSermonDocument) {
  return document.sources.map(source => ({
    sourceId: source.id,
    sha256: source.sha256,
    sizeBytes: source.sizeBytes,
    available: false,
  }))
}

function serializeSermonForSync(sermon: RequestDoc) {
  const documentSource = String(sermon.syncCurrentDocumentSource || '')
  let document: CanonicalSermonDocument
  try {
    document = normalizeSermonDocument(JSON.parse(documentSource))
  } catch {
    throw new SyncShowProtocolError(
      'INVALID_SERMON_STATE',
      'The stored sermon document is invalid.',
      500,
    )
  }
  return normalizeRemoteSermonEnvelope({
    syncId: sermon.syncId,
    syncVersion: sermon.syncVersion,
    revision: sermon.syncCurrentRevision,
    documentSource,
    archived: sermon.syncArchived,
    updatedAt: sermon.syncChangedAt,
    sourceObjects: unavailableSourceObjects(document),
  })
}

function sermonCursorSecret(req: PayloadRequest) {
  const secret = String(req.payload.secret || '')
  if (Buffer.byteLength(secret, 'utf8') < 16) {
    throw new SyncShowProtocolError(
      'CURSOR_UNAVAILABLE',
      'Signed sermon cursors are temporarily unavailable.',
      503,
    )
  }
  return secret
}

function sermonCursorSignature(req: PayloadRequest, encodedPayload: string) {
  return createHmac('sha256', sermonCursorSecret(req))
    .update(SERMON_CURSOR_HMAC_DOMAIN, 'utf8')
    .update('\0')
    .update(encodedPayload, 'ascii')
    .digest('base64url')
}

function encodeSignedSermonCursor(
  req: PayloadRequest,
  communityId: number,
  payload: RequestDoc,
) {
  const encodedPayload = Buffer.from(JSON.stringify({
    version: SERMON_CURSOR_SCHEMA_VERSION,
    lane: SERMON_CURSOR_LANE,
    communityId,
    ...payload,
  }), 'utf8').toString('base64url')
  return `${encodedPayload}.${sermonCursorSignature(req, encodedPayload)}`
}

function decodeSermonCursor(
  req: PayloadRequest,
  communityId: number,
  value: string | null,
): SermonSnapshotCursor {
  if (!value) {
    return { checkpoint: 0, through: null, afterSyncId: null }
  }
  if (Buffer.byteLength(value, 'utf8') > MAX_SERMON_CURSOR_BYTES
    || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    throw new SyncShowProtocolError('INVALID_CURSOR', 'The sermon sync cursor is invalid.')
  }
  try {
    const [encodedPayload, encodedSignature] = value.split('.')
    const actualSignature = Buffer.from(encodedSignature, 'base64url')
    const expectedSignature = Buffer.from(
      sermonCursorSignature(req, encodedPayload),
      'base64url',
    )
    if (actualSignature.length !== expectedSignature.length
      || !timingSafeEqual(actualSignature, expectedSignature)) {
      throw new Error('invalid')
    }
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as RequestDoc
    const keys = Object.keys(parsed).sort()
    if (parsed.version !== SERMON_CURSOR_SCHEMA_VERSION
      || parsed.lane !== SERMON_CURSOR_LANE
      || parsed.communityId !== communityId) {
      throw new Error('invalid')
    }
    if (typeof parsed.checkpoint !== 'number') throw new Error('invalid')
    const checkpoint = parsed.checkpoint
    if (!Number.isSafeInteger(checkpoint) || checkpoint < 0) throw new Error('invalid')
    if (keys.length === 4
      && keys[0] === 'checkpoint'
      && keys[1] === 'communityId'
      && keys[2] === 'lane'
      && keys[3] === 'version') {
      return { checkpoint, through: null, afterSyncId: null }
    }
    if (keys.length !== 6
      || keys[0] !== 'afterSyncId'
      || keys[1] !== 'checkpoint'
      || keys[2] !== 'communityId'
      || keys[3] !== 'lane'
      || keys[4] !== 'through'
      || keys[5] !== 'version') {
      throw new Error('invalid')
    }
    if (typeof parsed.through !== 'number' || typeof parsed.afterSyncId !== 'string') {
      throw new Error('invalid')
    }
    const through = parsed.through
    const afterSyncId = parsed.afterSyncId
    if (!Number.isSafeInteger(through)
      || through < checkpoint
      || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(afterSyncId)) {
      throw new Error('invalid')
    }
    return { checkpoint, through, afterSyncId }
  } catch {
    throw new SyncShowProtocolError('INVALID_CURSOR', 'The sermon sync cursor is invalid.')
  }
}

function encodeSermonCheckpoint(
  req: PayloadRequest,
  communityId: number,
  checkpoint: number,
) {
  return encodeSignedSermonCursor(req, communityId, {
    checkpoint,
  })
}

function encodeSermonSnapshotCursor(
  req: PayloadRequest,
  communityId: number,
  checkpoint: number,
  through: number,
  afterSyncId: string,
) {
  return encodeSignedSermonCursor(req, communityId, {
    checkpoint,
    through,
    afterSyncId,
  })
}

type SermonSnapshotAdapter = {
  drizzle?: {
    execute: (
      query: unknown,
    ) => Promise<{ rows?: RequestDoc[] } | RequestDoc[]>
  }
}

function sermonSnapshotRows(
  result: { rows?: RequestDoc[] } | RequestDoc[],
) {
  if (Array.isArray(result)) return result
  return Array.isArray(result.rows) ? result.rows : []
}

function sermonSnapshotDatabase(req: PayloadRequest) {
  const database = (req.payload.db as unknown as SermonSnapshotAdapter).drizzle
  if (!database?.execute) {
    throw new SyncShowProtocolError(
      'SNAPSHOT_UNAVAILABLE',
      'Sermon change snapshots are temporarily unavailable.',
      503,
    )
  }
  return database
}

async function sermonJournalHighWater(
  req: PayloadRequest,
  communityId: number,
) {
  const result = await sermonSnapshotDatabase(req).execute(sql`
    SELECT COALESCE(MAX("id"), 0) AS "highWater"
    FROM "syncshow_sermon_changes"
    WHERE "community_id" = ${communityId};
  `)
  const highWater = Number(sermonSnapshotRows(result)[0]?.highWater)
  if (!Number.isSafeInteger(highWater) || highWater < 0) {
    throw new SyncShowProtocolError(
      'INVALID_SERMON_STATE',
      'The sermon change journal has an invalid high-water mark.',
      500,
    )
  }
  return highWater
}

function normalizeStoredSermonChange(change: RequestDoc): RequestDoc {
  const syncVersion = Number(change.syncVersion)
  const timestamp = change.changedAt instanceof Date
    ? change.changedAt.getTime()
    : Date.parse(String(change.changedAt || ''))
  if (!Number.isSafeInteger(syncVersion)
    || syncVersion < 1
    || !Number.isFinite(timestamp)) {
    throw new SyncShowProtocolError(
      'INVALID_SERMON_STATE',
      'The sermon change journal contains invalid metadata.',
      500,
    )
  }
  return {
    ...change,
    syncVersion,
    changedAt: new Date(timestamp).toISOString(),
  } as RequestDoc
}

async function latestSermonChangesInSnapshot(
  req: PayloadRequest,
  {
    communityId,
    checkpoint,
    through,
    afterSyncId,
    limit,
  }: {
    communityId: number
    checkpoint: number
    through: number
    afterSyncId: string
    limit: number
  },
) {
  const result = await sermonSnapshotDatabase(req).execute(sql`
    SELECT DISTINCT ON ("sync_id")
      "id",
      "sync_id" AS "syncId",
      "sync_version" AS "syncVersion",
      "revision",
      "archived",
      "changed_at" AS "changedAt"
    FROM "syncshow_sermon_changes"
    WHERE "community_id" = ${communityId}
      AND "id" > ${checkpoint}
      AND "id" <= ${through}
      AND "sync_id" > ${afterSyncId}
    ORDER BY "sync_id" ASC, "id" DESC
    LIMIT ${limit + 1};
  `)
  return sermonSnapshotRows(result)
    .map(row => normalizeStoredSermonChange(requestDoc(row)))
}

function sermonLegacyAndSyncData(
  write: SermonWriteBody,
  document: CanonicalSermonDocument,
  timeZone: string,
) {
  if (document.publication.status === 'published') {
    throw new SyncShowProtocolError(
      'PUBLICATION_NOT_ALLOWED',
      'SyncShow sermon write access cannot publish a sermon.',
      409,
    )
  }
  if (document.publication.status === 'archived'
    && (
      document.publication.visibility !== 'private'
      || document.publication.publishedAt !== null
      || document.publication.canonicalUrl !== null
    )) {
    throw new SyncShowProtocolError(
      'INVALID_ARCHIVE_TOMBSTONE',
      'Archived sermons must be private tombstones without publication residue.',
      409,
    )
  }
  const title = document.titles[document.defaultLanguage]
  const series = document.series?.titles[document.defaultLanguage] || null
  return {
    title,
    slug: `sync-${createHash('sha256').update(write.syncId, 'utf8').digest('hex').slice(0, 24)}`,
    speaker: document.speaker.name,
    preachedAt: payloadPreachedAtForServiceDate(document.serviceDate, timeZone),
    series,
    status: 'draft' as const,
    syncId: write.syncId,
    syncCurrentDocumentSource: write.documentSource,
    syncCurrentRevision: write.revision,
    syncArchived: document.publication.status === 'archived',
    syncPublicationStatus: document.publication.status,
    syncVisibility: document.publication.visibility,
    syncSourceObjects: unavailableSourceObjects(document),
    syncChangedAt: new Date().toISOString(),
  }
}

async function recordSermonChange(
  req: PayloadRequest,
  communityId: number,
  sermon: RequestDoc,
) {
  await req.payload.create({
    collection: 'syncshow-sermon-changes' as never,
    overrideAccess: true,
    context: { syncShowSermonChangeMutation: true },
    req,
    data: {
      community: communityId,
      sermon: Number(sermon.id),
      syncId: String(sermon.syncId),
      syncVersion: Number(sermon.syncVersion),
      revision: String(sermon.syncCurrentRevision),
      documentSource: String(sermon.syncCurrentDocumentSource),
      archived: sermon.syncArchived === true,
      changedAt: String(sermon.syncChangedAt),
    } as never,
  })
}

async function updateSermonWithCas(
  req: PayloadRequest,
  communityId: number,
  sermon: RequestDoc,
  expectedVersion: number,
  write: SermonWriteBody,
) {
  const adapter = req.payload.db as unknown as SermonTransactionAdapter
  const transactionId = await adapter.beginTransaction()
  if (!transactionId || !adapter.sessions?.[String(transactionId)]?.db) {
    throw new SyncShowProtocolError(
      'CAS_UNAVAILABLE',
      'Atomic sermon updates are temporarily unavailable.',
      503,
    )
  }
  const transactionDb = adapter.sessions[String(transactionId)].db
  const previousTransactionId = req.transactionID
  let committed = false
  try {
    req.transactionID = transactionId
    await transactionDb.execute(sql`
      SELECT pg_advisory_xact_lock(hashtext('syncshow-sermon-change-sequence'));
    `)
    const locked = (await transactionDb.execute(sql`
      SELECT "id"
      FROM "sermons"
      WHERE "id" = ${Number(sermon.id)}
      FOR UPDATE;
    `)).rows?.[0]
    if (!locked) {
      await adapter.rollbackTransaction(transactionId)
      committed = true
      return null
    }
    const current = await findCanonicalSermon(
      req,
      communityId,
      String(sermon.syncId),
    )
    if (!current) {
      await adapter.rollbackTransaction(transactionId)
      committed = true
      return null
    }

    // A lost successful response may be retried with the old ETag. Only the
    // exact same canonical bytes are safe to acknowledge in that state.
    const currentVersion = Number(current.syncVersion)
    const exactContent = String(current.syncCurrentRevision || '') === write.revision
      && String(current.syncCurrentDocumentSource || '') === write.documentSource
    if (exactContent
      && (currentVersion === expectedVersion || currentVersion === expectedVersion + 1)) {
      await adapter.commitTransaction(transactionId)
      committed = true
      return current
    }
    if (currentVersion !== expectedVersion) {
      await adapter.rollbackTransaction(transactionId)
      committed = true
      return null
    }
    if (current.syncArchived === true) {
      throw new SyncShowProtocolError(
        'SERMON_ARCHIVED',
        'An archived sermon is an immutable tombstone.',
        409,
      )
    }

    const document = sermonDocument(write)
    const timeZone = await lockedCommunityTimeZone(transactionDb, communityId)
    const updated = await req.payload.update({
      collection: 'sermons',
      id: Number(current.id),
      overrideAccess: true,
      showHiddenFields: true,
      context: { syncShowSermonMutation: true },
      req,
      data: {
        ...sermonLegacyAndSyncData(write, document, timeZone),
        syncVersion: expectedVersion + 1,
      },
    })
    if (document.publication.status === 'archived') {
      await deactivateSermonPublicationForArchive(
        req,
        communityId,
        Number(current.id),
        String(requestDoc(updated).syncChangedAt),
      )
    }
    await recordSermonChange(req, communityId, requestDoc(updated))
    await adapter.commitTransaction(transactionId)
    committed = true
    return requestDoc(updated)
  } catch (error) {
    if (!committed) await adapter.rollbackTransaction(transactionId)
    throw error
  } finally {
    req.transactionID = previousTransactionId
  }
}

type ServicePlanCursor = {
  changedAt: string
  id: number
}

const SERVICE_PLAN_CURSOR_SCHEMA_VERSION = 1
const SERVICE_PLAN_CURSOR_LANE = 'service-plans'
const SERVICE_PLAN_CURSOR_HMAC_DOMAIN =
  'heritage-syncshow-service-plan-cursor-v1'

function routeServicePlanSyncId(req: PayloadRequest) {
  const syncId = String(req.routeParams?.syncId || '')
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(syncId)) {
    throw new SyncShowProtocolError(
      'INVALID_SYNC_ID',
      'The service plan syncId is invalid.',
    )
  }
  return syncId
}

function servicePlanCursorSecret(req: PayloadRequest) {
  const secret = String(req.payload.secret || '')
  if (Buffer.byteLength(secret, 'utf8') < 16) {
    throw new SyncShowProtocolError(
      'CURSOR_UNAVAILABLE',
      'Signed service plan cursors are temporarily unavailable.',
      503,
    )
  }
  return secret
}

function servicePlanCursorSignature(
  req: PayloadRequest,
  encodedPayload: string,
) {
  return createHmac('sha256', servicePlanCursorSecret(req))
    .update(SERVICE_PLAN_CURSOR_HMAC_DOMAIN, 'utf8')
    .update('\0')
    .update(encodedPayload, 'ascii')
    .digest('base64url')
}

function encodeServicePlanCursor(
  req: PayloadRequest,
  communityId: number,
  plan: RequestDoc,
) {
  const changedAt = plan.changedAt instanceof Date
    ? plan.changedAt.toISOString()
    : new Date(String(plan.changedAt || '')).toISOString()
  const id = Number(plan.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new SyncShowProtocolError(
      'INVALID_SERVICE_PLAN_STATE',
      'The stored service plan cursor identity is invalid.',
      500,
    )
  }
  const encodedPayload = Buffer.from(JSON.stringify({
    version: SERVICE_PLAN_CURSOR_SCHEMA_VERSION,
    lane: SERVICE_PLAN_CURSOR_LANE,
    communityId,
    changedAt,
    id,
  }), 'utf8').toString('base64url')
  return `${encodedPayload}.${servicePlanCursorSignature(req, encodedPayload)}`
}

function decodeServicePlanCursor(
  req: PayloadRequest,
  communityId: number,
  value: string | null,
): ServicePlanCursor | null {
  if (!value) return null
  if (
    Buffer.byteLength(value, 'utf8') > MAX_COMMUNITY_SERVICE_PLAN_CURSOR_BYTES
    || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw new SyncShowProtocolError(
      'INVALID_CURSOR',
      'The service plan cursor is invalid.',
    )
  }
  try {
    const [encodedPayload, encodedSignature] = value.split('.')
    const actualSignature = Buffer.from(encodedSignature, 'base64url')
    const expectedSignature = Buffer.from(
      servicePlanCursorSignature(req, encodedPayload),
      'base64url',
    )
    if (
      actualSignature.length !== expectedSignature.length
      || !timingSafeEqual(actualSignature, expectedSignature)
    ) {
      throw new Error('invalid')
    }
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as RequestDoc
    const keys = Object.keys(parsed).sort()
    const changedAt = String(parsed.changedAt || '')
    const id = Number(parsed.id)
    if (
      keys.length !== 5
      || keys[0] !== 'changedAt'
      || keys[1] !== 'communityId'
      || keys[2] !== 'id'
      || keys[3] !== 'lane'
      || keys[4] !== 'version'
      || parsed.version !== SERVICE_PLAN_CURSOR_SCHEMA_VERSION
      || parsed.lane !== SERVICE_PLAN_CURSOR_LANE
      || parsed.communityId !== communityId
      || !Number.isSafeInteger(id)
      || id < 1
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(changedAt)
      || Number.isNaN(Date.parse(changedAt))
      || new Date(changedAt).toISOString() !== changedAt
    ) {
      throw new Error('invalid')
    }
    return { changedAt, id }
  } catch {
    throw new SyncShowProtocolError(
      'INVALID_CURSOR',
      'The service plan cursor is invalid.',
    )
  }
}

function validatedServicePlanEnvelope(plan: RequestDoc) {
  const changedAt = plan.changedAt instanceof Date
    ? plan.changedAt.toISOString()
    : String(plan.changedAt || '')
  return normalizeCommunityServicePlanEnvelope({
    syncId: plan.syncId,
    syncVersion: plan.syncVersion,
    revision: plan.revision,
    documentSource: plan.documentSource,
    status: plan.status,
    changedAt,
  })
}

function servicePlanEnvelope(plan: RequestDoc) {
  const envelope = validatedServicePlanEnvelope(plan)
  return {
    syncId: envelope.syncId,
    syncVersion: envelope.syncVersion,
    revision: envelope.revision,
    documentSource: envelope.documentSource,
    status: envelope.status,
    changedAt: envelope.changedAt,
  }
}

function servicePlanSummary(plan: RequestDoc) {
  const envelope = validatedServicePlanEnvelope(plan)
  return normalizeCommunityServicePlanSummary({
    syncId: envelope.syncId,
    syncVersion: envelope.syncVersion,
    revision: envelope.revision,
    status: envelope.status,
    title: envelope.plan.title,
    serviceDate: envelope.plan.serviceDate,
    startTime: envelope.plan.startTime,
    changedAt: envelope.changedAt,
  })
}

function servicePlanPageLimit(url: URL) {
  const value = url.searchParams.get('limit')
  if (value === null) return 50
  if (!/^[1-9]\d*$/.test(value)) {
    throw new SyncShowProtocolError(
      'INVALID_LIMIT',
      `Service plan limit must be 1-${MAX_COMMUNITY_SERVICE_PLAN_PAGE_ITEMS}.`,
    )
  }
  const limit = Number(value)
  if (
    !Number.isSafeInteger(limit)
    || limit > MAX_COMMUNITY_SERVICE_PLAN_PAGE_ITEMS
  ) {
    throw new SyncShowProtocolError(
      'INVALID_LIMIT',
      `Service plan limit must be 1-${MAX_COMMUNITY_SERVICE_PLAN_PAGE_ITEMS}.`,
    )
  }
  return limit
}

type ServiceDocumentCursor = {
  changedAt: string
  id: number
}

const SERVICE_DOCUMENT_LIST_LANE = 'service-documents-list'
const SERVICE_DOCUMENT_CHANGE_LANE = 'service-documents-changes'
const SERVICE_DOCUMENT_CURSOR_DOMAIN =
  'heritage-syncshow-service-document-cursor-v1'

function serviceDocumentCursorSignature(
  req: PayloadRequest,
  encodedPayload: string,
) {
  const secret = String(req.payload.secret || '')
  if (Buffer.byteLength(secret, 'utf8') < 16) {
    throw new SyncShowProtocolError(
      'CURSOR_UNAVAILABLE',
      'Signed service-document cursors are temporarily unavailable.',
      503,
    )
  }
  return createHmac('sha256', secret)
    .update(SERVICE_DOCUMENT_CURSOR_DOMAIN, 'utf8')
    .update('\0')
    .update(encodedPayload, 'ascii')
    .digest('base64url')
}

function encodeServiceDocumentCursor(
  req: PayloadRequest,
  communityId: number,
  lane: string,
  cursor: ServiceDocumentCursor,
) {
  const encoded = Buffer.from(JSON.stringify({
    version: 1,
    lane,
    communityId,
    changedAt: new Date(cursor.changedAt).toISOString(),
    id: cursor.id,
  }), 'utf8').toString('base64url')
  return `${encoded}.${serviceDocumentCursorSignature(req, encoded)}`
}

function decodeServiceDocumentCursor(
  req: PayloadRequest,
  communityId: number,
  lane: string,
  value: string | null,
  fallback: ServiceDocumentCursor | null,
) {
  if (!value) return fallback
  if (Buffer.byteLength(value, 'utf8') > MAX_SERVICE_DOCUMENT_CURSOR_BYTES
    || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    throw new SyncShowProtocolError(
      'INVALID_CURSOR',
      'The service-document cursor is invalid.',
    )
  }
  try {
    const [encoded, signature] = value.split('.')
    const actual = Buffer.from(signature, 'base64url')
    const expected = Buffer.from(
      serviceDocumentCursorSignature(req, encoded),
      'base64url',
    )
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new Error('invalid')
    }
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as RequestDoc
    const changedAt = new Date(String(parsed.changedAt || '')).toISOString()
    const id = Number(parsed.id)
    if (parsed.version !== 1
      || parsed.lane !== lane
      || parsed.communityId !== communityId
      || !Number.isSafeInteger(id)
      || id < 0) throw new Error('invalid')
    return { changedAt, id }
  } catch {
    throw new SyncShowProtocolError(
      'INVALID_CURSOR',
      'The service-document cursor is invalid.',
    )
  }
}

function serviceDocumentPageLimit(url: URL) {
  const value = url.searchParams.get('limit')
  if (value === null) return 50
  if (!/^[1-9]\d*$/.test(value)) {
    throw new SyncShowProtocolError(
      'INVALID_LIMIT',
      `Service-document limit must be 1-${MAX_SERVICE_DOCUMENT_PAGE_ITEMS}.`,
    )
  }
  const limit = Number(value)
  if (!Number.isSafeInteger(limit) || limit > MAX_SERVICE_DOCUMENT_PAGE_ITEMS) {
    throw new SyncShowProtocolError(
      'INVALID_LIMIT',
      `Service-document limit must be 1-${MAX_SERVICE_DOCUMENT_PAGE_ITEMS}.`,
    )
  }
  return limit
}

export async function findServiceDocument(
  req: PayloadRequest,
  communityId: number,
  syncId: string,
) {
  const found = (await req.payload.find({
    collection: 'service-documents' as never,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    showHiddenFields: true,
    req,
    where: {
      and: [
        { community: { equals: communityId } },
        { syncId: { equals: syncId } },
      ],
    },
  })).docs[0]
  return found ? requestDoc(found) : null
}

async function recordServiceDocumentChange(
  req: PayloadRequest,
  communityId: number,
  document: RequestDoc,
) {
  const summary = serviceDocumentSummary(document)
  await req.payload.create({
    collection: 'syncshow-service-document-changes' as never,
    overrideAccess: true,
    context: { serviceDocumentChange: true },
    req,
    data: {
      community: communityId,
      serviceDocument: Number(document.id),
      syncId: summary.syncId,
      syncVersion: summary.syncVersion,
      revision: summary.revision,
      documentSource: String(document.documentSource),
      status: summary.status,
      title: summary.title,
      serviceDate: summary.serviceDate,
      changedAt: summary.changedAt,
    } as never,
  })
}

export async function mutateServiceDocument(
  req: PayloadRequest,
  communityId: number,
  write: ServiceDocumentWrite,
  idempotencyKey: string,
) {
  const adapter = req.payload.db as unknown as SermonTransactionAdapter
  const transactionId = await adapter.beginTransaction()
  if (!transactionId || !adapter.sessions?.[String(transactionId)]?.db) {
    throw new SyncShowProtocolError(
      'CAS_UNAVAILABLE',
      'Atomic service-document updates are temporarily unavailable.',
      503,
    )
  }
  const db = adapter.sessions[String(transactionId)].db
  const previousTransactionId = req.transactionID
  let committed = false
  try {
    req.transactionID = transactionId
    await db.execute(sql`
      SELECT pg_advisory_xact_lock(
        hashtext(${`service-document:${communityId}:${write.syncId}`})
      );
    `)
    let current = await findServiceDocument(req, communityId, write.syncId)
    if (current) {
      await db.execute(sql`
        SELECT "id"
        FROM "service_documents"
        WHERE "id" = ${Number(current.id)}
        FOR UPDATE;
      `)
      current = await findServiceDocument(req, communityId, write.syncId)
    }

    if (write.baseSyncVersion === null) {
      const exactRetry = current
        && String(current.lastIdempotencyKey || '') === idempotencyKey
        && String(current.revision || '') === write.revision
        && String(current.documentSource || '') === write.documentSource
        && String(current.status || '') === write.status
      if (exactRetry) {
        await adapter.commitTransaction(transactionId)
        committed = true
        return { document: current as RequestDoc, created: false }
      }
      if (current) {
        throw new SyncShowProtocolError(
          'SERVICE_DOCUMENT_EXISTS',
          'This service document already exists. Open it before saving.',
          409,
        )
      }
      const created = requestDoc(await req.payload.create({
        collection: 'service-documents' as never,
        overrideAccess: true,
        showHiddenFields: true,
        context: { serviceDocumentChangedAt: new Date().toISOString() },
        req,
        data: {
          community: communityId,
          status: write.status,
          documentSource: write.documentSource,
          lastIdempotencyKey: idempotencyKey,
        } as never,
      }))
      await recordServiceDocumentChange(req, communityId, created)
      await adapter.commitTransaction(transactionId)
      committed = true
      return { document: created, created: true }
    }

    if (!current) {
      throw new SyncShowProtocolError(
        'SERVICE_DOCUMENT_NOT_FOUND',
        'Service document not found.',
        404,
      )
    }
    const currentVersion = Number(current.syncVersion)
    const exactRetry = String(current.lastIdempotencyKey || '') === idempotencyKey
      && String(current.revision || '') === write.revision
      && String(current.documentSource || '') === write.documentSource
      && String(current.status || '') === write.status
      && currentVersion === write.baseSyncVersion + 1
    if (exactRetry) {
      await adapter.commitTransaction(transactionId)
      committed = true
      return { document: current as RequestDoc, created: false }
    }
    if (currentVersion !== write.baseSyncVersion
      || String(current.revision || '') !== write.baseRevision) {
      throw new SyncShowProtocolError(
        'VERSION_CONFLICT',
        'The service document changed. Review both versions before saving.',
        412,
      )
    }
    const updated = requestDoc(await req.payload.update({
      collection: 'service-documents' as never,
      id: Number(current.id),
      overrideAccess: true,
      showHiddenFields: true,
      context: { serviceDocumentChangedAt: new Date().toISOString() },
      req,
      data: {
        status: write.status,
        documentSource: write.documentSource,
        lastIdempotencyKey: idempotencyKey,
      } as never,
    }))
    await recordServiceDocumentChange(req, communityId, updated)
    await adapter.commitTransaction(transactionId)
    committed = true
    return { document: updated, created: false }
  } catch (error) {
    if (!committed) await adapter.rollbackTransaction(transactionId)
    throw error
  } finally {
    req.transactionID = previousTransactionId
  }
}

const deviceStart: Endpoint = {
  path: '/community/syncshow/v1/auth/device/start',
  method: 'post',
  handler: async req => {
    try {
      const retryAfter = consumeRateLimit(`device-start:${clientAddress(req)}`, 12)
      if (retryAfter) return rateLimited(req, retryAfter)
      const data = await boundedJson(req, 16 * 1024)
      const email = normalizeEmail(data.email)
      if (!email) throw new SyncShowProtocolError('INVALID_EMAIL', 'Enter a valid administrator email address.')
      const emailRetry = consumeRateLimit(`device-email:${email}`, 6)
      if (emailRetry) return rateLimited(req, emailRetry)
      const clientName = String(data.deviceName || '').trim()
      if (!clientName || clientName.length > 120 || /[\u0000-\u001f\u007f]/.test(clientName)) {
        throw new SyncShowProtocolError('INVALID_DEVICE_NAME', 'deviceName must be 1 to 120 printable characters.')
      }
      const scopes = requestedScopes(data.scopes)
      if (data.codeChallengeMethod !== 'S256') {
        throw new SyncShowProtocolError('INVALID_PKCE_METHOD', 'Only the S256 PKCE method is supported.')
      }
      const codeChallenge = normalizePkceChallenge(data.codeChallenge)
      const communityId = await configuredCommunity(req)
      const deviceId = createOpaqueToken()
      const deviceSecret = createOpaqueToken()
      const userCode = makeUserCode()
      const expiresAt = new Date(Date.now() + DEVICE_GRANT_MINUTES * 60_000).toISOString()
      await req.payload.create({
        collection: 'syncshow-device-grants',
        overrideAccess: true,
        data: {
          community: communityId,
          requestedEmail: email,
          clientName,
          deviceId,
          deviceSecretHash: hashOpaqueToken(deviceSecret),
          userCodeHash: hashOpaqueToken(userCode),
          codeChallenge,
          scopes,
          status: 'pending',
          expiresAt,
        },
      })

      const verificationUri = `${communityPublicConfig.publicUrl}/api/community/syncshow/v1/auth/device/approve`
      const verificationUriComplete = `${verificationUri}?user_code=${encodeURIComponent(displayUserCode(userCode))}`
      const user = (await req.payload.find({
        collection: 'users',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { email: { equals: email } },
      })).docs[0]
      if (user && await managerMembership(req, user.id, communityId)) {
        await req.payload.sendEmail({
          to: email,
          subject: `Approve ${clientName} for ${communityPublicConfig.name}`,
          text: [
            `${clientName} requested scoped access to ${communityPublicConfig.name} resources.`,
            `Requested scopes: ${scopes.join(', ')}`,
            `Approval code: ${displayUserCode(userCode)}`,
            `Open this page and explicitly approve the request: ${verificationUriComplete}`,
            `This request expires in ${DEVICE_GRANT_MINUTES} minutes.`,
            'If you did not start this request, do not approve it.',
          ].join('\n\n'),
        }).catch(error => req.payload.logger.warn({ err: error }, 'Could not email the SyncShow approval link'))
      }
      return json(req, {
        schemaVersion: SYNCSHOW_PROTOCOL_VERSION,
        deviceId,
        deviceSecret,
        userCode: displayUserCode(userCode),
        verificationUri,
        expiresAt,
        pollIntervalMs: DEVICE_POLL_SECONDS * 1000,
      })
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const deviceStatus: Endpoint = {
  path: '/community/syncshow/v1/auth/device/status',
  method: 'post',
  handler: async req => {
    try {
      const data = await boundedJson(req, 8 * 1024)
      const grant = await findDeviceGrant(req, data)
      if (!grant) throw new SyncShowProtocolError('INVALID_DEVICE_CODE', 'The device authorization request is invalid.', 401)
      return json(req, {
        status: deviceGrantPollingStatus(grant, new Date(), TOKEN_RETRY_MINUTES * 60_000),
        expiresAt: grant.expiresAt,
        retryAfterMs: DEVICE_POLL_SECONDS * 1000,
      })
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const deviceToken: Endpoint = {
  path: '/community/syncshow/v1/auth/device/token',
  method: 'post',
  handler: async req => {
    try {
      const retryAfter = consumeRateLimit(`device-token:${clientAddress(req)}`, 60)
      if (retryAfter) return rateLimited(req, retryAfter)
      const data = await boundedJson(req, 16 * 1024)
      const grant = await findDeviceGrant(req, data)
      const grantExpiresAt = Date.parse(String(grant?.expiresAt || ''))
      const consumedAt = Date.parse(String(grant?.consumedAt || ''))
      const withinConsumedRetryWindow = grant?.status === 'consumed'
        && Number.isFinite(consumedAt)
        && consumedAt > Date.now() - TOKEN_RETRY_MINUTES * 60_000
      if (!grant || (grantExpiresAt <= Date.now() && !withinConsumedRetryWindow)) {
        throw new SyncShowProtocolError('INVALID_DEVICE_CODE', 'The device authorization request is invalid or expired.', 401)
      }
      if (!pkceChallengeMatches(data.codeVerifier, grant.codeChallenge)) {
        throw new SyncShowProtocolError('INVALID_PKCE_VERIFIER', 'The PKCE verifier is invalid.', 401)
      }
      if (grant.status === 'pending') {
        throw new SyncShowProtocolError('AUTHORIZATION_PENDING', 'The church administrator has not approved this connection yet.', 428)
      }
      if (!['approved', 'consumed'].includes(String(grant.status))) {
        throw new SyncShowProtocolError('AUTHORIZATION_DENIED', 'This SyncShow connection was denied or already consumed.', 403)
      }
      const userId = relationId(grant.approvedBy)
      const communityId = relationId(grant.community)
      if (!userId || !communityId || !await managerMembership(req, userId, communityId)) {
        throw new SyncShowProtocolError('MANAGER_REQUIRED', 'The approving account is no longer a church manager.', 403)
      }

      const accessToken = syncShowAccessToken(
        req.payload.secret,
        String(grant.deviceId),
        String(data.deviceSecret),
        String(grant.codeChallenge),
      )
      const tokenHash = hashOpaqueToken(accessToken)
      const requestedGrantScopes = requestedScopes(
        grant.scopes,
        { allowDisabledMedia: true },
      )
      const account = await req.payload.findByID({
        collection: 'users',
        id: userId,
        depth: 0,
        overrideAccess: true,
      })
      const adapter = req.payload.db as unknown as {
        beginTransaction: () => Promise<null | number | string>
        commitTransaction: (id: number | string) => Promise<void>
        rollbackTransaction: (id: number | string) => Promise<void>
        sessions?: Record<string, {
          db: { execute: (query: unknown) => Promise<{ rows?: RequestDoc[] }> }
        }>
      }
      const transactionId = await adapter.beginTransaction()
      if (!transactionId || !adapter.sessions?.[String(transactionId)]?.db) {
        throw new SyncShowProtocolError('TOKEN_EXCHANGE_UNAVAILABLE', 'Atomic token exchange is temporarily unavailable.', 503)
      }
      const transactionDb = adapter.sessions[String(transactionId)].db
      const previousTransactionId = req.transactionID
      let committed = false
      let expiresAt = ''
      let scopes: string[] = []
      try {
        req.transactionID = transactionId
        const lockedGrant = (await transactionDb.execute(sql`
          SELECT
            "status",
            "expires_at" AS "expiresAt",
            "consumed_at" AS "consumedAt"
          FROM "syncshow_device_grants"
          WHERE "id" = ${Number(grant.id)}
          FOR UPDATE;
        `)).rows?.[0]
        if (!lockedGrant) {
          throw new SyncShowProtocolError('INVALID_DEVICE_CODE', 'The device authorization request is invalid.', 401)
        }
        const lockedStatus = String(lockedGrant.status || '')
        const lockedExpiry = Date.parse(String(lockedGrant.expiresAt || ''))
        const lockedConsumedAt = Date.parse(String(lockedGrant.consumedAt || ''))
        const retryableConsumed = lockedStatus === 'consumed'
          && Number.isFinite(lockedConsumedAt)
          && lockedConsumedAt > Date.now() - TOKEN_RETRY_MINUTES * 60_000
        if (lockedStatus === 'pending') {
          throw new SyncShowProtocolError('AUTHORIZATION_PENDING', 'The church administrator has not approved this connection yet.', 428)
        }
        if (!['approved', 'consumed'].includes(lockedStatus)
          || (lockedExpiry <= Date.now() && !retryableConsumed)) {
          throw new SyncShowProtocolError('AUTHORIZATION_DENIED', 'This SyncShow connection is denied or expired.', 403)
        }

        const existingConnection = (await transactionDb.execute(sql`
          SELECT
            "id",
            "token_hash" AS "tokenHash",
            "scopes",
            "expires_at" AS "expiresAt",
            "revoked_at" AS "revokedAt"
          FROM "syncshow_connections"
          WHERE "grant_id" = ${Number(grant.id)}
          FOR UPDATE;
        `)).rows?.[0]

        if (existingConnection) {
          if (existingConnection.revokedAt) {
            throw new SyncShowProtocolError('AUTHORIZATION_REVOKED', 'This SyncShow connection was revoked.', 403)
          }
          expiresAt = new Date(String(existingConnection.expiresAt)).toISOString()
          if (Date.parse(expiresAt) <= Date.now()) {
            throw new SyncShowProtocolError('AUTHORIZATION_EXPIRED', 'This SyncShow connection expired.', 403)
          }
          scopes = requestedScopes(
            existingConnection.scopes || requestedGrantScopes,
            { allowDisabledMedia: true },
          )
          if (String(existingConnection.tokenHash) !== tokenHash) {
            // Recover an exchange left in the old one-shot state by rotating
            // that connection to the deterministic token held by this same
            // authenticated device grant.
            await req.payload.update({
              collection: 'syncshow-connections',
              id: existingConnection.id as number | string,
              overrideAccess: true,
              data: { tokenHash },
              req,
            })
          }
        } else {
          if (lockedStatus === 'consumed') {
            throw new SyncShowProtocolError(
              'TOKEN_EXCHANGE_INCOMPLETE',
              'The previous token exchange did not complete. Start a new SyncShow connection.',
              409,
            )
          }
          expiresAt = new Date(Date.now() + CONNECTION_DAYS * 86_400_000).toISOString()
          scopes = requestedGrantScopes
          await req.payload.create({
            collection: 'syncshow-connections',
            overrideAccess: true,
            data: {
              community: communityId,
              user: userId,
              grant: Number(grant.id),
              clientName: String(grant.clientName),
              tokenHash,
              scopes,
              expiresAt,
              lastUsedAt: new Date().toISOString(),
            },
            req,
          })
        }
        if (lockedStatus === 'approved') {
          await req.payload.update({
            collection: 'syncshow-device-grants',
            id: grant.id as number | string,
            overrideAccess: true,
            data: { status: 'consumed', consumedAt: new Date().toISOString() },
            req,
          })
        }
        await adapter.commitTransaction(transactionId)
        committed = true
      } catch (error) {
        if (!committed) await adapter.rollbackTransaction(transactionId)
        throw error
      } finally {
        req.transactionID = previousTransactionId
      }
      return json(req, {
        schemaVersion: SYNCSHOW_PROTOCOL_VERSION,
        accessToken,
        refreshToken: null,
        expiresAt,
        scopes,
        account: {
          id: String(account.id),
          email: account.email,
          name: account.displayName || '',
        },
      })
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const deviceCancel: Endpoint = {
  path: '/community/syncshow/v1/auth/device/cancel',
  method: 'post',
  handler: async req => {
    try {
      const data = await boundedJson(req, 8 * 1024)
      const grant = await findDeviceGrant(req, data)
      if (!grant) return json(req, { cancelled: true })
      if (grant.status === 'pending') {
        await req.payload.update({
          collection: 'syncshow-device-grants',
          id: grant.id as number | string,
          overrideAccess: true,
          data: { status: 'cancelled' },
        })
      }
      return json(req, { cancelled: true })
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const deviceApprovalPage: Endpoint = {
  path: '/community/syncshow/v1/auth/device/approve',
  method: 'get',
  handler: async req => {
    const userCode = normalizeUserCode(new URL(req.url || communityPublicConfig.publicUrl).searchParams.get('user_code'))
    if (!userCode) {
      return html(`<!doctype html>
<meta charset="utf-8">
<title>Connect SyncShow</title>
<h1>Connect SyncShow</h1>
<p>Enter the code shown in SyncShow. Entering a code only opens the request; it does not approve it.</p>
<form method="get" action="/api/community/syncshow/v1/auth/device/approve">
  <label>Approval code <input name="user_code" required maxlength="9" autocomplete="one-time-code"></label>
  <button type="submit">Continue</button>
</form>`)
    }
    const foundGrant = userCode
      ? (await req.payload.find({
          collection: 'syncshow-device-grants',
          depth: 0,
          limit: 1,
          overrideAccess: true,
          showHiddenFields: true,
          req,
          where: { userCodeHash: { equals: hashOpaqueToken(userCode) } },
        })).docs[0]
      : undefined
    const grant = foundGrant ? requestDoc(foundGrant) : undefined
    const usable = grant
      && grant.status === 'pending'
      && Date.parse(String(grant.expiresAt || '')) > Date.now()
    const browserUser = await authenticatedBrowserUser(req)
    const loginMessage = browserUser
      ? ''
      : '<p>You must first sign in to the Community admin in this browser, then reopen this approval link.</p><p><a href="/admin/login">Open Community admin sign-in</a></p>'
    if (!usable) {
      return html('<!doctype html><meta charset="utf-8"><title>SyncShow connection</title><h1>Request unavailable</h1><p>This connection code is invalid, expired, or already used.</p>', 404)
    }
    return html(`<!doctype html>
<meta charset="utf-8">
<title>Approve SyncShow connection</title>
<h1>Approve SyncShow connection</h1>
<p><strong>${escapeHtml(grant.clientName)}</strong> is asking for: ${escapeHtml(
  Array.isArray(grant.scopes) ? grant.scopes.join(', ') : 'Community resource access',
)}</p>
<p>Requested account: ${escapeHtml(grant.requestedEmail)}</p>
${loginMessage}
<form method="post" action="/api/community/syncshow/v1/auth/device/approve">
  <input type="hidden" name="userCode" value="${escapeHtml(displayUserCode(userCode))}">
  <button type="submit" name="decision" value="approve">Approve connection</button>
  <button type="submit" name="decision" value="deny">Deny</button>
</form>
<p>Opening this page never approves a connection. Approval requires pressing the button above.</p>`)
  },
}

function sameOriginApprovalSubmission(req: PayloadRequest) {
  const expectedOrigin = new URL(communityPublicConfig.publicUrl).origin
  const origin = req.headers.get('origin')
  if (origin && origin !== 'null') return origin === expectedOrigin
  const referer = req.headers.get('referer')
  if (referer) {
    try {
      return new URL(referer).origin === expectedOrigin
    } catch {
      return false
    }
  }

  // Approval pages deliberately use Referrer-Policy: no-referrer. Firefox may
  // therefore omit both Origin and Referer on this same-origin form POST.
  // Sec-Fetch-Site is a browser-controlled request header and preserves the
  // same-origin CSRF boundary without weakening explicit-origin rejection.
  return req.headers.get('sec-fetch-site') === 'same-origin'
}

const deviceApprovalPost: Endpoint = {
  path: '/community/syncshow/v1/auth/device/approve',
  method: 'post',
  handler: async req => {
    if (!sameOriginApprovalSubmission(req)) {
      return html('<!doctype html><meta charset="utf-8"><title>SyncShow connection</title><h1>Request rejected</h1><p>Approval must be submitted from this Community server.</p>', 403)
    }
    const user = await authenticatedBrowserUser(req)
    if (!user) {
      return html('<!doctype html><meta charset="utf-8"><title>SyncShow connection</title><h1>Sign in required</h1><p>Sign in to the Community admin before approving SyncShow.</p>', 401)
    }
    if (!req.formData) return html('<!doctype html><meta charset="utf-8"><title>SyncShow connection</title><h1>Invalid request</h1>', 400)
    const form = await req.formData()
    const userCode = normalizeUserCode(form.get('userCode'))
    const decision = String(form.get('decision') || '')
    if (!userCode || !['approve', 'deny'].includes(decision)) {
      return html('<!doctype html><meta charset="utf-8"><title>SyncShow connection</title><h1>Invalid request</h1>', 400)
    }
    const foundGrant = (await req.payload.find({
      collection: 'syncshow-device-grants',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      showHiddenFields: true,
      req,
      where: { userCodeHash: { equals: hashOpaqueToken(userCode) } },
    })).docs[0]
    const grant = foundGrant ? requestDoc(foundGrant) : undefined
    if (!grant || grant.status !== 'pending' || Date.parse(String(grant.expiresAt || '')) <= Date.now()) {
      return html('<!doctype html><meta charset="utf-8"><title>SyncShow connection</title><h1>Request unavailable</h1><p>This connection code is invalid, expired, or already used.</p>', 404)
    }
    const communityId = relationId(grant.community)
    if (normalizeEmail(user.email) !== normalizeEmail(grant.requestedEmail)
      || !communityId
      || !await managerMembership(req, Number(user.id), communityId)) {
      return html('<!doctype html><meta charset="utf-8"><title>SyncShow connection</title><h1>Manager approval required</h1><p>Sign in with the exact church-manager account named in this request.</p>', 403)
    }
    await req.payload.update({
      collection: 'syncshow-device-grants',
      id: Number(grant.id),
      overrideAccess: true,
      data: decision === 'approve'
        ? { status: 'approved', approvedBy: Number(user.id), approvedAt: new Date().toISOString() }
        : { status: 'denied' },
    })
    return html(`<!doctype html><meta charset="utf-8"><title>SyncShow connection</title><h1>${decision === 'approve' ? 'SyncShow approved' : 'SyncShow denied'}</h1><p>You may close this window and return to SyncShow.</p>`)
  },
}

const revoke: Endpoint = {
  path: '/community/syncshow/v1/auth/revoke',
  method: 'post',
  handler: async req => {
    const authorization = req.headers.get('authorization') || ''
    const token = authorization.startsWith('SyncShow ')
      ? authorization.slice('SyncShow '.length).trim()
      : ''
    if (token) {
      const connection = (await req.payload.find({
        collection: 'syncshow-connections',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        showHiddenFields: true,
        req,
        where: { tokenHash: { equals: hashOpaqueToken(token) } },
      })).docs[0]
      if (connection && !connection.revokedAt) {
        await req.payload.update({
          collection: 'syncshow-connections',
          id: connection.id,
          overrideAccess: true,
          data: { revokedAt: new Date().toISOString() },
        })
      }
    }
    // Deliberately idempotent and non-enumerating: a repeated or unknown token
    // receives the same success response.
    return json(req, { ok: true })
  },
}

const songsListGet: Endpoint = {
  path: '/community/syncshow/v1/songs',
  method: 'get',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(req, SYNCSHOW_READ_SCOPE)
      const url = new URL(req.url || communityPublicConfig.publicUrl)
      const parsedLimit = Number.parseInt(url.searchParams.get('limit') || '100', 10)
      const limit = Math.min(100, SYNCSHOW_MAX_PAGE_SIZE, Math.max(1, parsedLimit || 100))
      const cursorValue = url.searchParams.get('cursor')
      const cursor = decodeCursor(cursorValue)
      const result = await req.payload.find({
        collection: 'songs',
        depth: 0,
        limit: limit + 1,
        sort: ['updatedAt', 'id'],
        overrideAccess: true,
        showHiddenFields: true,
        req,
        where: {
          and: [
            { community: { equals: auth.communityId } },
            ...(cursor
              ? [{
                  or: [
                    { updatedAt: { greater_than: cursor.updatedAt } },
                    {
                      and: [
                        { updatedAt: { equals: cursor.updatedAt } },
                        { id: { greater_than: cursor.id } },
                      ],
                    },
                  ],
                }]
              : []),
          ],
        },
      })
      const pageDocs = result.docs.map(requestDoc)
      const hasMore = pageDocs.length > limit
      const docs = pageDocs.slice(0, limit)
      const nextCursor = docs.length ? encodeCursor(docs[docs.length - 1]) : cursorValue
      const etag = listEtag(docs)
      if (req.headers.get('if-none-match') === etag) {
        return new Response(null, { status: 304, headers: cors(req, { ETag: etag }) })
      }
      return json(req, {
        schemaVersion: SYNCSHOW_PROTOCOL_VERSION,
        serverTime: new Date().toISOString(),
        items: docs.map(song => serializeSongForSync(song)),
        nextCursor,
        hasMore,
      }, { headers: { ETag: etag } })
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const songsCreate: Endpoint = {
  path: '/community/syncshow/v1/songs',
  method: 'post',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(req, SYNCSHOW_WRITE_SCOPE)
      const input = await boundedJson(req)
      const data = normalizeSongMutation(input, { create: true })
      if (await findSong(req, auth.communityId, String(data.syncId))) {
        throw new SyncShowProtocolError('SYNC_ID_EXISTS', 'A song with this syncId already exists.', 409)
      }
      const createdSong = await req.payload.create({
        collection: 'songs',
        draft: false,
        overrideAccess: true,
        data: {
          ...data,
          community: auth.communityId,
          syncVersion: 1,
        } as unknown as RequiredDataFromCollectionSlug<'songs'>,
      })
      const song = requestDoc(createdSong)
      const etag = songEtag(song)
      return json(req, serializeSongForSync(song), { status: 201, headers: { ETag: etag, Location: `/api/community/syncshow/v1/songs/${encodeURIComponent(String(song.syncId))}` } })
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const songGet: Endpoint = {
  path: '/community/syncshow/v1/songs/:syncId',
  method: 'get',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(req, SYNCSHOW_READ_SCOPE)
      const syncId = routeSyncId(req)
      const song = await findSong(req, auth.communityId, syncId)
      if (!song) throw new SyncShowProtocolError('SONG_NOT_FOUND', 'Song not found.', 404)
      const etag = songEtag(song)
      if (req.headers.get('if-none-match') === etag) {
        return new Response(null, { status: 304, headers: cors(req, { ETag: etag }) })
      }
      return json(req, serializeSongForSync(song), { headers: { ETag: etag } })
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const songPut: Endpoint = {
  path: '/community/syncshow/v1/songs/:syncId',
  method: 'put',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(req, SYNCSHOW_WRITE_SCOPE)
      const syncId = routeSyncId(req)
      const song = await findSong(req, auth.communityId, syncId)
      if (!song) throw new SyncShowProtocolError('SONG_NOT_FOUND', 'Song not found.', 404)
      const expectedEtag = songEtag(song)
      const providedEtag = req.headers.get('if-match')
      if (!providedEtag) throw new SyncShowProtocolError('PRECONDITION_REQUIRED', 'If-Match is required for song updates.', 428)
      if (providedEtag !== expectedEtag) {
        throw new SyncShowProtocolError('VERSION_CONFLICT', 'The song changed on the server. Refresh it before saving.', 412)
      }
      const input = await boundedJson(req)
      if (input.syncId !== undefined && String(input.syncId) !== syncId) {
        throw new SyncShowProtocolError('IMMUTABLE_SYNC_ID', 'syncId cannot be changed.', 409)
      }
      const data = normalizeSongMutation({ ...input, syncId }, { existing: song })
      const currentVersion = Number(song.syncVersion || 1)
      const updated = await updateSongWithCas(req, song, currentVersion, data)
      if (!updated) {
        throw new SyncShowProtocolError('VERSION_CONFLICT', 'The song changed on the server. Refresh it before saving.', 412)
      }
      const etag = songEtag(updated)
      return json(req, serializeSongForSync(updated), { headers: { ETag: etag } })
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const songDelete: Endpoint = {
  path: '/community/syncshow/v1/songs/:syncId',
  method: 'delete',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(req, SYNCSHOW_WRITE_SCOPE)
      const syncId = routeSyncId(req)
      const song = await findSong(req, auth.communityId, syncId)
      if (!song) throw new SyncShowProtocolError('SONG_NOT_FOUND', 'Song not found.', 404)
      const providedEtag = req.headers.get('if-match')
      if (!providedEtag) throw new SyncShowProtocolError('PRECONDITION_REQUIRED', 'If-Match is required for song archival.', 428)
      if (providedEtag !== songEtag(song)) {
        throw new SyncShowProtocolError('VERSION_CONFLICT', 'The song changed on the server. Refresh it before archiving.', 412)
      }
      if (song.status === 'archived') {
        return json(req, serializeSongForSync(song), { headers: { ETag: songEtag(song) } })
      }
      const currentVersion = Number(song.syncVersion || 1)
      const updated = await updateSongWithCas(req, song, currentVersion, {
        status: 'archived',
        visibility: 'private',
        publishAt: null,
      })
      if (!updated) {
        throw new SyncShowProtocolError('VERSION_CONFLICT', 'The song changed on the server. Refresh it before archiving.', 412)
      }
      return json(req, serializeSongForSync(updated), { headers: { ETag: songEtag(updated) } })
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const sermonsListGet: Endpoint = {
  path: '/community/syncshow/v1/sermons',
  method: 'get',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(req, SYNCSHOW_SERMON_READ_SCOPE)
      const url = new URL(req.url || communityPublicConfig.publicUrl)
      const parsedLimit = Number.parseInt(url.searchParams.get('limit') || '100', 10)
      const limit = Math.min(
        MAX_SERMON_CHANGE_ITEMS,
        Math.max(1, parsedLimit || MAX_SERMON_CHANGE_ITEMS),
      )
      const cursorValue = url.searchParams.get('cursor')
      const cursor = decodeSermonCursor(req, auth.communityId, cursorValue)
      const highWater = await sermonJournalHighWater(req, auth.communityId)
      if (cursor.checkpoint > highWater
        || (cursor.through !== null && cursor.through > highWater)) {
        throw new SyncShowProtocolError(
          'INVALID_CURSOR',
          'The sermon sync cursor is beyond this Community journal.',
        )
      }
      const through = cursor.through ?? highWater
      const fetchedChanges = await latestSermonChangesInSnapshot(req, {
        communityId: auth.communityId,
        checkpoint: cursor.checkpoint,
        through,
        afterSyncId: cursor.afterSyncId || '',
        limit,
      })
      const hasMore = fetchedChanges.length > limit
      const pageChanges = fetchedChanges.slice(0, limit)
      const nextCursor = hasMore
        ? encodeSermonSnapshotCursor(
            req,
            auth.communityId,
            cursor.checkpoint,
            through,
            String(pageChanges[pageChanges.length - 1].syncId),
          )
        : encodeSermonCheckpoint(req, auth.communityId, through)
      const page = normalizeSermonChangePage({
        schemaVersion: COMMUNITY_SERMON_WIRE_SCHEMA_VERSION,
        items: pageChanges.map(change => ({
          syncId: change.syncId,
          syncVersion: change.syncVersion,
          revision: change.revision,
          archived: change.archived,
          updatedAt: change.changedAt,
        })),
        nextCursor,
        hasMore,
      })
      return json(req, page)
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const sermonsCreate: Endpoint = {
  path: '/community/syncshow/v1/sermons',
  method: 'post',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(req, SYNCSHOW_SERMON_WRITE_SCOPE)
      const rawIdempotencyKey = req.headers.get('idempotency-key')
      if (!rawIdempotencyKey) {
        throw new SyncShowProtocolError(
          'PRECONDITION_REQUIRED',
          'Idempotency-Key is required for sermon creation.',
          428,
        )
      }
      const idempotencyKey = buildSermonIdempotencyHeaders(rawIdempotencyKey)['Idempotency-Key']
      const input = await boundedJson(req, MAX_SERMON_TRANSFER_JSON_BYTES)
      const write = normalizeSermonWriteRequest(input)
      const result = await createCanonicalSermon(
        req,
        auth.communityId,
        write,
        idempotencyKey,
      )
      const sermon = serializeSermonForSync(result.sermon)
      const etag = sermonEtag(result.sermon)
      return json(
        req,
        { sermon },
        {
          status: result.created ? 201 : 200,
          headers: {
            ETag: etag,
            Location: `/api/community/syncshow/v1/sermons/${encodeURIComponent(sermon.syncId)}`,
          },
        },
      )
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const sermonGet: Endpoint = {
  path: '/community/syncshow/v1/sermons/:syncId',
  method: 'get',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(req, SYNCSHOW_SERMON_READ_SCOPE)
      const syncId = routeSermonSyncId(req)
      const sermon = await findCanonicalSermon(req, auth.communityId, syncId)
      if (!sermon) {
        throw new SyncShowProtocolError('SERMON_NOT_FOUND', 'Sermon not found.', 404)
      }
      const etag = sermonEtag(sermon)
      if (req.headers.get('if-none-match') === etag) {
        return new Response(null, { status: 304, headers: cors(req, { ETag: etag }) })
      }
      return json(req, { sermon: serializeSermonForSync(sermon) }, { headers: { ETag: etag } })
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const sermonPut: Endpoint = {
  path: '/community/syncshow/v1/sermons/:syncId',
  method: 'put',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(req, SYNCSHOW_SERMON_WRITE_SCOPE)
      const syncId = routeSermonSyncId(req)
      const expectedVersion = parseSermonIfMatch(req, syncId)
      const input = await boundedJson(req, MAX_SERMON_TRANSFER_JSON_BYTES)
      const write = normalizeSermonWriteRequest(input)
      if (write.syncId !== syncId) {
        throw new SyncShowProtocolError(
          'IMMUTABLE_SYNC_ID',
          'syncId cannot be changed.',
          409,
        )
      }
      const sermon = await findCanonicalSermon(req, auth.communityId, syncId)
      if (!sermon) {
        throw new SyncShowProtocolError('SERMON_NOT_FOUND', 'Sermon not found.', 404)
      }
      const updated = await updateSermonWithCas(
        req,
        auth.communityId,
        sermon,
        expectedVersion,
        write,
      )
      if (!updated) {
        throw new SyncShowProtocolError(
          'VERSION_CONFLICT',
          'The sermon changed on the server. Refresh it before saving.',
          412,
        )
      }
      return json(
        req,
        { sermon: serializeSermonForSync(updated) },
        { headers: { ETag: sermonEtag(updated) } },
      )
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const sermonDelete: Endpoint = {
  path: '/community/syncshow/v1/sermons/:syncId',
  method: 'delete',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(req, SYNCSHOW_SERMON_WRITE_SCOPE)
      const syncId = routeSermonSyncId(req)
      const expectedVersion = parseSermonIfMatch(req, syncId)
      const sermon = await findCanonicalSermon(req, auth.communityId, syncId)
      if (!sermon) {
        throw new SyncShowProtocolError('SERMON_NOT_FOUND', 'Sermon not found.', 404)
      }
      if (sermon.syncArchived === true) {
        const currentVersion = Number(sermon.syncVersion)
        if (currentVersion !== expectedVersion && currentVersion !== expectedVersion + 1) {
          throw new SyncShowProtocolError(
            'VERSION_CONFLICT',
            'The sermon changed on the server. Refresh it before archiving.',
            412,
          )
        }
        return json(
          req,
          { sermon: serializeSermonForSync(sermon) },
          { headers: { ETag: sermonEtag(sermon) } },
        )
      }

      let document: CanonicalSermonDocument
      try {
        document = normalizeSermonDocument(JSON.parse(String(sermon.syncCurrentDocumentSource || '')))
      } catch {
        throw new SyncShowProtocolError(
          'INVALID_SERMON_STATE',
          'The stored sermon document is invalid.',
          500,
        )
      }
      const archivedDocument = normalizeSermonDocument({
        ...document,
        publication: {
          status: 'archived',
          visibility: 'private',
          publishedAt: null,
          canonicalUrl: null,
        },
      })
      const documentSource = serializeSermonDocument(archivedDocument)
      const write = normalizeSermonWriteRequest({
        syncId,
        revision: createHash('sha256').update(documentSource, 'utf8').digest('hex'),
        documentSource,
      })
      const updated = await updateSermonWithCas(
        req,
        auth.communityId,
        sermon,
        expectedVersion,
        write,
      )
      if (!updated) {
        throw new SyncShowProtocolError(
          'VERSION_CONFLICT',
          'The sermon changed on the server. Refresh it before archiving.',
          412,
        )
      }
      return json(
        req,
        { sermon: serializeSermonForSync(updated) },
        { headers: { ETag: sermonEtag(updated) } },
      )
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const sermonPublicationGet: Endpoint = {
  path: '/community/syncshow/v1/sermon-publications/:syncId',
  method: 'get',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(
        req,
        SYNCSHOW_SERMON_PUBLICATION_READ_SCOPE,
      )
      const syncId = routeSermonSyncId(req)
      const sermon = await findCanonicalSermon(req, auth.communityId, syncId)
      if (!sermon) {
        throw new SyncShowProtocolError('SERMON_NOT_FOUND', 'Sermon not found.', 404)
      }
      const publicationRow = await findSermonPublication(
        req,
        auth.communityId,
        Number(sermon.id),
      )
      const publication = publicationRow
        ? validateSermonPublicationRow(publicationRow)
        : null
      const catalog = await loadStoredPublicSermonCatalog(
        req.payload as never,
        auth.communityId,
      )
      if (!catalog) {
        throw new SyncShowProtocolError(
          'SERMON_PUBLICATION_UNAVAILABLE',
          'Sermon publication state is temporarily unavailable.',
          503,
        )
      }
      return json(req, {
        publication: buildCommunitySermonPublicationState({
          catalog,
          publication,
          sermon,
        }),
      })
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const servicePlansListGet: Endpoint = {
  path: '/community/syncshow/v1/service-plans',
  method: 'get',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(
        req,
        SYNCSHOW_SERVICE_PLAN_READ_SCOPE,
      )
      const url = new URL(req.url || communityPublicConfig.publicUrl)
      const limit = servicePlanPageLimit(url)
      const cursorValue = url.searchParams.get('cursor')
      const cursor = decodeServicePlanCursor(
        req,
        auth.communityId,
        cursorValue,
      )
      const result = await req.payload.find({
        collection: 'service-plans',
        depth: 0,
        limit: limit + 1,
        // SyncShow operators need the plans touched most recently first. The
        // id tie-breaker makes identical millisecond timestamps deterministic.
        sort: ['-changedAt', '-id'],
        overrideAccess: true,
        showHiddenFields: true,
        req,
        where: {
          and: [
            { community: { equals: auth.communityId } },
            ...(cursor
              ? [{
                  or: [
                    { changedAt: { less_than: cursor.changedAt } },
                    {
                      and: [
                        { changedAt: { equals: cursor.changedAt } },
                        { id: { less_than: cursor.id } },
                      ],
                    },
                  ],
                }]
              : []),
          ],
        },
      })
      const fetched = result.docs.map(requestDoc)
      const hasMore = fetched.length > limit
      const pagePlans = fetched.slice(0, limit)
      const nextCursor = hasMore
        ? encodeServicePlanCursor(
            req,
            auth.communityId,
            pagePlans[pagePlans.length - 1],
          )
        : null
      return json(req, normalizeCommunityServicePlanPage({
        items: pagePlans.map(servicePlanSummary),
        nextCursor,
        hasMore,
      }, { maximumItems: limit }))
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const servicePlanGet: Endpoint = {
  path: '/community/syncshow/v1/service-plans/:syncId',
  method: 'get',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(
        req,
        SYNCSHOW_SERVICE_PLAN_READ_SCOPE,
      )
      const syncId = routeServicePlanSyncId(req)
      const found = (await req.payload.find({
        collection: 'service-plans',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        showHiddenFields: true,
        req,
        where: {
          and: [
            { community: { equals: auth.communityId } },
            { syncId: { equals: syncId } },
          ],
        },
      })).docs[0]
      if (!found) {
        throw new SyncShowProtocolError(
          'SERVICE_PLAN_NOT_FOUND',
          'Service plan not found.',
          404,
        )
      }
      return json(req, { plan: servicePlanEnvelope(requestDoc(found)) })
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

export {
  serviceDocumentResponse,
  serviceDocumentSummary,
}

const serviceDocumentsListGet: Endpoint = {
  path: '/community/syncshow/v1/service-documents',
  method: 'get',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(
        req,
        SYNCSHOW_SERVICE_DOCUMENT_READ_SCOPE,
      )
      const url = new URL(req.url || communityPublicConfig.publicUrl)
      const limit = serviceDocumentPageLimit(url)
      const cursor = decodeServiceDocumentCursor(
        req,
        auth.communityId,
        SERVICE_DOCUMENT_LIST_LANE,
        url.searchParams.get('cursor'),
        null,
      )
      const result = await req.payload.find({
        collection: 'service-documents' as never,
        depth: 0,
        limit: limit + 1,
        sort: ['-changedAt', '-id'],
        overrideAccess: true,
        showHiddenFields: true,
        req,
        where: {
          and: [
            { community: { equals: auth.communityId } },
            ...(cursor
              ? [{
                  or: [
                    { changedAt: { less_than: cursor.changedAt } },
                    {
                      and: [
                        { changedAt: { equals: cursor.changedAt } },
                        { id: { less_than: cursor.id } },
                      ],
                    },
                  ],
                }]
              : []),
          ],
        },
      })
      const fetched = result.docs.map(requestDoc)
      const hasMore = fetched.length > limit
      const page = fetched.slice(0, limit)
      const last = page[page.length - 1]
      const nextCursor = hasMore && last
        ? encodeServiceDocumentCursor(
            req,
            auth.communityId,
            SERVICE_DOCUMENT_LIST_LANE,
            {
              changedAt: new Date(String(last.changedAt)).toISOString(),
              id: Number(last.id),
            },
          )
        : null
      return json(req, serviceDocumentListPage({
        items: page.map(serviceDocumentSummary),
        nextCursor,
        hasMore,
      }, limit))
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const serviceDocumentChangesGet: Endpoint = {
  path: '/community/syncshow/v1/service-documents/changes',
  method: 'get',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(
        req,
        SYNCSHOW_SERVICE_DOCUMENT_READ_SCOPE,
      )
      const url = new URL(req.url || communityPublicConfig.publicUrl)
      const limit = serviceDocumentPageLimit(url)
      const cursor = decodeServiceDocumentCursor(
        req,
        auth.communityId,
        SERVICE_DOCUMENT_CHANGE_LANE,
        url.searchParams.get('cursor'),
        { changedAt: '1970-01-01T00:00:00.000Z', id: 0 },
      ) as ServiceDocumentCursor
      const result = await req.payload.find({
        collection: 'service-documents' as never,
        depth: 0,
        limit: limit + 1,
        sort: ['changedAt', 'id'],
        overrideAccess: true,
        showHiddenFields: true,
        req,
        where: {
          and: [
            { community: { equals: auth.communityId } },
            {
              or: [
                { changedAt: { greater_than: cursor.changedAt } },
                {
                  and: [
                    { changedAt: { equals: cursor.changedAt } },
                    { id: { greater_than: cursor.id } },
                  ],
                },
              ],
            },
          ],
        },
      })
      const fetched = result.docs.map(requestDoc)
      const hasMore = fetched.length > limit
      const page = fetched.slice(0, limit)
      const last = page[page.length - 1]
      const checkpoint = last
        ? {
            changedAt: new Date(String(last.changedAt)).toISOString(),
            id: Number(last.id),
          }
        : cursor
      return json(req, serviceDocumentChangePage({
        items: page.map(serviceDocumentSummary),
        nextCursor: encodeServiceDocumentCursor(
          req,
          auth.communityId,
          SERVICE_DOCUMENT_CHANGE_LANE,
          checkpoint,
        ),
        hasMore,
      }, limit))
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const serviceDocumentsCreate: Endpoint = {
  path: '/community/syncshow/v1/service-documents',
  method: 'post',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(
        req,
        SYNCSHOW_SERVICE_DOCUMENT_WRITE_SCOPE,
      )
      const idempotencyKey = serviceDocumentIdempotencyKey(
        req.headers.get('idempotency-key'),
      )
      const write = normalizeServiceDocumentWrite(
        await boundedJson(req, MAX_SERVICE_DOCUMENT_TRANSFER_BYTES),
      )
      const result = await mutateServiceDocument(
        req,
        auth.communityId,
        write,
        idempotencyKey,
      )
      const serviceDocument = serviceDocumentResponse(result.document)
      return json(
        req,
        { serviceDocument },
        {
          status: result.created ? 201 : 200,
          headers: {
            ETag: serviceDocumentEtag(result.document),
            Location: `/api/community/syncshow/v1/service-documents/${encodeURIComponent(serviceDocument.syncId)}`,
          },
        },
      )
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const serviceDocumentAssetPut: Endpoint = {
  path: '/community/syncshow/v1/service-documents/assets/:assetId',
  method: 'put',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(
        req,
        SYNCSHOW_SERVICE_DOCUMENT_WRITE_SCOPE,
      )
      const asset = await storeServiceDocumentAsset(
        req,
        auth.communityId,
        req.routeParams?.assetId,
      )
      return new Response(null, {
        status: 201,
        headers: cors(req, {
          ETag: `"${asset.sha256}"`,
          Location: `/api/community/syncshow/v1/service-documents/assets/${encodeURIComponent(asset.id)}`,
          'X-Content-Type-Options': 'nosniff',
        }),
      })
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const serviceDocumentAssetGet: Endpoint = {
  path: '/community/syncshow/v1/service-documents/:syncId/assets/:assetId',
  method: 'get',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(
        req,
        SYNCSHOW_SERVICE_DOCUMENT_READ_SCOPE,
      )
      const syncId = serviceDocumentRouteId(req.routeParams?.syncId)
      const identity = serviceDocumentAssetId(req.routeParams?.assetId)
      const stored = await findServiceDocument(req, auth.communityId, syncId)
      if (!stored) {
        throw new SyncShowProtocolError(
          'SERVICE_DOCUMENT_NOT_FOUND',
          'Service document not found.',
          404,
        )
      }
      let document
      try {
        document = serviceCore.parseHeritageServiceDocumentSource(
          String(stored.documentSource || ''),
        )
      } catch {
        throw new SyncShowProtocolError(
          'INVALID_SERVICE_DOCUMENT_STATE',
          'Stored service document is invalid.',
          500,
        )
      }
      const asset = document.project.assets[identity.id]
      if (!asset || asset.kind !== 'image') {
        throw new ServiceDocumentAssetError(
          'SERVICE_ASSET_NOT_FOUND',
          'That image is not part of this service revision.',
          404,
        )
      }
      const bytes = await readServiceDocumentAsset(auth.communityId, asset)
      return new Response(new Uint8Array(bytes), {
        status: 200,
        headers: cors(req, {
          'Content-Type': asset.mediaType,
          'Content-Length': String(asset.size),
          ETag: `"${asset.sha256}"`,
          'X-Content-Type-Options': 'nosniff',
        }),
      })
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const serviceDocumentGet: Endpoint = {
  path: '/community/syncshow/v1/service-documents/:syncId',
  method: 'get',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(
        req,
        SYNCSHOW_SERVICE_DOCUMENT_READ_SCOPE,
      )
      const syncId = serviceDocumentRouteId(req.routeParams?.syncId)
      const document = await findServiceDocument(req, auth.communityId, syncId)
      if (!document) {
        throw new SyncShowProtocolError(
          'SERVICE_DOCUMENT_NOT_FOUND',
          'Service document not found.',
          404,
        )
      }
      const etag = serviceDocumentEtag(document)
      if (req.headers.get('if-none-match') === etag) {
        return new Response(null, {
          status: 304,
          headers: cors(req, { ETag: etag }),
        })
      }
      return json(
        req,
        { serviceDocument: serviceDocumentResponse(document) },
        { headers: { ETag: etag } },
      )
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

const serviceDocumentPut: Endpoint = {
  path: '/community/syncshow/v1/service-documents/:syncId',
  method: 'put',
  handler: async req => {
    try {
      const auth = await authorizeSyncShow(
        req,
        SYNCSHOW_SERVICE_DOCUMENT_WRITE_SCOPE,
      )
      const routeId = serviceDocumentRouteId(req.routeParams?.syncId)
      const idempotencyKey = serviceDocumentIdempotencyKey(
        req.headers.get('idempotency-key'),
      )
      const write = normalizeServiceDocumentWrite(
        await boundedJson(req, MAX_SERVICE_DOCUMENT_TRANSFER_BYTES),
        { update: true },
      )
      if (write.syncId !== routeId) {
        throw new SyncShowProtocolError(
          'IMMUTABLE_SYNC_ID',
          'Service-document syncId cannot be changed.',
          409,
        )
      }
      if (req.headers.get('if-match') !== `"${write.baseRevision}"`
        || req.headers.get('x-heritage-base-sync-version')
          !== String(write.baseSyncVersion)) {
        throw new SyncShowProtocolError(
          'INVALID_SERVICE_DOCUMENT_BASE',
          'The service-document base headers do not match the request body.',
          412,
        )
      }
      const result = await mutateServiceDocument(
        req,
        auth.communityId,
        write,
        idempotencyKey,
      )
      return json(
        req,
        { serviceDocument: serviceDocumentResponse(result.document) },
        { headers: { ETag: serviceDocumentEtag(result.document) } },
      )
    } catch (error) {
      return protocolError(req, error)
    }
  },
}

export const syncShowEndpoints: Endpoint[] = [
  deviceStart,
  deviceStatus,
  deviceToken,
  deviceCancel,
  deviceApprovalPage,
  deviceApprovalPost,
  revoke,
  songsListGet,
  songsCreate,
  songGet,
  songPut,
  songDelete,
  sermonsListGet,
  sermonsCreate,
  sermonGet,
  sermonPut,
  sermonDelete,
  sermonPublicationGet,
  servicePlansListGet,
  servicePlanGet,
  serviceDocumentsListGet,
  serviceDocumentChangesGet,
  serviceDocumentsCreate,
  serviceDocumentAssetPut,
  serviceDocumentAssetGet,
  serviceDocumentGet,
  serviceDocumentPut,
]
