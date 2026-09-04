import { postgresAdapter, type PostgresAdapterArgs } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { sql } from 'drizzle-orm'
import { check } from 'drizzle-orm/pg-core'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { Books } from '@/collections/Books'
import { Commentaries } from '@/collections/Commentaries'
import { Communities } from '@/collections/Communities'
import { CommunityInvites } from '@/collections/CommunityInvites'
import { CommunityAuthChallenges } from '@/collections/CommunityAuthChallenges'
import { CommunityAuthRateLimits } from '@/collections/CommunityAuthRateLimits'
import { CommunitySessions } from '@/collections/CommunitySessions'
import { EncryptedSync } from '@/collections/EncryptedSync'
import { EventRsvps } from '@/collections/EventRsvps'
import { Events } from '@/collections/Events'
import { Media } from '@/collections/Media'
import { Memberships } from '@/collections/Memberships'
import { PlanCohorts } from '@/collections/PlanCohorts'
import { PlanNotes } from '@/collections/PlanNotes'
import { ReadingPlans } from '@/collections/ReadingPlans'
import { ServiceDocuments } from '@/collections/ServiceDocuments'
import { ServicePlans } from '@/collections/ServicePlans'
import { Sermons } from '@/collections/Sermons'
import { Songs } from '@/collections/Songs'
import { SyncShowConnections } from '@/collections/SyncShowConnections'
import { SyncShowDeviceGrants } from '@/collections/SyncShowDeviceGrants'
import { SyncShowSermonChanges } from '@/collections/SyncShowSermonChanges'
import { SyncShowServiceDocumentChanges } from '@/collections/SyncShowServiceDocumentChanges'
import { SyncShowSermonPublicationCatalogs } from '@/collections/SyncShowSermonPublicationCatalogs'
import { SyncShowSermonPublications } from '@/collections/SyncShowSermonPublications'
import { SyncShowSongPublicLinks } from '@/collections/SyncShowSongPublicLinks'
import { SyncShowSongMemberShares } from '@/collections/SyncShowSongMemberShares'
import { SyncAccountEvents } from '@/collections/SyncAccountEvents'
import { SyncConflicts } from '@/collections/SyncConflicts'
import { SyncDevices } from '@/collections/SyncDevices'
import { SyncRecords } from '@/collections/SyncRecords'
import { Users } from '@/collections/Users'
import { authEndpoints } from '@/endpoints/auth'
import { accountEndpoints } from '@/endpoints/account'
import { managerSermonPublicationEndpoints } from '@/endpoints/sermonPublications'
import { managerSermonPreparationEndpoints } from '@/endpoints/sermonPreparations'
import { sermonMediaEndpoints } from '@/endpoints/sermonMedia'
import { managerServiceDocumentEndpoints } from '@/endpoints/serviceDocuments'
import { startSermonMediaMaintenance } from '@/lib/syncshow/SermonMediaMaintenance'
import { songPublicLinkEndpoints } from '@/endpoints/songPublicLinks'
import { songMemberSharingEndpoints } from '@/endpoints/songMemberSharing'
import { syncShowEndpoints } from '@/endpoints/syncShow'
import { syncEndpoints } from '@/endpoints/sync'
import { backfillSongSyncDocuments } from '@/lib/backfillSongSyncDocuments'
import { bootstrapInstallation } from '@/lib/bootstrapInstallation'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { communityAuthEnabled, publicUrl } from '@/lib/publicConfig'
import { seedConfiguredSongs } from '@/lib/seedConfiguredSongs'
import { ensurePublicSermonCatalog } from '@/lib/syncshow/SermonPublicationStore'
import { migrations } from '@/migrations'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const appOrigins = (process.env.HERITAGE_APP_ORIGINS || 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)
const communityOrigin = new URL(publicUrl).origin
const allowedOrigins = [...new Set([...appOrigins, communityOrigin])]

type RawRelationshipColumn = {
  name?: string
  reference?: { onDelete?: string }
}

const restrictSermonSystemParentDeletes: NonNullable<
  PostgresAdapterArgs['beforeSchemaInit']
>[number] = ({ adapter, schema }) => {
  const rawTables = (adapter as {
    rawTables?: Record<string, { columns?: Record<string, RawRelationshipColumn> }>
  }).rawTables
  for (const [tableName, label, parentColumnNames] of [
    ['syncshow_sermon_changes', 'journal', ['community_id', 'sermon_id']],
    ['syncshow_sermon_publications', 'publication', ['community_id', 'sermon_id']],
    ['syncshow_sermon_publication_catalogs', 'publication catalog', ['community_id']],
    ['syncshow_song_public_links', 'song public link', ['community_id', 'song_id']],
    ['syncshow_song_member_shares', 'song member-sharing receipt', ['community_id', 'song_id']],
  ] as const) {
    const columns = Object.values(rawTables?.[tableName]?.columns || {})
    const requiredParentColumns = new Set<string>(parentColumnNames)
    for (const column of columns) {
      if (!column.name || !requiredParentColumns.has(column.name)) continue
      if (!column.reference) {
        throw new Error(
          `SyncShow sermon ${label} column ${column.name} lost its parent foreign key.`,
        )
      }
      column.reference.onDelete = 'restrict'
      requiredParentColumns.delete(column.name)
    }
    if (requiredParentColumns.size) {
      throw new Error(
        `SyncShow sermon ${label} schema is missing: ${[...requiredParentColumns].join(', ')}.`,
      )
    }
  }
  return schema
}

