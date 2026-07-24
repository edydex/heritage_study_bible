import config from '@payload-config'
import { getPayload } from 'payload'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { relationshipId } from '@/lib/communityRelationships'
import { communityPublicConfig, publicJson } from '@/lib/publicConfig'

const typeToCollection = {
  readingPlans: 'reading-plans',
  songs: 'songs',
  sermons: 'sermons',
  books: 'books',
  commentaries: 'commentaries',
} as const

export async function GET(_request: Request, context: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await context.params
  const collection = typeToCollection[type as keyof typeof typeToCollection]
  if (!collection) return publicJson({ error: 'Unknown content type.' }, { status: 404 })

  const payload = await getPayload({ config })
  const communityId = await getConfiguredCommunityId(payload)
  if (communityId == null) return publicJson({ error: 'Not found.' }, { status: 404 })
  try {
    const doc = await payload.findByID({ collection, id, depth: 2, overrideAccess: true })
    if (doc.status !== 'published' || relationshipId(doc.community) !== String(communityId)) {
      return publicJson({ error: 'Not found.' }, { status: 404 })
    }
    if (type === 'readingPlans' && 'planData' in doc) return publicJson(doc.planData)
    return publicJson(
      {
        schemaVersion: 1,
        contentType: type,
        ...doc,
        communityRightsContact: type === 'songs'
          ? {
              communityName: communityPublicConfig.name,
              communityUrl: communityPublicConfig.publicUrl,
              ccliLicenseNumber: communityPublicConfig.ccliLicenseNumber,
              email: communityPublicConfig.copyrightContactEmail,
            }
          : undefined,
      },
      type === 'songs'
        ? {
            headers: {
              'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
              'X-Robots-Tag': 'noindex, nofollow, noarchive',
            },
          }
        : {},
    )
  } catch {
    return publicJson({ error: 'Not found.' }, { status: 404 })
  }
}

export function OPTIONS() {
  return publicJson(null, { status: 204 })
}
