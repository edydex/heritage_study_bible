import { headersWithCors, type Endpoint } from 'payload'
import { MAGIC_LINK_MINUTES, sendCommunityMagicLinkEmail } from '@/lib/communityMagicLinkEmail'
import { communityAuthEnabled, communityPublicConfig } from '@/lib/publicConfig'
import { createOpaqueToken, hashOpaqueToken } from '@/lib/tokens'

const SESSION_DAYS = 30
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60_000
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>()

function cors(req: Parameters<Endpoint['handler']>[0]) {
  return headersWithCors({ headers: new Headers(), req })
}

function normalizeEmail(value: unknown) {
  const email = String(value || '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

async function configuredCommunity(req: Parameters<Endpoint['handler']>[0]) {
  return (await req.payload.find({
    collection: 'communities',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { slug: { equals: communityPublicConfig.id } },
  })).docs[0]
}

async function activeInvitation(
  req: Parameters<Endpoint['handler']>[0],
  communityID: string,
  email: string,
) {
  return (await req.payload.find({
    collection: 'community-invites',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [
        { community: { equals: communityID } },
        { email: { equals: email } },
        { active: { equals: true } },
      ],
    },
  })).docs[0]
}

async function existingMembership(
  req: Parameters<Endpoint['handler']>[0],
  communityID: string,
  userID: string,
) {
  return (await req.payload.find({
    collection: 'memberships',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [
        { community: { equals: communityID } },
        { user: { equals: userID } },
      ],
    },
  })).docs[0]
}

