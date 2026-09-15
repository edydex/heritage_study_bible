import { applyManagerSongPublicLinkRevocation } from '../collections/SyncShowSongPublicLinks'
import type { CollectionAfterChangeHook, CollectionBeforeChangeHook, CollectionBeforeOperationHook } from 'payload'
import { effectiveSyncDocuments, legacyFieldsFromSyncDocuments } from './syncShowProtocol'

export const SONGBOOK_VISIBILITIES = ['private', 'unlisted', 'published'] as const
export type SongbookVisibility = typeof SONGBOOK_VISIBILITIES[number]
type Song = Record<string, unknown>

export function songbookVisibility(song: Song): SongbookVisibility {
  if (song.status === 'archived') return 'private'
  return song.songbookVisibility === 'published' || song.songbookVisibility === 'unlisted'
    ? song.songbookVisibility : 'private'
}

// Public copies contain only the song's words, chord text and public attribution.
// Uploaded files, private notes, receipts and lossless source documents stay private.
export function createPublicSongContent(song: Song) {
  const canonical = legacyFieldsFromSyncDocuments(effectiveSyncDocuments(song))
  const words = { ...canonical, ...song }
  for (const field of ['lyrics', 'russianLyrics']) {
    if (typeof words[field] !== 'string') words[field] = canonical[field] || ''
  }
  const text = (field: string) => String(words[field] || '')
  const list = (field: string) => Array.isArray(words[field]) ? (words[field] as unknown[]).map(String) : []
  return {
    schemaVersion: 1, contentType: 'songs',
    title: text('title'), russianTitle: text('russianTitle'), alternateTitles: list('alternateTitles'),
    authors: list('authors'), lyrics: text('lyrics'), russianLyrics: text('russianLyrics'),
    chordSheet: text('chordSheet'), russianChordSheet: text('russianChordSheet'),
    copyright: text('copyright'), license: text('license'), ccliNumber: text('ccliNumber'),
  }
}
export type PublicSongContent = ReturnType<typeof createPublicSongContent>

export function publishedSongContent(song: Song): PublicSongContent | null {
  if (songbookVisibility(song) === 'private') return null
  const value = song.songbookContent
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = value as Song
  if (raw.schemaVersion !== 1 || raw.contentType !== 'songs' || typeof raw.title !== 'string') return null
  // Re-project stored data too; adding a private field later cannot expose it here.
  const text = (field: string) => typeof raw[field] === 'string' ? raw[field] as string : ''
  const list = (field: string) => Array.isArray(raw[field]) ? (raw[field] as unknown[]).filter((item): item is string => typeof item === 'string') : []
  return {
    schemaVersion: 1, contentType: 'songs', title: text('title'), russianTitle: text('russianTitle'),
    alternateTitles: list('alternateTitles'), authors: list('authors'), lyrics: text('lyrics'),
    russianLyrics: text('russianLyrics'), chordSheet: text('chordSheet'), russianChordSheet: text('russianChordSheet'),
    copyright: text('copyright'), license: text('license'), ccliNumber: text('ccliNumber'),
  }
}

export const captureSongPublicationIntent: CollectionBeforeOperationHook = ({ args, operation }) => {
  if (operation === 'create' || operation === 'update' || operation === 'updateByID') {
    const input = 'data' in args ? args.data : undefined
    args.req.context.songbookPublicationRequested = Boolean(input && Object.prototype.hasOwnProperty.call(input, 'songbookVisibility'))
  }
  return args
}

export const prepareSongPublication: CollectionBeforeChangeHook = ({ data, originalDoc, context }) => {
  const existing = (originalDoc || {}) as Song
  const next = { ...data } as Song
  // A server-generated snapshot is the only anonymous lyrics source. Ordinary
  // SyncShow/member-sharing edits do not replace the last explicitly saved copy.
  next.songbookContent = existing.songbookContent || null
  const merged = { ...existing, ...next }
  if (songbookVisibility(merged) === 'private') next.songbookContent = null
  else if (context.songbookPublicationRequested === true) {
    next.songbookContent = createPublicSongContent(merged)
  }
  return next
}

// Selecting Private also withdraws previously issued anonymous sharing links.
// These writes use the song update's transaction, so a failed withdrawal rolls
// back the publication change instead of displaying a false Private state.
export const withdrawSongPublicLinks: CollectionAfterChangeHook = async ({ doc, operation, context, req }) => {
  if (operation !== 'update' || !((context.songbookPublicationRequested === true && songbookVisibility(doc) === 'private') || doc.status === 'archived')) return doc
  const community = typeof doc.community === 'object' ? doc.community.id : doc.community
  const links = await req.payload.find({ collection: 'syncshow-song-public-links', req, overrideAccess: true, showHiddenFields: true,
    pagination: false, depth: 0, where: { and: [{ community: { equals: community } }, { songSyncId: { equals: doc.syncId } }, { revokedAt: { exists: false } }] } })
  for (const link of links.docs) {
    const data = applyManagerSongPublicLinkRevocation({ data: { revokedAt: new Date().toISOString() }, originalDoc: link as unknown as Song, userId: req.user?.id })
    await req.payload.update({ collection: 'syncshow-song-public-links', id: link.id, req, overrideAccess: true,
      context: { songPublicLinkInternalMutation: true }, data })
  }
  return doc
}
