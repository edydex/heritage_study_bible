import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_songs_rights_status" ADD VALUE IF NOT EXISTS 'community-translation';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // PostgreSQL cannot safely remove one enum value in place.
}
