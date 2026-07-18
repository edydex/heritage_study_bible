import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import {
  normalizeContentServerManifestUrl,
  validateContentCatalog,
  validateContentServerManifest,
} from '../utils/contentProtocol.js'
import {
  normalizeCommunityManifestUrl,
  validateCommunityManifest,
} from '../utils/communityProtocol.js'

export const STORAGE_KEYS = {
  bookmarks: 'bible-study-bookmarks',
  commentaryBookmarks: 'bible-study-commentary-bookmarks',
  notes: 'bible-study-notes',
  highlights: 'bible-study-highlights',
  translation: 'heritage-translation',
  parallelTranslation: 'heritage-parallel-translation',
  textSize: 'heritage-text-size',
  commentaryTextSize: 'heritage-commentary-text-size',
  verseStacking: 'heritage-verse-stacking',
  darkMode: 'heritage-dark-mode',
  sidebarWidth: 'heritage-sidebar-width',
  sideButtonScroll: 'heritage-side-button-scroll',
  advancedSettings: 'heritage-advanced-settings',
  massExportSettings: 'heritage-mass-export-settings',
  readerProgress: 'heritage-reader-progress',
  resourceBookmarks: 'heritage-resource-bookmarks',
  readingPlanPrefix: 'heritage-reading-plan:',
  activeReadingPlan: 'heritage-reading-plan:active',
  readingPlanGroups: 'heritage-reading-plan:groups',
  contentServers: 'heritage-content-servers-v2',
  communities: 'heritage-communities-v1',
}

export const EXPORTABLE_EXACT_KEYS = [
  STORAGE_KEYS.bookmarks,
  STORAGE_KEYS.commentaryBookmarks,
  STORAGE_KEYS.notes,
  STORAGE_KEYS.highlights,
  STORAGE_KEYS.translation,
  STORAGE_KEYS.parallelTranslation,
  STORAGE_KEYS.textSize,
  STORAGE_KEYS.commentaryTextSize,
  STORAGE_KEYS.verseStacking,
  STORAGE_KEYS.darkMode,
  STORAGE_KEYS.sidebarWidth,
  STORAGE_KEYS.sideButtonScroll,
  STORAGE_KEYS.advancedSettings,
  STORAGE_KEYS.massExportSettings,
  STORAGE_KEYS.readerProgress,
  STORAGE_KEYS.resourceBookmarks,
  STORAGE_KEYS.activeReadingPlan,
  STORAGE_KEYS.readingPlanGroups,
  STORAGE_KEYS.contentServers,
  STORAGE_KEYS.communities,
]

export function isNativePlatform() {
  return Capacitor.isNativePlatform?.() === true
}

export async function getStoredValue(key) {
  try {
    const local = localStorage.getItem(key)
    if (local != null) return local
  } catch {}

  if (isNativePlatform()) {
    try {
      const result = await Preferences.get({ key })
      return result.value
    } catch (error) {
      console.warn(`Failed to read native preference ${key}`, error)
    }
  }

  return null
}

export async function setStoredValue(key, value) {
  const normalized = String(value)
  try { localStorage.setItem(key, normalized) } catch {}

  if (isNativePlatform()) {
    try { await Preferences.set({ key, value: normalized }) } catch (error) {
      console.warn(`Failed to write native preference ${key}`, error)
    }
  }
}

export async function removeStoredValue(key) {
  try { localStorage.removeItem(key) } catch {}

  if (isNativePlatform()) {
    try { await Preferences.remove({ key }) } catch (error) {
      console.warn(`Failed to remove native preference ${key}`, error)
    }
  }
}

export async function getStoredJson(key, fallback) {
  const raw = await getStoredValue(key)
  if (!raw) return fallback
  try { return JSON.parse(raw) } catch { return fallback }
}

export async function setStoredJson(key, value) {
  await setStoredValue(key, JSON.stringify(value))
}

function getAllLocalStorageKeys() {
  try {
    return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(Boolean)
  } catch {
    return []
  }
}

