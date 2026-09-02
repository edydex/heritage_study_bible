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
import {
  parseSongPublicLinkSnapshotSource,
  type SongPublicLinkSnapshot,
} from '@/lib/syncshow/SongPublicLink'

type PublicSong = {
  id: string
  syncId: string
  slug: string
  title: string
  russianTitle: string
  alternateTitles: string[]
  authors: string[]
  description: string
}

function relationId(value: unknown) {
  const raw = value && typeof value === 'object' && 'id' in value
    ? (value as { id: unknown }).id
    : value
  return String(raw || '')
}

function publicSong(doc: Record<string, any>): PublicSong {
  return {
    id: String(doc.id || ''),
    syncId: String(doc.syncId || ''),
    slug: String(doc.slug || doc.syncId || doc.id || ''),
    title: String(doc.title || 'Untitled song'),
    russianTitle: String(doc.russianTitle || ''),
    alternateTitles: Array.isArray(doc.alternateTitles)
      ? doc.alternateTitles.map(String).filter(Boolean)
      : [],
    authors: Array.isArray(doc.authors) ? doc.authors.map(String).filter(Boolean) : [],
    description: String(doc.description || ''),
  }
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

export async function loadPublicSongs(): Promise<PublicSong[]> {
  const { payload, communityId } = await context()
  if (communityId == null) return []
  const result = await payload.find({
    collection: 'songs',
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    showHiddenFields: true,
    sort: 'title',
    where: {
      and: [
        { community: { equals: communityId } },
        { status: { not_equals: 'archived' } },
      ],
    },
  })
  return result.docs.map(doc => publicSong(doc as Record<string, any>))
}

async function loadApprovedSongSnapshot(
  payload: Awaited<ReturnType<typeof getPayload>>,
  communityId: number,
  songSyncId: string,
): Promise<SongPublicLinkSnapshot | null> {
  const result = await payload.find({
    collection: 'syncshow-song-public-links',
    depth: 0,
    limit: 20,
    overrideAccess: true,
    showHiddenFields: true,
    sort: '-issuedAt',
    where: {
      and: [
        { community: { equals: communityId } },
        { songSyncId: { equals: songSyncId } },
        { revokedAt: { exists: false } },
      ],
    },
  })
  const now = Date.now()
  for (const raw of result.docs as Record<string, any>[]) {
    if (raw.expiresAt && Date.parse(String(raw.expiresAt)) <= now) continue
    try {
      return parseSongPublicLinkSnapshotSource(raw.snapshotSource, raw.snapshotChecksum)
    } catch {
      // A corrupt historical link never grants public access. Try the next
      // independently reviewed active snapshot, if one exists.
    }
  }
  return null
}

export async function loadPublicSong(
  routeId: string,
): Promise<{ song: PublicSong; snapshot: SongPublicLinkSnapshot | null } | null> {
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
  const snapshot = await loadApprovedSongSnapshot(payload, communityId, song.syncId)
  return { song, snapshot }
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
