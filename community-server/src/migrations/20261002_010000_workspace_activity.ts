import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "enum_workspace_activity_screen" AS ENUM ('home','planner','sermon','publication','songs','people','translation','media','scripture','library','account');
    CREATE TABLE "workspace_activity" (
      "id" serial PRIMARY KEY, "community_id" integer NOT NULL REFERENCES "communities"("id") ON DELETE RESTRICT,
      "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "screen" "enum_workspace_activity_screen" NOT NULL,
      "last_navigation_at" timestamp(3) with time zone NOT NULL, "last_active_at" timestamp(3) with time zone NOT NULL,
      "navigation_count" numeric NOT NULL DEFAULT 1,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL, "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX "workspace_activity_community_user_idx" ON "workspace_activity" ("community_id","user_id");
    CREATE INDEX "workspace_activity_community_idx" ON "workspace_activity" ("community_id");
    CREATE INDEX "workspace_activity_user_idx" ON "workspace_activity" ("user_id");
    CREATE INDEX "workspace_activity_last_active_at_idx" ON "workspace_activity" ("last_active_at");
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "workspace_activity_id" integer REFERENCES "workspace_activity"("id") ON DELETE CASCADE;
  `)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "workspace_activity_id"; DROP TABLE "workspace_activity"; DROP TYPE "enum_workspace_activity_screen";`)
}
