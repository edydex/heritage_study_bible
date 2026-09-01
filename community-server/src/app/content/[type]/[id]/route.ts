import config from '@payload-config'
import { getPayload } from 'payload'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { communityRequestAccess } from '@/lib/communityMemberRequest'
import { relationshipId } from '@/lib/communityRelationships'
import { communityPublicConfig, privateAuthorizationJson, publicJson } from '@/lib/publicConfig'
import { isSongVisibleToMember } from '@/lib/syncShowProtocol'

const typeToCollection = {
  readingPlans: 'reading-plans',
  songs: 'songs',
  sermons: 'sermons',
  books: 'books',
  commentaries: 'commentaries',
} as const

export async function GET(request: Request, context: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await context.params
  const collection = typeToCollection[type as keyof typeof typeToCollection]
  if (!collection) return publicJson({ error: 'Unknown content type.' }, { status: 404 })
  const contentJson = type === 'songs' ? privateAuthorizationJson : publicJson

  const payload = await getPayload({ config })
  const communityId = await getConfiguredCommunityId(payload)
  if (communityId == null) return contentJson({ error: 'Not found.' }, { status: 404 })
  try {
    const doc = await payload.findByID({ collection, id, depth: 2, overrideAccess: true })
    if (relationshipId(doc.community) !== String(communityId)) {
      return contentJson({ error: 'Not found.' }, { status: 404 })
    }
    if (type === 'songs') {
      const access = await communityRequestAccess(payload, request.headers, communityId)
      if (!access.authenticated
        || doc.status === 'archived'
        || (!access.manager && !isSongVisibleToMember(doc as unknown as Record<string, unknown>))) {
        return contentJson({ error: 'Not found.' }, { status: 404 })
      }
    } else if (doc.status !== 'published') {
      return contentJson({ error: 'Not found.' }, { status: 404 })
    }
    if (type === 'readingPlans' && 'planData' in doc) return contentJson(doc.planData)
    return contentJson(
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
    )
  } catch {
    return contentJson({ error: 'Not found.' }, { status: 404 })
  }
}

export function OPTIONS() {
  return publicJson(null, { status: 204 })
}
