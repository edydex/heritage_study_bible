import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'
import { backfillPeopleFromMemberships } from '../lib/peopleAccounts'

// The church directory: people (with or without an account) and households.
// Additive only. Existing members each receive a profile linked to their account.
// The directory belongs to its church: removing a church (possible only after
// its memberships are gone) removes its people and households too.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "enum_people_status" AS ENUM ('member','attender','visitor','inactive');
    CREATE TYPE "enum_people_gender" AS ENUM ('male','female');
    CREATE TYPE "enum_people_household_role" AS ENUM ('head','spouse','child','other');
    CREATE TABLE "households" (
      "id" serial PRIMARY KEY,
      "community_id" integer NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE,
      "name" varchar NOT NULL,
      "phone" varchar,
      "address_street" varchar,
      "address_unit" varchar,
      "address_city" varchar,
      "address_region" varchar,
      "address_postal_code" varchar,
      "address_country" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX "households_community_idx" ON "households" ("community_id");
    CREATE INDEX "households_updated_at_idx" ON "households" ("updated_at");
    CREATE INDEX "households_created_at_idx" ON "households" ("created_at");
    CREATE TABLE "people" (
      "id" serial PRIMARY KEY,
      "community_id" integer NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE,
      "first_name" varchar NOT NULL,
      "last_name" varchar,
      "preferred_name" varchar,
      "full_name" varchar NOT NULL,
      "status" "enum_people_status" NOT NULL DEFAULT 'member',
      "gender" "enum_people_gender",
      "household_id" integer REFERENCES "households"("id") ON DELETE SET NULL,
      "household_role" "enum_people_household_role",
      "email" varchar,
      "phone" varchar,
      "birth_date" varchar,
      "member_since" varchar,
      "baptism_date" varchar,
      "user_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
      "notes" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX "people_community_idx" ON "people" ("community_id");
    CREATE INDEX "people_full_name_idx" ON "people" ("full_name");
    CREATE INDEX "people_household_idx" ON "people" ("household_id");
    CREATE INDEX "people_user_idx" ON "people" ("user_id");
    CREATE INDEX "people_email_lower_idx" ON "people" (lower("email"));
    CREATE UNIQUE INDEX "people_community_user_idx" ON "people" ("community_id","user_id");
    CREATE INDEX "people_updated_at_idx" ON "people" ("updated_at");
    CREATE INDEX "people_created_at_idx" ON "people" ("created_at");
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "people_id" integer REFERENCES "people"("id") ON DELETE CASCADE;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "households_id" integer REFERENCES "households"("id") ON DELETE CASCADE;
    CREATE INDEX "payload_locked_documents_rels_people_id_idx" ON "payload_locked_documents_rels" ("people_id");
    CREATE INDEX "payload_locked_documents_rels_households_id_idx" ON "payload_locked_documents_rels" ("households_id");
  `)
  await backfillPeopleFromMemberships(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "people_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "households_id";
    DROP TABLE IF EXISTS "people";
    DROP TABLE IF EXISTS "households";
    DROP TYPE IF EXISTS "enum_people_household_role";
    DROP TYPE IF EXISTS "enum_people_gender";
    DROP TYPE IF EXISTS "enum_people_status";
  `)
}
