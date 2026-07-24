import type { Payload } from 'payload'

export async function isCommunityMemberRequest(
  payload: Payload,
  headers: Headers,
  communityId: number | string,
): Promise<boolean> {
  const { user } = await payload.auth({ headers })
  if (!user) return false
  if (user.systemRole === 'system-admin') return true

  const membership = await payload.find({
    collection: 'memberships',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [
        { user: { equals: user.id } },
        { community: { equals: communityId } },
      ],
    },
  })
  return membership.docs.length > 0
}
