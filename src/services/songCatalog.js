import { parseSongLyrics, normalizeSongSections } from '../../community-server/packages/song-text/index.js'
import { HERITAGE_BUILT_IN_SONGS } from '../data/builtInSongs.js'
import { HYMNS } from '../components/HymnsViewer.jsx'
import { getCommunities } from './communities.js'
import { getRemoteContentItemsForCategory } from './contentServers.js'
import { readSavedSong, saveSong } from './savedSongs.js'

const SONG_REQUEST_TIMEOUT_MS = 5000
const TRAILING_DESCRIPTOR = /\s*\([^)]*\)\s*$/
const TITLE_ALIASES = new Map([
  ['arise my soul arise', 'o my soul arise'],
  ['turn your eyes upon jesus', 'turn your eyes'],
])

function plainText(value) {
  return String(value || '').normalize('NFKC').trim()
}

export function normalizeSongTitle(value) {
  const normalized = plainText(value)
    .replace(TRAILING_DESCRIPTOR, '')
    .replace(/[’‘]/g, "'")
    .replace(/&/g, ' and ')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\boh\b/g, 'o')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
  return TITLE_ALIASES.get(normalized) || normalized
}

function routeIdForTitle(value) {
  return normalizeSongTitle(value).replace(/\s+/g, '-').slice(0, 96)
}

function communityContentServerId(community) {
  return String(community?.contentPreview?.manifest?.id || '')
}

function sourceForRemoteItem(item, communities, remoteIndex) {
  const community = communities.find(record => communityContentServerId(record) === item.sourceServerId)
  if (!community) {
    return {
      id: item.sourceServerId,
      name: item.sourceServerName || 'Content Server',
      type: 'content-server',
      priority: 1000 + remoteIndex,
    }
  }

  const secondaryCommunities = communities
    .filter(record => !record.primary)
    .sort((left, right) => (
      Date.parse(left.addedAt || '') - Date.parse(right.addedAt || '')
    ))
  const secondaryIndex = secondaryCommunities.findIndex(record => record.manifest.id === community.manifest.id)
  return {
    id: item.sourceServerId,
    name: community.manifest?.name || item.sourceServerName || 'Community',
    type: community.primary ? 'primary-community' : 'community',
    priority: community.primary ? 100 : 200 + Math.max(secondaryIndex, 0),
  }
}

function builtInReference(song) {
  return {
    kind: 'built-in',
    id: song.id,
    title: song.title,
    russianTitle: song.russianTitle || '',
    alternateTitles: Array.isArray(song.alternateTitles) ? song.alternateTitles : [],
    description: song.description || '',
    author: song.author || '',
    authors: song.authors || (song.author ? [song.author] : []),
    year: song.year,
    rightsStatus: song.rightsStatus,
    source: { id: 'heritage', name: 'Heritage', type: 'heritage', priority: 0 },
    song,
  }
}

function remoteReference(item, communities, remoteIndex) {
  return {
    kind: 'remote',
    id: item.id,
    title: item.title,
    russianTitle: item.russianTitle || item.alternateTitle || '',
    alternateTitles: Array.isArray(item.alternateTitles) ? item.alternateTitles : [],
    description: item.description || '',
    author: item.author || '',
    authors: Array.isArray(item.authors) ? item.authors : (item.author ? [item.author] : []),
    year: item.year,
    rightsStatus: item.rightsStatus,
    source: sourceForRemoteItem(item, communities, remoteIndex),
    item,
  }
}

