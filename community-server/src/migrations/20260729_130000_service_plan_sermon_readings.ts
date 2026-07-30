import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "service_plans_entries"
      ADD COLUMN "scripture_sermon_reading_sermon_id" integer;
    ALTER TABLE "service_plans_entries"
      ADD COLUMN "scripture_sermon_reading_reference_id" varchar;
    ALTER TABLE "service_plans_entries"
      ADD CONSTRAINT "service_plans_entries_scripture_sermon_reading_sermon_id_sermons_id_fk"
      FOREIGN KEY ("scripture_sermon_reading_sermon_id")
      REFERENCES "public"."sermons"("id")
      ON DELETE set null ON UPDATE no action;
    CREATE INDEX "service_plans_entries_scripture_sermon_reading_scripture_idx"
      ON "service_plans_entries"
      USING btree ("scripture_sermon_reading_sermon_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "service_plans_entries"
      DROP CONSTRAINT "service_plans_entries_scripture_sermon_reading_sermon_id_sermons_id_fk";
    DROP INDEX "service_plans_entries_scripture_sermon_reading_scripture_idx";
    ALTER TABLE "service_plans_entries"
      DROP COLUMN "scripture_sermon_reading_sermon_id";
    ALTER TABLE "service_plans_entries"
      DROP COLUMN "scripture_sermon_reading_reference_id";
  `)
}
