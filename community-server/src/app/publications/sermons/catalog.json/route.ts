import config from '@payload-config'
import { getPayload } from 'payload'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import {
  PUBLIC_SERMON_CATALOG_MEDIA_TYPE,
  publicSermonOptionsResponse,
  publicSermonSourceResponse,
  unavailablePublicSermonResponse,
} from '@/lib/syncshow/PublicSermonPublication'
import { loadStoredPublicSermonCatalog } from '@/lib/syncshow/SermonPublicationStore'

export async function GET() {
  try {
    const payload = await getPayload({ config })
    const communityId = await getConfiguredCommunityId(payload)
    if (communityId == null) return unavailablePublicSermonResponse()
    const catalog = await loadStoredPublicSermonCatalog(
      payload as never,
      communityId,
    )
    if (!catalog) return unavailablePublicSermonResponse()
    return publicSermonSourceResponse(
      catalog.source,
      PUBLIC_SERMON_CATALOG_MEDIA_TYPE,
      catalog.checksum,
    )
  } catch {
    // Corrupt, ambiguous, or unavailable authority must never fall back to
    // legacy editorial Sermons rows.
    return unavailablePublicSermonResponse()
  }
}

export function OPTIONS() {
  return publicSermonOptionsResponse()
}
