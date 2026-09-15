import config from '@payload-config'
import { getPayload } from 'payload'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { CANONICAL_BIBLE_BOOKS, type CanonicalBibleRange } from '@/lib/syncshow/BibleRange'
import {
  parsePublicSermonCatalogSource,
  parsePublicSermonDetailSource,
  type PublicSermonCatalogItem,
  type PublicSermonDetail,
} from '@/lib/syncshow/PublicSermonPublication'
import {
  loadActivePublicSermonPublication,
  loadStoredPublicSermonCatalog,
} from '@/lib/syncshow/SermonPublicationStore'
import { publishedSongContent } from '@/lib/songPublication'
import type { SongbookEntry } from '@/lib/songbookSearch'

function relationId(value: unknown) {
  const raw = value && typeof value === 'object' && 'id' in value
    ? (value as { id: unknown }).id
    : value
  return String(raw || '')
}

function publicSong(doc: Record<string, any>): SongbookEntry | null {
  const content = publishedSongContent(doc)
  if (!content) return null
  return { id: String(doc.id), slug: String(doc.slug || doc.syncId || doc.id),
    title: content.title, russianTitle: content.russianTitle, alternateTitles: content.alternateTitles,
    authors: content.authors }
}

async function context() {
  const payload = await getPayload({ config })
  const communityId = await getConfiguredCommunityId(payload)
  return { payload, communityId }
}

export async function loadPublicSermons(): Promise<readonly PublicSermonCatalogItem[]> {
  const { payload, communityId } = await context()
  if (communityId == null) return []
  const stored = await loadStoredPublicSermonCatalog(payload as never, communityId)
  if (!stored) return []
  return parsePublicSermonCatalogSource(stored.source).items
}

export async function loadPublicSermon(publicId: string): Promise<PublicSermonDetail | null> {
  const { payload, communityId } = await context()
  if (communityId == null) return null
  const publication = await loadActivePublicSermonPublication(
    payload as never,
    communityId,
    publicId,
  )
  return publication ? parsePublicSermonDetailSource(publication.detailSource) : null
}

export async function loadPublicSongs(): Promise<SongbookEntry[]> {
  const { payload, communityId } = await context()
  if (communityId == null) return []
  const songs: SongbookEntry[] = []
  let page = 1
  for (;;) {
    const result = await payload.find({
      collection: 'songs', depth: 0, limit: 200, page, overrideAccess: true, showHiddenFields: true,
      sort: 'title', where: { and: [
        { community: { equals: communityId } }, { status: { not_equals: 'archived' } },
        { songbookVisibility: { equals: 'published' } },
      ] },
    })
    for (const doc of result.docs) {
      const song = publicSong(doc)
      if (song) songs.push(song)
    }
    if (!result.hasNextPage) return songs
    page++
  }
}

export async function loadPublicSong(
  routeId: string,
): Promise<{ song: SongbookEntry; content: NonNullable<ReturnType<typeof publishedSongContent>> } | null> {
  const { payload, communityId } = await context()
  if (communityId == null) return null
  const found = await payload.find({
    collection: 'songs',
    depth: 0,
    limit: 2,
    overrideAccess: true,
    showHiddenFields: true,
    where: {
      and: [
        { community: { equals: communityId } },
        { status: { not_equals: 'archived' } },
        {
          or: [
            { slug: { equals: routeId } },
            { syncId: { equals: routeId } },
          ],
        },
      ],
    },
  })
  const raw = found.docs[0] as Record<string, any> | undefined
  if (!raw || relationId(raw.community) !== String(communityId)) return null
  const song = publicSong(raw)
  const content = publishedSongContent(raw)
  return song && content ? { song, content } : null
}

export function formatServiceDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-US', {
        dateStyle: 'long',
        timeZone: 'UTC',
      }).format(date)
}

export function formatBibleRange(range: CanonicalBibleRange) {
  const book = CANONICAL_BIBLE_BOOKS.find(candidate => candidate.id === range.bookId)
  const start = `${range.start.chapter}${range.start.verse ? `:${range.start.verse}` : ''}`
  const sameChapter = range.end.chapter === range.start.chapter
  const end = `${sameChapter ? '' : range.end.chapter}${range.end.verse ? `:${range.end.verse}` : ''}`
  return `${book?.name || range.bookId} ${start}${end && end !== start ? `–${end}` : ''}`
}
