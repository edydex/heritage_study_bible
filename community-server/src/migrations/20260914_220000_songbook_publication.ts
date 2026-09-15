import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`CREATE TYPE "public"."enum_songs_songbook_visibility" AS ENUM ('published', 'unlisted', 'private');
    ALTER TABLE "songs" ADD COLUMN "songbook_visibility" "enum_songs_songbook_visibility" DEFAULT 'private' NOT NULL;
    ALTER TABLE "songs" ADD COLUMN "songbook_content" jsonb;
    CREATE INDEX "songs_songbook_visibility_idx" ON "songs" USING btree ("songbook_visibility");`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX "songs_songbook_visibility_idx";
    ALTER TABLE "songs" DROP COLUMN "songbook_content", DROP COLUMN "songbook_visibility";
    DROP TYPE "public"."enum_songs_songbook_visibility";`)
}
