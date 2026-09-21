import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "communities"
      ADD COLUMN "live_service_youtube_channel_url" varchar,
      ADD COLUMN "live_service_youtube_video_url" varchar,
      ADD COLUMN "live_service_translation_url" varchar,
      ADD COLUMN "live_service_broadcast_delay_seconds" numeric DEFAULT 0;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "communities"
      DROP COLUMN "live_service_youtube_channel_url",
      DROP COLUMN "live_service_youtube_video_url",
      DROP COLUMN "live_service_translation_url",
      DROP COLUMN "live_service_broadcast_delay_seconds";
  `)
}
