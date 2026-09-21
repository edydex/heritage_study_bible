import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "service_documents" ADD COLUMN "translation_plan" jsonb;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "service_documents" DROP COLUMN "translation_plan";`)
}
