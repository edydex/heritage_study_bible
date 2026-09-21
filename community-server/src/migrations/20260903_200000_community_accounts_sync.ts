import {
  type MigrateDownArgs,
  type MigrateUpArgs,
  sql,
} from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_users_account_protection"
      AS ENUM('email', 'strict-password');
    CREATE TYPE "public"."enum_community_auth_challenges_purpose"
      AS ENUM('sign-in', 'reverify');
    CREATE TYPE "public"."enum_community_auth_challenges_flow"
      AS ENUM('community', 'sync');
    CREATE TYPE "public"."enum_sync_account_events_event_type"
      AS ENUM('device-connected', 'protection-changed', 'device-revoked');

    ALTER TABLE "users"
      ADD COLUMN "account_protection"
        "enum_users_account_protection" DEFAULT 'email' NOT NULL,
      ADD COLUMN "strict_password_hash" varchar,
      ADD COLUMN "strict_password_algorithm" varchar,
      ADD COLUMN "strict_password_params" jsonb,
      ADD COLUMN "sync_generation" numeric DEFAULT 1 NOT NULL;

    ALTER TABLE "community_sessions"
      ADD COLUMN "device_id" varchar,
      ADD COLUMN "device_name" varchar,
      ADD COLUMN "platform" varchar,
      ADD COLUMN "email_verified_at" timestamp(3) with time zone,
      ADD COLUMN "last_used_at" timestamp(3) with time zone,
      ADD COLUMN "sync_generation" numeric DEFAULT 1 NOT NULL;

    ALTER TABLE "community_sessions"
      DROP CONSTRAINT "community_sessions_user_id_users_id_fk",
      ADD CONSTRAINT "community_sessions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "encrypted_sync"
      DROP CONSTRAINT "encrypted_sync_user_id_users_id_fk",
      ADD CONSTRAINT "encrypted_sync_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE TABLE "community_auth_challenges" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "email_hash" varchar NOT NULL,
      "token_hash" varchar NOT NULL,
      "purpose" "enum_community_auth_challenges_purpose" NOT NULL,
      "flow" "enum_community_auth_challenges_flow" NOT NULL,
      "device_id" varchar NOT NULL,
      "device_name" varchar NOT NULL,
      "platform" varchar NOT NULL,
      "requires_password" boolean DEFAULT false NOT NULL,
      "expires_at" timestamp(3) with time zone NOT NULL,
      "failed_attempts" numeric DEFAULT 0 NOT NULL,
      "consumed_at" timestamp(3) with time zone,
      "superseded_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "community_auth_rate_limits" (
      "id" serial PRIMARY KEY NOT NULL,
      "bucket_hash" varchar NOT NULL,
      "attempts" numeric DEFAULT 0 NOT NULL,
      "reset_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "sync_devices" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "device_id" varchar NOT NULL,
      "friendly_name" varchar NOT NULL,
      "platform" varchar NOT NULL,
      "first_connected_at" timestamp(3) with time zone NOT NULL,
      "last_synced_at" timestamp(3) with time zone,
      "revoked_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE SEQUENCE "public"."sync_records_server_revision_seq"
      AS bigint
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1;

    CREATE TABLE "sync_records" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "record_type" varchar NOT NULL,
      "record_id" varchar NOT NULL,
      "schema_version" numeric NOT NULL,
      "server_revision" numeric NOT NULL,
      "origin_device_id" varchar NOT NULL,
      "deleted" boolean DEFAULT false NOT NULL,
      "client_updated_at" timestamp(3) with time zone,
      "key_id" varchar NOT NULL,
      "iv" varchar NOT NULL,
      "auth_tag" varchar NOT NULL,
      "ciphertext" varchar NOT NULL,
      "content_hash" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "sync_conflicts" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "record_type" varchar NOT NULL,
      "record_id" varchar NOT NULL,
      "schema_version" numeric NOT NULL,
      "base_revision" numeric NOT NULL,
      "server_revision" numeric NOT NULL,
      "origin_device_id" varchar NOT NULL,
      "deleted" boolean DEFAULT false NOT NULL,
      "client_updated_at" timestamp(3) with time zone,
      "server_record_missing" boolean DEFAULT false NOT NULL,
      "key_id" varchar NOT NULL,
      "iv" varchar NOT NULL,
      "auth_tag" varchar NOT NULL,
      "ciphertext" varchar NOT NULL,
      "content_hash" varchar NOT NULL,
      "resolved_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "sync_account_events" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "event_type" "enum_sync_account_events_event_type" NOT NULL,
      "device_id" varchar,
      "occurred_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "community_auth_challenges"
      ADD CONSTRAINT "community_auth_challenges_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "sync_devices"
      ADD CONSTRAINT "sync_devices_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "sync_records"
      ADD CONSTRAINT "sync_records_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "sync_conflicts"
      ADD CONSTRAINT "sync_conflicts_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "sync_account_events"
      ADD CONSTRAINT "sync_account_events_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "community_sessions_device_id_idx"
      ON "community_sessions" USING btree ("device_id");
    CREATE INDEX "community_sessions_email_verified_at_idx"
      ON "community_sessions" USING btree ("email_verified_at");
    CREATE INDEX "community_sessions_last_used_at_idx"
      ON "community_sessions" USING btree ("last_used_at");
    CREATE INDEX "community_sessions_sync_generation_idx"
      ON "community_sessions" USING btree ("sync_generation");

    CREATE INDEX "community_auth_challenges_user_idx"
      ON "community_auth_challenges" USING btree ("user_id");
    CREATE INDEX "community_auth_challenges_email_hash_idx"
      ON "community_auth_challenges" USING btree ("email_hash");
    CREATE UNIQUE INDEX "community_auth_challenges_token_hash_idx"
      ON "community_auth_challenges" USING btree ("token_hash");
    CREATE INDEX "community_auth_challenges_device_id_idx"
      ON "community_auth_challenges" USING btree ("device_id");
    CREATE INDEX "community_auth_challenges_expires_at_idx"
      ON "community_auth_challenges" USING btree ("expires_at");
    CREATE INDEX "community_auth_challenges_consumed_at_idx"
      ON "community_auth_challenges" USING btree ("consumed_at");
    CREATE INDEX "community_auth_challenges_superseded_at_idx"
      ON "community_auth_challenges" USING btree ("superseded_at");
    CREATE INDEX "community_auth_challenges_updated_at_idx"
      ON "community_auth_challenges" USING btree ("updated_at");
    CREATE INDEX "community_auth_challenges_created_at_idx"
      ON "community_auth_challenges" USING btree ("created_at");

    CREATE UNIQUE INDEX "community_auth_rate_limits_bucket_hash_idx"
      ON "community_auth_rate_limits" USING btree ("bucket_hash");
    CREATE INDEX "community_auth_rate_limits_reset_at_idx"
      ON "community_auth_rate_limits" USING btree ("reset_at");
    CREATE INDEX "community_auth_rate_limits_updated_at_idx"
      ON "community_auth_rate_limits" USING btree ("updated_at");
    CREATE INDEX "community_auth_rate_limits_created_at_idx"
      ON "community_auth_rate_limits" USING btree ("created_at");

    CREATE INDEX "sync_devices_user_idx"
      ON "sync_devices" USING btree ("user_id");
    CREATE INDEX "sync_devices_device_id_idx"
      ON "sync_devices" USING btree ("device_id");
    CREATE INDEX "sync_devices_last_synced_at_idx"
      ON "sync_devices" USING btree ("last_synced_at");
    CREATE INDEX "sync_devices_revoked_at_idx"
      ON "sync_devices" USING btree ("revoked_at");
    CREATE INDEX "sync_devices_updated_at_idx"
      ON "sync_devices" USING btree ("updated_at");
    CREATE INDEX "sync_devices_created_at_idx"
      ON "sync_devices" USING btree ("created_at");
    CREATE UNIQUE INDEX "sync_devices_user_device_id_idx"
      ON "sync_devices" USING btree ("user_id", "device_id");

    CREATE INDEX "sync_records_user_idx"
      ON "sync_records" USING btree ("user_id");
    CREATE INDEX "sync_records_record_type_idx"
      ON "sync_records" USING btree ("record_type");
    CREATE INDEX "sync_records_record_id_idx"
      ON "sync_records" USING btree ("record_id");
    CREATE UNIQUE INDEX "sync_records_server_revision_idx"
      ON "sync_records" USING btree ("server_revision");
    CREATE INDEX "sync_records_origin_device_id_idx"
      ON "sync_records" USING btree ("origin_device_id");
    CREATE INDEX "sync_records_content_hash_idx"
      ON "sync_records" USING btree ("content_hash");
    CREATE INDEX "sync_records_updated_at_idx"
      ON "sync_records" USING btree ("updated_at");
    CREATE INDEX "sync_records_created_at_idx"
      ON "sync_records" USING btree ("created_at");
    CREATE UNIQUE INDEX "sync_records_user_type_record_id_idx"
      ON "sync_records" USING btree ("user_id", "record_type", "record_id");
    CREATE INDEX "sync_records_user_revision_idx"
      ON "sync_records" USING btree ("user_id", "server_revision");

    CREATE INDEX "sync_conflicts_user_idx"
      ON "sync_conflicts" USING btree ("user_id");
    CREATE INDEX "sync_conflicts_record_type_idx"
      ON "sync_conflicts" USING btree ("record_type");
    CREATE INDEX "sync_conflicts_record_id_idx"
      ON "sync_conflicts" USING btree ("record_id");
    CREATE INDEX "sync_conflicts_resolved_at_idx"
      ON "sync_conflicts" USING btree ("resolved_at");
    CREATE INDEX "sync_conflicts_updated_at_idx"
      ON "sync_conflicts" USING btree ("updated_at");
    CREATE INDEX "sync_conflicts_created_at_idx"
      ON "sync_conflicts" USING btree ("created_at");

    CREATE INDEX "sync_account_events_user_idx"
      ON "sync_account_events" USING btree ("user_id");
    CREATE INDEX "sync_account_events_device_id_idx"
      ON "sync_account_events" USING btree ("device_id");
    CREATE INDEX "sync_account_events_occurred_at_idx"
      ON "sync_account_events" USING btree ("occurred_at");
    CREATE INDEX "sync_account_events_updated_at_idx"
      ON "sync_account_events" USING btree ("updated_at");
    CREATE INDEX "sync_account_events_created_at_idx"
      ON "sync_account_events" USING btree ("created_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE "sync_account_events";
    DROP TABLE "sync_conflicts";
    DROP TABLE "sync_records";
    DROP SEQUENCE "public"."sync_records_server_revision_seq";
    DROP TABLE "sync_devices";
    DROP TABLE "community_auth_rate_limits";
    DROP TABLE "community_auth_challenges";

    DROP INDEX "community_sessions_device_id_idx";
    DROP INDEX "community_sessions_email_verified_at_idx";
    DROP INDEX "community_sessions_last_used_at_idx";
    DROP INDEX "community_sessions_sync_generation_idx";
    ALTER TABLE "community_sessions"
      DROP CONSTRAINT "community_sessions_user_id_users_id_fk",
      ADD CONSTRAINT "community_sessions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
    ALTER TABLE "encrypted_sync"
      DROP CONSTRAINT "encrypted_sync_user_id_users_id_fk",
      ADD CONSTRAINT "encrypted_sync_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
      ON DELETE set null ON UPDATE no action;
    ALTER TABLE "community_sessions"
      DROP COLUMN "device_id",
      DROP COLUMN "device_name",
      DROP COLUMN "platform",
      DROP COLUMN "email_verified_at",
      DROP COLUMN "last_used_at",
      DROP COLUMN "sync_generation";

    ALTER TABLE "users"
      DROP COLUMN "account_protection",
      DROP COLUMN "strict_password_hash",
      DROP COLUMN "strict_password_algorithm",
      DROP COLUMN "strict_password_params",
      DROP COLUMN "sync_generation";

    DROP TYPE "public"."enum_sync_account_events_event_type";
    DROP TYPE "public"."enum_community_auth_challenges_flow";
    DROP TYPE "public"."enum_community_auth_challenges_purpose";
    DROP TYPE "public"."enum_users_account_protection";
  `)
}
