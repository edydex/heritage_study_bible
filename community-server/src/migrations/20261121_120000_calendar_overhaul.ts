import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Calendar overhaul: all-day events, changes to single dates of a repeating
// event, church-wide defaults for new events, and the members' calendar
// subscription link version. Additive, plus one cleanup: legacy "PST"/"PDT"
// time zones become America/Los_Angeles, which every browser understands.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "events" ADD COLUMN "all_day" boolean DEFAULT false;
    -- New events take the church's default reminder (which may be "none") instead of a fixed hour.
    ALTER TABLE "events" ALTER COLUMN "default_reminder_minutes" DROP DEFAULT;
    CREATE TABLE "events_exceptions" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
      "id" varchar PRIMARY KEY NOT NULL,
      "date" varchar,
      "cancelled" boolean DEFAULT false,
      "start_time" varchar,
      "end_time" varchar,
      "title" varchar,
      "location" varchar,
      "note" varchar
    );
    CREATE INDEX "events_exceptions_order_idx" ON "events_exceptions" ("_order");
    CREATE INDEX "events_exceptions_parent_id_idx" ON "events_exceptions" ("_parent_id");
    ALTER TABLE "communities" ADD COLUMN "calendar_default_start_time" varchar DEFAULT '10:00';
    ALTER TABLE "communities" ADD COLUMN "calendar_default_duration_minutes" numeric DEFAULT 60;
    ALTER TABLE "communities" ADD COLUMN "calendar_default_reminder_minutes" numeric DEFAULT 60;
    ALTER TABLE "communities" ADD COLUMN "calendar_default_location" varchar;
    ALTER TABLE "communities" ADD COLUMN "calendar_feed_version" numeric DEFAULT 1;
    UPDATE "events" SET "time_zone" = 'America/Los_Angeles' WHERE upper("time_zone") IN ('PST', 'PDT');
    UPDATE "communities" SET "time_zone" = 'America/Los_Angeles' WHERE upper("time_zone") IN ('PST', 'PDT');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "events_exceptions";
    ALTER TABLE "events" ALTER COLUMN "default_reminder_minutes" SET DEFAULT 60;
    ALTER TABLE "events" DROP COLUMN IF EXISTS "all_day";
    ALTER TABLE "communities" DROP COLUMN IF EXISTS "calendar_default_start_time";
    ALTER TABLE "communities" DROP COLUMN IF EXISTS "calendar_default_duration_minutes";
    ALTER TABLE "communities" DROP COLUMN IF EXISTS "calendar_default_reminder_minutes";
    ALTER TABLE "communities" DROP COLUMN IF EXISTS "calendar_default_location";
    ALTER TABLE "communities" DROP COLUMN IF EXISTS "calendar_feed_version";
  `)
}
