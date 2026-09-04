export const COMMUNITY_KIND = 'heritage-community'
export const COMMUNITY_PROTOCOL_VERSION = 1

export function normalizeCommunityManifestUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) throw new Error('Enter a community URL.')
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
    ? raw
    : `https://${raw.replace(/^\/\//, '')}`
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

function sameOriginHttpUrl(value, base, expectedOrigin) {
  const resolved = httpUrl(value, base)
  if (new URL(resolved).origin !== expectedOrigin) {
    throw new Error('Community account endpoints must stay on the Community server.')
  }
  return resolved
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
  const apiOrigin = new URL(apiBaseUrl).origin
  const requestUrl = sameOriginHttpUrl(String(input.auth.requestPath || input.auth.requestUrl || '').replace(/^\/+/, ''), `${apiBaseUrl}/`, apiOrigin)
  const sessionUrl = sameOriginHttpUrl(String(input.auth.sessionPath || input.auth.sessionUrl || '').replace(/^\/+/, ''), `${apiBaseUrl}/`, apiOrigin)
  const optionalAuthUrl = (pathKey, urlKey) => input.auth?.[pathKey] || input.auth?.[urlKey]
    ? sameOriginHttpUrl(String(input.auth[pathKey] || input.auth[urlKey]).replace(/^\/+/, ''), `${apiBaseUrl}/`, apiOrigin)
    : ''
  const syncEndpoint = (pathKey, urlKey) => {
    const value = input.sync?.[pathKey] || input.sync?.[urlKey]
    if (!value) throw new Error('The Community sync manifest is incomplete.')
    return sameOriginHttpUrl(String(value).replace(/^\/+/, ''), `${apiBaseUrl}/`, apiOrigin)
  }
  const optionalSyncEndpoint = (pathKey, urlKey) => {
    const value = input.sync?.[pathKey] || input.sync?.[urlKey]
    return value ? sameOriginHttpUrl(String(value).replace(/^\/+/, ''), `${apiBaseUrl}/`, apiOrigin) : ''
  }
  const sync = input.sync && typeof input.sync === 'object' && Number(input.sync.schemaVersion) === 1
    ? {
        schemaVersion: 1,
        recordsUrl: syncEndpoint('recordsPath', 'recordsUrl'),
        accountUrl: syncEndpoint('accountPath', 'accountUrl'),
        protectionUrl: syncEndpoint('protectionPath', 'protectionUrl'),
        revokeDeviceUrl: syncEndpoint('revokeDevicePath', 'revokeDeviceUrl'),
        ...(optionalSyncEndpoint('conflictsPath', 'conflictsUrl') ? {
          conflictsUrl: optionalSyncEndpoint('conflictsPath', 'conflictsUrl'),
        } : {}),
        ...(optionalSyncEndpoint('resolveConflictPath', 'resolveConflictUrl') ? {
          resolveConflictUrl: optionalSyncEndpoint('resolveConflictPath', 'resolveConflictUrl'),
        } : {}),
        exportUrl: syncEndpoint('exportPath', 'exportUrl'),
        eraseUrl: syncEndpoint('erasePath', 'eraseUrl'),
        privacyModel: String(input.sync.privacyModel || ''),
      }
    : null
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
      requestUrl,
      sessionUrl,
      reverifyUrl: optionalAuthUrl('reverifyPath', 'reverifyUrl'),
      logoutUrl: optionalAuthUrl('logoutPath', 'logoutUrl'),
    },
    capabilities: input.capabilities && typeof input.capabilities === 'object' ? input.capabilities : {},
    sync,
  }
}
