import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "community_invites" ADD COLUMN "send_email_now" boolean DEFAULT true;
  ALTER TABLE "community_invites" ADD COLUMN "email_sent_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "community_invites" DROP COLUMN "send_email_now";
  ALTER TABLE "community_invites" DROP COLUMN "email_sent_at";`)
}
