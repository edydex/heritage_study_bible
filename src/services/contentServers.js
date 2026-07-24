import {
  RESOURCE_CATEGORY_TO_CONTENT_TYPE,
  makeRemoteContentKey,
  normalizeContentServerManifestUrl,
  validateContentCatalog,
  validateContentServerManifest,
} from '../utils/contentProtocol.js'

export const CONTENT_SERVERS_STORAGE_KEY = 'heritage-content-servers-v2'
export const CONTENT_SERVERS_CHANGE_EVENT = 'heritage-content-servers-change'
const MAX_METADATA_BYTES = 5 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 15000
const AUTOMATIC_REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000
const COMMUNITY_REGISTRY_KEY = 'heritage-communities-v1'
const COMMUNITY_SESSIONS_KEY = 'heritage-community-sessions-v1'

function readSubscriptions() {
  try {
    const value = JSON.parse(localStorage.getItem(CONTENT_SERVERS_STORAGE_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function writeSubscriptions(subscriptions) {
  localStorage.setItem(CONTENT_SERVERS_STORAGE_KEY, JSON.stringify(subscriptions))
  window.dispatchEvent(new CustomEvent(CONTENT_SERVERS_CHANGE_EVENT, { detail: subscriptions }))
}

function memberRequestOptionsForServer(server) {
  try {
    const communities = JSON.parse(localStorage.getItem(COMMUNITY_REGISTRY_KEY) || '[]')
    const sessions = JSON.parse(localStorage.getItem(COMMUNITY_SESSIONS_KEY) || '{}')
    const community = Array.isArray(communities)
      ? communities.find(record => record?.contentPreview?.manifest?.id === server?.manifest?.id)
      : null
    const token = sessions?.[community?.manifest?.id]?.token
    if (!token || !community?.manifest?.contentServerUrl) return {}
    return {
      authorization: `Community ${token}`,
      authorizationOrigin: new URL(community.manifest.contentServerUrl).origin,
    }
  } catch {
    return {}
  }
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const headers = {}
    if (
      options.authorization
      && options.authorizationOrigin
      && new URL(url).origin === options.authorizationOrigin
    ) {
      headers.Authorization = options.authorization
    }
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      headers,
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}.`)
    const contentLength = Number(response.headers.get('content-length') || 0)
    if (contentLength > MAX_METADATA_BYTES) throw new Error('Server metadata is too large.')
    const text = await response.text()
    if (new TextEncoder().encode(text).byteLength > MAX_METADATA_BYTES) {
      throw new Error('Server metadata is too large.')
    }
    return JSON.parse(text)
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('The content server took too long to respond.')
    if (error instanceof SyntaxError) throw new Error('The content server returned invalid JSON.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export function getContentServerSubscriptions() {
  return readSubscriptions()
}

export async function inspectContentServer(inputUrl, options = {}) {
  const manifestUrl = normalizeContentServerManifestUrl(inputUrl)
  const rawManifest = await fetchJson(manifestUrl, options)
  const manifest = validateContentServerManifest(rawManifest, manifestUrl)
  const catalogs = {}

  await Promise.all(Object.entries(manifest.catalogs).map(async ([contentType, catalogUrl]) => {
    const rawCatalog = await fetchJson(catalogUrl, options)
    catalogs[contentType] = validateContentCatalog(rawCatalog, contentType, catalogUrl)
  }))

  return {
    manifestUrl,
    manifest,
    catalogs,
    counts: Object.fromEntries(Object.entries(catalogs).map(([type, catalog]) => [type, catalog.items.length])),
  }
}

export async function addContentServer(preview) {
  if (!preview?.manifest?.id || !preview?.manifestUrl) throw new Error('Check the server before adding it.')
  const subscriptions = readSubscriptions()
  const duplicate = subscriptions.find(server => server.manifest.id === preview.manifest.id)
  if (duplicate) throw new Error('That content server is already installed.')

  const record = {
    ...preview,
    addedAt: new Date().toISOString(),
    lastCheckedAt: new Date().toISOString(),
    enabled: true,
  }
  writeSubscriptions([...subscriptions, record])
  return record
}

export async function upsertContentServer(preview) {
  if (!preview?.manifest?.id || !preview?.manifestUrl) throw new Error('Check the server before adding it.')
  const subscriptions = readSubscriptions()
  const existing = subscriptions.find(server => server.manifest.id === preview.manifest.id)
  if (!existing) return addContentServer(preview)

  const record = {
    ...existing,
    ...preview,
    addedAt: existing.addedAt,
    lastCheckedAt: new Date().toISOString(),
    enabled: existing.enabled !== false,
  }
  writeSubscriptions(subscriptions.map(server => server.manifest.id === preview.manifest.id ? record : server))
  return record
}

export async function refreshContentServer(serverId, options = null) {
  const subscriptions = readSubscriptions()
  const existing = subscriptions.find(server => server.manifest.id === serverId)
  if (!existing) throw new Error('Content server not found.')
  const preview = await inspectContentServer(
    existing.manifestUrl,
    options || memberRequestOptionsForServer(existing),
  )
  if (preview.manifest.id !== serverId) throw new Error('The server id changed; remove it and review it again.')

  const next = subscriptions.map(server => server.manifest.id === serverId
    ? {
        ...server,
        ...preview,
        lastCheckedAt: new Date().toISOString(),
      }
    : server)
  writeSubscriptions(next)
  return next.find(server => server.manifest.id === serverId)
}

export async function refreshStaleContentServers() {
  const subscriptions = readSubscriptions()
  const now = Date.now()
  const refreshed = []
  for (const server of subscriptions) {
    const checkedAt = Date.parse(server.lastCheckedAt || server.addedAt || '') || 0
    if (now - checkedAt < AUTOMATIC_REFRESH_INTERVAL_MS) continue
    try {
      refreshed.push(await refreshContentServer(server.manifest.id, memberRequestOptionsForServer(server)))
    } catch {
      // A temporarily unavailable optional library must not block app startup.
    }
  }
  return refreshed
}

export function removeContentServer(serverId) {
  const next = readSubscriptions().filter(server => server.manifest.id !== serverId)
  writeSubscriptions(next)
  return next
}

export function getRemoteContentItemsForCategory(categoryId) {
  const contentType = RESOURCE_CATEGORY_TO_CONTENT_TYPE[categoryId]
  if (!contentType) return []

  return readSubscriptions().flatMap(server => {
    if (!server.enabled) return []
    const items = server.catalogs?.[contentType]?.items || []
    return items.map(item => {
      const contentKey = makeRemoteContentKey(server.manifest.id, contentType, item.id)
      return {
        ...item,
        id: contentKey,
        contentKey,
        contentType,
        remote: true,
        sourceServerId: server.manifest.id,
        sourceServerName: server.manifest.name,
      }
    })
  })
}

export function getRemoteContentItem(contentKey) {
  for (const server of readSubscriptions()) {
    for (const [contentType, catalog] of Object.entries(server.catalogs || {})) {
      for (const item of catalog.items || []) {
        if (makeRemoteContentKey(server.manifest.id, contentType, item.id) !== contentKey) continue
        return {
          ...item,
          id: contentKey,
          contentKey,
          contentType,
          remote: true,
          sourceServerId: server.manifest.id,
          sourceServerName: server.manifest.name,
        }
      }
    }
  }
  return null
}
