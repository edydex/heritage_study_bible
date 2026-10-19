import type { CollectionBeforeValidateHook } from 'payload'
import { membershipCommunityIds } from '@/access'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'

// Church ownership is installation context, not a choice on each new song.
export const assignSongCommunity: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  if (!data || data.community || originalDoc?.community) return data
  const communityId = await getConfiguredCommunityId(req.payload)
  if (!communityId) throw new Error('Set up this church before adding songs.')
  // Create access is evaluated before this hook, when community may be absent.
  // Check the derived relationship too; membership in another church is not enough.
  if (req.user && req.user.systemRole !== 'system-admin') {
    const allowed = await membershipCommunityIds(req, ['owner', 'admin', 'leader'])
    if (!allowed.map(String).includes(String(communityId))) throw new Error('You do not have permission to add songs for this church.')
  }
  return { ...data, community: communityId }
}