export function mergeSongCatalog({
  builtInSongs = HERITAGE_BUILT_IN_SONGS,
  remoteItems = [],
  communities = [],
} = {}) {
  const groups = new Set()
  const groupByTitle = new Map()
  const referenceKeys = reference => [...new Set([
    reference.title,
    reference.russianTitle,
    ...reference.alternateTitles,
  ].map(normalizeSongTitle).filter(Boolean))]
  const add = reference => {
    const keys = referenceKeys(reference)
    if (!keys.length) return
    const matches = [...new Set(keys.map(key => groupByTitle.get(key)).filter(Boolean))]
    const target = matches[0] || { songKey: normalizeSongTitle(reference.title) || keys[0], keys: new Set(), references: [] }
    if (!matches.length) groups.add(target)

    matches.slice(1).forEach(group => {
      group.references.forEach(existing => target.references.push(existing))
      group.keys.forEach(key => target.keys.add(key))
      groups.delete(group)
    })
    target.references.push(reference)
    keys.forEach(key => target.keys.add(key))
    target.keys.forEach(key => groupByTitle.set(key, target))
  }

  builtInSongs.forEach(song => add(builtInReference(song)))
  remoteItems.forEach((item, index) => add(remoteReference(item, communities, index)))

  return [...groups].map(group => {
    group.references.sort((left, right) => left.source.priority - right.source.priority)
    const builtIn = group.references.find(reference => reference.kind === 'built-in')
    const preferred = builtIn || group.references[0]
    const russianTitle = group.references.find(reference => reference.russianTitle)?.russianTitle || ''
    const sourceNames = [...new Set(group.references.map(reference => reference.source.name))]
    return {
      id: builtIn?.id || `song-${routeIdForTitle(preferred.title)}`,
      songKey: group.songKey,
      songGroup: true,
      title: preferred.title,
      alternateTitle: russianTitle,
      russianTitle,
      description: preferred.description,
      author: preferred.author,
      authors: preferred.authors,
      year: preferred.year,
      rightsStatus: preferred.rightsStatus,
      builtIn: Boolean(builtIn),
      sourceCount: sourceNames.length,
      sourceNames,
      references: group.references,
    }
  }).sort((left, right) => left.title.localeCompare(right.title))
}

export function getMergedSongCatalog() {
  return mergeSongCatalog({
    remoteItems: getRemoteContentItemsForCategory('songs'),
    communities: getCommunities(),
  })
}

function sectionsFromStanzas(stanzas) {
  return (Array.isArray(stanzas) ? stanzas : [])
    .map((stanza, index) => ({
      label: `Verse ${index + 1}`,
      lines: plainText(stanza).split(/\r?\n/).map(plainText).filter(Boolean),
    }))
    .filter(section => section.lines.length)
}

const sectionsFromSongSections = normalizeSongSections
export const sectionsFromText = parseSongLyrics

function lyricsSignature(sections) {
  return sections
    .flatMap(section => section.lines)
    .join('\n')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/[^a-zа-яё0-9']+/giu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function rightsForBuiltIn(song, language) {
  const russian = language === 'ru'
  return {
    status: song.rightsStatus || '',
    label: russian ? song.russianRightsLabel : song.rightsLabel,
    sourceLabel: russian ? song.russianSourceLabel || '' : '',
    sourceUrl: russian
      ? song.russianTextSourceUrl || ''
      : song.textSourceUrl || song.sourceUrl || '',
    permissionUrl: song.permissionUrl || '',
  }
}

function builtInLanguageVariants(reference) {
  const variants = []
  const add = (language, configuredSections, stanzas) => {
    const sections = sectionsFromSongSections(configuredSections)
    const normalizedSections = sections.length ? sections : sectionsFromStanzas(stanzas)
    if (!normalizedSections.length) return
    variants.push({
      language,
      sections: normalizedSections,
      source: reference.source,
      rights: rightsForBuiltIn(reference.song, language),
    })
  }
  const legacySong = HYMNS.find(song => song.id === reference.song.id)
  add('en', reference.song.sections, reference.song.stanzas?.length ? reference.song.stanzas : legacySong?.stanzas)
  add('ru', reference.song.russianSections, reference.song.russianStanzas)
  return variants
}

function rightsForDocument(document, item) {
  const nested = document?.rights && typeof document.rights === 'object' ? document.rights : {}
  return {
    status: plainText(document?.rightsStatus || nested.status || item?.rightsStatus),
    label: plainText(
      document?.rightsNotes ||
      nested.statement ||
      document?.rightsStatement ||
      document?.copyright ||
      item?.description,
    ),
    sourceUrl: plainText(document?.sourceUrl || item?.sourceUrl),
    permissionUrl: plainText(document?.permissionUrl || item?.permissionUrl),
  }
}

function remoteLanguageVariants(reference, document) {
  const variants = []
  const add = (language, sections, rights = rightsForDocument(document, reference.item)) => {
    if (!sections.length) return
    variants.push({ language, sections, source: reference.source, rights })
  }

  add('en', sectionsFromText(document?.lyrics))
  add('ru', sectionsFromText(document?.russianLyrics, { language: 'ru' }))

  const primarySections = sectionsFromSongSections(document?.songSections, document?.language)
  if (primarySections.length) add(plainText(document?.language).toLowerCase() === 'ru' ? 'ru' : 'en', primarySections)

  const translations = [
    ...(Array.isArray(document?.translations) ? document.translations : []),
    ...(Array.isArray(document?.languageVersions) ? document.languageVersions : []),
  ]
  translations.forEach(translation => {
    const language = plainText(translation?.language || translation?.locale).toLowerCase().startsWith('ru') ? 'ru' : 'en'
    const sections = sectionsFromSongSections(translation?.songSections, language)
    add(language, sections.length ? sections : sectionsFromText(translation?.lyrics || translation?.text, { language }))
  })
  return variants
}

async function fetchSongDocument(reference) {
  const url = reference.item?.content?.url
  if (!url) return null
  // The browsable songbook is public, even for church administrators. Member
  // links use their separate authenticated viewer and never enter this cache.
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), SONG_REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    if (Number(response.headers.get('content-length')) > 1024 * 1024) throw new Error('Song response is too large.')
    const text = await response.text()
    if (controller.signal.aborted) throw new Error('Refresh timed out.')
    if (new TextEncoder().encode(text).byteLength > 1024 * 1024) throw new Error('Song response is too large.')
    const document = JSON.parse(text)
    if (!document || Array.isArray(document) || typeof document !== 'object'
      || !['title', 'lyrics', 'russianLyrics', 'songSections'].some(key => Object.hasOwn(document, key))) {
      throw new Error('The server returned an invalid song.')
    }
    return document
  } finally {
    window.clearTimeout(timeout)
  }
}

