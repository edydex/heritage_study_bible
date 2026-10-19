const HERITAGE_APP_ORIGIN = 'https://heritage.faith'
const CONTENT_SERVER_ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,95})$/
const COMMUNITY_SONG_PATH = /^\/content\/songs\/[^/?#]+\/?$/
const SONG_PUBLIC_BEARER_PATH = /^\/community\/songs\/shared\/([A-Za-z0-9_-]{32,128})$/

function isLoopbackHostname(hostname) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '[::1]'
    || hostname === '::1'
}

function normalizeSecureUrl(value) {
  const raw = String(value || '').trim()
  if (!raw || raw.includes('\\')) return null
  try {
    const url = new URL(raw)
    const secureTransport = url.protocol === 'https:'
      || (url.protocol === 'http:' && isLoopbackHostname(url.hostname))
    if (
      !secureTransport
      || !url.hostname
      || url.username
      || url.password
      || url.search
      || url.hash
    ) {
      return null
    }
    return url
  } catch {
    return null
  }
}

export function normalizeCommunitySongContentServerId(value) {
  const id = String(value || '').trim()
  return CONTENT_SERVER_ID_PATTERN.test(id) ? id : ''
}

export function normalizeCommunitySongMemberContentUrl(value) {
  const url = normalizeSecureUrl(value)
  if (!url || !COMMUNITY_SONG_PATH.test(url.pathname)) return ''
  return url.href
}

export function normalizeCommunitySongPublicBearerUrl(value) {
  const url = normalizeSecureUrl(value)
  if (!url || !SONG_PUBLIC_BEARER_PATH.test(url.pathname)) return ''
  return url.href
}

export function buildCommunitySongMemberShareUrl(
  contentUrl,
  contentServerId,
  appOrigin = HERITAGE_APP_ORIGIN,
) {
  const normalizedContentUrl = normalizeCommunitySongMemberContentUrl(contentUrl)
  const normalizedServerId = normalizeCommunitySongContentServerId(contentServerId)
  let normalizedAppUrl = null
  try {
    normalizedAppUrl = normalizeSecureUrl(new URL('/', appOrigin).href)
  } catch {
    // Invalid app origins fail closed instead of producing a partial link.
  }
  if (!normalizedContentUrl || !normalizedServerId || !normalizedAppUrl) return ''
  const params = new URLSearchParams({
    access: 'member',
    server: normalizedServerId,
    url: normalizedContentUrl,
  })
  return `${normalizedAppUrl.origin}/#/community-song?${params.toString()}`
}

export function parseCommunitySongMemberRoute(value) {
  let params
  try {
    params = value instanceof URLSearchParams
      ? value
      : new URLSearchParams(String(value || '').replace(/^\?/, ''))
  } catch {
    return null
  }

  const expectedKeys = ['access', 'server', 'url']
  const keys = [...params.keys()]
  if (
    keys.length !== expectedKeys.length
    || expectedKeys.some(key => params.getAll(key).length !== 1)
    || keys.some(key => !expectedKeys.includes(key))
    || params.get('access') !== 'member'
  ) {
    return null
  }

  const contentServerId = normalizeCommunitySongContentServerId(params.get('server'))
  const contentUrl = normalizeCommunitySongMemberContentUrl(params.get('url'))
  if (!contentServerId || !contentUrl) return null
  return Object.freeze({ contentServerId, contentUrl })
}

export function communitySongMemberItemFromRoute(value) {
  const route = parseCommunitySongMemberRoute(value)
  if (!route) return null
  const url = new URL(route.contentUrl)
  return {
    id: `member-song:${route.contentServerId}:${route.contentUrl}`,
    title: 'Community song',
    description: '',
    contentType: 'songs',
    remote: true,
    memberAccessRequired: true,
    sourceServerId: route.contentServerId,
    sourceServerName: url.hostname,
    content: {
      url: route.contentUrl,
      mediaType: 'application/vnd.heritage.song+json',
    },
  }
}
