import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_songs_visibility" AS ENUM('private', 'public', 'scheduled-public');
    CREATE TYPE "public"."enum_syncshow_device_grants_status" AS ENUM('pending', 'approved', 'denied', 'cancelled', 'consumed');

    ALTER TABLE "songs" ADD COLUMN "sync_id" varchar;
    ALTER TABLE "songs" ADD COLUMN "visibility" "enum_songs_visibility" DEFAULT 'private' NOT NULL;
    ALTER TABLE "songs" ADD COLUMN "publish_at" timestamp(3) with time zone;
    ALTER TABLE "songs" ADD COLUMN "sync_version" numeric DEFAULT 1 NOT NULL;
    ALTER TABLE "songs" ADD COLUMN "sync_documents" jsonb DEFAULT '[]'::jsonb NOT NULL;

    UPDATE "songs"
    SET
      "sync_id" = CASE
        WHEN "slug" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' THEN "slug"
        ELSE 'heritage:' || "id"::text
      END,
      "visibility" = CASE
        WHEN "status" = 'published' THEN 'public'::"enum_songs_visibility"
        ELSE 'private'::"enum_songs_visibility"
      END,
      "sync_version" = 1,
      "sync_documents" = '[]'::jsonb;

    ALTER TABLE "songs" ALTER COLUMN "sync_id" SET NOT NULL;

    CREATE TABLE "syncshow_device_grants" (
      "id" serial PRIMARY KEY NOT NULL,
      "community_id" integer NOT NULL,
      "requested_email" varchar NOT NULL,
      "client_name" varchar NOT NULL,
      "device_id" varchar NOT NULL,
      "device_secret_hash" varchar NOT NULL,
      "user_code_hash" varchar NOT NULL,
      "code_challenge" varchar NOT NULL,
      "scopes" jsonb NOT NULL,
      "status" "enum_syncshow_device_grants_status" DEFAULT 'pending' NOT NULL,
      "expires_at" timestamp(3) with time zone NOT NULL,
      "approved_by_id" integer,
      "approved_at" timestamp(3) with time zone,
      "consumed_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "syncshow_connections" (
      "id" serial PRIMARY KEY NOT NULL,
      "community_id" integer NOT NULL,
      "user_id" integer NOT NULL,
      "grant_id" integer NOT NULL,
      "client_name" varchar NOT NULL,
      "token_hash" varchar NOT NULL,
      "scopes" jsonb NOT NULL,
      "expires_at" timestamp(3) with time zone NOT NULL,
      "revoked_at" timestamp(3) with time zone,
      "last_used_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "syncshow_device_grants_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "syncshow_connections_id" integer;

    ALTER TABLE "syncshow_device_grants"
      ADD CONSTRAINT "syncshow_device_grants_community_id_communities_id_fk"
      FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "syncshow_device_grants"
      ADD CONSTRAINT "syncshow_device_grants_approved_by_id_users_id_fk"
      FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "syncshow_connections"
      ADD CONSTRAINT "syncshow_connections_community_id_communities_id_fk"
      FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "syncshow_connections"
      ADD CONSTRAINT "syncshow_connections_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "syncshow_connections"
      ADD CONSTRAINT "syncshow_connections_grant_id_syncshow_device_grants_id_fk"
      FOREIGN KEY ("grant_id") REFERENCES "public"."syncshow_device_grants"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_syncshow_device_grants_fk"
      FOREIGN KEY ("syncshow_device_grants_id") REFERENCES "public"."syncshow_device_grants"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_syncshow_connections_fk"
      FOREIGN KEY ("syncshow_connections_id") REFERENCES "public"."syncshow_connections"("id") ON DELETE cascade ON UPDATE no action;

    CREATE UNIQUE INDEX "songs_community_sync_id_idx" ON "songs" USING btree ("community_id", "sync_id");
    CREATE INDEX "songs_visibility_idx" ON "songs" USING btree ("visibility");
    CREATE INDEX "songs_publish_at_idx" ON "songs" USING btree ("publish_at");
    CREATE INDEX "songs_sync_version_idx" ON "songs" USING btree ("sync_version");

    CREATE INDEX "syncshow_device_grants_community_idx" ON "syncshow_device_grants" USING btree ("community_id");
    CREATE INDEX "syncshow_device_grants_requested_email_idx" ON "syncshow_device_grants" USING btree ("requested_email");
    CREATE UNIQUE INDEX "syncshow_device_grants_device_id_idx" ON "syncshow_device_grants" USING btree ("device_id");
    CREATE UNIQUE INDEX "syncshow_device_grants_device_secret_hash_idx" ON "syncshow_device_grants" USING btree ("device_secret_hash");
    CREATE UNIQUE INDEX "syncshow_device_grants_user_code_hash_idx" ON "syncshow_device_grants" USING btree ("user_code_hash");
    CREATE INDEX "syncshow_device_grants_status_idx" ON "syncshow_device_grants" USING btree ("status");
    CREATE INDEX "syncshow_device_grants_expires_at_idx" ON "syncshow_device_grants" USING btree ("expires_at");
    CREATE INDEX "syncshow_device_grants_approved_by_idx" ON "syncshow_device_grants" USING btree ("approved_by_id");
    CREATE INDEX "syncshow_device_grants_updated_at_idx" ON "syncshow_device_grants" USING btree ("updated_at");
    CREATE INDEX "syncshow_device_grants_created_at_idx" ON "syncshow_device_grants" USING btree ("created_at");

    CREATE INDEX "syncshow_connections_community_idx" ON "syncshow_connections" USING btree ("community_id");
    CREATE INDEX "syncshow_connections_user_idx" ON "syncshow_connections" USING btree ("user_id");
    CREATE UNIQUE INDEX "syncshow_connections_grant_idx" ON "syncshow_connections" USING btree ("grant_id");
    CREATE UNIQUE INDEX "syncshow_connections_token_hash_idx" ON "syncshow_connections" USING btree ("token_hash");
    CREATE INDEX "syncshow_connections_expires_at_idx" ON "syncshow_connections" USING btree ("expires_at");
    CREATE INDEX "syncshow_connections_revoked_at_idx" ON "syncshow_connections" USING btree ("revoked_at");
    CREATE INDEX "syncshow_connections_updated_at_idx" ON "syncshow_connections" USING btree ("updated_at");
    CREATE INDEX "syncshow_connections_created_at_idx" ON "syncshow_connections" USING btree ("created_at");

    CREATE INDEX "payload_locked_documents_rels_syncshow_device_grants_id_idx"
      ON "payload_locked_documents_rels" USING btree ("syncshow_device_grants_id");
    CREATE INDEX "payload_locked_documents_rels_syncshow_connections_id_idx"
      ON "payload_locked_documents_rels" USING btree ("syncshow_connections_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX "payload_locked_documents_rels_syncshow_connections_id_idx";
    DROP INDEX "payload_locked_documents_rels_syncshow_device_grants_id_idx";
    DROP INDEX "syncshow_connections_created_at_idx";
    DROP INDEX "syncshow_connections_updated_at_idx";
    DROP INDEX "syncshow_connections_revoked_at_idx";
    DROP INDEX "syncshow_connections_expires_at_idx";
    DROP INDEX "syncshow_connections_token_hash_idx";
    DROP INDEX "syncshow_connections_grant_idx";
    DROP INDEX "syncshow_connections_user_idx";
    DROP INDEX "syncshow_connections_community_idx";
    DROP INDEX "syncshow_device_grants_created_at_idx";
    DROP INDEX "syncshow_device_grants_updated_at_idx";
    DROP INDEX "syncshow_device_grants_approved_by_idx";
    DROP INDEX "syncshow_device_grants_expires_at_idx";
    DROP INDEX "syncshow_device_grants_status_idx";
    DROP INDEX "syncshow_device_grants_user_code_hash_idx";
    DROP INDEX "syncshow_device_grants_device_secret_hash_idx";
    DROP INDEX "syncshow_device_grants_device_id_idx";
    DROP INDEX "syncshow_device_grants_requested_email_idx";
    DROP INDEX "syncshow_device_grants_community_idx";
    DROP INDEX "songs_sync_version_idx";
    DROP INDEX "songs_publish_at_idx";
    DROP INDEX "songs_visibility_idx";
    DROP INDEX "songs_community_sync_id_idx";

    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_syncshow_connections_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_syncshow_device_grants_fk";
    ALTER TABLE "syncshow_connections"
      DROP CONSTRAINT "syncshow_connections_grant_id_syncshow_device_grants_id_fk";
    ALTER TABLE "syncshow_connections"
      DROP CONSTRAINT "syncshow_connections_user_id_users_id_fk";
    ALTER TABLE "syncshow_connections"
      DROP CONSTRAINT "syncshow_connections_community_id_communities_id_fk";
    ALTER TABLE "syncshow_device_grants"
      DROP CONSTRAINT "syncshow_device_grants_approved_by_id_users_id_fk";
    ALTER TABLE "syncshow_device_grants"
      DROP CONSTRAINT "syncshow_device_grants_community_id_communities_id_fk";

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "syncshow_connections_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "syncshow_device_grants_id";
    DROP TABLE "syncshow_connections" CASCADE;
    DROP TABLE "syncshow_device_grants" CASCADE;

    ALTER TABLE "songs" DROP COLUMN "sync_documents";
    ALTER TABLE "songs" DROP COLUMN "sync_version";
    ALTER TABLE "songs" DROP COLUMN "publish_at";
    ALTER TABLE "songs" DROP COLUMN "visibility";
    ALTER TABLE "songs" DROP COLUMN "sync_id";

    DROP TYPE "public"."enum_syncshow_device_grants_status";
    DROP TYPE "public"."enum_songs_visibility";
  `)
}
