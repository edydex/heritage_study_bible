import { publishedSongContent, songbookVisibility } from '@/lib/songPublication'
import config from '@payload-config'
import { getPayload } from 'payload'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { communityRequestAccess } from '@/lib/communityMemberRequest'
import { isSongVisibleToMember } from '@/lib/syncShowProtocol'
import { privateAuthorizationJson, publicJson } from '@/lib/publicConfig'

const typeToCollection = {
  readingPlans: 'reading-plans',
  songs: 'songs',
  sermons: 'sermons',
  books: 'books',
  commentaries: 'commentaries',
} as const

const mediaTypes = {
  readingPlans: 'application/vnd.heritage.reading-plan+json',
  songs: 'application/vnd.heritage.song+json',
  sermons: 'application/vnd.heritage.sermon+json',
  books: 'application/vnd.heritage.book+json',
  commentaries: 'application/vnd.heritage.commentary+json',
} as const

export async function GET(request: Request, context: { params: Promise<{ type: string }> }) {
  const { type } = await context.params
  const collection = typeToCollection[type as keyof typeof typeToCollection]
  if (!collection) return publicJson({ error: 'Unknown catalog.' }, { status: 404 })
  const catalogJson = type === 'songs' ? privateAuthorizationJson : publicJson

  const payload = await getPayload({ config })
  const communityId = await getConfiguredCommunityId(payload)
  if (communityId == null) {
    return catalogJson({ error: 'The configured community does not exist.' }, { status: 503 })
  }
  const songAccess = type === 'songs'
    ? await communityRequestAccess(payload, request.headers, communityId)
    : null
  const now = new Date().toISOString()
  const records: Record<string, any>[] = []
  let page = 1
  for (;;) {
    const result = await payload.find({
      collection, depth: 0, limit: type === 'songs' ? 200 : 1000, page,
      overrideAccess: true, showHiddenFields: type === 'songs', sort: 'id',
      where: { and: [
        { community: { equals: communityId } },
        type === 'songs' ? { status: { not_equals: 'archived' } } : { status: { equals: 'published' } },
        ...(type === 'songs' && !songAccess?.authenticated ? [{ songbookVisibility: { equals: 'published' } }] : []),
      ] },
    })
    records.push(...result.docs)
    if (type !== 'songs' || !result.hasNextPage) break
    page++
  }
  const docs = type === 'songs' ? records.flatMap<Record<string, any>>(doc => {
    const raw = doc as unknown as Record<string, unknown>
    const content = publishedSongContent(raw)
    if (songbookVisibility(raw) === 'published' && content) return [{ ...content, id: doc.id }]
    if (songAccess?.authenticated && (songAccess.manager || isSongVisibleToMember(raw, new Date(now)))) return [doc]
    return []
  }) : records

  return catalogJson(
    {
      schemaVersion: 2,
      contentType: type,
      updatedAt: new Date().toISOString(),
      items: docs.map(doc => ({
        id: String(doc.id),
        title: doc.title,
        description: doc.description || '',
        author: 'author' in doc ? doc.author : undefined,
        authors: 'authors' in doc ? doc.authors : undefined,
        alternateTitle: 'russianTitle' in doc ? doc.russianTitle : undefined,
        russianTitle: 'russianTitle' in doc ? doc.russianTitle : undefined,
        rightsStatus:
          type !== 'songs' && 'rightsStatus' in doc
            ? doc.rightsStatus
            : undefined,
        content: {
          url: `/content/${type}/${doc.id}`,
          mediaType: mediaTypes[type as keyof typeof mediaTypes],
        },
      })),
    },
  )
}

export function OPTIONS() {
  return publicJson(null, { status: 204 })
}
