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
  const communityId = relationId(data?.community)
  // Payload calls create access without document data when deciding whether to
  // render the create form. Missing relationships still fail each collection's
  // required-field validation on a real write; a supplied ID remains scoped to
  // the user's eligible communities below.
  if (!communityId) return communityIds.length > 0
  return communityIds.map(String).includes(communityId)
}

export const createMemberCommunityContent: Access = async ({ req, data }) => {
  if (req.user?.systemRole === 'system-admin') return true
  const communityIds = await membershipCommunityIds(req)
  const communityId = relationId(data?.community)
  if (!communityId) return communityIds.length > 0
  return communityIds.map(String).includes(communityId)
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

// Raw library records are for church managers. Public readers receive only the
// explicit Songbook publication snapshot through the public content routes.
export const readSongsByVisibility: Access = manageCommunityContent

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

export const readBooksByVisibility: Access = async ({req}) => {
 if(req.user?.systemRole==='system-admin')return true
 const members=await membershipCommunityIds(req), managers=await membershipCommunityIds(req,['owner','admin','leader'])
 const where:Where={or:[{and:[{status:{equals:'published'}},{or:[{visibility:{equals:'public'}},...(members.length?[{community:{in:members}}]:[])]}]},...(managers.length?[{community:{in:managers}}]:[])]}
 return where
}

// People and households hold private contact details (including children's).
// Owners and church administrators manage them; leaders may look people up
// (for example to schedule volunteers) but cannot change them or read notes.
const PEOPLE_VIEW_ROLES = ['owner', 'admin', 'leader']
const PEOPLE_EDIT_ROLES = ['owner', 'admin']

/** Membership lookups repeat for every field and document; remember them for this request. */
function requestCommunityIds(req: Parameters<Access>[0]['req'], roles: string[]) {
  const context = (req.context ||= {}) as Record<string, unknown>
  const key = `heritage:community-ids:${req.user?.id ?? 'anonymous'}:${roles.join(',')}`
  if (!context[key]) context[key] = membershipCommunityIds(req, roles)
  return context[key] as Promise<Array<number | string>>
}

export const readChurchPeople: Access = async ({ req }) => {
  if (req.user?.systemRole === 'system-admin') return true
  const communityIds = await requestCommunityIds(req, PEOPLE_VIEW_ROLES)
  return communityIds.length ? { community: { in: communityIds } } : false
}

export const manageChurchPeople: Access = async ({ req }) => {
  if (req.user?.systemRole === 'system-admin') return true
  const communityIds = await requestCommunityIds(req, PEOPLE_EDIT_ROLES)
  return communityIds.length ? { community: { in: communityIds } } : false
}

export const createChurchPeople: Access = async ({ req, data }) => {
  if (req.user?.systemRole === 'system-admin') return true
  const communityIds = await requestCommunityIds(req, PEOPLE_EDIT_ROLES)
  const communityId = relationId(data?.community)
  if (!communityId) return communityIds.length > 0
  return communityIds.map(String).includes(communityId)
}

/** Private notes: only owners and church administrators of that church. */
export const churchPeopleEditorField: FieldAccess = async ({ req, doc, data, siblingData }) => {
  if (req.user?.systemRole === 'system-admin') return true
  if (!req.user) return false
  const communityIds = await requestCommunityIds(req, PEOPLE_EDIT_ROLES)
  const communityId = relationId(doc?.community ?? data?.community ?? siblingData?.community)
  if (!communityId) return communityIds.length > 0
  return communityIds.map(String).includes(communityId)
}
