import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_syncshow_sermon_media_upload_state"
      AS ENUM(
        'uploading',
        'finalizing',
        'internal',
        'complete',
        'cancelled',
        'superseded',
        'expired'
      );

    CREATE TABLE "syncshow_sermon_media_objects" (
      "id" serial PRIMARY KEY NOT NULL,
      "community_id" integer NOT NULL,
      "sha256" varchar NOT NULL,
      "size_bytes" bigint NOT NULL,
      "media_type" varchar NOT NULL,
      "storage_key" varchar NOT NULL,
      "verified_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "syncshow_sermon_media_objects_sha256_check"
        CHECK ("sha256" ~ '^[a-f0-9]{64}$'),
      CONSTRAINT "syncshow_sermon_media_objects_size_check"
        CHECK ("size_bytes" BETWEEN 1 AND 1073741824),
      CONSTRAINT "syncshow_sermon_media_objects_media_type_check"
        CHECK ("media_type" IN ('audio/mpeg', 'audio/mp4')),
      CONSTRAINT "syncshow_sermon_media_objects_storage_key_check"
        CHECK (
          "storage_key"
            ~ '^objects/[a-f0-9]{64}/sha256/[a-f0-9]{2}/[a-f0-9]{64}$'
          AND split_part("storage_key", '/', 4)
            = substring("sha256" from 1 for 2)
          AND split_part("storage_key", '/', 5) = "sha256"
        ),
      CONSTRAINT "syncshow_sermon_media_objects_time_check"
        CHECK (
          "created_at" <= "verified_at"
          AND "created_at" <= "updated_at"
        )
    );

    CREATE TABLE "syncshow_sermon_media_uploads" (
      "id" serial PRIMARY KEY NOT NULL,
      "upload_id" varchar NOT NULL,
      "community_id" integer NOT NULL,
      "connection_id" integer NOT NULL,
      "sermon_id" integer NOT NULL,
      "schema_version" numeric NOT NULL,
      "state" "enum_syncshow_sermon_media_upload_state" NOT NULL,
      "sync_id" varchar NOT NULL,
      "expected_sync_version" numeric NOT NULL,
      "expected_current_revision" varchar NOT NULL,
      "recording_id" varchar NOT NULL,
      "kind" varchar NOT NULL,
      "language" varchar NOT NULL,
      "media_type" varchar NOT NULL,
      "file_name" varchar NOT NULL,
      "sha256" varchar NOT NULL,
      "size_bytes" bigint NOT NULL,
      "duration_seconds" double precision,
      "chunk_size_bytes" bigint NOT NULL,
      "chunk_count" numeric NOT NULL,
      "staging_key" varchar NOT NULL,
      "object_id" integer,
      "init_idempotency_key_hash" varchar NOT NULL,
      "init_request_hash" varchar NOT NULL,
      "complete_idempotency_key_hash" varchar,
      "complete_request_hash" varchar,
      "cancel_idempotency_key_hash" varchar,
      "cancel_request_hash" varchar,
      "finalization_lease_token_hash" varchar,
      "finalization_lease_expires_at" timestamp(3) with time zone,
      "expires_at" timestamp(3) with time zone NOT NULL,
      "completed_at" timestamp(3) with time zone,
      "cancelled_at" timestamp(3) with time zone,
      "superseded_at" timestamp(3) with time zone,
      "expired_at" timestamp(3) with time zone,
      "internal_at" timestamp(3) with time zone,
      "staging_cleaned_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "syncshow_sermon_media_uploads_schema_check"
        CHECK ("schema_version" = 1),
      CONSTRAINT "syncshow_sermon_media_uploads_upload_id_check"
        CHECK ("upload_id" ~ '^[A-Za-z0-9_-]{32,128}$'),
      CONSTRAINT "syncshow_sermon_media_uploads_identity_check"
        CHECK (
          "sync_id" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
          AND "recording_id"
            ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$'
          AND "expected_sync_version" >= 1
          AND "expected_current_revision" ~ '^[a-f0-9]{64}$'
        ),
      CONSTRAINT "syncshow_sermon_media_uploads_recording_check"
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
        ),
      CONSTRAINT "syncshow_sermon_media_uploads_chunk_geometry_check"
        CHECK (
          "chunk_size_bytes" = 8388608
          AND "chunk_count"
            = (("size_bytes" + "chunk_size_bytes" - 1)
              / "chunk_size_bytes")
          AND "chunk_count" BETWEEN 1 AND 128
        ),
      CONSTRAINT "syncshow_sermon_media_uploads_staging_key_check"
        CHECK ("staging_key" = 'staging/' || "upload_id"),
      CONSTRAINT "syncshow_sermon_media_uploads_digest_check"
        CHECK (
          "init_idempotency_key_hash" ~ '^[a-f0-9]{64}$'
          AND "init_request_hash" ~ '^[a-f0-9]{64}$'
          AND (
            (
              "complete_idempotency_key_hash" IS NULL
              AND "complete_request_hash" IS NULL
            )
            OR (
              "complete_idempotency_key_hash" ~ '^[a-f0-9]{64}$'
              AND "complete_request_hash" ~ '^[a-f0-9]{64}$'
            )
          )
          AND (
            (
              "cancel_idempotency_key_hash" IS NULL
              AND "cancel_request_hash" IS NULL
            )
            OR (
              "cancel_idempotency_key_hash" ~ '^[a-f0-9]{64}$'
              AND "cancel_request_hash" ~ '^[a-f0-9]{64}$'
            )
          )
          AND (
            "finalization_lease_token_hash" IS NULL
            OR "finalization_lease_token_hash" ~ '^[a-f0-9]{64}$'
          )
        ),
      CONSTRAINT "syncshow_sermon_media_uploads_lease_check"
        CHECK (
          (
            "state" = 'finalizing'
            AND "complete_idempotency_key_hash" IS NOT NULL
            AND "complete_request_hash" IS NOT NULL
            AND "finalization_lease_token_hash" IS NOT NULL
            AND "finalization_lease_expires_at" IS NOT NULL
          )
          OR (
            "state" <> 'finalizing'
            AND "finalization_lease_token_hash" IS NULL
            AND "finalization_lease_expires_at" IS NULL
          )
        ),
      CONSTRAINT "syncshow_sermon_media_uploads_object_check"
        CHECK (
          (
            "state" = 'complete'
            AND "object_id" IS NOT NULL
            AND "completed_at" IS NOT NULL
          )
          OR (
            "state" = 'superseded'
            AND (
              (
                "object_id" IS NULL
                AND "completed_at" IS NULL
              )
              OR (
                "object_id" IS NOT NULL
                AND "completed_at" IS NOT NULL
              )
            )
          )
          OR (
            "state" NOT IN ('complete', 'superseded')
            AND "object_id" IS NULL
            AND "completed_at" IS NULL
          )
        ),
      CONSTRAINT "syncshow_sermon_media_uploads_terminal_time_check"
        CHECK (
          ("state" <> 'cancelled' OR "cancelled_at" IS NOT NULL)
          AND ("state" <> 'superseded' OR "superseded_at" IS NOT NULL)
          AND ("state" <> 'expired' OR "expired_at" IS NOT NULL)
          AND ("state" <> 'internal' OR "internal_at" IS NOT NULL)
          AND (
            "staging_cleaned_at" IS NULL
            OR "state" IN (
              'internal',
              'complete',
              'cancelled',
              'superseded',
              'expired'
            )
          )
        ),
      CONSTRAINT "syncshow_sermon_media_uploads_lifetime_check"
        CHECK (
          "created_at" <= "updated_at"
          AND "created_at" < "expires_at"
          AND "expires_at"
            <= "created_at" + interval '7 days 1 minute'
        )
    );

    CREATE TABLE "syncshow_sermon_media_chunks" (
      "id" serial PRIMARY KEY NOT NULL,
      "upload_id" integer NOT NULL,
      "chunk_index" numeric NOT NULL,
      "start_byte" bigint NOT NULL,
      "end_byte" bigint NOT NULL,
      "size_bytes" bigint NOT NULL,
      "sha256" varchar NOT NULL,
      "storage_key" varchar NOT NULL,
      "idempotency_key_hash" varchar NOT NULL,
      "request_hash" varchar NOT NULL,
      "received_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "syncshow_sermon_media_chunks_geometry_check"
        CHECK (
          "chunk_index" BETWEEN 0 AND 127
          AND "start_byte" >= 0
          AND "end_byte" >= "start_byte"
          AND "size_bytes" = "end_byte" - "start_byte" + 1
          AND "size_bytes" BETWEEN 1 AND 8388608
        ),
      CONSTRAINT "syncshow_sermon_media_chunks_digest_check"
        CHECK (
          "sha256" ~ '^[a-f0-9]{64}$'
          AND "idempotency_key_hash" ~ '^[a-f0-9]{64}$'
          AND "request_hash" ~ '^[a-f0-9]{64}$'
        ),
      CONSTRAINT "syncshow_sermon_media_chunks_storage_key_check"
        CHECK (
          "storage_key"
            ~ '^staging/[A-Za-z0-9_-]{32,128}/chunks/[0-9]{8}-[a-f0-9]{64}[.]chunk$'
          AND split_part(
            split_part("storage_key", '/', 4),
            '.',
            1
          ) = lpad("chunk_index"::text, 8, '0') || '-' || "sha256"
        ),
      CONSTRAINT "syncshow_sermon_media_chunks_time_check"
        CHECK (
          "created_at" <= "received_at"
          AND "created_at" <= "updated_at"
        )
    );

    ALTER TABLE "syncshow_sermon_media_objects"
      ADD CONSTRAINT "syncshow_sermon_media_objects_community_sha256_unique"
      UNIQUE("community_id", "sha256");
    ALTER TABLE "syncshow_sermon_media_objects"
      ADD CONSTRAINT "syncshow_sermon_media_objects_storage_key_unique"
      UNIQUE("storage_key");
    ALTER TABLE "syncshow_sermon_media_objects"
      ADD CONSTRAINT "syncshow_sermon_media_objects_id_community_unique"
      UNIQUE("id", "community_id");
    ALTER TABLE "syncshow_sermon_media_objects"
      ADD CONSTRAINT "syncshow_sermon_media_objects_community_fk"
      FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id")
      ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "syncshow_sermon_media_uploads"
      ADD CONSTRAINT "syncshow_sermon_media_uploads_upload_id_unique"
      UNIQUE("upload_id");
    ALTER TABLE "syncshow_sermon_media_uploads"
      ADD CONSTRAINT "syncshow_sermon_media_uploads_init_key_unique"
      UNIQUE("init_idempotency_key_hash");
    ALTER TABLE "syncshow_sermon_media_chunks"
      ADD CONSTRAINT "syncshow_sermon_media_chunks_upload_index_unique"
      UNIQUE("upload_id", "chunk_index");
    ALTER TABLE "syncshow_sermon_media_chunks"
      ADD CONSTRAINT "syncshow_sermon_media_chunks_idempotency_unique"
      UNIQUE("idempotency_key_hash");

    ALTER TABLE "syncshow_sermon_media_uploads"
      ADD CONSTRAINT "syncshow_sermon_media_uploads_community_fk"
      FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id")
      ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "syncshow_sermon_media_uploads"
      ADD CONSTRAINT "syncshow_sermon_media_uploads_connection_fk"
      FOREIGN KEY ("connection_id")
      REFERENCES "public"."syncshow_connections"("id")
      ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "syncshow_sermon_media_uploads"
      ADD CONSTRAINT "syncshow_sermon_media_uploads_sermon_fk"
      FOREIGN KEY ("sermon_id") REFERENCES "public"."sermons"("id")
      ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "syncshow_sermon_media_uploads"
      ADD CONSTRAINT "syncshow_sermon_media_uploads_object_fk"
      FOREIGN KEY ("object_id", "community_id")
      REFERENCES "public"."syncshow_sermon_media_objects"(
        "id",
        "community_id"
      )
      ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "syncshow_sermon_media_chunks"
      ADD CONSTRAINT "syncshow_sermon_media_chunks_upload_fk"
      FOREIGN KEY ("upload_id")
      REFERENCES "public"."syncshow_sermon_media_uploads"("id")
      ON DELETE restrict ON UPDATE no action;

    CREATE UNIQUE INDEX "syncshow_sermon_media_uploads_active_slot_idx"
      ON "syncshow_sermon_media_uploads"
      USING btree ("community_id", "sermon_id", "recording_id")
      WHERE "state" IN ('uploading', 'finalizing', 'complete');
    CREATE UNIQUE INDEX "syncshow_sermon_media_uploads_complete_key_idx"
      ON "syncshow_sermon_media_uploads"
      USING btree ("complete_idempotency_key_hash")
      WHERE "complete_idempotency_key_hash" IS NOT NULL;
    CREATE UNIQUE INDEX "syncshow_sermon_media_uploads_cancel_key_idx"
      ON "syncshow_sermon_media_uploads"
      USING btree ("cancel_idempotency_key_hash")
      WHERE "cancel_idempotency_key_hash" IS NOT NULL;
    CREATE INDEX "syncshow_sermon_media_uploads_community_idx"
      ON "syncshow_sermon_media_uploads" USING btree ("community_id");
    CREATE INDEX "syncshow_sermon_media_uploads_connection_idx"
      ON "syncshow_sermon_media_uploads" USING btree ("connection_id");
    CREATE INDEX "syncshow_sermon_media_uploads_sermon_idx"
      ON "syncshow_sermon_media_uploads" USING btree ("sermon_id");
    CREATE INDEX "syncshow_sermon_media_uploads_object_idx"
      ON "syncshow_sermon_media_uploads" USING btree ("object_id");
    CREATE INDEX "syncshow_sermon_media_uploads_expiry_idx"
      ON "syncshow_sermon_media_uploads"
      USING btree ("state", "expires_at");
    CREATE INDEX "syncshow_sermon_media_uploads_cleanup_idx"
      ON "syncshow_sermon_media_uploads"
      USING btree ("state", "staging_cleaned_at")
      WHERE "staging_cleaned_at" IS NULL;
    CREATE INDEX "syncshow_sermon_media_uploads_sync_idx"
      ON "syncshow_sermon_media_uploads"
      USING btree ("community_id", "sync_id");
    CREATE INDEX "syncshow_sermon_media_chunks_upload_idx"
      ON "syncshow_sermon_media_chunks" USING btree ("upload_id");
    CREATE INDEX "syncshow_sermon_media_objects_created_idx"
      ON "syncshow_sermon_media_objects" USING btree ("created_at");
    CREATE INDEX "syncshow_sermon_media_objects_community_idx"
      ON "syncshow_sermon_media_objects" USING btree ("community_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE "syncshow_sermon_media_chunks";
    DROP TABLE "syncshow_sermon_media_uploads";
    DROP TABLE "syncshow_sermon_media_objects";
    DROP TYPE "public"."enum_syncshow_sermon_media_upload_state";
  `)
}
