/**
 * Available Bible translations.
 * WEB is bundled statically; all others are lazy-fetched from /data/translations/<id>.json
 */
export const translations = [
  {
    id: 'LSV',
    abbr: 'LSV',
    name: 'Literal Standard Version',
    description: 'Modern literal translation (2020)',
    license: 'CC BY-SA 4.0',
    attribution: 'Literal Standard Version, © 2020 Covenant Press. Licensed under CC BY-SA 4.0.',
  },
  {
    id: 'WEB',
    abbr: 'WEB',
    name: 'World English Bible',
    description: 'Modern public domain translation',
    license: 'Public Domain',
    attribution: null,
  },
  {
    id: 'BSB',
    abbr: 'BSB',
    name: 'Berean Standard Bible',
    description: 'Clear and accurate modern English',
    license: 'Public Domain (CC0)',
    attribution: null,
  },
  {
    id: 'KJV',
    abbr: 'KJV',
    name: 'King James Version',
    description: 'Classic English translation (1611)',
    license: 'Public Domain',
    attribution: null,
  },
]

export const DEFAULT_TRANSLATION = 'LSV'

// Module-level cache for loaded translations
const translationCache = new Map()

/**
 * Load a translation's Bible data. Returns cached version if already loaded.
 * For WEB, uses the bundled static import as a fast path.
 */
export async function loadTranslation(translationId) {
  // Return cached
  if (translationCache.has(translationId)) {
    return translationCache.get(translationId)
  }

  // Fetch from public/data/translations/<ID>.json
  const url = `${import.meta.env.BASE_URL}data/translations/${translationId}.json`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Failed to load ${translationId}: ${resp.status}`)
  const data = await resp.json()
  translationCache.set(translationId, data)
  return data
}

/**
 * Pre-populate cache with statically-imported data (for WEB which is bundled).
 */
export function seedTranslationCache(translationId, data) {
  translationCache.set(translationId, data)
}
