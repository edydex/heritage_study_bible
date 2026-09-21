import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`CREATE TYPE "enum_songs_default_song_language" AS ENUM ('ru', 'en');
    ALTER TABLE "songs" ADD COLUMN "default_song_language" "enum_songs_default_song_language" DEFAULT 'ru' NOT NULL;`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "songs" DROP COLUMN "default_song_language"; DROP TYPE "enum_songs_default_song_language";`)
}
