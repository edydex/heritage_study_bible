import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from '@payloadcms/db-postgres'
import { legacyServicePlanToServiceDocument } from '@/lib/syncshow/LegacyServicePlanToServiceDocument'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_service_documents_status"
      AS ENUM('planning', 'ready', 'archived', 'cancelled');
    CREATE TABLE "service_documents" (
      "id" serial PRIMARY KEY NOT NULL,
      "community_id" integer NOT NULL,
      "title" varchar NOT NULL,
      "service_date" timestamp(3) with time zone NOT NULL,
      "status" "enum_service_documents_status" DEFAULT 'planning' NOT NULL,
      "document_source" varchar NOT NULL,
      "sync_id" varchar NOT NULL,
      "sync_version" numeric NOT NULL,
      "revision" varchar NOT NULL,
      "changed_at" timestamp(3) with time zone NOT NULL,
      "ready_revision" varchar,
      "ready_at" timestamp(3) with time zone,
      "last_idempotency_key" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE TABLE "syncshow_service_document_changes" (
      "id" serial PRIMARY KEY NOT NULL,
      "community_id" integer NOT NULL,
      "service_document_id" integer NOT NULL,
      "sync_id" varchar NOT NULL,
      "sync_version" numeric NOT NULL,
      "revision" varchar NOT NULL,
      "document_source" varchar NOT NULL,
      "status" varchar NOT NULL,
      "title" varchar NOT NULL,
      "service_date" varchar NOT NULL,
      "changed_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN "service_documents_id" integer;
    ALTER TABLE "service_documents"
      ADD CONSTRAINT "service_documents_community_id_communities_id_fk"
      FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id")
      ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "syncshow_service_document_changes"
      ADD CONSTRAINT "syncshow_service_document_changes_community_id_fk"
      FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id")
      ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "syncshow_service_document_changes"
      ADD CONSTRAINT "syncshow_service_document_changes_document_id_fk"
      FOREIGN KEY ("service_document_id") REFERENCES "public"."service_documents"("id")
      ON DELETE restrict ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_service_documents_fk"
      FOREIGN KEY ("service_documents_id") REFERENCES "public"."service_documents"("id")
      ON DELETE cascade ON UPDATE no action;
    CREATE UNIQUE INDEX "service_documents_community_sync_id_idx"
      ON "service_documents" ("community_id", "sync_id");
    CREATE INDEX "service_documents_community_changed_at_idx"
      ON "service_documents" ("community_id", "changed_at");
    CREATE INDEX "service_documents_service_date_idx"
      ON "service_documents" ("service_date");
    CREATE INDEX "service_documents_status_idx"
      ON "service_documents" ("status");
    CREATE UNIQUE INDEX "service_document_changes_document_version_idx"
      ON "syncshow_service_document_changes" ("service_document_id", "sync_version");
    CREATE INDEX "service_document_changes_community_idx"
      ON "syncshow_service_document_changes" ("community_id");
    CREATE INDEX "payload_locked_documents_rels_service_documents_id_idx"
      ON "payload_locked_documents_rels" ("service_documents_id");
  `)

  const legacyRows = (await db.execute(sql`
    SELECT
      "community_id" AS "communityId",
      "sync_id" AS "syncId",
      "sync_version" AS "syncVersion",
      "revision",
      "document_source" AS "documentSource",
      "status",
      "changed_at" AS "changedAt"
    FROM "service_plans"
    ORDER BY "id" ASC;
  `)).rows || []
  for (const row of legacyRows) {
    const migrated = legacyServicePlanToServiceDocument(
      row as Record<string, unknown>,
    )
    const inserted = (await db.execute(sql`
      INSERT INTO "service_documents" (
        "community_id", "title", "service_date", "status",
        "document_source", "sync_id", "sync_version", "revision",
        "changed_at", "updated_at", "created_at"
      ) VALUES (
        ${migrated.communityId}, ${migrated.title},
        ${`${migrated.serviceDate}T00:00:00.000Z`}, ${migrated.status},
        ${migrated.documentSource}, ${migrated.syncId},
        ${migrated.syncVersion}, ${migrated.revision}, ${migrated.changedAt},
        ${migrated.changedAt}, ${migrated.changedAt}
      ) RETURNING "id";
    `)).rows?.[0] as { id?: unknown } | undefined
    const documentId = Number(inserted?.id)
    if (!Number.isSafeInteger(documentId) || documentId < 1) {
      throw new Error('Could not create migrated service-document history.')
    }
    await db.execute(sql`
      INSERT INTO "syncshow_service_document_changes" (
        "community_id", "service_document_id", "sync_id", "sync_version",
        "revision", "document_source", "status", "title", "service_date",
        "changed_at", "updated_at", "created_at"
      ) VALUES (
        ${migrated.communityId}, ${documentId}, ${migrated.syncId},
        ${migrated.syncVersion}, ${migrated.revision},
        ${migrated.documentSource}, ${migrated.status}, ${migrated.title},
        ${migrated.serviceDate}, ${migrated.changedAt},
        ${migrated.changedAt}, ${migrated.changedAt}
      );
    `)
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_service_documents_fk";
    DROP INDEX "payload_locked_documents_rels_service_documents_id_idx";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN "service_documents_id";
    DROP TABLE "syncshow_service_document_changes";
    DROP TABLE "service_documents";
    DROP TYPE "public"."enum_service_documents_status";
  `)
}
