import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_sermons_sync_publication_status" AS ENUM('draft', 'ready', 'published', 'archived');
  CREATE TYPE "public"."enum_sermons_sync_visibility" AS ENUM('private', 'members', 'unlisted', 'public');
  CREATE TYPE "public"."enum_syncshow_sermon_publications_visibility" AS ENUM('public');
  CREATE TABLE "syncshow_sermon_publications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"community_id" integer NOT NULL,
  	"sermon_id" integer NOT NULL,
  	"schema_version" numeric NOT NULL,
  	"active" boolean DEFAULT false NOT NULL,
  	"visibility" "enum_syncshow_sermon_publications_visibility" NOT NULL,
  	"publication_version" numeric NOT NULL,
  	"published_at" timestamp(3) with time zone NOT NULL,
  	"withdrawn_at" timestamp(3) with time zone,
  	"sync_id" varchar NOT NULL,
  	"public_id" varchar NOT NULL,
  	"public_revision" varchar NOT NULL,
  	"published_document_source" varchar NOT NULL,
  	"selected_body_entry_ids" jsonb NOT NULL,
  	"selected_media_ids" jsonb NOT NULL,
  	"detail_checksum" varchar NOT NULL,
  	"detail_source" varchar NOT NULL,
  	"catalog_item_checksum" varchar NOT NULL,
  	"catalog_item_source" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "syncshow_sermon_publication_catalogs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"community_id" integer NOT NULL,
  	"schema_version" numeric NOT NULL,
  	"generation" numeric NOT NULL,
  	"changed_at" timestamp(3) with time zone NOT NULL,
  	"checksum" varchar NOT NULL,
  	"source" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "sermons" ADD COLUMN "sync_publication_status" "enum_sermons_sync_publication_status";
  ALTER TABLE "sermons" ADD COLUMN "sync_visibility" "enum_sermons_sync_visibility";
  UPDATE "sermons"
  SET
    "sync_publication_status" = (
      ("sync_current_document_source"::jsonb)->'publication'->>'status'
    )::"enum_sermons_sync_publication_status",
    "sync_visibility" = (
      ("sync_current_document_source"::jsonb)->'publication'->>'visibility'
    )::"enum_sermons_sync_visibility"
  WHERE "sync_id" IS NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "syncshow_sermon_publications_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "syncshow_sermon_publication_catalogs_id" integer;
  ALTER TABLE "syncshow_sermon_publications" ADD CONSTRAINT "syncshow_sermon_publications_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "syncshow_sermon_publications" ADD CONSTRAINT "syncshow_sermon_publications_sermon_id_sermons_id_fk" FOREIGN KEY ("sermon_id") REFERENCES "public"."sermons"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "syncshow_sermon_publication_catalogs" ADD CONSTRAINT "syncshow_sermon_publication_catalogs_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE restrict ON UPDATE no action;
  CREATE INDEX "syncshow_sermon_publications_community_idx" ON "syncshow_sermon_publications" USING btree ("community_id");
  CREATE INDEX "syncshow_sermon_publications_sermon_idx" ON "syncshow_sermon_publications" USING btree ("sermon_id");
  CREATE INDEX "syncshow_sermon_publications_active_idx" ON "syncshow_sermon_publications" USING btree ("active");
  CREATE INDEX "syncshow_sermon_publications_sync_id_idx" ON "syncshow_sermon_publications" USING btree ("sync_id");
  CREATE INDEX "syncshow_sermon_publications_public_id_idx" ON "syncshow_sermon_publications" USING btree ("public_id");
  CREATE INDEX "syncshow_sermon_publications_updated_at_idx" ON "syncshow_sermon_publications" USING btree ("updated_at");
  CREATE INDEX "syncshow_sermon_publications_created_at_idx" ON "syncshow_sermon_publications" USING btree ("created_at");
  CREATE UNIQUE INDEX "community_sermon_idx" ON "syncshow_sermon_publications" USING btree ("community_id","sermon_id");
  CREATE UNIQUE INDEX "community_publicId_idx" ON "syncshow_sermon_publications" USING btree ("community_id","public_id");
  CREATE UNIQUE INDEX "syncshow_sermon_publication_catalogs_community_idx" ON "syncshow_sermon_publication_catalogs" USING btree ("community_id");
  CREATE INDEX "syncshow_sermon_publication_catalogs_updated_at_idx" ON "syncshow_sermon_publication_catalogs" USING btree ("updated_at");
  CREATE INDEX "syncshow_sermon_publication_catalogs_created_at_idx" ON "syncshow_sermon_publication_catalogs" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_syncshow_sermon_publication_fk" FOREIGN KEY ("syncshow_sermon_publications_id") REFERENCES "public"."syncshow_sermon_publications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_syncshow_sermon_publicati_1_fk" FOREIGN KEY ("syncshow_sermon_publication_catalogs_id") REFERENCES "public"."syncshow_sermon_publication_catalogs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_syncshow_sermon_publicatio_idx" ON "payload_locked_documents_rels" USING btree ("syncshow_sermon_publications_id");
  CREATE INDEX "payload_locked_documents_rels_syncshow_sermon_publicat_1_idx" ON "payload_locked_documents_rels" USING btree ("syncshow_sermon_publication_catalogs_id");

  INSERT INTO "syncshow_sermon_publication_catalogs"
    ("community_id", "schema_version", "generation", "changed_at", "checksum", "source")
  SELECT
    "id",
    1,
    1,
    now(),
    '2c8d818469dc72882c2da93cba63d47a65fcb96aea8d0a52bdb000d7c255617d',
    E'{"contentType":"sermons","items":[],"schemaVersion":2}\\n'
  FROM "communities"
  ON CONFLICT ("community_id") DO NOTHING;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_syncshow_sermon_publication_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_syncshow_sermon_publicati_1_fk";
  DROP INDEX "payload_locked_documents_rels_syncshow_sermon_publicatio_idx";
  DROP INDEX "payload_locked_documents_rels_syncshow_sermon_publicat_1_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "syncshow_sermon_publications_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "syncshow_sermon_publication_catalogs_id";
  ALTER TABLE "syncshow_sermon_publications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "syncshow_sermon_publication_catalogs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "syncshow_sermon_publications" CASCADE;
  DROP TABLE "syncshow_sermon_publication_catalogs" CASCADE;
  ALTER TABLE "sermons" DROP COLUMN "sync_publication_status";
  ALTER TABLE "sermons" DROP COLUMN "sync_visibility";
  DROP TYPE "public"."enum_sermons_sync_publication_status";
  DROP TYPE "public"."enum_sermons_sync_visibility";
  DROP TYPE "public"."enum_syncshow_sermon_publications_visibility";`)
}
