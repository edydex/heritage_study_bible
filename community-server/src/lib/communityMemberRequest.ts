import type { Payload } from 'payload'

export async function communityRequestAccess(
  payload: Payload,
  headers: Headers,
  communityId: number | string,
) {
  const { user } = await payload.auth({ headers })
  if (!user) return { authenticated: false, manager: false, user: null }
  if (user.systemRole === 'system-admin') return { authenticated: true, manager: true, user }

  const membership = (await payload.find({
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
  })).docs[0]
  return {
    authenticated: Boolean(membership),
    manager: Boolean(membership && ['owner', 'admin', 'leader'].includes(String(membership.role))),
    user,
  }
}

export async function isCommunityMemberRequest(
  payload: Payload,
  headers: Headers,
  communityId: number | string,
): Promise<boolean> {
  return (await communityRequestAccess(payload, headers, communityId)).authenticated
}
