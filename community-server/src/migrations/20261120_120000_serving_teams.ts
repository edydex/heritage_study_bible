import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Volunteer scheduling: teams with positions and members, people scheduled for
// one date of a calendar service, and dates people are away. Additive only.
// Schedules belong to their church, service, team and person: removing any of
// them removes the matching schedule rows too.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "enum_serving_assignments_status" AS ENUM ('pending','accepted','declined');
    ALTER TABLE "people" ADD COLUMN "serving_link_version" numeric DEFAULT 1;
    CREATE TABLE "teams" (
      "id" serial PRIMARY KEY,
      "community_id" integer NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE,
      "name" varchar NOT NULL,
      "description" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX "teams_community_idx" ON "teams" ("community_id");
    CREATE INDEX "teams_updated_at_idx" ON "teams" ("updated_at");
    CREATE INDEX "teams_created_at_idx" ON "teams" ("created_at");
    CREATE TABLE "teams_positions" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
      "id" varchar PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "needed" numeric DEFAULT 1 NOT NULL
    );
    CREATE INDEX "teams_positions_order_idx" ON "teams_positions" ("_order");
    CREATE INDEX "teams_positions_parent_id_idx" ON "teams_positions" ("_parent_id");
    CREATE TABLE "teams_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
      "path" varchar NOT NULL,
      "people_id" integer REFERENCES "people"("id") ON DELETE CASCADE
    );
    CREATE INDEX "teams_rels_order_idx" ON "teams_rels" ("order");
    CREATE INDEX "teams_rels_parent_idx" ON "teams_rels" ("parent_id");
    CREATE INDEX "teams_rels_path_idx" ON "teams_rels" ("path");
    CREATE INDEX "teams_rels_people_id_idx" ON "teams_rels" ("people_id");
    CREATE TABLE "serving_assignments" (
      "id" serial PRIMARY KEY,
      "community_id" integer NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE,
      "event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
      "date" varchar NOT NULL,
      "team_id" integer NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
      "position_id" varchar NOT NULL,
      "position" varchar NOT NULL,
      "person_id" integer NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
      "status" "enum_serving_assignments_status" DEFAULT 'pending' NOT NULL,
      "note" varchar,
      "requested_at" timestamp(3) with time zone,
      "responded_at" timestamp(3) with time zone,
      "scheduled_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX "serving_assignments_community_idx" ON "serving_assignments" ("community_id");
    CREATE INDEX "serving_assignments_event_idx" ON "serving_assignments" ("event_id");
    CREATE INDEX "serving_assignments_date_idx" ON "serving_assignments" ("date");
    CREATE INDEX "serving_assignments_team_idx" ON "serving_assignments" ("team_id");
    CREATE INDEX "serving_assignments_person_idx" ON "serving_assignments" ("person_id");
    CREATE INDEX "serving_assignments_status_idx" ON "serving_assignments" ("status");
    CREATE INDEX "serving_assignments_scheduled_by_idx" ON "serving_assignments" ("scheduled_by_id");
    CREATE INDEX "serving_assignments_updated_at_idx" ON "serving_assignments" ("updated_at");
    CREATE INDEX "serving_assignments_created_at_idx" ON "serving_assignments" ("created_at");
    CREATE UNIQUE INDEX "serving_assignments_event_date_team_position_id_person_idx"
      ON "serving_assignments" ("event_id","date","team_id","position_id","person_id");
    CREATE TABLE "serving_blockouts" (
      "id" serial PRIMARY KEY,
      "community_id" integer NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE,
      "person_id" integer NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
      "start_date" varchar NOT NULL,
      "end_date" varchar NOT NULL,
      "reason" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX "serving_blockouts_community_idx" ON "serving_blockouts" ("community_id");
    CREATE INDEX "serving_blockouts_person_idx" ON "serving_blockouts" ("person_id");
    CREATE INDEX "serving_blockouts_start_date_idx" ON "serving_blockouts" ("start_date");
    CREATE INDEX "serving_blockouts_end_date_idx" ON "serving_blockouts" ("end_date");
    CREATE INDEX "serving_blockouts_updated_at_idx" ON "serving_blockouts" ("updated_at");
    CREATE INDEX "serving_blockouts_created_at_idx" ON "serving_blockouts" ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "teams_id" integer REFERENCES "teams"("id") ON DELETE CASCADE;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "serving_assignments_id" integer REFERENCES "serving_assignments"("id") ON DELETE CASCADE;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "serving_blockouts_id" integer REFERENCES "serving_blockouts"("id") ON DELETE CASCADE;
    CREATE INDEX "payload_locked_documents_rels_teams_id_idx" ON "payload_locked_documents_rels" ("teams_id");
    CREATE INDEX "payload_locked_documents_rels_serving_assignments_id_idx" ON "payload_locked_documents_rels" ("serving_assignments_id");
    CREATE INDEX "payload_locked_documents_rels_serving_blockouts_id_idx" ON "payload_locked_documents_rels" ("serving_blockouts_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "teams_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "serving_assignments_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "serving_blockouts_id";
    DROP TABLE IF EXISTS "serving_blockouts";
    DROP TABLE IF EXISTS "serving_assignments";
    DROP TABLE IF EXISTS "teams_rels";
    DROP TABLE IF EXISTS "teams_positions";
    DROP TABLE IF EXISTS "teams";
    DROP TYPE IF EXISTS "enum_serving_assignments_status";
    ALTER TABLE "people" DROP COLUMN IF EXISTS "serving_link_version";
  `)
}
