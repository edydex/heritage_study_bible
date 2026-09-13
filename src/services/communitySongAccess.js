import { getCommunities } from './communities.js'
import { getCommunitySession } from './communitySessions.js'
import {
  normalizeCommunitySongContentServerId,
  normalizeCommunitySongMemberContentUrl,
} from '../utils/communitySongLinks.js'

function communityContentServerId(community) {
  return String(community?.contentPreview?.manifest?.id || '')
}

export async function resolveCommunitySongMemberAccess(
  { contentServerId, contentUrl },
  {
    communities = getCommunities(),
    getSession = getCommunitySession,
  } = {},
) {
  const normalizedServerId = normalizeCommunitySongContentServerId(contentServerId)
  const normalizedContentUrl = normalizeCommunitySongMemberContentUrl(contentUrl)
  if (!normalizedServerId || !normalizedContentUrl) {
    return Object.freeze({ status: 'invalid-link', communityName: '' })
  }

  const community = communities.find(record => (
    communityContentServerId(record) === normalizedServerId
  ))
  if (!community) {
    return Object.freeze({ status: 'community-not-installed', communityName: '' })
  }

  const communityName = String(community.manifest?.name || '').trim()
  let authorizationOrigin
  try {
    authorizationOrigin = new URL(community.manifest.contentServerUrl).origin
  } catch {
    return Object.freeze({ status: 'invalid-community', communityName })
  }
  if (new URL(normalizedContentUrl).origin !== authorizationOrigin) {
    return Object.freeze({ status: 'origin-mismatch', communityName })
  }

  let token
  try { token = (await getSession(community.manifest?.id, community))?.token } catch {}
  if (
    community.status !== 'joined'
    || typeof token !== 'string'
    || !token.trim()
    || /[\u0000-\u001f\u007f]/u.test(token)
  ) {
    return Object.freeze({ status: 'sign-in-required', communityName })
  }

  return Object.freeze({
    status: 'ready',
    communityName,
    authorization: `Community ${token.trim()}`,
    authorizationOrigin,
  })
}