export const preserveSermonHistoryChecksum: NonNullable<
  PostgresAdapterArgs['afterSchemaInit']
>[number] = ({ extendTable, schema }) => {
  const journal = schema.tables.syncshow_sermon_changes
  if (!journal) {
    throw new Error('The SyncShow sermon change journal schema is missing.')
  }
  extendTable({
    table: journal,
    extraConfig: columns => ({
      documentRevision: check(
        'syncshow_sermon_changes_document_revision_check',
        sql`${columns.revision} ~ '^[0-9a-f]{64}$' AND encode(sha256(convert_to(${columns.documentSource}, 'UTF8')), 'hex') = ${columns.revision}`,
      ),
    }),
  })
  return schema
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    components: {
      Nav: '@/components/AdminNav',
      views: {
        dashboard: {
          Component: '@/components/AdminDashboard',
          exact: true,
          meta: {
            title: 'Church workspace',
          },
        },
        planService: {
          Component: '@/components/PlanService',
          exact: true,
          meta: {
            title: 'Plan a service',
          },
          path: '/plan-service',
        },
        prepareSermon: {
          Component: '@/components/PrepareSermon',
          exact: true,
          meta: {
            title: 'Prepare a sermon',
          },
          path: '/prepare-sermon',
        },
        sermonPublications: {
          Component: '@/components/SermonPublicationReview',
          exact: true,
          meta: {
            title: 'Review sermon publications',
          },
          path: '/sermon-publications',
        },
      },
    },
    meta: {
      titleSuffix: ' — Heritage Community',
    },
  },
  collections: [
    Users,
    CommunitySessions,
    CommunityAuthChallenges,
    CommunityAuthRateLimits,
    Communities,
    Memberships,
    CommunityInvites,
    Media,
    ReadingPlans,
    Songs,
    SyncShowSongMemberShares,
    SyncShowSongPublicLinks,
    SyncShowDeviceGrants,
    SyncShowConnections,
    Sermons,
    ServicePlans,
    ServiceDocuments,
    SyncShowServiceDocumentChanges,
    SyncShowSermonChanges,
    SyncShowSermonPublications,
    SyncShowSermonPublicationCatalogs,
    Books,
    Commentaries,
    PlanCohorts,
    PlanNotes,
    Events,
    EventRsvps,
    EncryptedSync,
    SyncDevices,
    SyncRecords,
    SyncConflicts,
    SyncAccountEvents,
  ],
  cors: allowedOrigins,
  // Heritage clients use scoped Community bearer tokens. Only the Community
  // origin may wield Payload's privileged admin cookie.
  csrf: [communityOrigin],
  db: postgresAdapter({
    afterSchemaInit: [preserveSermonHistoryChecksum],
    beforeSchemaInit: [restrictSermonSystemParentDeletes],
    pool: { connectionString: process.env.DATABASE_URL || '' },
    prodMigrations: migrations,
  }),
  editor: lexicalEditor(),
  email: nodemailerAdapter({
    defaultFromAddress: process.env.SMTP_FROM || 'heritage@example.church',
    defaultFromName: process.env.SMTP_FROM_NAME || 'Heritage Community',
    transportOptions: communityAuthEnabled && process.env.SMTP_HOST
      ? {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: Number(process.env.SMTP_PORT || 587) === 465,
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        }
      : { jsonTransport: true },
  }),
  endpoints: [
    ...authEndpoints,
    ...accountEndpoints,
    ...syncEndpoints,
    ...syncShowEndpoints,
    ...songPublicLinkEndpoints,
    ...songMemberSharingEndpoints,
    ...managerSermonPreparationEndpoints,
    ...managerSermonPublicationEndpoints,
    ...sermonMediaEndpoints,
    ...managerServiceDocumentEndpoints,
  ],
  onInit: async payload => {
    await bootstrapInstallation(payload)
    const communityId = await getConfiguredCommunityId(payload)
    if (communityId != null) await ensurePublicSermonCatalog(payload, communityId)
    await seedConfiguredSongs(payload)
    await backfillSongSyncDocuments(payload)
    await startSermonMediaMaintenance(payload)
  },
  secret: process.env.PAYLOAD_SECRET || '',
  serverURL: publicUrl,
  sharp,
  telemetry: false,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
})
