import config from '@payload-config'
import { getPayload } from 'payload'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { publicLiveServiceSettings } from '@/lib/liveServiceConfig'
import { communityPublicConfig } from '@/lib/publicConfig'

export async function loadLiveService() {
  const payload = await getPayload({ config })
  const communityId = await getConfiguredCommunityId(payload)
  if (communityId === null) return publicLiveServiceSettings({ name: communityPublicConfig.name })
  const community = await payload.findByID({ collection: 'communities', id: communityId, depth: 0, overrideAccess: false })
  return publicLiveServiceSettings(community as unknown as Record<string, unknown>)
}
