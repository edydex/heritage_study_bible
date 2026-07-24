const HERITAGE_APP_ORIGIN = 'https://heritage.faith'
const COMMUNITY_SONG_PATH = /^\/content\/songs\/[^/?#]+\/?$/

export function normalizeCommunitySongContentUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return ''
    if (!COMMUNITY_SONG_PATH.test(url.pathname)) return ''
    return url.href
  } catch {
    return ''
  }
}

export function buildCommunitySongShareUrl(contentUrl, appOrigin = HERITAGE_APP_ORIGIN) {
  const normalizedContentUrl = normalizeCommunitySongContentUrl(contentUrl)
  if (!normalizedContentUrl) return ''
  const normalizedAppOrigin = new URL(appOrigin).origin
  return `${normalizedAppOrigin}/#/community-song?url=${encodeURIComponent(normalizedContentUrl)}`
}

export function communitySongItemFromUrl(contentUrl) {
  const normalized = normalizeCommunitySongContentUrl(contentUrl)
  if (!normalized) return null
  const url = new URL(normalized)
  return {
    id: `unlisted-song:${normalized}`,
    title: 'Community song',
    description: '',
    contentType: 'songs',
    remote: true,
    sourceServerId: url.origin,
    sourceServerName: url.hostname,
    content: {
      url: normalized,
      mediaType: 'application/vnd.heritage.song+json',
    },
  }
}
