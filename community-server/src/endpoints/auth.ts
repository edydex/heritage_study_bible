import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { headersWithCors, type Endpoint, type PayloadRequest } from 'payload'
import { recordAccountSecurityEvent } from '@/lib/accountSecurityNotification'
import { consumePersistentRateLimit } from '@/lib/authRateLimit'
import { communityBearerToken, currentCommunitySession, relationId } from '@/lib/communitySession'
import { MAGIC_LINK_MINUTES, sendCommunityMagicLinkEmail } from '@/lib/communityMagicLinkEmail'
import { communityAuthEnabled, communityPublicConfig } from '@/lib/publicConfig'
import { lockSyncUser } from '@/lib/syncDatabase'
import { normalizeDeviceIdentity } from '@/lib/syncProtocol'
import { createOpaqueToken, hashOpaqueToken } from '@/lib/tokens'
import { verifyStrictPassword } from '@/lib/strictPassword'

const SESSION_DAYS = 30
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60_000
const PASSWORD_ATTEMPT_LIMIT = 8

type TransactionDatabase = {
  execute: (query: unknown) => Promise<{ rows?: Array<Record<string, unknown>> }>
}

type AuthTransactionAdapter = {
  beginTransaction: () => Promise<null | number | string>
  commitTransaction: (id: number | string) => Promise<void>
  rollbackTransaction: (id: number | string) => Promise<void>
  sessions: Record<string, { db: TransactionDatabase }>
}

function cors(req: Parameters<Endpoint['handler']>[0]) {
  return headersWithCors({ headers: new Headers({ 'Cache-Control': 'private, no-store' }), req })
}

