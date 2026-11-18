import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// The publication snapshot, lyrics, source documents, files and identities are
// untouched. Keep a private rollback record and immutable historical receipts.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "song_member_sharing_retirement_backup" (
      "song_id" integer PRIMARY KEY, "previous" jsonb NOT NULL, "normalized_hash" text
    );
    INSERT INTO "song_member_sharing_retirement_backup" ("song_id", "previous")
    SELECT "id", to_jsonb(s) FROM "songs" s
    WHERE "visibility" <> 'private' OR "status" = 'published' OR "publish_at" IS NOT NULL
      OR "member_share_receipt_id" IS NOT NULL OR "member_share_receipt_version" IS NOT NULL
      OR "member_share_previous_song_sync_version" IS NOT NULL OR "member_share_song_sync_version" IS NOT NULL
      OR "member_share_family_revision" IS NOT NULL OR "member_share_review_revision" IS NOT NULL
      OR "member_share_visibility" IS NOT NULL OR "member_share_publish_at" IS NOT NULL
      OR "member_share_time_zone" IS NOT NULL OR "member_share_valid_through" IS NOT NULL
      OR "member_share_reviewed_at" IS NOT NULL OR "member_share_confirmed_at" IS NOT NULL
      OR "member_share_request_revision" IS NOT NULL OR "member_share_receipt_revision" IS NOT NULL;

    UPDATE "songs" s SET
      "visibility" = 'private', "publish_at" = NULL,
      "status" = CASE WHEN "status" = 'archived' THEN "status" ELSE 'draft' END,
      "member_share_receipt_id" = NULL, "member_share_receipt_version" = NULL,
      "member_share_previous_song_sync_version" = NULL, "member_share_song_sync_version" = NULL,
      "member_share_family_revision" = NULL, "member_share_review_revision" = NULL,
      "member_share_visibility" = NULL, "member_share_publish_at" = NULL,
      "member_share_time_zone" = NULL, "member_share_valid_through" = NULL,
      "member_share_reviewed_at" = NULL, "member_share_confirmed_at" = NULL,
      "member_share_request_revision" = NULL, "member_share_receipt_revision" = NULL,
      "sync_version" = "sync_version" + 1, "updated_at" = now()
    WHERE "id" IN (SELECT "song_id" FROM "song_member_sharing_retirement_backup");

    UPDATE "song_member_sharing_retirement_backup" b SET "normalized_hash" = md5(to_jsonb(s)::text)
    FROM "songs" s WHERE s."id" = b."song_id";
    ALTER TABLE "songs" ADD CONSTRAINT "songs_retired_member_visibility_check" CHECK ("visibility" = 'private');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "songs" DROP CONSTRAINT "songs_retired_member_visibility_check";
    -- Never overwrite songs edited since normalization, or republish a changed
    -- family under an old receipt. Only identical normalized rows can roll back.
    UPDATE "songs" s SET
      "visibility" = old."visibility", "publish_at" = old."publish_at", "status" = old."status",
      "member_share_receipt_id" = old."member_share_receipt_id",
      "member_share_receipt_version" = old."member_share_receipt_version",
      "member_share_previous_song_sync_version" = old."member_share_previous_song_sync_version",
      "member_share_song_sync_version" = old."member_share_song_sync_version",
      "member_share_family_revision" = old."member_share_family_revision",
      "member_share_review_revision" = old."member_share_review_revision",
      "member_share_visibility" = old."member_share_visibility",
      "member_share_publish_at" = old."member_share_publish_at",
      "member_share_time_zone" = old."member_share_time_zone",
      "member_share_valid_through" = old."member_share_valid_through",
      "member_share_reviewed_at" = old."member_share_reviewed_at",
      "member_share_confirmed_at" = old."member_share_confirmed_at",
      "member_share_request_revision" = old."member_share_request_revision",
      "member_share_receipt_revision" = old."member_share_receipt_revision",
      "sync_version" = old."sync_version", "updated_at" = old."updated_at"
    FROM "song_member_sharing_retirement_backup" b,
      LATERAL jsonb_populate_record(NULL::"songs", b."previous") old
    WHERE s."id" = b."song_id" AND md5(to_jsonb(s)::text) = b."normalized_hash";
    DROP TABLE "song_member_sharing_retirement_backup";
  `)
}
