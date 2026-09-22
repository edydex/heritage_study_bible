import { getCommunities } from './communities.js'
import { getCommunitySession } from './communitySessions.js'
export async function resolveCommunityBookAccess(
  { contentServerId, contentUrl },
  { communities = getCommunities(), getSession = getCommunitySession } = {},
) {
  const community = communities.find(
    (record) => record.contentPreview?.manifest?.id === contentServerId,
  )
  if (!community) return { status: 'not-required' }
  let url, origin
  try {
    url = new URL(contentUrl)
    origin = new URL(community.manifest.contentServerUrl).origin
  } catch {
    return { status: 'invalid-link' }
  }
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    !/^\/content\/books\/\d+$/.test(url.pathname) ||
    url.search ||
    url.hash
  )
    return { status: 'origin-mismatch' }
  const session = await getSession(community.manifest.id, community)
  if (
    community.status !== 'joined' ||
    (session?.expiresAt && Date.parse(session.expiresAt) <= Date.now()) ||
    typeof session?.token !== 'string' ||
    !session.token.trim() ||
    /[\u0000-\u001f\u007f]/u.test(session.token)
  )
    return { status: 'sign-in-required' }
  return {
    status: 'ready',
    authorization: `Community ${session.token}`,
    authorizationOrigin: origin,
    ...(session.member?.id != null ? { memberId: String(session.member.id), communityId: community.manifest.id, expiresAt: session.expiresAt } : {}),
  }
}
