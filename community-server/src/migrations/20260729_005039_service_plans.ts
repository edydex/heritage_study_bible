import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_service_plans_entries_kind" AS ENUM('section', 'song', 'scripture', 'sermon');
  CREATE TYPE "public"."enum_service_plans_entries_scripture_book_id" AS ENUM('Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam', '1Kgs', '2Kgs', '1Chr', '2Chr', 'Ezra', 'Neh', 'Esth', 'Job', 'Ps', 'Prov', 'Eccl', 'Song', 'Isa', 'Jer', 'Lam', 'Ezek', 'Dan', 'Hos', 'Joel', 'Amos', 'Obad', 'Jonah', 'Mic', 'Nah', 'Hab', 'Zeph', 'Hag', 'Zech', 'Mal', 'Matt', 'Mark', 'Luke', 'John', 'Acts', 'Rom', '1Cor', '2Cor', 'Gal', 'Eph', 'Phil', 'Col', '1Thess', '2Thess', '1Tim', '2Tim', 'Titus', 'Phlm', 'Heb', 'Jas', '1Pet', '2Pet', '1John', '2John', '3John', 'Jude', 'Rev');
  CREATE TYPE "public"."enum_service_plans_status" AS ENUM('draft', 'ready', 'archived', 'cancelled');
  CREATE TABLE "service_plans_entries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"entry_id" varchar,
  	"kind" "enum_service_plans_entries_kind" NOT NULL,
  	"title" varchar NOT NULL,
  	"song_id" integer,
  	"sermon_id" integer,
  	"scripture_book_id" "enum_service_plans_entries_scripture_book_id",
  	"scripture_start_chapter" numeric,
  	"scripture_start_verse" numeric,
  	"scripture_end_chapter" numeric,
  	"scripture_end_verse" numeric,
  	"scripture_translation_id" varchar DEFAULT 'BSB',
  	"resolved_sync_id" varchar,
  	"resolved_sync_version" numeric,
  	"resolved_revision" varchar
  );
  
  CREATE TABLE "service_plans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"community_id" integer NOT NULL,
  	"status" "enum_service_plans_status" DEFAULT 'draft' NOT NULL,
  	"service_date" timestamp(3) with time zone NOT NULL,
  	"start_time" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"team_notes" varchar DEFAULT '',
  	"sync_id" varchar NOT NULL,
  	"sync_version" numeric NOT NULL,
  	"revision" varchar NOT NULL,
  	"document_source" varchar NOT NULL,
  	"changed_at" timestamp(3) with time zone NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "service_plans_id" integer;
  ALTER TABLE "service_plans_entries" ADD CONSTRAINT "service_plans_entries_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "service_plans_entries" ADD CONSTRAINT "service_plans_entries_sermon_id_sermons_id_fk" FOREIGN KEY ("sermon_id") REFERENCES "public"."sermons"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "service_plans_entries" ADD CONSTRAINT "service_plans_entries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."service_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "service_plans" ADD CONSTRAINT "service_plans_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "service_plans_entries_order_idx" ON "service_plans_entries" USING btree ("_order");
  CREATE INDEX "service_plans_entries_parent_id_idx" ON "service_plans_entries" USING btree ("_parent_id");
  CREATE INDEX "service_plans_entries_song_idx" ON "service_plans_entries" USING btree ("song_id");
  CREATE INDEX "service_plans_entries_sermon_idx" ON "service_plans_entries" USING btree ("sermon_id");
  CREATE INDEX "service_plans_community_idx" ON "service_plans" USING btree ("community_id");
  CREATE INDEX "service_plans_status_idx" ON "service_plans" USING btree ("status");
  CREATE INDEX "service_plans_service_date_idx" ON "service_plans" USING btree ("service_date");
  CREATE INDEX "service_plans_sync_id_idx" ON "service_plans" USING btree ("sync_id");
  CREATE INDEX "service_plans_changed_at_idx" ON "service_plans" USING btree ("changed_at");
  CREATE INDEX "service_plans_updated_at_idx" ON "service_plans" USING btree ("updated_at");
  CREATE INDEX "service_plans_created_at_idx" ON "service_plans" USING btree ("created_at");
  CREATE UNIQUE INDEX "community_syncId_2_idx" ON "service_plans" USING btree ("community_id","sync_id");
  CREATE INDEX "community_changedAt_idx" ON "service_plans" USING btree ("community_id","changed_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_service_plans_fk" FOREIGN KEY ("service_plans_id") REFERENCES "public"."service_plans"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_service_plans_id_idx" ON "payload_locked_documents_rels" USING btree ("service_plans_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_service_plans_fk";
  DROP INDEX "payload_locked_documents_rels_service_plans_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "service_plans_id";
  ALTER TABLE "service_plans_entries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "service_plans" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "service_plans_entries";
  DROP TABLE "service_plans";
  DROP TYPE "public"."enum_service_plans_entries_kind";
  DROP TYPE "public"."enum_service_plans_entries_scripture_book_id";
  DROP TYPE "public"."enum_service_plans_status";`)
}
