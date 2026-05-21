/**
 * Available Bible translations.
 * All translations are lazy-fetched from /data/translations/<id>.json.
 */
export const translations = [
  {
    id: 'LSV',
    abbr: 'LSV',
    name: 'Literal Standard Version',
    description: 'Modern literal translation (2020)',
    language: 'English',
    versification: 'western',
    license: 'CC BY-SA 4.0',
    attribution: 'Literal Standard Version, © 2020 Covenant Press. Licensed under CC BY-SA 4.0.',
  },
  {
    id: 'WEB',
    abbr: 'WEB',
    name: 'World English Bible',
    description: 'Modern public domain translation',
    language: 'English',
    versification: 'western',
    license: 'Public Domain',
    attribution: null,
  },
  {
    id: 'BSB',
    abbr: 'BSB',
    name: 'Berean Standard Bible',
    description: 'Clear and accurate modern English',
    language: 'English',
    versification: 'western',
    license: 'Public Domain (CC0)',
    attribution: null,
  },
  {
    id: 'KJV',
    abbr: 'KJV',
    name: 'King James Version',
    description: 'Classic English translation (1611)',
    language: 'English',
    versification: 'western',
    license: 'Public Domain',
    attribution: null,
  },
  {
    id: 'SYNO-W',
    abbr: 'SYNO-W',
    name: 'Russian Synodal (Western Aligned)',
    description: 'Russian Synodal with western verse alignment',
    language: 'Russian',
    versification: 'western',
    sourceVersification: 'synodal',
    license: 'Public Domain',
    attribution: 'Russian Synodal (russyn) from eBible.org, remapped to western versification.',
    mappingArtifacts: {
      nativeToCanonical: 'data/versification/SYNO-W.native-to-canonical.json',
      canonicalToNative: 'data/versification/SYNO-W.canonical-to-native.json',
    },
  },
  {
    id: 'UKRK',
    abbr: 'UKRK',
    name: 'Ukrainian Kulish/Pulyui',
    description: 'Ukrainian Bible (ukr1871 source)',
    language: 'Ukrainian',
    versification: 'ukr1871',
    license: 'Public Domain',
    attribution: 'Ukrainian ukr1871 text from eBible.org.',
  },
]

export const DEFAULT_TRANSLATION = 'BSB'

// Module-level cache for loaded translations
const translationCache = new Map()
const versificationCache = new Map()

export function getTranslationById(translationId) {
  return translations.find(t => t.id === translationId) || null
}

/**
 * Load a translation's Bible data. Returns cached version if already loaded.
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
 * Load optional versification mapping artifacts for a translation.
 * direction: "nativeToCanonical" | "canonicalToNative"
 */
export async function loadVersificationMap(translationId, direction = 'nativeToCanonical') {
  const meta = getTranslationById(translationId)
  const mapPath = meta?.mappingArtifacts?.[direction]
  if (!mapPath) return null

  const cacheKey = `${translationId}:${direction}`
  if (versificationCache.has(cacheKey)) {
    return versificationCache.get(cacheKey)
  }

  const normalizedPath = mapPath.replace(/^\/+/, '')
  const url = `${import.meta.env.BASE_URL}${normalizedPath}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Failed to load versification map ${translationId}/${direction}: ${resp.status}`)
  const data = await resp.json()
  versificationCache.set(cacheKey, data)
  return data
}
