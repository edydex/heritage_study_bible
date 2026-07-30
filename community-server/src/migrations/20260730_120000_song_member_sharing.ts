import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_syncshow_song_member_shares_visibility"
      AS ENUM('public', 'scheduled-public');

    ALTER TABLE "songs"
      ADD COLUMN "member_share_receipt_id" varchar,
      ADD COLUMN "member_share_receipt_version" numeric,
      ADD COLUMN "member_share_previous_song_sync_version" numeric,
      ADD COLUMN "member_share_song_sync_version" numeric,
      ADD COLUMN "member_share_family_revision" varchar,
      ADD COLUMN "member_share_review_revision" varchar,
      ADD COLUMN "member_share_visibility" varchar,
      ADD COLUMN "member_share_publish_at" timestamp(3) with time zone,
      ADD COLUMN "member_share_time_zone" varchar,
      ADD COLUMN "member_share_valid_through" timestamp(3) with time zone,
      ADD COLUMN "member_share_reviewed_at" timestamp(3) with time zone,
      ADD COLUMN "member_share_confirmed_at" timestamp(3) with time zone,
      ADD COLUMN "member_share_request_revision" varchar,
      ADD COLUMN "member_share_receipt_revision" varchar;

    -- Pre-gate member visibility has no exact-family review authority. Fail
    -- closed instead of grandfathering lyrics under an unverifiable decision.
    UPDATE "songs"
    SET
      "visibility" = 'private',
      "publish_at" = NULL,
      "status" = CASE
        WHEN "status" = 'archived' THEN "status"
        ELSE 'draft'
      END,
      "sync_version" = "sync_version" + 1,
      "updated_at" = now()
    WHERE "visibility" IN ('public', 'scheduled-public');

    CREATE TABLE "syncshow_song_member_shares" (
      "id" serial PRIMARY KEY NOT NULL,
      "community_id" integer NOT NULL,
      "song_id" integer NOT NULL,
      "schema_version" numeric NOT NULL,
      "receipt_id" varchar NOT NULL,
      "receipt_version" numeric NOT NULL,
      "song_sync_id" varchar NOT NULL,
      "previous_song_sync_version" numeric NOT NULL,
      "song_sync_version" numeric NOT NULL,
      "family_revision" varchar NOT NULL,
      "review_revision" varchar NOT NULL,
      "visibility" "enum_syncshow_song_member_shares_visibility" NOT NULL,
      "publish_at" timestamp(3) with time zone,
      "time_zone" varchar NOT NULL,
      "valid_through" timestamp(3) with time zone,
      "reviewed_at" timestamp(3) with time zone NOT NULL,
      "confirmed_at" timestamp(3) with time zone NOT NULL,
      "request_revision" varchar NOT NULL,
      "receipt_revision" varchar NOT NULL,
      "review_source" varchar NOT NULL,
      "audit_source" varchar NOT NULL,
      "idempotency_key_hash" varchar NOT NULL,
      "request_hash" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "syncshow_song_member_shares_schema_check"
        CHECK ("schema_version" = 1),
      CONSTRAINT "syncshow_song_member_shares_versions_check"
        CHECK (
          "receipt_version" >= 1
          AND "previous_song_sync_version" >= 1
          AND "song_sync_version" = "previous_song_sync_version" + 1
        ),
      CONSTRAINT "syncshow_song_member_shares_visibility_check"
        CHECK (
          ("visibility" = 'public' AND "publish_at" IS NULL)
          OR
          ("visibility" = 'scheduled-public' AND "publish_at" IS NOT NULL)
        ),
      CONSTRAINT "syncshow_song_member_shares_lifetime_check"
        CHECK (
          "reviewed_at" <= "confirmed_at"
          AND (
            "valid_through" IS NULL
            OR (
              "confirmed_at" <= "valid_through"
              AND (
                "publish_at" IS NULL
                OR "publish_at" <= "valid_through"
              )
            )
          )
        )
    );

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN "syncshow_song_member_shares_id" integer;

    ALTER TABLE "syncshow_song_member_shares"
      ADD CONSTRAINT "syncshow_song_member_shares_community_id_communities_id_fk"
      FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id")
      ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "syncshow_song_member_shares"
      ADD CONSTRAINT "syncshow_song_member_shares_song_id_songs_id_fk"
      FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id")
      ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_syncshow_song_member_shares_fk"
      FOREIGN KEY ("syncshow_song_member_shares_id")
      REFERENCES "public"."syncshow_song_member_shares"("id")
      ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "songs"
      ADD CONSTRAINT "songs_member_share_authority_check"
      CHECK (
        "visibility" = 'private'
        OR (
          "member_share_receipt_id" IS NOT NULL
          AND "member_share_receipt_version" >= 1
          AND "member_share_previous_song_sync_version" >= 1
          AND "member_share_song_sync_version" = "sync_version"
          AND "member_share_song_sync_version"
            = "member_share_previous_song_sync_version" + 1
          AND "member_share_family_revision" IS NOT NULL
          AND "member_share_review_revision" IS NOT NULL
          AND "member_share_visibility" = "visibility"::text
          AND "member_share_time_zone" IS NOT NULL
          AND "member_share_reviewed_at" IS NOT NULL
          AND "member_share_confirmed_at" IS NOT NULL
          AND "member_share_request_revision" IS NOT NULL
          AND "member_share_receipt_revision" IS NOT NULL
          AND (
            (
              "visibility" = 'public'
              AND "publish_at" IS NULL
              AND "member_share_publish_at" IS NULL
            )
            OR (
              "visibility" = 'scheduled-public'
              AND "publish_at" IS NOT NULL
              AND "member_share_publish_at" = "publish_at"
            )
          )
        )
      );

    CREATE INDEX "syncshow_song_member_shares_community_idx"
      ON "syncshow_song_member_shares" USING btree ("community_id");
    CREATE INDEX "syncshow_song_member_shares_song_idx"
      ON "syncshow_song_member_shares" USING btree ("song_id");
    CREATE UNIQUE INDEX "syncshow_song_member_shares_receipt_id_idx"
      ON "syncshow_song_member_shares" USING btree ("receipt_id");
    CREATE INDEX "syncshow_song_member_shares_song_sync_id_idx"
      ON "syncshow_song_member_shares" USING btree ("song_sync_id");
    CREATE INDEX "syncshow_song_member_shares_confirmed_at_idx"
      ON "syncshow_song_member_shares" USING btree ("confirmed_at");
    CREATE UNIQUE INDEX "syncshow_song_member_shares_idempotency_key_hash_idx"
      ON "syncshow_song_member_shares" USING btree ("idempotency_key_hash");
    CREATE UNIQUE INDEX "community_songSyncId_receiptVersion_idx"
      ON "syncshow_song_member_shares"
      USING btree ("community_id", "song_sync_id", "receipt_version");
    CREATE INDEX "syncshow_song_member_shares_updated_at_idx"
      ON "syncshow_song_member_shares" USING btree ("updated_at");
    CREATE INDEX "syncshow_song_member_shares_created_at_idx"
      ON "syncshow_song_member_shares" USING btree ("created_at");
    CREATE INDEX "payload_locked_documents_rels_syncshow_song_member_shares_idx"
      ON "payload_locked_documents_rels"
      USING btree ("syncshow_song_member_shares_id");
    CREATE INDEX "songs_member_share_receipt_id_idx"
      ON "songs" USING btree ("member_share_receipt_id");
    CREATE INDEX "songs_member_share_valid_through_idx"
      ON "songs" USING btree ("member_share_valid_through");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "songs"
    SET
      "visibility" = 'private',
      "publish_at" = NULL,
      "status" = CASE
        WHEN "status" = 'archived' THEN "status"
        ELSE 'draft'
      END,
      "sync_version" = "sync_version" + 1,
      "updated_at" = now()
    WHERE "visibility" IN ('public', 'scheduled-public');

    ALTER TABLE "songs"
      DROP CONSTRAINT "songs_member_share_authority_check";
    DROP INDEX "songs_member_share_valid_through_idx";
    DROP INDEX "songs_member_share_receipt_id_idx";
    DROP INDEX "payload_locked_documents_rels_syncshow_song_member_shares_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_syncshow_song_member_shares_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN "syncshow_song_member_shares_id";
    DROP TABLE "syncshow_song_member_shares";
    DROP TYPE "public"."enum_syncshow_song_member_shares_visibility";

    ALTER TABLE "songs"
      DROP COLUMN "member_share_receipt_id",
      DROP COLUMN "member_share_receipt_version",
      DROP COLUMN "member_share_previous_song_sync_version",
      DROP COLUMN "member_share_song_sync_version",
      DROP COLUMN "member_share_family_revision",
      DROP COLUMN "member_share_review_revision",
      DROP COLUMN "member_share_visibility",
      DROP COLUMN "member_share_publish_at",
      DROP COLUMN "member_share_time_zone",
      DROP COLUMN "member_share_valid_through",
      DROP COLUMN "member_share_reviewed_at",
      DROP COLUMN "member_share_confirmed_at",
      DROP COLUMN "member_share_request_revision",
      DROP COLUMN "member_share_receipt_revision";
  `)
}