function parseRegistryArray(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function requireHttpUrl(value, label) {
  const url = new URL(String(value || ''))
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${label} must use HTTP or HTTPS without embedded credentials.`)
  }
  url.hash = ''
  return url.href
}

function safeOptionalString(value, maxLength = 500) {
  return typeof value === 'string' ? value.slice(0, maxLength) : ''
}

function safeTimestamp(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null
  return value
}

function sanitizeCatalogItem(item) {
  const result = {
    id: item.id,
    title: item.title,
    description: item.description,
    content: {
      url: requireHttpUrl(item.content.url, 'Content item URL'),
      mediaType: safeOptionalString(item.content.mediaType, 150) || 'application/octet-stream',
    },
  }

  if (item.artwork) result.artwork = requireHttpUrl(item.artwork, 'Content artwork URL')

  for (const key of ['author', 'speaker', 'language', 'license', 'revision', 'updatedAt']) {
    if (typeof item[key] === 'string') result[key] = safeOptionalString(item[key])
  }
  for (const key of ['year', 'publishedYear', 'totalDays']) {
    if (Number.isFinite(Number(item[key]))) result[key] = Number(item[key])
  }
  for (const key of ['authors', 'tags', 'scripture']) {
    if (Array.isArray(item[key])) {
      result[key] = item[key]
        .filter(value => typeof value === 'string')
        .slice(0, 100)
        .map(value => safeOptionalString(value, 200))
    }
  }
  for (const key of ['sha256', 'etag']) {
    if (typeof item.content?.[key] === 'string') result.content[key] = safeOptionalString(item.content[key], 200)
  }
  if (Number.isFinite(Number(item.content?.bytes))) result.content.bytes = Number(item.content.bytes)

  return result
}

function sanitizeContentServerRecord(record, includeSubscriptionMetadata = true) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('Content server record must be an object.')
  }

  const manifestUrl = normalizeContentServerManifestUrl(requireHttpUrl(record.manifestUrl, 'Content manifest URL'))
  const manifest = validateContentServerManifest(record.manifest, manifestUrl)
  requireHttpUrl(manifestUrl, 'Content manifest URL')
  if (manifest.website) requireHttpUrl(manifest.website, 'Content server website')
  if (manifest.icon) requireHttpUrl(manifest.icon, 'Content server icon')

  const catalogs = {}
  for (const [contentType, catalogUrl] of Object.entries(manifest.catalogs)) {
    requireHttpUrl(catalogUrl, `${contentType} catalog URL`)
    const validated = validateContentCatalog(record.catalogs?.[contentType], contentType, catalogUrl)
    catalogs[contentType] = {
      schemaVersion: validated.schemaVersion,
      contentType: validated.contentType,
      updatedAt: safeTimestamp(validated.updatedAt),
      items: validated.items.map(sanitizeCatalogItem),
    }
  }

  const sanitized = {
    manifestUrl,
    manifest,
    catalogs,
    counts: Object.fromEntries(Object.entries(catalogs).map(([type, catalog]) => [type, catalog.items.length])),
  }

  if (includeSubscriptionMetadata) {
    sanitized.addedAt = safeTimestamp(record.addedAt) || new Date(0).toISOString()
    sanitized.lastCheckedAt = safeTimestamp(record.lastCheckedAt)
    sanitized.enabled = record.enabled !== false
  }
  return sanitized
}

export function sanitizeContentServerRegistry(value) {
  const result = []
  const seen = new Set()
  for (const record of parseRegistryArray(value)) {
    try {
      const sanitized = sanitizeContentServerRecord(record)
      if (seen.has(sanitized.manifest.id)) continue
      seen.add(sanitized.manifest.id)
      result.push(sanitized)
    } catch {
      // Imported remote registries are untrusted. Invalid records are omitted.
    }
  }
  return result
}

function sanitizeMember(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const member = {}
  for (const key of ['id', 'name', 'displayName', 'email', 'role']) {
    if (typeof value[key] === 'string') member[key] = safeOptionalString(value[key], 320)
  }
  return Object.keys(member).length ? member : null
}

function sanitizeCapabilities(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value)
    .filter(([key, enabled]) => /^[a-z][a-zA-Z0-9]{0,63}$/.test(key) && typeof enabled === 'boolean'))
}

export function sanitizeCommunityRegistry(value) {
  const result = []
  const seen = new Set()

  for (const record of parseRegistryArray(value)) {
    try {
      if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('Invalid community record.')
      const manifestUrl = normalizeCommunityManifestUrl(requireHttpUrl(record.manifestUrl, 'Community manifest URL'))
      const storedAuth = record.manifest?.auth || {}
      const manifest = validateCommunityManifest({
        ...record.manifest,
        auth: {
          method: storedAuth.method,
          requestPath: storedAuth.requestPath || storedAuth.requestUrl,
          sessionPath: storedAuth.sessionPath || storedAuth.sessionUrl,
        },
      }, manifestUrl)

      for (const [label, endpoint] of [
        ['Community manifest URL', manifestUrl],
        ['Community website', manifest.website],
        ['Community content server URL', manifest.contentServerUrl],
        ['Community API URL', manifest.apiBaseUrl],
        ['Community sign-in URL', manifest.auth.requestUrl],
        ['Community session URL', manifest.auth.sessionUrl],
      ]) {
        if (endpoint) requireHttpUrl(endpoint, label)
      }

      const contentPreview = sanitizeContentServerRecord(record.contentPreview, false)
      const expectedContentUrl = normalizeContentServerManifestUrl(manifest.contentServerUrl)
      if (contentPreview.manifestUrl !== expectedContentUrl) {
        throw new Error('Community content server does not match its manifest.')
      }
      if (seen.has(manifest.id)) continue
      seen.add(manifest.id)

      manifest.capabilities = sanitizeCapabilities(manifest.capabilities)
      const sanitized = {
        manifestUrl,
        manifest,
        contentPreview,
        status: record.status === 'joined' ? 'joined' : 'email-sent',
        email: safeOptionalString(record.email, 320),
        addedAt: safeTimestamp(record.addedAt) || new Date(0).toISOString(),
        primary: record.primary === true,
      }
      const member = sanitizeMember(record.member)
      if (member) sanitized.member = member
      result.push(sanitized)
    } catch {
      // Imported remote registries are untrusted. Invalid records are omitted.
    }
  }

  let keptPrimary = false
  result.forEach(record => {
    if (record.primary && !keptPrimary) keptPrimary = true
    else if (record.primary) record.primary = false
  })
  if (result.length && !keptPrimary) result[0].primary = true
  return result
}

function sanitizeImportedValue(key, value) {
  if (key === STORAGE_KEYS.contentServers) {
    return JSON.stringify(sanitizeContentServerRegistry(value))
  }
  if (key === STORAGE_KEYS.communities) {
    return JSON.stringify(sanitizeCommunityRegistry(value))
  }
  return value
}

export async function exportHeritageData() {
  const keys = new Set(EXPORTABLE_EXACT_KEYS)
  for (const key of getAllLocalStorageKeys()) {
    if (key.startsWith(STORAGE_KEYS.readingPlanPrefix)) keys.add(key)
  }

  const data = {}
  for (const key of keys) {
    const value = await getStoredValue(key)
    if (value != null) data[key] = value
  }

  return {
    schemaVersion: 1,
    app: 'Heritage Study Bible',
    exportedAt: new Date().toISOString(),
    data,
  }
}

export async function importHeritageData(payload) {
  if (!payload || payload.app !== 'Heritage Study Bible' || !payload.data || typeof payload.data !== 'object') {
    throw new Error('This does not look like a Heritage backup file.')
  }

  const entries = Object.entries(payload.data)
  for (const [key, value] of entries) {
    if (typeof value !== 'string') continue
    const allowed = EXPORTABLE_EXACT_KEYS.includes(key) || key.startsWith(STORAGE_KEYS.readingPlanPrefix)
    if (allowed) await setStoredValue(key, sanitizeImportedValue(key, value))
  }

  return entries.length
}

export async function exportNotesMarkdown() {
  const notes = await getStoredJson(STORAGE_KEYS.notes, [])
  const highlights = await getStoredJson(STORAGE_KEYS.highlights, [])
  const bookmarks = await getStoredJson(STORAGE_KEYS.bookmarks, [])
  const commentaryBookmarks = await getStoredJson(STORAGE_KEYS.commentaryBookmarks, [])
  const lines = ['# Heritage Study Bible Export', '', `Exported: ${new Date().toISOString()}`, '']

  lines.push('## Verse Notes', '')
  if (notes.length === 0) lines.push('_No verse notes._', '')
  for (const note of notes) {
    lines.push(`### ${note.reference || `${note.book} ${note.chapter}:${note.verse}`}`, '')
    if (note.verseText) lines.push(`> ${note.verseText}`, '')
    lines.push(note.text || '', '')
  }

  lines.push('## Highlights', '')
  if (highlights.length === 0) lines.push('_No verse highlights._', '')
  for (const highlight of highlights) {
    lines.push(`- ${highlight.reference || `${highlight.book} ${highlight.chapter}:${highlight.verse}`}`)
  }
  lines.push('')

  lines.push('## Verse Bookmarks', '')
  if (bookmarks.length === 0) lines.push('_No verse bookmarks._', '')
  for (const bookmark of bookmarks) {
    lines.push(`- ${bookmark.book} ${bookmark.chapter}:${bookmark.verse}${bookmark.verseText ? ` — ${bookmark.verseText}` : ''}`)
  }
  lines.push('')

  lines.push('## Commentary Bookmarks', '')
  if (commentaryBookmarks.length === 0) lines.push('_No commentary bookmarks._', '')
  for (const bookmark of commentaryBookmarks) {
    lines.push(`- ${bookmark.reference || 'Commentary'}${bookmark.authorName ? ` — ${bookmark.authorName}` : ''}${bookmark.workTitle ? `, ${bookmark.workTitle}` : ''}`)
  }

  return lines.join('\n')
}
