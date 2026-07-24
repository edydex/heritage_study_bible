import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_songs_rights_status" AS ENUM('needs-review', 'metadata-only', 'public-domain', 'licensed', 'permission-granted', 'mixed');
  ALTER TABLE "songs" ALTER COLUMN "lyrics" DROP NOT NULL;
  ALTER TABLE "songs" ADD COLUMN "russian_title" varchar;
  ALTER TABLE "songs" ADD COLUMN "russian_lyrics" varchar;
  ALTER TABLE "songs" ADD COLUMN "russian_chord_sheet" varchar;
  ALTER TABLE "songs" ADD COLUMN "rights_status" "enum_songs_rights_status" DEFAULT 'needs-review' NOT NULL;
  ALTER TABLE "songs" ADD COLUMN "ccli_number" varchar;
  ALTER TABLE "songs" ADD COLUMN "license" varchar;
  ALTER TABLE "songs" ADD COLUMN "rights_notes" varchar;
  ALTER TABLE "songs" ADD COLUMN "source_url" varchar;
  ALTER TABLE "songs" ADD COLUMN "permission_url" varchar;
  CREATE INDEX "songs_rights_status_idx" ON "songs" USING btree ("rights_status");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "songs_rights_status_idx";
  UPDATE "songs" SET "lyrics" = '' WHERE "lyrics" IS NULL;
  ALTER TABLE "songs" ALTER COLUMN "lyrics" SET NOT NULL;
  ALTER TABLE "songs" DROP COLUMN "russian_title";
  ALTER TABLE "songs" DROP COLUMN "russian_lyrics";
  ALTER TABLE "songs" DROP COLUMN "russian_chord_sheet";
  ALTER TABLE "songs" DROP COLUMN "rights_status";
  ALTER TABLE "songs" DROP COLUMN "ccli_number";
  ALTER TABLE "songs" DROP COLUMN "license";
  ALTER TABLE "songs" DROP COLUMN "rights_notes";
  ALTER TABLE "songs" DROP COLUMN "source_url";
  ALTER TABLE "songs" DROP COLUMN "permission_url";
  DROP TYPE "public"."enum_songs_rights_status";`)
}
