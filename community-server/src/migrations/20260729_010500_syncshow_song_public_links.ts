import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "syncshow_song_public_links" (
      "id" serial PRIMARY KEY NOT NULL,
      "community_id" integer NOT NULL,
      "song_id" integer NOT NULL,
      "schema_version" numeric NOT NULL,
      "link_id" varchar NOT NULL,
      "link_version" numeric NOT NULL,
      "song_sync_id" varchar NOT NULL,
      "song_sync_version" numeric NOT NULL,
      "family_revision" varchar NOT NULL,
      "review_revision" varchar NOT NULL,
      "label" varchar,
      "issued_at" timestamp(3) with time zone NOT NULL,
      "expires_at" timestamp(3) with time zone,
      "revoked_at" timestamp(3) with time zone,
      "snapshot_checksum" varchar NOT NULL,
      "snapshot_source" varchar NOT NULL,
      "review_source" varchar NOT NULL,
      "audit_source" varchar NOT NULL,
      "create_idempotency_key_hash" varchar NOT NULL,
      "create_request_hash" varchar NOT NULL,
      "revoke_idempotency_key_hash" varchar,
      "revoke_request_hash" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "syncshow_song_public_links_schema_check"
        CHECK ("schema_version" = 1),
      CONSTRAINT "syncshow_song_public_links_link_version_check"
        CHECK ("link_version" >= 1),
      CONSTRAINT "syncshow_song_public_links_song_version_check"
        CHECK ("song_sync_version" >= 1),
      CONSTRAINT "syncshow_song_public_links_expiry_check"
        CHECK ("expires_at" IS NULL OR "expires_at" > "issued_at"),
      CONSTRAINT "syncshow_song_public_links_revocation_check"
        CHECK ("revoked_at" IS NULL OR "revoked_at" >= "issued_at"),
      CONSTRAINT "syncshow_song_public_links_revoke_operation_check"
        CHECK (
          ("revoke_idempotency_key_hash" IS NULL)
          = ("revoke_request_hash" IS NULL)
        )
    );

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN "syncshow_song_public_links_id" integer;

    ALTER TABLE "syncshow_song_public_links"
      ADD CONSTRAINT "syncshow_song_public_links_community_id_communities_id_fk"
      FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id")
      ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "syncshow_song_public_links"
      ADD CONSTRAINT "syncshow_song_public_links_song_id_songs_id_fk"
      FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id")
      ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_syncshow_song_public_links_fk"
      FOREIGN KEY ("syncshow_song_public_links_id")
      REFERENCES "public"."syncshow_song_public_links"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "syncshow_song_public_links_community_idx"
      ON "syncshow_song_public_links" USING btree ("community_id");
    CREATE INDEX "syncshow_song_public_links_song_idx"
      ON "syncshow_song_public_links" USING btree ("song_id");
    CREATE UNIQUE INDEX "syncshow_song_public_links_link_id_idx"
      ON "syncshow_song_public_links" USING btree ("link_id");
    CREATE INDEX "syncshow_song_public_links_song_sync_id_idx"
      ON "syncshow_song_public_links" USING btree ("song_sync_id");
    CREATE INDEX "syncshow_song_public_links_issued_at_idx"
      ON "syncshow_song_public_links" USING btree ("issued_at");
    CREATE INDEX "syncshow_song_public_links_expires_at_idx"
      ON "syncshow_song_public_links" USING btree ("expires_at");
    CREATE INDEX "syncshow_song_public_links_revoked_at_idx"
      ON "syncshow_song_public_links" USING btree ("revoked_at");
    CREATE UNIQUE INDEX "syncshow_song_public_links_create_idempotency_key_hash_idx"
      ON "syncshow_song_public_links"
      USING btree ("create_idempotency_key_hash");
    CREATE UNIQUE INDEX "syncshow_song_public_links_revoke_idempotency_key_hash_idx"
      ON "syncshow_song_public_links"
      USING btree ("revoke_idempotency_key_hash");
    CREATE INDEX "community_songSyncId_issuedAt_idx"
      ON "syncshow_song_public_links"
      USING btree ("community_id", "song_sync_id", "issued_at");
    CREATE INDEX "syncshow_song_public_links_updated_at_idx"
      ON "syncshow_song_public_links" USING btree ("updated_at");
    CREATE INDEX "syncshow_song_public_links_created_at_idx"
      ON "syncshow_song_public_links" USING btree ("created_at");
    CREATE INDEX "payload_locked_documents_rels_syncshow_song_public_links_idx"
      ON "payload_locked_documents_rels"
      USING btree ("syncshow_song_public_links_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "payload_locked_documents_rels_syncshow_song_public_links_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_syncshow_song_public_links_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN "syncshow_song_public_links_id";
    DROP TABLE "syncshow_song_public_links";
  `)
}
