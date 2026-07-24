import {
  addContentServer,
  getContentServerSubscriptions,
  inspectContentServer,
  upsertContentServer,
} from './contentServers.js'
import { normalizeCommunityManifestUrl, validateCommunityManifest } from '../utils/communityProtocol.js'

export const COMMUNITY_REGISTRY_KEY = 'heritage-communities-v1'
const COMMUNITY_SESSIONS_KEY = 'heritage-community-sessions-v1'
export const COMMUNITIES_CHANGE_EVENT = 'heritage-communities-change'

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '')
    return value ?? fallback
  } catch {
    return fallback
  }
}

function writeRegistry(records) {
  localStorage.setItem(COMMUNITY_REGISTRY_KEY, JSON.stringify(records))
  window.dispatchEvent(new CustomEvent(COMMUNITIES_CHANGE_EVENT, { detail: records }))
}

async function fetchJson(url, options = {}) {
  let response
  try {
    const headers = { ...(options.headers || {}) }
    if (options.body != null && !Object.keys(headers).some(name => name.toLowerCase() === 'content-type')) {
      headers['Content-Type'] = 'application/json'
    }
    response = await fetch(url, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      ...options,
      headers,
    })
  } catch (error) {
    let destination = 'the Community server'
    try {
      destination = new URL(url).host || destination
    } catch {
      // Keep the generic destination for malformed or non-URL inputs.
    }
    const message = `Could not reach ${destination}. Check your connection. If this Community was just set up, wait a minute, reopen Heritage, and try the sign-in email again.`
    const wrapped = new Error(message)
    wrapped.cause = error
    throw wrapped
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || `Community request failed with HTTP ${response.status}.`)
  return body
}

export function getCommunities() {
  const records = readJson(COMMUNITY_REGISTRY_KEY, [])
  return Array.isArray(records) ? records : []
}

export function getCommunitySessions() {
  const sessions = readJson(COMMUNITY_SESSIONS_KEY, {})
  return sessions && typeof sessions === 'object' ? sessions : {}
}

async function inspectCommunityManifest(inputUrl) {
  const manifestUrl = normalizeCommunityManifestUrl(inputUrl)
  const manifest = validateCommunityManifest(await fetchJson(manifestUrl), manifestUrl)
  return { manifestUrl, manifest }
}

export async function inspectCommunity(inputUrl) {
  const discovery = await inspectCommunityManifest(inputUrl)
  const { manifest } = discovery
  const contentPreview = await inspectContentServer(manifest.contentServerUrl)
  return { ...discovery, contentPreview }
}

export async function beginCommunityJoin(preview, email) {
  if (!preview?.manifest?.id) throw new Error('Check the community before joining it.')
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('Enter a valid email address.')

  const records = getCommunities()
  const existing = records.find(record => record.manifest.id === preview.manifest.id)
  const authResult = await fetchJson(preview.manifest.auth.requestUrl, {
    method: 'POST',
    body: JSON.stringify({ email: normalizedEmail }),
  })
  const record = {
    ...preview,
    status: 'email-sent',
    email: normalizedEmail,
    addedAt: existing?.addedAt || new Date().toISOString(),
    primary: existing?.primary ?? records.length === 0,
  }
  writeRegistry(existing
    ? records.map(row => row.manifest.id === preview.manifest.id ? record : row)
    : [...records, record])

  let contentWarning = ''
  try {
    if (!getContentServerSubscriptions().some(server => server.manifest.id === preview.contentPreview.manifest.id)) {
      await addContentServer(preview.contentPreview)
    }
  } catch (error) {
    contentWarning = `The sign-in email was sent, but public resources were not installed: ${error.message}`
  }

  return { ...record, contentWarning, debugLink: authResult.debugLink || '' }
}

export async function completeCommunitySignIn(serverUrl, token) {
  // Authentication depends only on the signed community discovery document.
  // Public content catalogs are refreshed separately so a broken optional feed
  // cannot invalidate an otherwise valid one-time sign-in link.
  const discovery = await inspectCommunityManifest(serverUrl)
  const session = await fetchJson(discovery.manifest.auth.sessionUrl, {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
  const sessions = getCommunitySessions()
  localStorage.setItem(COMMUNITY_SESSIONS_KEY, JSON.stringify({
    ...sessions,
    [discovery.manifest.id]: session,
  }))

  const records = getCommunities()
  const existing = records.find(record => record.manifest.id === discovery.manifest.id)
  let contentPreview = existing?.contentPreview || null
  let contentWarning = ''
  try {
    const refreshedContent = await inspectContentServer(discovery.manifest.contentServerUrl, {
      authorization: `Community ${session.token}`,
      authorizationOrigin: new URL(discovery.manifest.contentServerUrl).origin,
    })
    contentPreview = refreshedContent
    await upsertContentServer(refreshedContent)
  } catch (error) {
    contentWarning = `Signed in, but the Community resource catalog could not be refreshed: ${error.message}`
  }

  const record = {
    ...(existing || discovery),
    ...discovery,
    ...(contentPreview ? { contentPreview } : {}),
    status: 'joined',
    member: session.member,
    contentWarning,
    primary: existing?.primary ?? records.length === 0,
    addedAt: existing?.addedAt || new Date().toISOString(),
  }
  writeRegistry(existing
    ? records.map(row => row.manifest.id === discovery.manifest.id ? record : row)
    : [...records, record])
  return record
}

export function setPrimaryCommunity(communityId) {
  const next = getCommunities().map(record => ({ ...record, primary: record.manifest.id === communityId }))
  writeRegistry(next)
  return next
}

export function removeCommunity(communityId) {
  const records = getCommunities().filter(record => record.manifest.id !== communityId)
  if (records.length && !records.some(record => record.primary)) records[0] = { ...records[0], primary: true }
  writeRegistry(records)
  const sessions = getCommunitySessions()
  delete sessions[communityId]
  localStorage.setItem(COMMUNITY_SESSIONS_KEY, JSON.stringify(sessions))
  return records
}

export async function communityApiRequest(community, path, options = {}) {
  const session = getCommunitySessions()[community.manifest.id]
  if (!session?.token) throw new Error('Sign in to this community again.')
  const url = new URL(String(path).replace(/^\/+/, ''), `${community.manifest.apiBaseUrl}/`).href
  return fetchJson(url, {
    ...options,
    headers: { Authorization: `Community ${session.token}`, ...(options.headers || {}) },
  })
}
