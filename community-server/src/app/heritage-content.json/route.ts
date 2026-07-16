import { communityPublicConfig, publicJson } from '@/lib/publicConfig'

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
  })
}

export function OPTIONS() {
  return publicJson(null, { status: 204 })
}
