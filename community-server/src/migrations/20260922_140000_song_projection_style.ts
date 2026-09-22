import {sql,type MigrateUpArgs,type MigrateDownArgs} from '@payloadcms/db-postgres'
export async function up({db}:MigrateUpArgs):Promise<void>{await db.execute(sql`ALTER TABLE songs ADD COLUMN projection_style jsonb;`)}
export async function down({db}:MigrateDownArgs):Promise<void>{await db.execute(sql`ALTER TABLE songs DROP COLUMN projection_style;`)}
