import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Sign-up forms on events and the people who signed up. Additive only: the
// existing events table gains one nullable column.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "registration" jsonb;
    CREATE TYPE "enum_event_registrations_status" AS ENUM ('confirmed','waitlisted','cancelled');
    CREATE TABLE "event_registrations" (
      "id" serial PRIMARY KEY,
      "community_id" integer NOT NULL REFERENCES "communities"("id") ON DELETE RESTRICT,
      "event_id" integer NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
      "status" "enum_event_registrations_status" NOT NULL DEFAULT 'confirmed',
      "name" varchar NOT NULL,
      "email" varchar NOT NULL,
      "phone" varchar,
      "party_size" numeric NOT NULL DEFAULT 1 CHECK ("party_size" >= 1),
      "answers" jsonb,
      "amount_due_cents" numeric CHECK ("amount_due_cents" IS NULL OR "amount_due_cents" >= 0),
      "paid" boolean DEFAULT false,
      "paid_note" varchar,
      "user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
      "language" varchar,
      "manage_token_hash" varchar,
      "confirmation_sent_at" timestamp(3) with time zone,
      "cancelled_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX "event_registrations_community_idx" ON "event_registrations" ("community_id");
    CREATE INDEX "event_registrations_event_idx" ON "event_registrations" ("event_id");
    CREATE INDEX "event_registrations_status_idx" ON "event_registrations" ("status");
    CREATE INDEX "event_registrations_email_idx" ON "event_registrations" ("email");
    CREATE INDEX "event_registrations_user_idx" ON "event_registrations" ("user_id");
    CREATE UNIQUE INDEX "event_registrations_manage_token_hash_idx" ON "event_registrations" ("manage_token_hash");
    CREATE INDEX "event_registrations_updated_at_idx" ON "event_registrations" ("updated_at");
    CREATE INDEX "event_registrations_created_at_idx" ON "event_registrations" ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "event_registrations_id" integer REFERENCES "event_registrations"("id") ON DELETE CASCADE;
    CREATE INDEX "payload_locked_documents_rels_event_registrations_id_idx" ON "payload_locked_documents_rels" ("event_registrations_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "event_registrations_id";
    DROP TABLE IF EXISTS "event_registrations";
    DROP TYPE IF EXISTS "enum_event_registrations_status";
    ALTER TABLE "events" DROP COLUMN IF EXISTS "registration";
  `)
}