function clientAddress(req: Parameters<Endpoint['handler']>[0]) {
  return req.headers.get('cf-connecting-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'local'
}

function trimRateLimitBuckets(now: number) {
  if (rateLimitBuckets.size < 10_000) return
  for (const [bucketKey, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) rateLimitBuckets.delete(bucketKey)
  }
  while (rateLimitBuckets.size >= 10_000) {
    const oldestKey = rateLimitBuckets.keys().next().value
    if (!oldestKey) break
    rateLimitBuckets.delete(oldestKey)
  }
}

function consumeRateLimit(key: string, maximum: number) {
  const now = Date.now()
  const current = rateLimitBuckets.get(key)
  if (!current || current.resetAt <= now) {
    trimRateLimitBuckets(now)
    rateLimitBuckets.set(key, { count: 1, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS })
    return 0
  }

  if (current.count >= maximum) {
    return Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  }

  current.count += 1
  return 0
}

function tooManyRequests(req: Parameters<Endpoint['handler']>[0], retryAfter: number) {
  const headers = cors(req)
  headers.set('Retry-After', String(retryAfter))
  return Response.json(
    { error: 'Too many sign-in attempts. Please wait and try again.' },
    { status: 429, headers },
  )
}

function authDisabled(req: Parameters<Endpoint['handler']>[0]) {
  if (communityAuthEnabled) return null
  return Response.json(
    {
      code: 'COMMUNITY_AUTH_DISABLED',
      error: 'Community member sign-in is disabled on this server.',
    },
    { status: 503, headers: cors(req) },
  )
}

export const authEndpoints: Endpoint[] = [
  {
    path: '/community/auth/magic-link',
    method: 'post',
    handler: async req => {
      const disabledResponse = authDisabled(req)
      if (disabledResponse) return disabledResponse

      const address = clientAddress(req)
      const addressRetry = consumeRateLimit(`magic-link:address:${address}`, 10)
      if (addressRetry) return tooManyRequests(req, addressRetry)

      const data = req.json ? await req.json().catch(() => ({})) : {} as { email?: unknown }
      const email = normalizeEmail(data.email)
      if (!email) return Response.json({ error: 'Enter a valid email address.' }, { status: 400, headers: cors(req) })
      const emailRetry = consumeRateLimit(`magic-link:email:${email}`, 5)
      if (emailRetry) return tooManyRequests(req, emailRetry)

      const community = await configuredCommunity(req)
      if (!community) {
        return Response.json(
          { error: 'This Community has not finished setup.' },
          { status: 503, headers: cors(req) },
        )
      }

      let user = (await req.payload.find({
        collection: 'users',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { email: { equals: email } },
      })).docs[0]

      const communityID = String(community.id)
      const invitation = await activeInvitation(req, communityID, email)
      const membership = user
        ? await existingMembership(req, communityID, String(user.id))
        : null
      const mayJoin = community.joinPolicy === 'open' || Boolean(invitation || membership)

      // Do not reveal whether an address was invited. The Heritage app shows
      // the same "check your email" state either way, while an uninvited
      // address receives no account, token, or message.
      if (!mayJoin) {
        return Response.json({
          ok: true,
          expiresAt: new Date(Date.now() + MAGIC_LINK_MINUTES * 60_000).toISOString(),
        }, { headers: cors(req) })
      }

      const { expiresAt, link } = await sendCommunityMagicLinkEmail({
        payload: req.payload,
        email,
        displayName: invitation?.displayName,
        userID: user?.id,
      })

      return Response.json({
        ok: true,
        expiresAt,
        ...(process.env.NODE_ENV !== 'production' ? { debugLink: link } : {}),
      }, { headers: cors(req) })
    },
  },
  {
    path: '/community/auth/session',
    method: 'post',
    handler: async req => {
      const disabledResponse = authDisabled(req)
      if (disabledResponse) return disabledResponse

      const retryAfter = consumeRateLimit(`session:address:${clientAddress(req)}`, 30)
      if (retryAfter) return tooManyRequests(req, retryAfter)

      const data = req.json ? await req.json().catch(() => ({})) : {} as { token?: unknown }
      const magicToken = String(data.token || '')
      if (!magicToken) return Response.json({ error: 'Invalid or expired sign-in link.' }, { status: 401, headers: cors(req) })

      const result = await req.payload.find({
        collection: 'users',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: {
          and: [
            { magicLinkTokenHash: { equals: hashOpaqueToken(magicToken) } },
            { magicLinkExpiresAt: { greater_than: new Date().toISOString() } },
          ],
        },
      })
      const user = result.docs[0]
      if (!user) return Response.json({ error: 'Invalid or expired sign-in link.' }, { status: 401, headers: cors(req) })

      const community = await configuredCommunity(req)
      if (!community) {
        return Response.json(
          { error: 'This Community has not finished setup.' },
          { status: 503, headers: cors(req) },
        )
      }
      const communityID = String(community.id)
      const membership = await existingMembership(req, communityID, String(user.id))
      const invitation = await activeInvitation(req, communityID, String(user.email || '').toLowerCase())
      if (community.joinPolicy !== 'open' && !membership && !invitation) {
        await req.payload.update({
          collection: 'users',
          id: user.id,
          overrideAccess: true,
          data: { magicLinkTokenHash: null, magicLinkExpiresAt: null },
        })
        return Response.json({ error: 'Invalid or expired sign-in link.' }, { status: 401, headers: cors(req) })
      }

      const sessionToken = createOpaqueToken()
      const sessionExpiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString()
      await req.payload.delete({
        collection: 'community-sessions',
        overrideAccess: true,
        where: {
          and: [
            { user: { equals: user.id } },
            { expiresAt: { less_than_equal: new Date().toISOString() } },
          ],
        },
      })
      await req.payload.create({
        collection: 'community-sessions',
        overrideAccess: true,
        data: {
          expiresAt: sessionExpiresAt,
          tokenHash: hashOpaqueToken(sessionToken),
          user: user.id,
        },
      })
      await req.payload.update({
        collection: 'users',
        id: user.id,
        overrideAccess: true,
        data: { magicLinkTokenHash: null, magicLinkExpiresAt: null },
      })

      if (!membership) {
        await req.payload.create({
          collection: 'memberships',
          draft: false,
          overrideAccess: true,
          data: {
            community: community.id,
            user: user.id,
            role: invitation?.role || 'member',
            joinedAt: new Date().toISOString(),
          },
        })
      }
      if (invitation) {
        await req.payload.update({
          collection: 'community-invites',
          id: invitation.id,
          overrideAccess: true,
          data: { active: false, acceptedAt: new Date().toISOString() },
        })
      }

      return Response.json({
        token: sessionToken,
        expiresAt: sessionExpiresAt,
        member: { id: user.id, email: user.email, displayName: user.displayName },
        communityId: community.id,
      }, { headers: cors(req) })
    },
  },
]
