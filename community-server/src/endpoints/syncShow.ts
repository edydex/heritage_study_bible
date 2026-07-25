import {
  headersWithCors,
  type Endpoint,
  type PayloadRequest,
  type RequiredDataFromCollectionSlug,
} from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { randomBytes } from 'node:crypto'
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
  SyncShowProtocolError,
  SYNCSHOW_WRITE_SCOPE,
} from '@/lib/syncShowProtocol'

const DEVICE_GRANT_MINUTES = 10
const CONNECTION_DAYS = 180
const TOKEN_RETRY_MINUTES = 15
const DEVICE_POLL_SECONDS = 3
const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const RATE_WINDOW_MS = 15 * 60_000
const rateLimits = new Map<string, { count: number; resetAt: number }>()

type RequestDoc = Record<string, unknown>
type SyncShowAuth = {
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

function requestedScopes(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > SYNCSHOW_SCOPES.length) {
    throw new SyncShowProtocolError('INVALID_SCOPE', 'Request one or both supported SyncShow song scopes.')
  }
  const scopes = [...new Set(value.map(String))].sort()
  if (scopes.some(scope => !SYNCSHOW_SCOPES.includes(scope as typeof SYNCSHOW_SCOPES[number]))
    || (scopes.includes(SYNCSHOW_WRITE_SCOPE) && !scopes.includes(SYNCSHOW_READ_SCOPE))) {
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
  const result = await req.payload.auth({ headers: req.headers })
  return result.user ? requestDoc(result.user) : null
}

async function authorizeSyncShow(req: PayloadRequest, scope: string): Promise<SyncShowAuth> {
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
  if (!connection || !scopes.includes(scope)) {
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
            `${clientName} requested access to manage the ${communityPublicConfig.name} song library.`,
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
      const requestedGrantScopes = requestedScopes(grant.scopes)
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
          scopes = requestedScopes(existingConnection.scopes || requestedGrantScopes)
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
  Array.isArray(grant.scopes) ? grant.scopes.join(', ') : 'song library access',
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

const deviceApprovalPost: Endpoint = {
  path: '/community/syncshow/v1/auth/device/approve',
  method: 'post',
  handler: async req => {
    const expectedOrigin = new URL(communityPublicConfig.publicUrl).origin
    if (req.headers.get('origin') !== expectedOrigin) {
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
]
