import type { Payload } from 'payload'
import { communityPublicConfig } from '@/lib/publicConfig'

export async function getConfiguredCommunityId(payload: Payload): Promise<number | string | null> {
  const result = await payload.find({
    collection: 'communities',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: { slug: { equals: communityPublicConfig.id } },
  })
  return result.docs[0]?.id ?? null
}
