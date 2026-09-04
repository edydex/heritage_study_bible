import type { PayloadRequest } from 'payload'
import { hashOpaqueToken } from '@/lib/tokens'

export function communityBearerToken(headers: Headers) {
  const authorization = headers.get('authorization') || ''
  return authorization.startsWith('Community ')
    ? authorization.slice('Community '.length).trim()
    : ''
}

export async function currentCommunitySession(req: PayloadRequest) {
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
  return result.docs[0] || null
}

export function relationId(value: unknown) {
  const raw = value && typeof value === 'object' && 'id' in value ? value.id : value
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : 0
}
