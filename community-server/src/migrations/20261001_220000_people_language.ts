import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_users_preferred_language" AS ENUM ('en', 'ru');
    CREATE TYPE "public"."enum_community_invites_preferred_language" AS ENUM ('en', 'ru');
    ALTER TABLE "users" ADD COLUMN "preferred_language" "enum_users_preferred_language" DEFAULT 'en';
    ALTER TABLE "community_invites" ADD COLUMN "preferred_language" "enum_community_invites_preferred_language" DEFAULT 'en';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "community_invites" DROP COLUMN "preferred_language";
    ALTER TABLE "users" DROP COLUMN "preferred_language";
    DROP TYPE "public"."enum_community_invites_preferred_language";
    DROP TYPE "public"."enum_users_preferred_language";
  `)
}
