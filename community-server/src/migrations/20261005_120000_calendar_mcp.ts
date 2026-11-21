import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE events ADD COLUMN calendar_version varchar NOT NULL DEFAULT '1';
    CREATE FUNCTION calendar_event_version() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN NEW.calendar_version := '1';
        ELSE NEW.calendar_version := ((OLD.calendar_version::bigint) + 1)::text; END IF;
        RETURN NEW;
      END;
    $$;
    CREATE TRIGGER calendar_event_version BEFORE INSERT OR UPDATE ON events
      FOR EACH ROW EXECUTE FUNCTION calendar_event_version();
    CREATE TABLE calendar_mcp_grants (
      id uuid PRIMARY KEY, community_id integer NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id varchar NOT NULL, resource varchar NOT NULL, scopes text[] NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL, revoked_at timestamptz,
      CHECK (scopes <@ ARRAY['calendar:read','calendar:create','calendar:update']::text[] AND 'calendar:read' = ANY(scopes))
    );
    CREATE INDEX calendar_mcp_grants_owner ON calendar_mcp_grants(community_id,user_id);
    CREATE TABLE calendar_mcp_consents (
      nonce_hash char(64) PRIMARY KEY, community_id integer NOT NULL, user_id integer NOT NULL,
      parameters jsonb NOT NULL, expires_at timestamptz NOT NULL
    );
    CREATE TABLE calendar_mcp_codes (
      code_hash char(64) PRIMARY KEY, grant_id uuid NOT NULL REFERENCES calendar_mcp_grants(id) ON DELETE CASCADE,
      redirect_uri varchar NOT NULL, challenge varchar NOT NULL, expires_at timestamptz NOT NULL
    );
    CREATE TABLE calendar_mcp_tokens (
      access_hash char(64) PRIMARY KEY, refresh_hash char(64) UNIQUE NOT NULL,
      grant_id uuid NOT NULL REFERENCES calendar_mcp_grants(id) ON DELETE CASCADE,
      access_expires_at timestamptz NOT NULL, refresh_expires_at timestamptz NOT NULL, rotated_at timestamptz
    );
    CREATE INDEX calendar_mcp_tokens_grant ON calendar_mcp_tokens(grant_id);
    CREATE TABLE calendar_mcp_sources (
      community_id integer NOT NULL, client_id varchar NOT NULL, source varchar NOT NULL, source_id varchar NOT NULL,
      event_id integer REFERENCES events(id) ON DELETE SET NULL, input_hash char(64) NOT NULL,
      PRIMARY KEY (community_id,client_id,source,source_id)
    );
    CREATE TABLE calendar_mcp_mutations (
      community_id integer NOT NULL, client_id varchar NOT NULL, request_id varchar NOT NULL,
      input_hash char(64) NOT NULL, result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (community_id,client_id,request_id)
    );
    CREATE TABLE calendar_mcp_audit (
      id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), community_id integer NOT NULL,
      user_id integer NOT NULL, client_id varchar NOT NULL, grant_id uuid NOT NULL,
      action varchar NOT NULL, event_id integer, before_version varchar, after_version varchar, request_id varchar
    );
    CREATE INDEX calendar_mcp_audit_church_time ON calendar_mcp_audit(community_id,at);
    CREATE FUNCTION calendar_mcp_immutable_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Calendar MCP audit records are immutable'; END;
    $$;
    CREATE TRIGGER calendar_mcp_immutable_audit BEFORE UPDATE OR DELETE ON calendar_mcp_audit
      FOR EACH ROW EXECUTE FUNCTION calendar_mcp_immutable_audit();
  `)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE calendar_mcp_audit, calendar_mcp_mutations, calendar_mcp_sources, calendar_mcp_tokens,
      calendar_mcp_codes, calendar_mcp_consents, calendar_mcp_grants;
    DROP FUNCTION calendar_mcp_immutable_audit();
    DROP TRIGGER calendar_event_version ON events; DROP FUNCTION calendar_event_version();
    ALTER TABLE events DROP COLUMN calendar_version;
  `)
}
