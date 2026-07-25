import type { Access, FieldAccess, Where } from 'payload'

export const isSystemAdmin: Access = ({ req }) => req.user?.systemRole === 'system-admin'
export const isAuthenticated: Access = ({ req }) => Boolean(req.user)
export const updateRelationAsSystemAdmin: FieldAccess = ({ req }) => req.user?.systemRole === 'system-admin'

export async function membershipCommunityIds(req: Parameters<Access>[0]['req'], roles?: string[]) {
  if (!req.user) return []
  const result = await req.payload.find({
    collection: 'memberships',
    depth: 0,
    limit: 500,
    overrideAccess: true,
    where: {
      and: [
        { user: { equals: req.user.id } },
        ...(roles?.length ? [{ role: { in: roles } }] : []),
      ],
    },
  })
  return result.docs.map(row => typeof row.community === 'object' ? row.community.id : row.community)
}

export const readPublishedOrMember: Access = async ({ req }) => {
  if (req.user?.systemRole === 'system-admin') return true
  const communityIds = await membershipCommunityIds(req)
  const clauses: Where[] = [{ status: { equals: 'published' } }]
  if (communityIds.length) clauses.push({ community: { in: communityIds } })
  return { or: clauses }
}

export const manageCommunityContent: Access = async ({ req }) => {
  if (req.user?.systemRole === 'system-admin') return true
  const communityIds = await membershipCommunityIds(req, ['owner', 'admin', 'leader'])
  if (!communityIds.length) return false
  return { community: { in: communityIds } }
}

function relationId(value: unknown) {
  if (value && typeof value === 'object' && 'id' in value) return String(value.id)
  return value == null ? '' : String(value)
}

export const createCommunityContent: Access = async ({ req, data }) => {
  if (req.user?.systemRole === 'system-admin') return true
  const communityIds = await membershipCommunityIds(req, ['owner', 'admin', 'leader'])
  return communityIds.map(String).includes(relationId(data?.community))
}

export const createMemberCommunityContent: Access = async ({ req, data }) => {
  if (req.user?.systemRole === 'system-admin') return true
  const communityIds = await membershipCommunityIds(req)
  return communityIds.map(String).includes(relationId(data?.community))
}

export const readCommunityMembership: Access = async ({ req }) => {
  if (req.user?.systemRole === 'system-admin') return true
  if (!req.user) return false
  return { user: { equals: req.user.id } }
}

export const readMemberCommunityContent: Access = async ({ req }) => {
  if (req.user?.systemRole === 'system-admin') return true
  if (!req.user) return false
  const communityIds = await membershipCommunityIds(req)
  if (!communityIds.length) return false
  return { community: { in: communityIds } }
}

export const readSongsByVisibility: Access = async ({ req }) => {
  if (req.user?.systemRole === 'system-admin') return true
  if (!req.user) return false
  const communityIds = await membershipCommunityIds(req)
  if (!communityIds.length) return false
  const managerCommunityIds = await membershipCommunityIds(req, ['owner', 'admin', 'leader'])
  const now = new Date().toISOString()
  const clauses: Where[] = [
    {
      and: [
        { community: { in: communityIds } },
        { status: { equals: 'published' } },
        {
          or: [
            { visibility: { equals: 'public' } },
            {
              and: [
                { visibility: { equals: 'scheduled-public' } },
                { publishAt: { less_than_equal: now } },
              ],
            },
          ],
        },
      ],
    },
  ]
  if (managerCommunityIds.length) clauses.push({ community: { in: managerCommunityIds } })
  return { or: clauses }
}

export const readSharedPlanNotes: Access = async ({ req }) => {
  if (req.user?.systemRole === 'system-admin') return true
  if (!req.user) return false
  const communityIds = await membershipCommunityIds(req)
  const leaderCommunityIds = await membershipCommunityIds(req, ['owner', 'admin', 'leader'])
  const where: Where = {
    or: [
      { author: { equals: req.user.id } },
      {
        community: { in: communityIds },
        visibility: { equals: 'shared' },
      },
      ...(leaderCommunityIds.length ? [{
        community: { in: leaderCommunityIds },
        visibility: { equals: 'leaders' },
      }] : []),
    ],
  }
  return where
}
