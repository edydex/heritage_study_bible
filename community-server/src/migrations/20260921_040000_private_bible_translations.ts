import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "bible_translations" (
      "id" serial PRIMARY KEY NOT NULL,
      "community_id" integer NOT NULL REFERENCES "communities"("id") ON DELETE restrict,
      "translation_id" varchar NOT NULL, "name" varchar NOT NULL,
      "language" varchar NOT NULL, "edition" varchar NOT NULL,
      "attribution" varchar NOT NULL, "source_url" varchar NOT NULL,
      "license" varchar NOT NULL, "digest" varchar NOT NULL,
      "book_count" numeric NOT NULL, "chapter_count" numeric NOT NULL, "verse_count" numeric NOT NULL,
      "document_source" varchar NOT NULL,
      "permission_confirmed" boolean NOT NULL,
      "permission_reference" varchar NOT NULL,
      "installed_by_id" integer NOT NULL REFERENCES "users"("id") ON DELETE restrict,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "bible_translations_digest_check" CHECK (
        digest ~ '^[0-9a-f]{64}$' AND encode(sha256(convert_to(document_source, 'UTF8')), 'hex') = digest),
      CONSTRAINT "bible_translations_permission_check" CHECK (permission_confirmed = true AND length(trim(permission_reference)) > 0)
    );
    CREATE UNIQUE INDEX "bible_translations_community_translation_id_idx" ON "bible_translations" ("community_id", "translation_id");
    CREATE INDEX "bible_translations_community_idx" ON "bible_translations" ("community_id");
    CREATE INDEX "bible_translations_installed_by_idx" ON "bible_translations" ("installed_by_id");
    CREATE INDEX "bible_translations_updated_at_idx" ON "bible_translations" ("updated_at");
    CREATE INDEX "bible_translations_created_at_idx" ON "bible_translations" ("created_at");
  `)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE "bible_translations";`)
}
