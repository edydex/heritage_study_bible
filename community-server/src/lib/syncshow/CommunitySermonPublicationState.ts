import type { StoredManagerSermonPublication } from './ManagerSermonPublication.ts'

export const COMMUNITY_SERMON_PUBLICATION_STATE_SCHEMA_VERSION = 1

const SYNC_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/

export type CommunitySermonPublicationState = Readonly<{
  schemaVersion: typeof COMMUNITY_SERMON_PUBLICATION_STATE_SCHEMA_VERSION
  syncId: string
  currentRevision: string
  syncVersion: number
  publicationVersion: number | null
  publicRevision: string | null
  publicId: string | null
  detailChecksum: string | null
  catalogChecksum: string | null
  passageIndexChecksum: string | null
  publishedAt: string | null
  selectedBodyEntryIds: readonly string[]
  selectedMediaIds: readonly string[]
}>

function validSha256(value: unknown, label: string): string {
  const normalized = String(value || '')
  if (!SHA256_PATTERN.test(normalized)) {
    throw new Error(`${label} is invalid.`)
  }
  return normalized
}

export function buildCommunitySermonPublicationState({
  catalog,
  publication,
  sermon,
}: {
  catalog: Readonly<{
    checksum: string
    passageIndexChecksum: string
  }>
  publication: StoredManagerSermonPublication | null
  sermon: Readonly<Record<string, unknown>>
}): CommunitySermonPublicationState {
  const syncId = String(sermon.syncId || '')
  const syncVersion = Number(sermon.syncVersion)
  if (
    !SYNC_ID_PATTERN.test(syncId)
    || !Number.isSafeInteger(syncVersion)
    || syncVersion < 1
  ) {
    throw new Error('Stored sermon publication state is invalid.')
  }
  const currentRevision = validSha256(
    sermon.syncCurrentRevision,
    'Stored current sermon revision',
  )
  if (publication && publication.syncId !== syncId) {
    throw new Error('Stored sermon publication identity is invalid.')
  }
  if (!publication || !publication.active) {
    return Object.freeze({
      schemaVersion: COMMUNITY_SERMON_PUBLICATION_STATE_SCHEMA_VERSION,
      syncId,
      currentRevision,
      syncVersion,
      publicationVersion: publication?.publicationVersion ?? null,
      publicRevision: null,
      publicId: null,
      detailChecksum: null,
      catalogChecksum: null,
      passageIndexChecksum: null,
      publishedAt: null,
      selectedBodyEntryIds: Object.freeze([]),
      selectedMediaIds: Object.freeze([]),
    })
  }
  return Object.freeze({
    schemaVersion: COMMUNITY_SERMON_PUBLICATION_STATE_SCHEMA_VERSION,
    syncId,
    currentRevision,
    syncVersion,
    publicationVersion: publication.publicationVersion,
    publicRevision: publication.publicRevision,
    publicId: publication.publicId,
    detailChecksum: publication.detailChecksum,
    catalogChecksum: validSha256(catalog.checksum, 'Stored sermon catalog checksum'),
    passageIndexChecksum: validSha256(
      catalog.passageIndexChecksum,
      'Stored sermon passage-index checksum',
    ),
    publishedAt: publication.publishedAt,
    selectedBodyEntryIds: Object.freeze([...publication.selectedBodyEntryIds]),
    selectedMediaIds: Object.freeze([...publication.selectedMediaIds]),
  })
}
