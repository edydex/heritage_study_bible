import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "syncshow_sermon_media_uploads"
      ALTER COLUMN "connection_id" DROP NOT NULL,
      ADD COLUMN "manager_user_id" integer REFERENCES "users"("id") ON DELETE restrict,
      ADD CONSTRAINT "syncshow_sermon_media_uploads_actor_check"
        CHECK (("connection_id" IS NULL) <> ("manager_user_id" IS NULL));
    CREATE INDEX "syncshow_sermon_media_uploads_manager_idx"
      ON "syncshow_sermon_media_uploads" ("community_id", "manager_user_id");
    ALTER TABLE "syncshow_sermon_media_objects"
      DROP CONSTRAINT "syncshow_sermon_media_objects_media_type_check",
      ADD CONSTRAINT "syncshow_sermon_media_objects_media_type_check"
        CHECK ("media_type" IN ('audio/mpeg', 'audio/mp4', 'audio/ogg'));
  `)
  // Keep the original size, filename and identity bounds when adding Opus.
  await db.execute(sql`
    ALTER TABLE "syncshow_sermon_media_uploads"
      DROP CONSTRAINT "syncshow_sermon_media_uploads_recording_check",
      ADD CONSTRAINT "syncshow_sermon_media_uploads_recording_check"
        CHECK (
          "kind" = 'audio'
          AND "language"
            ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})*$'
          AND "media_type" IN ('audio/mpeg', 'audio/mp4', 'audio/ogg')
          AND length("file_name") BETWEEN 1 AND 255
          AND position('/' in "file_name") = 0
          AND position(E'\\\\' in "file_name") = 0
          AND "file_name" NOT IN ('.', '..')
          AND "sha256" ~ '^[a-f0-9]{64}$'
          AND "size_bytes" BETWEEN 1 AND 1073741824
          AND (
            "duration_seconds" IS NULL
            OR "duration_seconds" > 0
          )
        );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM "syncshow_sermon_media_uploads" WHERE "manager_user_id" IS NOT NULL OR "media_type" = 'audio/ogg')
        OR EXISTS (SELECT 1 FROM "syncshow_sermon_media_objects" WHERE "media_type" = 'audio/ogg') THEN
        RAISE EXCEPTION 'Manager or Opus recording history exists; restore the pre-update backup instead of discarding it';
      END IF;
    END $$;
    ALTER TABLE "syncshow_sermon_media_uploads"
      DROP CONSTRAINT "syncshow_sermon_media_uploads_actor_check",
      DROP COLUMN "manager_user_id",
      ALTER COLUMN "connection_id" SET NOT NULL;
    ALTER TABLE "syncshow_sermon_media_objects"
      DROP CONSTRAINT "syncshow_sermon_media_objects_media_type_check",
      ADD CONSTRAINT "syncshow_sermon_media_objects_media_type_check"
        CHECK ("media_type" IN ('audio/mpeg', 'audio/mp4'));
    ALTER TABLE "syncshow_sermon_media_uploads"
      DROP CONSTRAINT "syncshow_sermon_media_uploads_recording_check",
      ADD CONSTRAINT "syncshow_sermon_media_uploads_recording_check"
        CHECK (
          "kind" = 'audio'
          AND "language"
            ~ '^[a-z]{2,3}(-[a-z0-9]{2,8})*$'
          AND "media_type" IN ('audio/mpeg', 'audio/mp4')
          AND length("file_name") BETWEEN 1 AND 255
          AND position('/' in "file_name") = 0
          AND position(E'\\\\' in "file_name") = 0
          AND "file_name" NOT IN ('.', '..')
          AND "sha256" ~ '^[a-f0-9]{64}$'
          AND "size_bytes" BETWEEN 1 AND 1073741824
          AND (
            "duration_seconds" IS NULL
            OR "duration_seconds" > 0
          )
        );
  `)
}
