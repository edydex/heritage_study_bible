import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_communities_join_policy" AS ENUM('invite', 'open');
  CREATE TYPE "public"."enum_community_invites_role" AS ENUM('member', 'leader', 'admin');
  CREATE TABLE "community_invites" (
    "id" serial PRIMARY KEY NOT NULL,
    "community_id" integer NOT NULL,
    "email" varchar NOT NULL,
    "display_name" varchar,
    "role" "enum_community_invites_role" DEFAULT 'member' NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "accepted_at" timestamp(3) with time zone,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "communities" ADD COLUMN "join_policy" "enum_communities_join_policy" DEFAULT 'invite' NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "community_invites_id" integer;
  ALTER TABLE "community_invites" ADD CONSTRAINT "community_invites_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "community_invites_community_idx" ON "community_invites" USING btree ("community_id");
  CREATE INDEX "community_invites_email_idx" ON "community_invites" USING btree ("email");
  CREATE INDEX "community_invites_active_idx" ON "community_invites" USING btree ("active");
  CREATE INDEX "community_invites_updated_at_idx" ON "community_invites" USING btree ("updated_at");
  CREATE INDEX "community_invites_created_at_idx" ON "community_invites" USING btree ("created_at");
  CREATE UNIQUE INDEX "community_email_idx" ON "community_invites" USING btree ("community_id","email");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_community_invites_fk" FOREIGN KEY ("community_invites_id") REFERENCES "public"."community_invites"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "community_slug_idx" ON "reading_plans" USING btree ("community_id","slug");
  CREATE UNIQUE INDEX "community_slug_1_idx" ON "songs" USING btree ("community_id","slug");
  CREATE UNIQUE INDEX "community_slug_2_idx" ON "sermons" USING btree ("community_id","slug");
  CREATE UNIQUE INDEX "community_slug_3_idx" ON "books" USING btree ("community_id","slug");
  CREATE UNIQUE INDEX "community_slug_4_idx" ON "commentaries" USING btree ("community_id","slug");
  CREATE INDEX "payload_locked_documents_rels_community_invites_id_idx" ON "payload_locked_documents_rels" USING btree ("community_invites_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_community_invites_fk";
  DROP INDEX "community_slug_idx";
  DROP INDEX "community_slug_1_idx";
  DROP INDEX "community_slug_2_idx";
  DROP INDEX "community_slug_3_idx";
  DROP INDEX "community_slug_4_idx";
  DROP INDEX "payload_locked_documents_rels_community_invites_id_idx";
  ALTER TABLE "communities" DROP COLUMN "join_policy";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "community_invites_id";
  ALTER TABLE "community_invites" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "community_invites" CASCADE;
  DROP TYPE "public"."enum_communities_join_policy";
  DROP TYPE "public"."enum_community_invites_role";`)
}
