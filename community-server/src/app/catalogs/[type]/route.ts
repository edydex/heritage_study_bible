import config from '@payload-config'
import { getPayload } from 'payload'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { isCommunityMemberRequest } from '@/lib/communityMemberRequest'
import { publicJson } from '@/lib/publicConfig'

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

  const payload = await getPayload({ config })
  const communityId = await getConfiguredCommunityId(payload)
  if (communityId == null) {
    return publicJson({ error: 'The configured community does not exist.' }, { status: 503 })
  }
  const songCatalogVisible = type !== 'songs'
    || await isCommunityMemberRequest(payload, request.headers, communityId)
  if (!songCatalogVisible) {
    return publicJson(
      {
        schemaVersion: 2,
        contentType: type,
        updatedAt: new Date().toISOString(),
        items: [],
      },
      {
        headers: {
          'Cache-Control': 'private, no-store',
          Vary: 'Authorization',
          'X-Robots-Tag': 'noindex, nofollow, noarchive',
        },
      },
    )
  }
  const result = await payload.find({
    collection,
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    where: {
      and: [
        { status: { equals: 'published' } },
        { community: { equals: communityId } },
      ],
    },
  })

  return publicJson(
    {
      schemaVersion: 2,
      contentType: type,
      updatedAt: new Date().toISOString(),
      items: result.docs.map(doc => ({
        id: String(doc.id),
        title: doc.title,
        description: doc.description || '',
        author: 'author' in doc ? doc.author : undefined,
        authors: 'authors' in doc ? doc.authors : undefined,
        alternateTitle: 'russianTitle' in doc ? doc.russianTitle : undefined,
        russianTitle: 'russianTitle' in doc ? doc.russianTitle : undefined,
        rightsStatus: 'rightsStatus' in doc ? doc.rightsStatus : undefined,
        content: {
          url: `/content/${type}/${doc.id}`,
          mediaType: mediaTypes[type as keyof typeof mediaTypes],
        },
      })),
    },
    type === 'songs'
      ? {
          headers: {
            'Cache-Control': 'private, no-store',
            Vary: 'Authorization',
            'X-Robots-Tag': 'noindex, nofollow, noarchive',
          },
        }
      : {},
  )
}

export function OPTIONS() {
  return publicJson(null, { status: 204 })
}
