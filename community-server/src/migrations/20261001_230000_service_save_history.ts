import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    CREATE TYPE "enum_service_document_saves_save_kind" AS ENUM ('automatic','manual','restore');
    CREATE TABLE "service_document_saves" (
      "id" serial PRIMARY KEY,
      "community_id" integer NOT NULL REFERENCES "communities"("id") ON DELETE RESTRICT,
      "service_document_id" integer NOT NULL REFERENCES "service_documents"("id") ON DELETE RESTRICT,
      "request_id" varchar NOT NULL, "sync_version" numeric NOT NULL, "revision" varchar NOT NULL,
      "save_kind" "enum_service_document_saves_save_kind" NOT NULL,
      "saved_by" varchar NOT NULL, "saved_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX "service_document_saves_service_document_request_id_idx" ON "service_document_saves" ("service_document_id","request_id");
    CREATE INDEX "service_document_saves_community_idx" ON "service_document_saves" ("community_id");
    CREATE INDEX "service_document_saves_service_document_idx" ON "service_document_saves" ("service_document_id");
    CREATE INDEX "service_document_saves_saved_at_idx" ON "service_document_saves" ("saved_at");
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "service_document_saves_id" integer REFERENCES "service_document_saves"("id") ON DELETE CASCADE;
  `)
}
export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "service_document_saves_id"; DROP TABLE "service_document_saves"; DROP TYPE "enum_service_document_saves_save_kind";`)
}