export function collapseLanguageVariants(variants) {
  const grouped = new Map()
  variants.forEach(variant => {
    const signature = lyricsSignature(variant.sections)
    if (!signature) return
    const existing = grouped.get(signature)
    if (!existing) {
      grouped.set(signature, {
        signature,
        sections: variant.sections,
        sources: [variant.source],
        preferredSource: variant.source,
        rights: variant.rights,
      })
      return
    }
    if (!existing.sources.some(source => source.id === variant.source.id)) existing.sources.push(variant.source)
    if (variant.source.priority < existing.preferredSource.priority) {
      existing.sections = variant.sections
      existing.preferredSource = variant.source
      existing.rights = variant.rights
    }
  })
  return [...grouped.values()]
    .map(group => ({
      ...group,
      sources: group.sources.sort((left, right) => left.priority - right.priority),
    }))
    .sort((left, right) => left.preferredSource.priority - right.preferredSource.priority)
}

function assembledSong(group, loaded) {
  const allVariants = loaded.flatMap(result => result.variants)
  return {
    ...group,
    loaded,
    pendingSourceCount: Math.max(group.references.length - loaded.length, 0) + loaded.filter(result => result.refreshing).length,
    languages: {
      en: collapseLanguageVariants(allVariants.filter(variant => variant.language === 'en')),
      ru: collapseLanguageVariants(allVariants.filter(variant => variant.language === 'ru')),
    },
  }
}

export async function loadMergedSong(routeId, { onProgress } = {}) {
  const catalog = getMergedSongCatalog()
  const group = catalog.find(song => song.id === routeId || song.songKey === normalizeSongTitle(routeId))
  if (!group) return null

  const loadedByReference = new Map()
  group.references.filter(reference => reference.kind === 'built-in').forEach(reference => {
    loadedByReference.set(reference, {
      reference,
      variants: builtInLanguageVariants(reference),
      document: reference.song,
      error: null,
    })
  })
  const snapshot = () => assembledSong(
    group,
    group.references.map(reference => loadedByReference.get(reference)).filter(Boolean),
  )
  onProgress?.(snapshot())

  await Promise.all(group.references.filter(reference => reference.kind === 'remote').map(async reference => {
    const cached = await readSavedSong(reference)
    if (cached) {
      loadedByReference.set(reference, { reference, document: cached, variants: remoteLanguageVariants(reference, cached), cached: true, refreshing: true, error: null })
      onProgress?.(snapshot())
    }
    let result
    try {
      const document = await fetchSongDocument(reference)
      result = { reference, variants: remoteLanguageVariants(reference, document), document, error: null }
      if (document) await saveSong(reference, document)
    } catch (error) {
      result = { reference, variants: cached ? remoteLanguageVariants(reference, cached) : [], document: cached, cached: Boolean(cached), error }
    }
    loadedByReference.set(reference, result)
    onProgress?.(snapshot())
  }))
  return snapshot()
}
