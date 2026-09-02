import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "syncshow_service_document_changes_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_service_document_changes_fk"
      FOREIGN KEY ("syncshow_service_document_changes_id")
      REFERENCES "public"."syncshow_service_document_changes"("id")
      ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_service_document_changes_idx"
      ON "payload_locked_documents_rels" ("syncshow_service_document_changes_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_service_document_changes_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_service_document_changes_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "syncshow_service_document_changes_id";
  `)
}
