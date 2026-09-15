import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "enum_songs_tags" AS ENUM ('solo', 'choir', 'communal');
    CREATE TABLE "songs_tags" ("id" serial PRIMARY KEY, "order" integer NOT NULL, "parent_id" integer NOT NULL, "value" "enum_songs_tags");
    ALTER TABLE "songs_tags" ADD CONSTRAINT "songs_tags_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "songs"("id") ON DELETE cascade;
    CREATE INDEX "songs_tags_order_idx" ON "songs_tags" ("order");
    CREATE INDEX "songs_tags_parent_idx" ON "songs_tags" ("parent_id");
    CREATE INDEX "songs_tags_value_idx" ON "songs_tags" ("value");
    ALTER TABLE "songs" ADD COLUMN "tag_sort_key" varchar DEFAULT '~';
    CREATE INDEX "songs_tag_sort_key_idx" ON "songs" ("tag_sort_key");
    CREATE TYPE "enum_communities_calendar_default_visibility" AS ENUM ('members', 'public');
    ALTER TABLE "communities" ADD COLUMN "calendar_default_visibility" "enum_communities_calendar_default_visibility" DEFAULT 'members' NOT NULL;
    CREATE TYPE "enum_events_visibility" AS ENUM ('inherit', 'public', 'members');
    CREATE TYPE "enum_events_recurrence" AS ENUM ('none', 'weekly', 'monthly');
    ALTER TABLE "events" ADD COLUMN "visibility" "enum_events_visibility" DEFAULT 'inherit' NOT NULL,
      ADD COLUMN "recurrence" "enum_events_recurrence" DEFAULT 'none',
      ADD COLUMN "repeat_interval" numeric DEFAULT 1, ADD COLUMN "repeat_until" varchar;
    ALTER TABLE "events" ALTER COLUMN "time_zone" DROP DEFAULT;
    CREATE TYPE "enum_service_documents_purpose" AS ENUM ('service', 'sermon');
    ALTER TABLE "service_documents" ADD COLUMN "purpose" "enum_service_documents_purpose" DEFAULT 'service' NOT NULL,
      ADD COLUMN "sermon_id" integer;
    ALTER TABLE "service_documents" ADD CONSTRAINT "service_documents_sermon_id_sermons_id_fk" FOREIGN KEY ("sermon_id") REFERENCES "sermons"("id") ON DELETE set null;
    CREATE INDEX "service_documents_purpose_idx" ON "service_documents" ("purpose");
    CREATE INDEX "service_documents_sermon_idx" ON "service_documents" ("sermon_id");
  `)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE "songs_tags"; DROP TYPE "enum_songs_tags";
    ALTER TABLE "songs" DROP COLUMN "tag_sort_key";
    ALTER TABLE "communities" DROP COLUMN "calendar_default_visibility";
    DROP TYPE "enum_communities_calendar_default_visibility";
    ALTER TABLE "events" DROP COLUMN "visibility", DROP COLUMN "recurrence", DROP COLUMN "repeat_interval", DROP COLUMN "repeat_until";
    ALTER TABLE "events" ALTER COLUMN "time_zone" SET DEFAULT 'UTC';
    DROP TYPE "enum_events_visibility"; DROP TYPE "enum_events_recurrence";
    ALTER TABLE "service_documents" DROP COLUMN "purpose", DROP COLUMN "sermon_id";
    DROP TYPE "enum_service_documents_purpose";
  `)
}
