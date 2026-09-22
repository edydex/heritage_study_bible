import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { resolveCommunityBookAccess } from './communityBookAccess'
import { communityBookDownloads, communityBookAudioUrl } from './communityBookDownloads'
import { setCommunityAudioBooks } from './audioCatalog'
import { makeRemoteContentKey } from '../utils/contentProtocol'

const REGISTRY = 'heritage-community-audio-v1'
export const NATIVE_COMMUNITY_AUDIO = 'heritage-community-audio-active-v1'
const documents = new Map()
let registry = [], initialized, updates = Promise.resolve()
const native = () => Capacitor.getPlatform?.() === 'android'
async function read() {
  if (!initialized) initialized = (async () => {
    const value = native() ? (await Preferences.get({ key: REGISTRY })).value : localStorage.getItem(REGISTRY)
    try { const rows = JSON.parse(value || '[]'); registry = Array.isArray(rows) ? rows : [] } catch { registry = [] }
  })()
  await initialized
}
async function optionsFor(book) {
  const result = await resolveCommunityBookAccess({ contentServerId: book.community.serverId, contentUrl: book.community.contentUrl })
  if (result.status !== 'ready' || String(result.memberId) !== book.community.memberId) return null
  return result
}
export async function refreshCommunityAudioCatalog() {
  await read()
  const active = []
  for (const book of registry) {
    const options = await optionsFor(book)
    if (options) active.push({ ...book, community: { ...book.community, expiresAt: options.expiresAt } })
  }
  setCommunityAudioBooks(active)
  if (native()) await Preferences.set({ key: NATIVE_COMMUNITY_AUDIO, value: JSON.stringify(active) })
  return active
}
export async function registerCommunityAudio(document, item, options) {
  if (!document.readAlong?.chapters?.length || options.memberId == null) return null
  await read()
  const contentUrl = item.content.url, name = await communityBookDownloads.nameFor(contentUrl, options)
  if (!name) return null
  const scope = name.slice(-64), contentKey = item.contentKey || makeRemoteContentKey(item.sourceServerId, 'books', document.id)
  const id = contentKey
  const community = { contentUrl, contentKey, serverId: item.sourceServerId, communityId: options.communityId, memberId: String(options.memberId), scope, expiresAt: options.expiresAt }
  const book = { id, title: document.title, author: document.author, kind: 'audiobook', community, editions: [{ id: 'community', title: document.readAlong.voice || 'Community recording', tracks: document.readAlong.chapters.map((chapter, index) => ({
    id: `cb-${scope.slice(0, 24)}-${index}`, bookId: id, editionId: 'community', title: chapter.title, duration: chapter.duration, bytes: chapter.audioSize,
    url: communityBookAudioUrl(contentUrl, chapter.id), community: { ...community, chapterId: chapter.id, chapterIndex: index, audioSha256: chapter.audioSha256 },
  })) }] }
  documents.set(scope, document)
  updates = updates.catch(() => {}).then(async () => {
    registry = [...registry.filter(row => row.community.scope !== scope), book]
    if (native()) await Preferences.set({ key: REGISTRY, value: JSON.stringify(registry) })
    else localStorage.setItem(REGISTRY, JSON.stringify(registry))
    await refreshCommunityAudioCatalog()
  })
  await updates
  return book
}
export async function communityAudioSource(track) {
  const options = await optionsFor({ community: track.community })
  if (!options) throw new Error('Sign in to this Community to listen.')
  const { community } = track
  let document = documents.get(community.scope)
  if (!document) document = (await communityBookDownloads.loadDocument(community.contentUrl, options)).value
  const chapter = document.readAlong?.chapters.find(ch => ch.id === community.chapterId && ch.audioSha256 === community.audioSha256)
  if (!chapter) throw new Error('This recording has changed. Open the book again.')
  const blob = await communityBookDownloads.loadAudio(community.contentUrl, chapter, options)
  const url = URL.createObjectURL(blob)
  return { webPath: url, offline: Boolean(await communityBookDownloads.status(community.contentUrl, options)), release: () => URL.revokeObjectURL(url) }
}
export function sentenceRanges(text, language = 'en') {
  if (typeof Intl.Segmenter === 'function') return [...new Intl.Segmenter(language, { granularity: 'sentence' }).segment(text)].map(part => ({ start: part.index, end: part.index + part.segment.trimEnd().length }))
  return [...text.matchAll(/[^.!?…]+(?:[.!?…]+[»”"']*|$)/gu)].map(match => ({ start: match.index, end: match.index + match[0].trimEnd().length }))
}
export function communityAudioTiming(document, track) {
  const chapterIndex = track.community.chapterIndex, chapter = document.readAlong.chapters[chapterIndex]
  if (!chapter || chapter.id !== track.community.chapterId || chapter.audioSha256 !== track.community.audioSha256) return null
  const paragraphs = {}, spans = [], sentenceSpans = []
  chapter.paragraphs.forEach((paragraph, paragraphIndex) => {
    const key = `${chapterIndex}:${paragraphIndex}`, words = chapter.words.filter(word => word.paragraphId === paragraph.id)
    paragraphs[key] = { chapterIndex, paragraphIndex, text: paragraph.text }
    if (!words.length) return
    spans.push({ paragraph: key, start: words[0].start, end: words.at(-1).end })
    for (const range of sentenceRanges(paragraph.text, document.readAlong.language)) {
      const matches = words.filter(word => word.sourceStart < range.end && word.sourceEnd > range.start)
      if (!matches.length) continue
      const next = { paragraph: key, start: matches[0].start, end: matches.at(-1).end, textStart: range.start, textEnd: range.end }
      sentenceSpans.push(next)
    }
  })
  // Narration may read a printed citation before the quotation it follows.
  // The player's binary search needs spoken order. Shared source mappings can
  // cross sentence boundaries (e.g. “Лук. 9:1”); merge their overlapping ranges.
  sentenceSpans.sort((a, b) => a.start - b.start || a.end - b.end)
  const merged = []
  for (const next of sentenceSpans) {
    const previous = merged.at(-1)
    if (previous?.paragraph === next.paragraph && next.start < previous.end) {
      previous.end = Math.max(previous.end, next.end)
      previous.textStart = Math.min(previous.textStart, next.textStart)
      previous.textEnd = Math.max(previous.textEnd, next.textEnd)
    } else merged.push({ ...next })
  }
  return { trackId: track.id, textBookId: track.bookId, paragraphs, spans, sentenceSpans: merged }
}
export async function loadCommunityAudioTiming(track) {
  const options = await optionsFor({ community: track.community })
  if (!options) return null
  const document = documents.get(track.community.scope) || (await communityBookDownloads.loadDocument(track.community.contentUrl, options)).value
  return communityAudioTiming(document, track)
}
export function clearCommunityAudioDocuments() { documents.clear() }
export async function forgetCommunityAudio(contentUrl) {
  await read()
  updates = updates.catch(() => {}).then(async () => {
    for (const row of registry) if (row.community.contentUrl === contentUrl) documents.delete(row.community.scope)
    registry = registry.filter(row => row.community.contentUrl !== contentUrl)
    if (native()) await Preferences.set({ key: REGISTRY, value: JSON.stringify(registry) })
    else localStorage.setItem(REGISTRY, JSON.stringify(registry))
    await refreshCommunityAudioCatalog()
  })
  return updates
}
