import { communityPublicConfig, publicJson } from '@/lib/publicConfig'
import { PUBLIC_SERMON_DISCOVERY_DESCRIPTOR } from '@/lib/syncshow/PublicSermonPublication'

export function GET() {
  return publicJson({
    schemaVersion: 2,
    kind: 'heritage-content-server',
    id: communityPublicConfig.id,
    name: communityPublicConfig.name,
    description: communityPublicConfig.description,
    publisher: communityPublicConfig.name,
    website: communityPublicConfig.publicUrl,
    updatedAt: new Date().toISOString(),
    catalogs: {
      readingPlans: '/catalogs/readingPlans',
      songs: '/catalogs/songs',
      sermons: '/catalogs/sermons',
      books: '/catalogs/books',
      commentaries: '/catalogs/commentaries',
    },
    publications: {
      sermons: PUBLIC_SERMON_DISCOVERY_DESCRIPTOR,
    },
  })
}

export function OPTIONS() {
  return publicJson(null, { status: 204 })
}
