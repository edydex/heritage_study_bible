import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { Books } from '@/collections/Books'
import { Commentaries } from '@/collections/Commentaries'
import { Communities } from '@/collections/Communities'
import { CommunityInvites } from '@/collections/CommunityInvites'
import { CommunitySessions } from '@/collections/CommunitySessions'
import { EncryptedSync } from '@/collections/EncryptedSync'
import { EventRsvps } from '@/collections/EventRsvps'
import { Events } from '@/collections/Events'
import { Media } from '@/collections/Media'
import { Memberships } from '@/collections/Memberships'
import { PlanCohorts } from '@/collections/PlanCohorts'
import { PlanNotes } from '@/collections/PlanNotes'
import { ReadingPlans } from '@/collections/ReadingPlans'
import { Sermons } from '@/collections/Sermons'
import { Songs } from '@/collections/Songs'
import { Users } from '@/collections/Users'
import { authEndpoints } from '@/endpoints/auth'
import { bootstrapInstallation } from '@/lib/bootstrapInstallation'
import { communityAuthEnabled, publicUrl } from '@/lib/publicConfig'
import { seedConfiguredSongs } from '@/lib/seedConfiguredSongs'
import { migrations } from '@/migrations'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const appOrigins = (process.env.HERITAGE_APP_ORIGINS || 'http://localhost:5173,http://localhost:4173')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)
const communityOrigin = new URL(publicUrl).origin
const allowedOrigins = [...new Set([...appOrigins, communityOrigin])]

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    components: {
      beforeDashboard: ['@/components/AdminWelcome'],
    },
    meta: {
      titleSuffix: ' — Heritage Community',
    },
  },
  collections: [
    Users,
    CommunitySessions,
    Communities,
    Memberships,
    CommunityInvites,
    Media,
    ReadingPlans,
    Songs,
    Sermons,
    Books,
    Commentaries,
    PlanCohorts,
    PlanNotes,
    Events,
    EventRsvps,
    EncryptedSync,
  ],
  cors: allowedOrigins,
  // Heritage clients use scoped Community bearer tokens. Only the Community
  // origin may wield Payload's privileged admin cookie.
  csrf: [communityOrigin],
  db: postgresAdapter({
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
  endpoints: authEndpoints,
  onInit: async payload => {
    await bootstrapInstallation(payload)
    await seedConfiguredSongs(payload)
  },
  secret: process.env.PAYLOAD_SECRET || '',
  serverURL: publicUrl,
  sharp,
  telemetry: false,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
})
