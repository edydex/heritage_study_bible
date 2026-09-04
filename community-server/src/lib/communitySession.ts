import type { PayloadRequest } from 'payload'
import { hashOpaqueToken } from '@/lib/tokens'

const COMMUNITY_SESSION_ID = Symbol.for('heritage-community-session-id')

export function markCommunitySessionUser<T extends object>(user: T, sessionId: unknown) {
  const id = Number(sessionId)
  if (!Number.isSafeInteger(id) || id < 1) return user
  Object.defineProperty(user, COMMUNITY_SESSION_ID, {
    configurable: false,
    enumerable: false,
    value: id,
    writable: false,
  })
  return user
}

function markedCommunitySessionId(user: unknown) {
  if (!user || typeof user !== 'object') return 0
  const id = Number((user as Record<PropertyKey, unknown>)[COMMUNITY_SESSION_ID])
  return Number.isSafeInteger(id) && id > 0 ? id : 0
}

function sessionIsActive(session: { expiresAt?: unknown; revokedAt?: unknown } | null | undefined) {
  const expiry = Date.parse(String(session?.expiresAt || ''))
  return Number.isFinite(expiry) && expiry > Date.now() && !session?.revokedAt
}

export function communityBearerToken(headers: Headers) {
  const authorization = headers.get('authorization') || ''
  return authorization.startsWith('Community ')
    ? authorization.slice('Community '.length).trim()
    : ''
}

export async function currentCommunitySession(req: PayloadRequest) {
  // Payload runs collection auth before custom endpoints and gives the endpoint
  // the authenticated user object. The Community strategy carries its already-
  // validated session ID with that object so the endpoint can revalidate the
  // exact row without repeating authentication through a second query path.
  // Cookie/JWT users cannot provide or forge this private server-side marker.
  const markedSessionId = markedCommunitySessionId(req.user)
  if (markedSessionId) {
    const session = await req.payload.findByID({
      collection: 'community-sessions',
      id: markedSessionId,
      depth: 0,
      overrideAccess: true,
    })
    if (!sessionIsActive(session)) return null
    return relationId(session.user) === relationId(req.user) ? session : null
  }

  const token = communityBearerToken(req.headers)
  if (!token) return null
  const result = await req.payload.find({
    collection: 'community-sessions',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    // Payload has already authenticated the request with this same bearer
    // token before a custom endpoint runs. Reusing that authenticated request
    // here makes the nested collection lookup inherit request state that can
    // suppress its own session row. Keep this authority check independent,
    // as the collection auth strategy does, and scope every later operation
    // from the validated session relationship.
    where: {
      and: [
        { tokenHash: { equals: hashOpaqueToken(token) } },
        { expiresAt: { greater_than: new Date().toISOString() } },
        { revokedAt: { exists: false } },
      ],
    },
  })
  const session = result.docs[0] || null
  return sessionIsActive(session) ? session : null
}

export function relationId(value: unknown) {
  const raw = value && typeof value === 'object' && 'id' in value ? value.id : value
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : 0
}