export function normalizeEmail(value: unknown) {
  const email = String(value || '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320 ? email : ''
}

async function requestBody(req: PayloadRequest) {
  if (req.json) return req.json().catch(() => ({}))
  if (req.text) return req.text().then(value => JSON.parse(value)).catch(() => ({}))
  return {}
}

async function configuredCommunity(req: Parameters<Endpoint['handler']>[0]) {
  return (await req.payload.find({
    collection: 'communities', depth: 0, limit: 1, overrideAccess: true,
    req,
    where: { slug: { equals: communityPublicConfig.id } },
  })).docs[0]
}

async function activeInvitation(req: PayloadRequest, communityID: string, email: string) {
  return (await req.payload.find({
    collection: 'community-invites', depth: 0, limit: 1, overrideAccess: true,
    req,
    where: { and: [
      { community: { equals: communityID } },
      { email: { equals: email } },
      { active: { equals: true } },
    ] },
  })).docs[0]
}

async function existingMembership(req: PayloadRequest, communityID: string, userID: string) {
  return (await req.payload.find({
    collection: 'memberships', depth: 0, limit: 1, overrideAccess: true,
    req,
    where: { and: [
      { community: { equals: communityID } },
      { user: { equals: userID } },
    ] },
  })).docs[0]
}

function clientAddress(req: PayloadRequest) {
  return req.headers.get('cf-connecting-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'local'
}

function legacyDevice(address: string) {
  return {
    deviceId: `legacy-${createHash('sha256').update(address).digest('hex').slice(0, 32)}`,
    deviceName: 'Heritage app',
    platform: 'legacy',
  }
}

function requestedDevice(data: Record<string, unknown>, address: string) {
  try {
    return normalizeDeviceIdentity(data)
  } catch {
    if (!data.deviceId) return legacyDevice(address)
    throw new Error('This device needs a new secure identity.')
  }
}

async function rateLimit(req: PayloadRequest, key: string, maximum: number) {
  return consumePersistentRateLimit({ payload: req.payload, key, maximum, windowMs: AUTH_RATE_LIMIT_WINDOW_MS })
}

function tooManyRequests(req: PayloadRequest, retryAfter: number) {
  const headers = cors(req)
  headers.set('Retry-After', String(retryAfter))
  return Response.json({ error: 'Too many sign-in attempts. Please wait and try again.' }, { status: 429, headers })
}

function authDisabled(req: PayloadRequest) {
  if (communityAuthEnabled) return null
  return Response.json({
    code: 'COMMUNITY_AUTH_DISABLED',
    error: 'Community member sign-in is disabled on this server.',
  }, { status: 503, headers: cors(req) })
}

function invalidCredentials(req: PayloadRequest) {
  return Response.json({ error: 'The sign-in link or password is invalid or expired.' }, { status: 401, headers: cors(req) })
}

function transactionDatabase(req: PayloadRequest) {
  const transactionId = req.transactionID
  if (transactionId == null || transactionId instanceof Promise) {
    throw new Error('Community authentication transaction is unavailable.')
  }
  const adapter = req.payload.db as unknown as AuthTransactionAdapter
  const database = adapter.sessions?.[String(transactionId)]?.db
  if (!database?.execute) throw new Error('Community authentication transaction is unavailable.')
  return database
}

async function withAuthTransaction<T>(req: PayloadRequest, operation: (database: TransactionDatabase) => Promise<T>) {
  const adapter = req.payload.db as unknown as AuthTransactionAdapter
  const transactionId = await adapter.beginTransaction()
  if (transactionId == null || !adapter.sessions?.[String(transactionId)]?.db) {
    throw new Error('Community authentication transaction is unavailable.')
  }
  const previous = req.transactionID
  let committed = false
  req.transactionID = transactionId
  try {
    const result = await operation(transactionDatabase(req))
    await adapter.commitTransaction(transactionId)
    committed = true
    return result
  } catch (error) {
    if (!committed) await adapter.rollbackTransaction(transactionId)
    throw error
  } finally {
    req.transactionID = previous
  }
}

async function lockChallenge(req: PayloadRequest, database: TransactionDatabase, tokenHash: string) {
  const result = await database.execute(sql`
    SELECT "id"
      FROM "community_auth_challenges"
     WHERE "token_hash" = ${tokenHash}
     FOR UPDATE
  `)
  const challengeId = Number(result.rows?.[0]?.id)
  if (!Number.isSafeInteger(challengeId) || challengeId < 1) return null
  return req.payload.findByID({
    collection: 'community-auth-challenges', id: challengeId, depth: 0, overrideAccess: true, req,
  })
}

export function challengeIsUsable(challenge: Record<string, unknown> | null) {
  if (!challenge || challenge.consumedAt || challenge.supersededAt) return false
  const expiresAt = Date.parse(String(challenge.expiresAt || ''))
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

async function consumeLockedChallenge(database: TransactionDatabase, challengeId: number | string) {
  const result = await database.execute(sql`
    UPDATE "community_auth_challenges"
       SET "consumed_at" = now(), "updated_at" = now()
     WHERE "id" = ${Number(challengeId)}
       AND "consumed_at" IS NULL
       AND "superseded_at" IS NULL
       AND "expires_at" > now()
    RETURNING "id"
  `)
  return Array.isArray(result.rows) && result.rows.length === 1
}

async function lockCurrentBearerSession(req: PayloadRequest, database: TransactionDatabase) {
  const token = communityBearerToken(req.headers)
  if (!token) return null
  const result = await database.execute(sql`
    SELECT "id"
      FROM "community_sessions"
     WHERE "token_hash" = ${hashOpaqueToken(token)}
       AND "expires_at" > now()
       AND "revoked_at" IS NULL
     FOR UPDATE
  `)
  const sessionId = Number(result.rows?.[0]?.id)
  if (!Number.isSafeInteger(sessionId) || sessionId < 1) return null
  return req.payload.findByID({
    collection: 'community-sessions', id: sessionId, depth: 0, overrideAccess: true, req,
  })
}

async function upsertDevice(req: PayloadRequest, userId: number, device: ReturnType<typeof legacyDevice>) {
  await transactionDatabase(req).execute(sql`
    SELECT pg_advisory_xact_lock(hashtext(${`community-sync-device:${userId}:${device.deviceId}`}))
  `)
  const existing = (await req.payload.find({
    collection: 'sync-devices', depth: 0, limit: 1, overrideAccess: true,
    req,
    where: { and: [
      { user: { equals: userId } },
      { deviceId: { equals: device.deviceId } },
    ] },
  })).docs[0]
  if (existing?.revokedAt) return null
  if (existing) {
    return req.payload.update({
      collection: 'sync-devices', id: existing.id, overrideAccess: true,
      req,
      data: { friendlyName: device.deviceName, platform: device.platform },
    })
  }
  return req.payload.create({
    collection: 'sync-devices', overrideAccess: true,
    req,
    data: {
      user: userId,
      deviceId: device.deviceId,
      friendlyName: device.deviceName,
      platform: device.platform,
      firstConnectedAt: new Date().toISOString(),
    },
  })
}

export const authEndpoints: Endpoint[] = [
  {
    path: '/community/auth/magic-link',
    method: 'post',
    handler: async req => {
      const disabledResponse = authDisabled(req)
      if (disabledResponse) return disabledResponse
      const address = clientAddress(req)
      const addressLimit = await rateLimit(req, `magic-link:address:${address}`, 10)
      if (!addressLimit.allowed) return tooManyRequests(req, addressLimit.retryAfter)

      const data = await requestBody(req) as Record<string, unknown>
      const email = normalizeEmail(data.email)
      if (!email) return Response.json({ error: 'Enter a valid email address.' }, { status: 400, headers: cors(req) })
      const emailLimit = await rateLimit(req, `magic-link:email:${email}`, 5)
      if (!emailLimit.allowed) return tooManyRequests(req, emailLimit.retryAfter)
      let device
      try {
        device = requestedDevice(data, address)
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : 'This device needs a new secure identity.' }, { status: 400, headers: cors(req) })
      }
      const flow = data.flow === 'sync' ? 'sync' : 'community'
      const community = await configuredCommunity(req)
      if (!community) return Response.json({ error: 'This Community has not finished setup.' }, { status: 503, headers: cors(req) })

      const user = (await req.payload.find({
        collection: 'users', depth: 0, limit: 1, overrideAccess: true,
        req,
        where: { email: { equals: email } },
      })).docs[0]
      const communityID = String(community.id)
      const invitation = await activeInvitation(req, communityID, email)
      const membership = user ? await existingMembership(req, communityID, String(user.id)) : null
      const mayJoin = flow === 'sync' || community.joinPolicy === 'open' || Boolean(invitation || membership)

      // The response is deliberately identical for existing, invited, and
      // unknown addresses. An ineligible address receives no token or message.
      if (mayJoin) {
        try {
          await sendCommunityMagicLinkEmail({
            payload: req.payload,
            email,
            displayName: invitation?.displayName,
            userID: user?.id,
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            platform: device.platform,
            flow,
          })
        } catch {
          // Do not reveal whether this address was eligible by changing the
          // public response when SMTP or challenge storage fails.
          req.payload.logger.warn('A Heritage public sign-in email request could not be completed.')
        }
      }
      return Response.json({
        ok: true,
        accepted: true,
        message: 'If this address can sign in and the mail service accepted the request, a link will arrive shortly.',
        expiresAt: new Date(Date.now() + MAGIC_LINK_MINUTES * 60_000).toISOString(),
      }, { status: 202, headers: cors(req) })
    },
  },
  {
    path: '/community/auth/session',
    method: 'post',
    handler: async req => {
      const disabledResponse = authDisabled(req)
      if (disabledResponse) return disabledResponse
      const address = clientAddress(req)
      const attemptLimit = await rateLimit(req, `session:address:${address}`, 30)
      if (!attemptLimit.allowed) return tooManyRequests(req, attemptLimit.retryAfter)

      const data = await requestBody(req) as Record<string, unknown>
      const magicToken = String(data.token || '')
      if (!magicToken) return invalidCredentials(req)
      const transition = await withAuthTransaction(req, async database => {
        const challenge = await lockChallenge(req, database, hashOpaqueToken(magicToken))
        if (!challenge || !challengeIsUsable(challenge as unknown as Record<string, unknown>)) {
          return { response: invalidCredentials(req) } as const
        }

        const userId = relationId(challenge?.user)
        if (!userId) return { response: invalidCredentials(req) } as const
        await lockSyncUser(req, userId)
        const user = await req.payload.findByID({
          collection: 'users', id: userId, depth: 0, overrideAccess: true, req,
        })
        if (!user) return { response: invalidCredentials(req) } as const

        if (challenge?.purpose === 'reverify') {
          const current = await lockCurrentBearerSession(req, database)
          if (
            !current
            || relationId(current.user) !== userId
            || String(current.deviceId || '') !== String(challenge.deviceId || '')
          ) return { response: invalidCredentials(req) } as const
          if (!await consumeLockedChallenge(database, challenge.id)) {
            return { response: invalidCredentials(req) } as const
          }
          const emailVerifiedAt = new Date().toISOString()
          await req.payload.update({
            collection: 'community-sessions', id: current.id, overrideAccess: true, req,
            data: { emailVerifiedAt, lastUsedAt: emailVerifiedAt },
          })
          return { response: Response.json({ reverified: true, emailVerifiedAt }, { headers: cors(req) }) } as const
        }

        if (user.accountProtection === 'strict-password') {
          if (typeof data.password !== 'string') {
            return {
              response: Response.json({ passwordRequired: true }, { status: 428, headers: cors(req) }),
            } as const
          }
          const passwordLimit = await rateLimit(req, `password:user:${userId}`, PASSWORD_ATTEMPT_LIMIT)
          if (!passwordLimit.allowed) {
            return { response: tooManyRequests(req, passwordLimit.retryAfter) } as const
          }
          const validPassword = await verifyStrictPassword(user.strictPasswordHash, data.password)
          if (!validPassword) {
            const failures = Number(challenge.failedAttempts || 0) + 1
            await req.payload.update({
              collection: 'community-auth-challenges', id: challenge.id, overrideAccess: true, req,
              data: {
                failedAttempts: failures,
                ...(failures >= PASSWORD_ATTEMPT_LIMIT ? { supersededAt: new Date().toISOString() } : {}),
              },
            })
            return { response: invalidCredentials(req) } as const
          }
        }

        const community = await configuredCommunity(req)
        if (!community) {
          return {
            response: Response.json({ error: 'This Community has not finished setup.' }, { status: 503, headers: cors(req) }),
          } as const
        }
        const communityID = String(community.id)
        const membership = await existingMembership(req, communityID, String(userId))
        const invitation = await activeInvitation(req, communityID, normalizeEmail(user.email))
        const syncOnly = challenge?.flow === 'sync' && !membership && !invitation
        if (challenge?.flow !== 'sync' && community.joinPolicy !== 'open' && !membership && !invitation) {
          return { response: invalidCredentials(req) } as const
        }

        const device = {
          deviceId: String(challenge?.deviceId || ''),
          deviceName: String(challenge?.deviceName || ''),
          platform: String(challenge?.platform || ''),
        }
        if (!await upsertDevice(req, userId, device)) {
          return { response: invalidCredentials(req) } as const
        }
        if (!await consumeLockedChallenge(database, challenge.id)) {
          return { response: invalidCredentials(req) } as const
        }

        const now = new Date().toISOString()
        const sessionToken = createOpaqueToken()
        const sessionExpiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString()
        await req.payload.create({
          collection: 'community-sessions', overrideAccess: true, req,
          data: {
            expiresAt: sessionExpiresAt,
            tokenHash: hashOpaqueToken(sessionToken),
            user: user.id,
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            platform: device.platform,
            emailVerifiedAt: now,
            lastUsedAt: now,
            syncGeneration: Number(user.syncGeneration || 1),
          },
        })
        if (!membership && challenge?.flow !== 'sync') {
          await req.payload.create({
            collection: 'memberships', draft: false, overrideAccess: true, req,
            data: { community: community.id, user: user.id, role: invitation?.role || 'member', joinedAt: now },
          })
        }
        if (invitation) {
          await req.payload.update({
            collection: 'community-invites', id: invitation.id, overrideAccess: true, req,
            data: { active: false, acceptedAt: now },
          })
        }
        return {
          notification: {
            userId: Number(user.id),
            email: user.email,
            deviceId: device.deviceId,
            deviceName: device.deviceName,
          },
          responseBody: {
            token: sessionToken,
            expiresAt: sessionExpiresAt,
            member: { id: user.id, email: user.email, displayName: user.displayName },
            communityId: community.id,
            accountProtection: user.accountProtection || 'email',
            deviceId: device.deviceId,
            syncOnly,
            syncGeneration: Number(user.syncGeneration || 1),
          },
        } as const
      })

      if ('response' in transition && transition.response) return transition.response
      // The session, membership, invitation, device, and one-time-token
      // transition is committed before any notification side effect begins.
      await recordAccountSecurityEvent({
        payload: req.payload,
        ...transition.notification,
        eventType: 'device-connected',
      })
      return Response.json(transition.responseBody, { headers: cors(req) })
    },
  },
  {
    path: '/community/auth/reverify',
    method: 'post',
    handler: async req => {
      const disabledResponse = authDisabled(req)
      if (disabledResponse) return disabledResponse
      const session = await currentCommunitySession(req)
      const userId = relationId(session?.user)
      if (!session || !userId) return invalidCredentials(req)
      const user = await req.payload.findByID({
        collection: 'users', id: userId, depth: 0, overrideAccess: true, req,
      })
      if (!user) return invalidCredentials(req)
      const address = clientAddress(req)
      const addressLimit = await rateLimit(req, `reverify:address:${address}`, 10)
      if (!addressLimit.allowed) return tooManyRequests(req, addressLimit.retryAfter)
      const userLimit = await rateLimit(req, `reverify:user:${userId}`, 5)
      if (!userLimit.allowed) return tooManyRequests(req, userLimit.retryAfter)
      try {
        await sendCommunityMagicLinkEmail({
          payload: req.payload,
          email: String(user.email),
          userID: user.id,
          deviceId: String(session.deviceId || 'legacy-community-device'),
          deviceName: String(session.deviceName || 'Heritage device'),
          platform: String(session.platform || 'unknown'),
          purpose: 'reverify',
          flow: 'sync',
        })
      } catch {
        req.payload.logger.warn('A Heritage re-verification email request could not be completed.')
        return Response.json({
          error: 'The verification email could not be sent. Please try again later.',
        }, { status: 503, headers: cors(req) })
      }
      return Response.json({
        ok: true,
        accepted: true,
        expiresAt: new Date(Date.now() + MAGIC_LINK_MINUTES * 60_000).toISOString(),
      }, { status: 202, headers: cors(req) })
    },
  },
  {
    path: '/community/auth/logout',
    method: 'post',
    handler: async req => {
      const session = await currentCommunitySession(req)
      if (session) {
        await req.payload.update({
          collection: 'community-sessions', id: session.id, overrideAccess: true,
          data: { revokedAt: new Date().toISOString() },
        })
      }
      return Response.json({ ok: true }, { headers: cors(req) })
    },
  },
]
