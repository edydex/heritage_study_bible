import type { Payload } from 'payload'
import { WOTBC_STARTER_SONGS } from '@/data/wotbcSongCatalog'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'

export async function seedConfiguredSongs(payload: Payload) {
  if ((process.env.COMMUNITY_ID || '').trim().toLowerCase() !== 'wotbc') return

  const configuredCommunityId = await getConfiguredCommunityId(payload)
  const communityId = Number(configuredCommunityId)
  if (!Number.isInteger(communityId) || communityId < 1) return

  const existing = await payload.find({
    collection: 'songs',
    depth: 0,
    limit: 1000,
    overrideAccess: true,
    where: { community: { equals: communityId } },
  })
  const existingSlugs = new Set(existing.docs.map(song => song.slug))
  let created = 0

  for (const song of WOTBC_STARTER_SONGS) {
    if (existingSlugs.has(song.slug)) continue
    await payload.create({
      collection: 'songs',
      draft: false,
      overrideAccess: true,
      data: {
        ...song,
        community: communityId,
        description: song.rightsStatus === 'needs-review'
          ? 'WOTBC songbook listing. Lyrics, chords, and files can be added after the church records its license or permission.'
          : 'WOTBC songbook listing in English and Russian.',
        status: 'published',
      },
    })
    created += 1
  }

  if (created) payload.logger.info(`Added ${created} WOTBC starter song listings`)
}
