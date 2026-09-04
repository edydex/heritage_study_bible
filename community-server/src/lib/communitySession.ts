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
    req,
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
