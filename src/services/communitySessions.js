import { getSecureValue, removeSecureValue, setSecureValue } from './secureStorage.js'

export const COMMUNITY_SESSIONS_KEY = 'heritage-community-sessions-v1'

function expectedIssuer(value) {
  const manifest = value?.manifest || value
  const apiBaseUrl = typeof manifest === 'string' ? manifest : manifest?.apiBaseUrl
  try { return new URL(apiBaseUrl).origin } catch { return '' }
}

export async function getCommunitySessions() {
  let raw = await getSecureValue(COMMUNITY_SESSIONS_KEY)
  if (!raw) {
    try {
      raw = localStorage.getItem(COMMUNITY_SESSIONS_KEY)
      if (raw) {
        await setSecureValue(COMMUNITY_SESSIONS_KEY, raw)
        localStorage.removeItem(COMMUNITY_SESSIONS_KEY)
      }
    } catch {}
  }
  try {
    const sessions = JSON.parse(raw || '{}')
    return sessions && typeof sessions === 'object' && !Array.isArray(sessions) ? sessions : {}
  } catch {
    return {}
  }
}

export async function getCommunitySession(communityId, community) {
  if (!communityId) return null
  const session = (await getCommunitySessions())[communityId] || null
  const issuer = expectedIssuer(community)
  if (!session || !issuer || session.issuerOrigin !== issuer) return null
  return session
}

export async function saveCommunitySession(communityId, session, community) {
  const sessions = await getCommunitySessions()
  const issuer = expectedIssuer(community)
  const existing = sessions[communityId]
  if (session) {
    if (!issuer) throw new Error('The Community session issuer is invalid.')
    if (existing?.issuerOrigin && existing.issuerOrigin !== issuer) {
      throw new Error('This Community id is already bound to a different server. Remove it before signing in elsewhere.')
    }
    sessions[communityId] = { ...session, issuerOrigin: issuer }
  } else if (!existing || !issuer || existing.issuerOrigin === issuer) {
    delete sessions[communityId]
  }
  if (Object.keys(sessions).length) await setSecureValue(COMMUNITY_SESSIONS_KEY, JSON.stringify(sessions))
  else await removeSecureValue(COMMUNITY_SESSIONS_KEY)
  try { localStorage.removeItem(COMMUNITY_SESSIONS_KEY) } catch {}
}
