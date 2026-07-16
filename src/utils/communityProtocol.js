export const COMMUNITY_KIND = 'heritage-community'
export const COMMUNITY_PROTOCOL_VERSION = 1

export function normalizeCommunityManifestUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) throw new Error('Enter a community URL.')
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  const url = new URL(withProtocol)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Community URLs must use HTTP or HTTPS.')
  url.username = ''
  url.password = ''
  url.hash = ''
  if (!url.pathname.endsWith('.json')) {
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/.well-known/heritage-community.json`.replace(/^\/{2,}/, '/')
    url.search = ''
  }
  return url.href
}

function httpUrl(value, base) {
  const url = new URL(String(value || ''), base)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Community endpoints must use HTTP or HTTPS.')
  return url.href
}

export function validateCommunityManifest(input, manifestUrl) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Community manifest must be an object.')
  if (input.kind !== COMMUNITY_KIND || Number(input.schemaVersion) !== COMMUNITY_PROTOCOL_VERSION) {
    throw new Error('This server does not publish a supported Heritage Community manifest.')
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,95}$/.test(String(input.id || ''))) throw new Error('The community has an invalid id.')
  if (!String(input.name || '').trim()) throw new Error('The community is missing a name.')
  if (input.auth?.method !== 'email-magic-link') throw new Error('This community does not support Heritage email sign-in.')

  const apiBaseUrl = httpUrl(input.apiBaseUrl, manifestUrl).replace(/\/+$/, '')
  return {
    schemaVersion: COMMUNITY_PROTOCOL_VERSION,
    kind: COMMUNITY_KIND,
    id: String(input.id),
    name: String(input.name).trim(),
    description: String(input.description || '').trim(),
    website: input.website ? httpUrl(input.website, manifestUrl) : '',
    contentServerUrl: httpUrl(input.contentServerUrl, manifestUrl),
    apiBaseUrl,
    auth: {
      method: 'email-magic-link',
      requestUrl: httpUrl(String(input.auth.requestPath || '').replace(/^\/+/, ''), `${apiBaseUrl}/`),
      sessionUrl: httpUrl(String(input.auth.sessionPath || '').replace(/^\/+/, ''), `${apiBaseUrl}/`),
    },
    capabilities: input.capabilities && typeof input.capabilities === 'object' ? input.capabilities : {},
  }
}
