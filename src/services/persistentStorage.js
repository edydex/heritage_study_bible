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
  highlightColor: 'bible-study-highlight-color',
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
  syncState: 'heritage-progress-sync-state-v1',
  syncRollback: 'heritage-progress-sync-rollback-v1',
}

export const EXPORTABLE_EXACT_KEYS = [
  STORAGE_KEYS.bookmarks,
  STORAGE_KEYS.commentaryBookmarks,
  STORAGE_KEYS.notes,
  STORAGE_KEYS.highlights,
  STORAGE_KEYS.highlightColor,
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
      const storedSync = record.manifest?.sync || null
      const manifest = validateCommunityManifest({
        ...record.manifest,
        auth: {
          method: storedAuth.method,
          requestPath: storedAuth.requestPath || storedAuth.requestUrl,
          sessionPath: storedAuth.sessionPath || storedAuth.sessionUrl,
          reverifyPath: storedAuth.reverifyPath || storedAuth.reverifyUrl,
          logoutPath: storedAuth.logoutPath || storedAuth.logoutUrl,
        },
        ...(storedSync ? {
          sync: {
            ...storedSync,
            recordsPath: storedSync.recordsPath || storedSync.recordsUrl,
            accountPath: storedSync.accountPath || storedSync.accountUrl,
            protectionPath: storedSync.protectionPath || storedSync.protectionUrl,
            revokeDevicePath: storedSync.revokeDevicePath || storedSync.revokeDeviceUrl,
            conflictsPath: storedSync.conflictsPath || storedSync.conflictsUrl,
            resolveConflictPath: storedSync.resolveConflictPath || storedSync.resolveConflictUrl,
            exportPath: storedSync.exportPath || storedSync.exportUrl,
            erasePath: storedSync.erasePath || storedSync.eraseUrl,
          },
        } : {}),
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
        status: record.status === 'joined' ? 'joined' : record.status === 'sync-only' ? 'sync-only' : 'email-sent',
        syncOnly: record.syncOnly === true,
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

const SYNCHRONIZED_LIST_TYPES = new Map([
  [STORAGE_KEYS.bookmarks, 'bible-bookmark'],
  [STORAGE_KEYS.resourceBookmarks, 'resource-bookmark'],
  [STORAGE_KEYS.notes, 'note'],
  [STORAGE_KEYS.highlights, 'highlight'],
])

function parseImportedJson(value, fallback) {
  try { return JSON.parse(value) } catch { return fallback }
}

function timestampNumber(value) {
  const parsed = Date.parse(String(value || ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function itemModifiedAt(item) {
  return timestampNumber(item?.dateModified)
    || timestampNumber(item?.updatedAt)
    || timestampNumber(item?.dateCreated)
    || timestampNumber(item?.createdAt)
}

function importedItemId(item) {
  if (item?.id != null && String(item.id)) return String(item.id)
  // Retain legacy pre-UUID entries without collapsing distinct item kinds.
  return JSON.stringify([
    item?.resourceId || '', item?.commentaryId || '', item?.book || '',
    item?.chapter || '', item?.verse || '', item?.chapterIndex || '',
    item?.reference || '', item?.type || '',
  ])
}

function wasSynchronouslyDeleted(syncState, recordType, recordId) {
  return syncState?.records?.[`${recordType}\u0000${recordId}`]?.deleted === true
}

function hasSynchronizedMetadata(syncState, recordType, recordId) {
  return Boolean(syncState?.records?.[`${recordType}\u0000${recordId}`])
}

function mergeSynchronizedList(current, incoming, recordType, syncState) {
  const existing = Array.isArray(current) ? current : []
  const result = new Map(existing.map(item => [importedItemId(item), item]))
  for (const item of Array.isArray(incoming) ? incoming : []) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const id = importedItemId(item)
    const saved = result.get(id)
    if (item?.id && hasSynchronizedMetadata(syncState, recordType, String(item.id))) continue
    if (!saved || itemModifiedAt(item) > itemModifiedAt(saved)) result.set(id, item)
  }
  return [...result.values()]
}

function newerPosition(current, incoming, recordType, recordId, syncState) {
  if (hasSynchronizedMetadata(syncState, recordType, recordId)) return current || null
  if (!current) {
    return wasSynchronouslyDeleted(syncState, recordType, recordId) ? null : incoming
  }
  if (!incoming) return current
  return timestampNumber(incoming.updatedAt) > timestampNumber(current.updatedAt) ? incoming : current
}

function mergeReaderProgress(current, incoming, syncState) {
  const saved = current && typeof current === 'object' ? current : {}
  const imported = incoming && typeof incoming === 'object' ? incoming : {}
  const resources = { ...(saved.resources || {}) }
  for (const [resourceId, position] of Object.entries(imported.resources || {})) {
    const merged = newerPosition(resources[resourceId], position, 'resource-position', resourceId, syncState)
    if (merged) resources[resourceId] = merged
  }
  return {
    ...imported,
    ...saved,
    bible: newerPosition(saved.bible, imported.bible, 'bible-position', 'bible', syncState),
    resources,
  }
}

function mergeActivePlan(current, incoming, syncState) {
  if (hasSynchronizedMetadata(syncState, 'active-reading-plan', 'active')) return current || null
  if (!current) return wasSynchronouslyDeleted(syncState, 'active-reading-plan', 'active') ? null : incoming
  if (!incoming) return current
  const currentTime = timestampNumber(current.updatedAt || current.startedAt || current.startedOn)
  const incomingTime = timestampNumber(incoming.updatedAt || incoming.startedAt || incoming.startedOn)
  return incomingTime > currentTime ? incoming : current
}

function mergePlanProgress(current, incoming, planId, syncState) {
  const saved = current && typeof current === 'object' ? current : {}
  const imported = incoming && typeof incoming === 'object' ? incoming : {}
  const completedItems = {}
  const days = new Set([...Object.keys(imported.completedItems || {}), ...Object.keys(saved.completedItems || {})])
  for (const day of days) {
    const ids = new Set(Array.isArray(saved.completedItems?.[day]) ? saved.completedItems[day].map(String) : [])
    for (const itemId of Array.isArray(imported.completedItems?.[day]) ? imported.completedItems[day].map(String) : []) {
      const recordId = `${planId}|${day}|${itemId}`
      if (!ids.has(itemId) && hasSynchronizedMetadata(syncState, 'reading-plan-item', recordId)) continue
      ids.add(itemId)
    }
    if (ids.size) completedItems[day] = [...ids]
  }

  const dayNotes = { ...(saved.dayNotes || {}) }
  const currentTime = timestampNumber(saved.updatedAt)
  const incomingTime = timestampNumber(imported.updatedAt)
  for (const [day, note] of Object.entries(imported.dayNotes || {})) {
    const recordId = `${planId}|${day}`
    if (hasSynchronizedMetadata(syncState, 'reading-plan-day-note', recordId)) continue
    if (!(day in dayNotes) || incomingTime > currentTime) dayNotes[day] = note
  }

  return {
    ...imported,
    ...saved,
    completedItems,
    completedDays: [...new Set([
      ...(saved.completedDays || []),
      ...(imported.completedDays || []).filter(day => !hasSynchronizedMetadata(
        syncState,
        'reading-plan-day',
        `${planId}|${day}`,
      )),
    ])],
    dayNotes,
    startedOn: saved.startedOn || imported.startedOn || null,
    updatedAt: currentTime >= incomingTime ? saved.updatedAt || imported.updatedAt : imported.updatedAt,
  }
}

export function mergeImportedSynchronizedValue(key, currentValue, importedValue, syncState = {}) {
  const current = parseImportedJson(currentValue, null)
  const incoming = parseImportedJson(importedValue, null)
  if (SYNCHRONIZED_LIST_TYPES.has(key)) {
    return JSON.stringify(mergeSynchronizedList(current, incoming, SYNCHRONIZED_LIST_TYPES.get(key), syncState))
  }
  if (key === STORAGE_KEYS.readerProgress) return JSON.stringify(mergeReaderProgress(current, incoming, syncState))
  if (key === STORAGE_KEYS.activeReadingPlan) return JSON.stringify(mergeActivePlan(current, incoming, syncState))
  if (key.startsWith(STORAGE_KEYS.readingPlanPrefix) && key.endsWith(':progress')) {
    const planId = key.slice(STORAGE_KEYS.readingPlanPrefix.length, -':progress'.length)
    return JSON.stringify(mergePlanProgress(current, incoming, planId, syncState))
  }
  return importedValue
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
  const syncState = await getStoredJson(STORAGE_KEYS.syncState, {})
  for (const [key, value] of entries) {
    if (typeof value !== 'string') continue
    const allowed = EXPORTABLE_EXACT_KEYS.includes(key) || key.startsWith(STORAGE_KEYS.readingPlanPrefix)
    if (!allowed) continue
    const sanitized = sanitizeImportedValue(key, value)
    const current = await getStoredValue(key)
    await setStoredValue(key, mergeImportedSynchronizedValue(key, current, sanitized, syncState))
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
