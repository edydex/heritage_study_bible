import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_system_role" AS ENUM('system-admin', 'member');
  CREATE TYPE "public"."enum_memberships_role" AS ENUM('owner', 'admin', 'leader', 'member');
  CREATE TYPE "public"."enum_media_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_reading_plans_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE "public"."enum_songs_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE "public"."enum_sermons_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE "public"."enum_books_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE "public"."enum_commentaries_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE "public"."enum_plan_cohorts_default_note_visibility" AS ENUM('shared', 'private', 'leaders');
  CREATE TYPE "public"."enum_plan_notes_visibility" AS ENUM('shared', 'private', 'leaders');
  CREATE TYPE "public"."enum_event_rsvps_response" AS ENUM('going', 'maybe', 'not-going');
  CREATE TABLE "users_sessions" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "created_at" timestamp(3) with time zone,
    "expires_at" timestamp(3) with time zone NOT NULL
  );

  CREATE TABLE "users" (
    "id" serial PRIMARY KEY NOT NULL,
    "display_name" varchar DEFAULT 'Reader' NOT NULL,
    "system_role" "enum_users_system_role" DEFAULT 'member' NOT NULL,
    "magic_link_token_hash" varchar,
    "magic_link_expires_at" timestamp(3) with time zone,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "email" varchar NOT NULL,
    "reset_password_token" varchar,
    "reset_password_expiration" timestamp(3) with time zone,
    "salt" varchar,
    "hash" varchar,
    "login_attempts" numeric DEFAULT 0,
    "lock_until" timestamp(3) with time zone
  );

  CREATE TABLE "community_sessions" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "token_hash" varchar NOT NULL,
    "expires_at" timestamp(3) with time zone NOT NULL,
    "revoked_at" timestamp(3) with time zone,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "communities" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar NOT NULL,
    "slug" varchar NOT NULL,
    "description" varchar,
    "website" varchar,
    "logo_id" integer,
    "time_zone" varchar DEFAULT 'UTC' NOT NULL,
    "allow_directory_listing" boolean DEFAULT false,
    "content_server_enabled" boolean DEFAULT true,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "memberships" (
    "id" serial PRIMARY KEY NOT NULL,
    "community_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "role" "enum_memberships_role" DEFAULT 'member' NOT NULL,
    "joined_at" timestamp(3) with time zone NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "media" (
    "id" serial PRIMARY KEY NOT NULL,
    "community_id" integer NOT NULL,
    "status" "enum_media_status" DEFAULT 'published',
    "alt" varchar,
    "credit" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "url" varchar,
    "thumbnail_u_r_l" varchar,
    "filename" varchar,
    "mime_type" varchar,
    "filesize" numeric,
    "width" numeric,
    "height" numeric,
    "focal_x" numeric,
    "focal_y" numeric
  );

  CREATE TABLE "reading_plans_blocks_plan_passage" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "passage" varchar NOT NULL,
    "block_name" varchar
  );

  CREATE TABLE "reading_plans_blocks_plan_note_sources" (
    "_order" integer NOT NULL,
    "_parent_id" varchar NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "title" varchar NOT NULL,
    "url" varchar NOT NULL
  );

  CREATE TABLE "reading_plans_blocks_plan_note" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "key" varchar NOT NULL,
    "title" varchar NOT NULL,
    "text" varchar NOT NULL,
    "block_name" varchar
  );

  CREATE TABLE "reading_plans_days" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "label" varchar
  );

  CREATE TABLE "reading_plans" (
    "id" serial PRIMARY KEY NOT NULL,
    "community_id" integer NOT NULL,
    "status" "enum_reading_plans_status" DEFAULT 'draft' NOT NULL,
    "title" varchar NOT NULL,
    "slug" varchar NOT NULL,
    "description" varchar,
    "revision" varchar DEFAULT '1' NOT NULL,
    "total_days" numeric NOT NULL,
    "plan_data" jsonb NOT NULL,
    "license" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "reading_plans_texts" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer NOT NULL,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "text" varchar
  );

  CREATE TABLE "songs" (
    "id" serial PRIMARY KEY NOT NULL,
    "community_id" integer NOT NULL,
    "status" "enum_songs_status" DEFAULT 'draft' NOT NULL,
    "title" varchar NOT NULL,
    "slug" varchar NOT NULL,
    "description" varchar,
    "lyrics" varchar NOT NULL,
    "chord_sheet" varchar,
    "key" varchar,
    "tempo" numeric,
    "copyright" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "songs_texts" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer NOT NULL,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "text" varchar
  );

  CREATE TABLE "songs_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "media_id" integer
  );

  CREATE TABLE "sermons" (
    "id" serial PRIMARY KEY NOT NULL,
    "community_id" integer NOT NULL,
    "status" "enum_sermons_status" DEFAULT 'draft' NOT NULL,
    "title" varchar NOT NULL,
    "slug" varchar NOT NULL,
    "description" varchar,
    "speaker" varchar NOT NULL,
    "preached_at" timestamp(3) with time zone NOT NULL,
    "transcript" varchar,
    "series" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "sermons_texts" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer NOT NULL,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "text" varchar
  );

  CREATE TABLE "sermons_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "media_id" integer
  );

  CREATE TABLE "books" (
    "id" serial PRIMARY KEY NOT NULL,
    "community_id" integer NOT NULL,
    "status" "enum_books_status" DEFAULT 'draft' NOT NULL,
    "title" varchar NOT NULL,
    "slug" varchar NOT NULL,
    "description" varchar,
    "author" varchar NOT NULL,
    "published_year" numeric,
    "body" jsonb,
    "license" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "books_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "media_id" integer
  );

  CREATE TABLE "commentaries" (
    "id" serial PRIMARY KEY NOT NULL,
    "community_id" integer NOT NULL,
    "status" "enum_commentaries_status" DEFAULT 'draft' NOT NULL,
    "title" varchar NOT NULL,
    "slug" varchar NOT NULL,
    "description" varchar,
    "author" varchar NOT NULL,
    "book" varchar NOT NULL,
    "chapter" numeric,
    "verse_start" numeric,
    "verse_end" numeric,
    "body" jsonb NOT NULL,
    "license" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "plan_cohorts" (
    "id" serial PRIMARY KEY NOT NULL,
    "community_id" integer NOT NULL,
    "plan_id" integer NOT NULL,
    "name" varchar NOT NULL,
    "starts_on" timestamp(3) with time zone NOT NULL,
    "ends_on" timestamp(3) with time zone,
    "default_note_visibility" "enum_plan_cohorts_default_note_visibility" DEFAULT 'shared' NOT NULL,
    "active" boolean DEFAULT true,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "plan_notes" (
    "id" serial PRIMARY KEY NOT NULL,
    "community_id" integer NOT NULL,
    "cohort_id" integer NOT NULL,
    "plan_id" integer NOT NULL,
    "day" numeric NOT NULL,
    "author_id" integer NOT NULL,
    "visibility" "enum_plan_notes_visibility" DEFAULT 'shared' NOT NULL,
    "body" varchar NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "events" (
    "id" serial PRIMARY KEY NOT NULL,
    "community_id" integer NOT NULL,
    "title" varchar NOT NULL,
    "description" varchar,
    "starts_at" timestamp(3) with time zone NOT NULL,
    "ends_at" timestamp(3) with time zone,
    "time_zone" varchar DEFAULT 'UTC' NOT NULL,
    "location" varchar,
    "url" varchar,
    "rsvp_enabled" boolean DEFAULT true,
    "default_reminder_minutes" numeric DEFAULT 60,
    "cancelled" boolean DEFAULT false,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "event_rsvps" (
    "id" serial PRIMARY KEY NOT NULL,
    "community_id" integer NOT NULL,
    "event_id" integer NOT NULL,
    "user_id" integer NOT NULL,
    "response" "enum_event_rsvps_response" NOT NULL,
    "guests" numeric DEFAULT 0,
    "note" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "encrypted_sync" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "device_id" varchar NOT NULL,
    "schema_version" numeric NOT NULL,
    "key_id" varchar NOT NULL,
    "salt" varchar NOT NULL,
    "iv" varchar NOT NULL,
    "ciphertext" varchar NOT NULL,
    "content_hash" varchar NOT NULL,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_kv" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar NOT NULL,
    "data" jsonb NOT NULL
  );

  CREATE TABLE "payload_locked_documents" (
    "id" serial PRIMARY KEY NOT NULL,
    "global_slug" varchar,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_locked_documents_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "users_id" integer,
    "community_sessions_id" integer,
    "communities_id" integer,
    "memberships_id" integer,
    "media_id" integer,
    "reading_plans_id" integer,
    "songs_id" integer,
    "sermons_id" integer,
    "books_id" integer,
    "commentaries_id" integer,
    "plan_cohorts_id" integer,
    "plan_notes_id" integer,
    "events_id" integer,
    "event_rsvps_id" integer,
    "encrypted_sync_id" integer
  );

  CREATE TABLE "payload_preferences" (
    "id" serial PRIMARY KEY NOT NULL,
    "key" varchar,
    "value" jsonb,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_preferences_rels" (
    "id" serial PRIMARY KEY NOT NULL,
    "order" integer,
    "parent_id" integer NOT NULL,
    "path" varchar NOT NULL,
    "users_id" integer
  );

  CREATE TABLE "payload_migrations" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar,
    "batch" numeric,
    "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "community_sessions" ADD CONSTRAINT "community_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "communities" ADD CONSTRAINT "communities_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "memberships" ADD CONSTRAINT "memberships_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reading_plans_blocks_plan_passage" ADD CONSTRAINT "reading_plans_blocks_plan_passage_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."reading_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reading_plans_blocks_plan_note_sources" ADD CONSTRAINT "reading_plans_blocks_plan_note_sources_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."reading_plans_blocks_plan_note"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reading_plans_blocks_plan_note" ADD CONSTRAINT "reading_plans_blocks_plan_note_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."reading_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reading_plans_days" ADD CONSTRAINT "reading_plans_days_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."reading_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reading_plans" ADD CONSTRAINT "reading_plans_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reading_plans_texts" ADD CONSTRAINT "reading_plans_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."reading_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "songs" ADD CONSTRAINT "songs_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "songs_texts" ADD CONSTRAINT "songs_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "songs_rels" ADD CONSTRAINT "songs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "songs_rels" ADD CONSTRAINT "songs_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sermons" ADD CONSTRAINT "sermons_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sermons_texts" ADD CONSTRAINT "sermons_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sermons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sermons_rels" ADD CONSTRAINT "sermons_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sermons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sermons_rels" ADD CONSTRAINT "sermons_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "books" ADD CONSTRAINT "books_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "books_rels" ADD CONSTRAINT "books_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "books_rels" ADD CONSTRAINT "books_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "commentaries" ADD CONSTRAINT "commentaries_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "plan_cohorts" ADD CONSTRAINT "plan_cohorts_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "plan_cohorts" ADD CONSTRAINT "plan_cohorts_plan_id_reading_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."reading_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "plan_notes" ADD CONSTRAINT "plan_notes_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "plan_notes" ADD CONSTRAINT "plan_notes_cohort_id_plan_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."plan_cohorts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "plan_notes" ADD CONSTRAINT "plan_notes_plan_id_reading_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."reading_plans"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "plan_notes" ADD CONSTRAINT "plan_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "event_rsvps" ADD CONSTRAINT "event_rsvps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "encrypted_sync" ADD CONSTRAINT "encrypted_sync_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_community_sessions_fk" FOREIGN KEY ("community_sessions_id") REFERENCES "public"."community_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_communities_fk" FOREIGN KEY ("communities_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_memberships_fk" FOREIGN KEY ("memberships_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reading_plans_fk" FOREIGN KEY ("reading_plans_id") REFERENCES "public"."reading_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_songs_fk" FOREIGN KEY ("songs_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sermons_fk" FOREIGN KEY ("sermons_id") REFERENCES "public"."sermons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_books_fk" FOREIGN KEY ("books_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_commentaries_fk" FOREIGN KEY ("commentaries_id") REFERENCES "public"."commentaries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_plan_cohorts_fk" FOREIGN KEY ("plan_cohorts_id") REFERENCES "public"."plan_cohorts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_plan_notes_fk" FOREIGN KEY ("plan_notes_id") REFERENCES "public"."plan_notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_event_rsvps_fk" FOREIGN KEY ("event_rsvps_id") REFERENCES "public"."event_rsvps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_encrypted_sync_fk" FOREIGN KEY ("encrypted_sync_id") REFERENCES "public"."encrypted_sync"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_magic_link_token_hash_idx" ON "users" USING btree ("magic_link_token_hash");
  CREATE INDEX "users_magic_link_expires_at_idx" ON "users" USING btree ("magic_link_expires_at");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "community_sessions_user_idx" ON "community_sessions" USING btree ("user_id");
  CREATE UNIQUE INDEX "community_sessions_token_hash_idx" ON "community_sessions" USING btree ("token_hash");
  CREATE INDEX "community_sessions_expires_at_idx" ON "community_sessions" USING btree ("expires_at");
  CREATE INDEX "community_sessions_revoked_at_idx" ON "community_sessions" USING btree ("revoked_at");
  CREATE INDEX "community_sessions_updated_at_idx" ON "community_sessions" USING btree ("updated_at");
  CREATE INDEX "community_sessions_created_at_idx" ON "community_sessions" USING btree ("created_at");
  CREATE UNIQUE INDEX "communities_slug_idx" ON "communities" USING btree ("slug");
  CREATE INDEX "communities_logo_idx" ON "communities" USING btree ("logo_id");
  CREATE INDEX "communities_updated_at_idx" ON "communities" USING btree ("updated_at");
  CREATE INDEX "communities_created_at_idx" ON "communities" USING btree ("created_at");
  CREATE INDEX "memberships_community_idx" ON "memberships" USING btree ("community_id");
  CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");
  CREATE INDEX "memberships_updated_at_idx" ON "memberships" USING btree ("updated_at");
  CREATE INDEX "memberships_created_at_idx" ON "memberships" USING btree ("created_at");
  CREATE UNIQUE INDEX "community_user_idx" ON "memberships" USING btree ("community_id","user_id");
  CREATE INDEX "media_community_idx" ON "media" USING btree ("community_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "reading_plans_blocks_plan_passage_order_idx" ON "reading_plans_blocks_plan_passage" USING btree ("_order");
  CREATE INDEX "reading_plans_blocks_plan_passage_parent_id_idx" ON "reading_plans_blocks_plan_passage" USING btree ("_parent_id");
  CREATE INDEX "reading_plans_blocks_plan_passage_path_idx" ON "reading_plans_blocks_plan_passage" USING btree ("_path");
  CREATE INDEX "reading_plans_blocks_plan_note_sources_order_idx" ON "reading_plans_blocks_plan_note_sources" USING btree ("_order");
  CREATE INDEX "reading_plans_blocks_plan_note_sources_parent_id_idx" ON "reading_plans_blocks_plan_note_sources" USING btree ("_parent_id");
  CREATE INDEX "reading_plans_blocks_plan_note_order_idx" ON "reading_plans_blocks_plan_note" USING btree ("_order");
  CREATE INDEX "reading_plans_blocks_plan_note_parent_id_idx" ON "reading_plans_blocks_plan_note" USING btree ("_parent_id");
  CREATE INDEX "reading_plans_blocks_plan_note_path_idx" ON "reading_plans_blocks_plan_note" USING btree ("_path");
  CREATE INDEX "reading_plans_days_order_idx" ON "reading_plans_days" USING btree ("_order");
  CREATE INDEX "reading_plans_days_parent_id_idx" ON "reading_plans_days" USING btree ("_parent_id");
  CREATE INDEX "reading_plans_community_idx" ON "reading_plans" USING btree ("community_id");
  CREATE INDEX "reading_plans_status_idx" ON "reading_plans" USING btree ("status");
  CREATE INDEX "reading_plans_slug_idx" ON "reading_plans" USING btree ("slug");
  CREATE INDEX "reading_plans_updated_at_idx" ON "reading_plans" USING btree ("updated_at");
  CREATE INDEX "reading_plans_created_at_idx" ON "reading_plans" USING btree ("created_at");
  CREATE INDEX "reading_plans_texts_order_parent" ON "reading_plans_texts" USING btree ("order","parent_id");
  CREATE INDEX "songs_community_idx" ON "songs" USING btree ("community_id");
  CREATE INDEX "songs_status_idx" ON "songs" USING btree ("status");
  CREATE INDEX "songs_slug_idx" ON "songs" USING btree ("slug");
  CREATE INDEX "songs_updated_at_idx" ON "songs" USING btree ("updated_at");
  CREATE INDEX "songs_created_at_idx" ON "songs" USING btree ("created_at");
  CREATE INDEX "songs_texts_order_parent" ON "songs_texts" USING btree ("order","parent_id");
  CREATE INDEX "songs_rels_order_idx" ON "songs_rels" USING btree ("order");
  CREATE INDEX "songs_rels_parent_idx" ON "songs_rels" USING btree ("parent_id");
  CREATE INDEX "songs_rels_path_idx" ON "songs_rels" USING btree ("path");
  CREATE INDEX "songs_rels_media_id_idx" ON "songs_rels" USING btree ("media_id");
  CREATE INDEX "sermons_community_idx" ON "sermons" USING btree ("community_id");
  CREATE INDEX "sermons_status_idx" ON "sermons" USING btree ("status");
  CREATE INDEX "sermons_slug_idx" ON "sermons" USING btree ("slug");
  CREATE INDEX "sermons_updated_at_idx" ON "sermons" USING btree ("updated_at");
  CREATE INDEX "sermons_created_at_idx" ON "sermons" USING btree ("created_at");
  CREATE INDEX "sermons_texts_order_parent" ON "sermons_texts" USING btree ("order","parent_id");
  CREATE INDEX "sermons_rels_order_idx" ON "sermons_rels" USING btree ("order");
  CREATE INDEX "sermons_rels_parent_idx" ON "sermons_rels" USING btree ("parent_id");
  CREATE INDEX "sermons_rels_path_idx" ON "sermons_rels" USING btree ("path");
  CREATE INDEX "sermons_rels_media_id_idx" ON "sermons_rels" USING btree ("media_id");
  CREATE INDEX "books_community_idx" ON "books" USING btree ("community_id");
  CREATE INDEX "books_status_idx" ON "books" USING btree ("status");
  CREATE INDEX "books_slug_idx" ON "books" USING btree ("slug");
  CREATE INDEX "books_updated_at_idx" ON "books" USING btree ("updated_at");
  CREATE INDEX "books_created_at_idx" ON "books" USING btree ("created_at");
  CREATE INDEX "books_rels_order_idx" ON "books_rels" USING btree ("order");
  CREATE INDEX "books_rels_parent_idx" ON "books_rels" USING btree ("parent_id");
  CREATE INDEX "books_rels_path_idx" ON "books_rels" USING btree ("path");
  CREATE INDEX "books_rels_media_id_idx" ON "books_rels" USING btree ("media_id");
  CREATE INDEX "commentaries_community_idx" ON "commentaries" USING btree ("community_id");
  CREATE INDEX "commentaries_status_idx" ON "commentaries" USING btree ("status");
  CREATE INDEX "commentaries_slug_idx" ON "commentaries" USING btree ("slug");
  CREATE INDEX "commentaries_book_idx" ON "commentaries" USING btree ("book");
  CREATE INDEX "commentaries_chapter_idx" ON "commentaries" USING btree ("chapter");
  CREATE INDEX "commentaries_updated_at_idx" ON "commentaries" USING btree ("updated_at");
  CREATE INDEX "commentaries_created_at_idx" ON "commentaries" USING btree ("created_at");
  CREATE INDEX "plan_cohorts_community_idx" ON "plan_cohorts" USING btree ("community_id");
  CREATE INDEX "plan_cohorts_plan_idx" ON "plan_cohorts" USING btree ("plan_id");
  CREATE INDEX "plan_cohorts_updated_at_idx" ON "plan_cohorts" USING btree ("updated_at");
  CREATE INDEX "plan_cohorts_created_at_idx" ON "plan_cohorts" USING btree ("created_at");
  CREATE INDEX "plan_notes_community_idx" ON "plan_notes" USING btree ("community_id");
  CREATE INDEX "plan_notes_cohort_idx" ON "plan_notes" USING btree ("cohort_id");
  CREATE INDEX "plan_notes_plan_idx" ON "plan_notes" USING btree ("plan_id");
  CREATE INDEX "plan_notes_day_idx" ON "plan_notes" USING btree ("day");
  CREATE INDEX "plan_notes_author_idx" ON "plan_notes" USING btree ("author_id");
  CREATE INDEX "plan_notes_updated_at_idx" ON "plan_notes" USING btree ("updated_at");
  CREATE INDEX "plan_notes_created_at_idx" ON "plan_notes" USING btree ("created_at");
  CREATE INDEX "events_community_idx" ON "events" USING btree ("community_id");
  CREATE INDEX "events_starts_at_idx" ON "events" USING btree ("starts_at");
  CREATE INDEX "events_updated_at_idx" ON "events" USING btree ("updated_at");
  CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");
  CREATE INDEX "event_rsvps_community_idx" ON "event_rsvps" USING btree ("community_id");
  CREATE INDEX "event_rsvps_event_idx" ON "event_rsvps" USING btree ("event_id");
  CREATE INDEX "event_rsvps_user_idx" ON "event_rsvps" USING btree ("user_id");
  CREATE INDEX "event_rsvps_updated_at_idx" ON "event_rsvps" USING btree ("updated_at");
  CREATE INDEX "event_rsvps_created_at_idx" ON "event_rsvps" USING btree ("created_at");
  CREATE UNIQUE INDEX "event_user_idx" ON "event_rsvps" USING btree ("event_id","user_id");
  CREATE INDEX "encrypted_sync_user_idx" ON "encrypted_sync" USING btree ("user_id");
  CREATE INDEX "encrypted_sync_device_id_idx" ON "encrypted_sync" USING btree ("device_id");
  CREATE INDEX "encrypted_sync_updated_at_idx" ON "encrypted_sync" USING btree ("updated_at");
  CREATE INDEX "encrypted_sync_created_at_idx" ON "encrypted_sync" USING btree ("created_at");
  CREATE UNIQUE INDEX "user_deviceId_idx" ON "encrypted_sync" USING btree ("user_id","device_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_community_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("community_sessions_id");
  CREATE INDEX "payload_locked_documents_rels_communities_id_idx" ON "payload_locked_documents_rels" USING btree ("communities_id");
  CREATE INDEX "payload_locked_documents_rels_memberships_id_idx" ON "payload_locked_documents_rels" USING btree ("memberships_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_reading_plans_id_idx" ON "payload_locked_documents_rels" USING btree ("reading_plans_id");
  CREATE INDEX "payload_locked_documents_rels_songs_id_idx" ON "payload_locked_documents_rels" USING btree ("songs_id");
  CREATE INDEX "payload_locked_documents_rels_sermons_id_idx" ON "payload_locked_documents_rels" USING btree ("sermons_id");
  CREATE INDEX "payload_locked_documents_rels_books_id_idx" ON "payload_locked_documents_rels" USING btree ("books_id");
  CREATE INDEX "payload_locked_documents_rels_commentaries_id_idx" ON "payload_locked_documents_rels" USING btree ("commentaries_id");
  CREATE INDEX "payload_locked_documents_rels_plan_cohorts_id_idx" ON "payload_locked_documents_rels" USING btree ("plan_cohorts_id");
  CREATE INDEX "payload_locked_documents_rels_plan_notes_id_idx" ON "payload_locked_documents_rels" USING btree ("plan_notes_id");
  CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");
  CREATE INDEX "payload_locked_documents_rels_event_rsvps_id_idx" ON "payload_locked_documents_rels" USING btree ("event_rsvps_id");
  CREATE INDEX "payload_locked_documents_rels_encrypted_sync_id_idx" ON "payload_locked_documents_rels" USING btree ("encrypted_sync_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "community_sessions" CASCADE;
  DROP TABLE "communities" CASCADE;
  DROP TABLE "memberships" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "reading_plans_blocks_plan_passage" CASCADE;
  DROP TABLE "reading_plans_blocks_plan_note_sources" CASCADE;
  DROP TABLE "reading_plans_blocks_plan_note" CASCADE;
  DROP TABLE "reading_plans_days" CASCADE;
  DROP TABLE "reading_plans" CASCADE;
  DROP TABLE "reading_plans_texts" CASCADE;
  DROP TABLE "songs" CASCADE;
  DROP TABLE "songs_texts" CASCADE;
  DROP TABLE "songs_rels" CASCADE;
  DROP TABLE "sermons" CASCADE;
  DROP TABLE "sermons_texts" CASCADE;
  DROP TABLE "sermons_rels" CASCADE;
  DROP TABLE "books" CASCADE;
  DROP TABLE "books_rels" CASCADE;
  DROP TABLE "commentaries" CASCADE;
  DROP TABLE "plan_cohorts" CASCADE;
  DROP TABLE "plan_notes" CASCADE;
  DROP TABLE "events" CASCADE;
  DROP TABLE "event_rsvps" CASCADE;
  DROP TABLE "encrypted_sync" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_system_role";
  DROP TYPE "public"."enum_memberships_role";
  DROP TYPE "public"."enum_media_status";
  DROP TYPE "public"."enum_reading_plans_status";
  DROP TYPE "public"."enum_songs_status";
  DROP TYPE "public"."enum_sermons_status";
  DROP TYPE "public"."enum_books_status";
  DROP TYPE "public"."enum_commentaries_status";
  DROP TYPE "public"."enum_plan_cohorts_default_note_visibility";
  DROP TYPE "public"."enum_plan_notes_visibility";
  DROP TYPE "public"."enum_event_rsvps_response";`)
}
