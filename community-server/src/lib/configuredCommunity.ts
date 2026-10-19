import type { Payload } from 'payload'
import { communityPublicConfig } from '@/lib/publicConfig'

export async function getConfiguredCommunityId(payload: Payload): Promise<number | null> {
  const result = await payload.find({
    collection: 'communities',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { slug: { equals: communityPublicConfig.id } },
  })
  const id = result.docs[0]?.id
  if (id === undefined || id === null) return null
  const numericId = typeof id === 'number' ? id : Number(id)
  return Number.isSafeInteger(numericId) && numericId > 0 ? numericId : null
}
