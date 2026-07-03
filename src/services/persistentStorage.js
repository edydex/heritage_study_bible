import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

export const STORAGE_KEYS = {
  bookmarks: 'bible-study-bookmarks',
  commentaryBookmarks: 'bible-study-commentary-bookmarks',
  notes: 'bible-study-notes',
  highlights: 'bible-study-highlights',
  journal: 'bible-study-journal',
  ink: 'bible-study-ink',
  journalTipsDismissed: 'heritage-journal-tips-dismissed',
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
}

export const EXPORTABLE_EXACT_KEYS = [
  STORAGE_KEYS.bookmarks,
  STORAGE_KEYS.commentaryBookmarks,
  STORAGE_KEYS.notes,
  STORAGE_KEYS.highlights,
  STORAGE_KEYS.journal,
  STORAGE_KEYS.ink,
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
    if (allowed) await setStoredValue(key, value)
  }

  return entries.length
}

export async function exportNotesMarkdown() {
  const notes = await getStoredJson(STORAGE_KEYS.notes, [])
  const bookmarks = await getStoredJson(STORAGE_KEYS.bookmarks, [])
  const commentaryBookmarks = await getStoredJson(STORAGE_KEYS.commentaryBookmarks, [])
  const journal = await getStoredJson(STORAGE_KEYS.journal, [])
  const ink = await getStoredJson(STORAGE_KEYS.ink, [])
  const lines = ['# Heritage Study Bible Export', '', `Exported: ${new Date().toISOString()}`, '']

  lines.push('## Verse Notes', '')
  if (notes.length === 0) lines.push('_No verse notes._', '')
  for (const note of notes) {
    lines.push(`### ${note.book} ${note.chapter}:${note.verse}`, '')
    if (note.verseText) lines.push(`> ${note.verseText}`, '')
    lines.push(note.text || '', '')
  }

  lines.push('## Journal Entries', '')
  const journalEntries = Array.isArray(journal) ? journal : []
  if (journalEntries.length === 0) lines.push('_No journal entries._', '')
  // Set of "book|chapter" that have handwritten ink strokes.
  const inkChapters = new Set(
    (Array.isArray(ink) ? ink : [])
      .filter(entry => Array.isArray(entry?.strokes) && entry.strokes.length > 0)
      .map(entry => `${entry.book}|${entry.chapter}`)
  )
  for (const entry of journalEntries) {
    const pane = entry.pane || 'notes'
    const paneLabel = pane === 'bible' ? ' (bible margin)' : pane === 'notes' ? ' (side notes)' : ''
    lines.push(`### ${entry.book} ${entry.chapter}${paneLabel}`, '')
    if (entry.text) lines.push(entry.text, '')
    if (inkChapters.has(`${entry.book}|${entry.chapter}`)) {
      lines.push('_[handwritten note present]_', '')
      inkChapters.delete(`${entry.book}|${entry.chapter}`)
    }
  }
  // Chapters with only handwritten ink (no typed journal text).
  for (const key of inkChapters) {
    const [book, chapter] = key.split('|')
    lines.push(`### ${book} ${chapter}`, '', '_[handwritten note present]_', '')
  }

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
