import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "syncshow_sermon_changes" (
      "id" serial PRIMARY KEY NOT NULL,
      "community_id" integer NOT NULL,
      "sermon_id" integer NOT NULL,
      "sync_id" varchar NOT NULL,
      "sync_version" numeric NOT NULL,
      "revision" varchar NOT NULL,
      "archived" boolean DEFAULT false NOT NULL,
      "changed_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- All fields are nullable and have no defaults so existing sermons remain
    -- unmistakably legacy rows until a deliberate SyncShow mutation adopts them.
    ALTER TABLE "sermons" ADD COLUMN "sync_id" varchar;
    ALTER TABLE "sermons" ADD COLUMN "sync_version" numeric;
    ALTER TABLE "sermons" ADD COLUMN "sync_current_document_source" varchar;
    ALTER TABLE "sermons" ADD COLUMN "sync_current_revision" varchar;
    ALTER TABLE "sermons" ADD COLUMN "sync_archived" boolean;
    ALTER TABLE "sermons" ADD COLUMN "sync_source_objects" jsonb;
    ALTER TABLE "sermons" ADD COLUMN "sync_changed_at" timestamp(3) with time zone;
    ALTER TABLE "sermons" ADD COLUMN "sync_create_idempotency_key" varchar;
    ALTER TABLE "sermons" ADD COLUMN "sync_create_idempotency_hash" varchar;

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN "syncshow_sermon_changes_id" integer;

    -- Journal rows are immutable audit records. Restricting deletion matches
    -- their required foreign-key columns and prevents orphaned history.
    ALTER TABLE "syncshow_sermon_changes"
      ADD CONSTRAINT "syncshow_sermon_changes_community_id_communities_id_fk"
      FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id")
      ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "syncshow_sermon_changes"
      ADD CONSTRAINT "syncshow_sermon_changes_sermon_id_sermons_id_fk"
      FOREIGN KEY ("sermon_id") REFERENCES "public"."sermons"("id")
      ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_syncshow_sermon_changes_fk"
      FOREIGN KEY ("syncshow_sermon_changes_id")
      REFERENCES "public"."syncshow_sermon_changes"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "syncshow_sermon_changes_community_idx"
      ON "syncshow_sermon_changes" USING btree ("community_id");
    CREATE INDEX "syncshow_sermon_changes_sermon_idx"
      ON "syncshow_sermon_changes" USING btree ("sermon_id");
    CREATE INDEX "syncshow_sermon_changes_sync_id_idx"
      ON "syncshow_sermon_changes" USING btree ("sync_id");
    CREATE INDEX "syncshow_sermon_changes_updated_at_idx"
      ON "syncshow_sermon_changes" USING btree ("updated_at");
    CREATE INDEX "syncshow_sermon_changes_created_at_idx"
      ON "syncshow_sermon_changes" USING btree ("created_at");
    CREATE UNIQUE INDEX "sermon_syncVersion_idx"
      ON "syncshow_sermon_changes" USING btree ("sermon_id", "sync_version");

    CREATE INDEX "sermons_sync_id_idx" ON "sermons" USING btree ("sync_id");
    CREATE INDEX "sermons_sync_changed_at_idx" ON "sermons" USING btree ("sync_changed_at");
    CREATE INDEX "sermons_sync_create_idempotency_key_idx"
      ON "sermons" USING btree ("sync_create_idempotency_key");
    CREATE UNIQUE INDEX "community_syncId_1_idx"
      ON "sermons" USING btree ("community_id", "sync_id");
    CREATE UNIQUE INDEX "community_syncCreateIdempotencyKey_idx"
      ON "sermons" USING btree ("community_id", "sync_create_idempotency_key");

    CREATE INDEX "payload_locked_documents_rels_syncshow_sermon_changes_id_idx"
      ON "payload_locked_documents_rels" USING btree ("syncshow_sermon_changes_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "payload_locked_documents_rels_syncshow_sermon_changes_id_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_syncshow_sermon_changes_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN "syncshow_sermon_changes_id";

    DROP TABLE "syncshow_sermon_changes" CASCADE;

    DROP INDEX "community_syncCreateIdempotencyKey_idx";
    DROP INDEX "community_syncId_1_idx";
    DROP INDEX "sermons_sync_create_idempotency_key_idx";
    DROP INDEX "sermons_sync_changed_at_idx";
    DROP INDEX "sermons_sync_id_idx";

    ALTER TABLE "sermons" DROP COLUMN "sync_create_idempotency_hash";
    ALTER TABLE "sermons" DROP COLUMN "sync_create_idempotency_key";
    ALTER TABLE "sermons" DROP COLUMN "sync_changed_at";
    ALTER TABLE "sermons" DROP COLUMN "sync_source_objects";
    ALTER TABLE "sermons" DROP COLUMN "sync_archived";
    ALTER TABLE "sermons" DROP COLUMN "sync_current_revision";
    ALTER TABLE "sermons" DROP COLUMN "sync_current_document_source";
    ALTER TABLE "sermons" DROP COLUMN "sync_version";
    ALTER TABLE "sermons" DROP COLUMN "sync_id";
  `)
}
