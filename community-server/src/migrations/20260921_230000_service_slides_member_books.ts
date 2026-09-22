import {sql, type MigrateUpArgs, type MigrateDownArgs} from '@payloadcms/db-postgres'
export async function up({db}:MigrateUpArgs):Promise<void> {
 await db.execute(sql`ALTER TABLE communities ADD COLUMN presentation_slides jsonb;
 CREATE TYPE enum_books_visibility AS ENUM ('members','public');
 ALTER TABLE books ADD COLUMN visibility enum_books_visibility DEFAULT 'members' NOT NULL;
 ALTER TABLE books ADD COLUMN read_along jsonb;
 UPDATE books SET visibility='public';`)
}
export async function down({db}:MigrateDownArgs):Promise<void> {
 await db.execute(sql`ALTER TABLE communities DROP COLUMN presentation_slides; ALTER TABLE books DROP COLUMN visibility; ALTER TABLE books DROP COLUMN read_along; DROP TYPE enum_books_visibility;`)
}
