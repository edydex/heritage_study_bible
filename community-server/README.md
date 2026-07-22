# Heritage Community Server

This is the dynamic, self-hostable companion to the Heritage Study Bible app.
It is a separate deployable built on Payload, Next.js, and PostgreSQL. Its
Payload admin manages the same resource types as a static Content Server, plus
member invitations, memberships, events, and RSVPs. Reading plans use an
ordered day builder, so editors can interleave Bible passages and contextual
notes without writing JSON. Experimental cohort tables are retained for later
client work, but the public manifest does not claim unfinished collaboration or
sync features.

## Local development

1. Copy `.env.example` to `.env` and replace `PAYLOAD_SECRET`.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Install packages with `npm install --legacy-peer-deps`.
4. Run `npm run dev` and open `http://localhost:3000/admin`.
5. Create the first Payload user, set its `systemRole` to `system-admin`, then
   create a Community and its initial owner Membership. The dashboard's
   **Start here** cards link directly to content, invitations, and events.

Without SMTP settings, development uses Nodemailer's local JSON transport and
the magic-link response includes a `debugLink`; no real message is sent.
Public, member-enabled deployments must set real SMTP credentials and HTTPS.
Every production deployment needs strong secrets and backups. Local-only
production can explicitly set `COMMUNITY_AUTH_ENABLED=false` and omit SMTP.

The public static-compatible endpoint is `/heritage-content.json`. Community
discovery is `/.well-known/heritage-community.json`. New Communities default to
invite-only sign-in. Create a **Member invitation** before giving someone the
sign-in address; existing active members may continue to request links.

## Validation and deployment

```sh
npm run typecheck
npm run build
```

Production must provide `DATABASE_URL`, `PAYLOAD_SECRET`,
`COMMUNITY_PUBLIC_URL`, `COMMUNITY_ID`, `HERITAGE_APP_URL`, and allowed app
origins. Member-enabled servers also require SMTP settings. Run Payload
migrations as part of the release process and back up both PostgreSQL and the
media volume. Public catalog routes fail closed
unless `COMMUNITY_ID` resolves to an existing Community, and only that
community's published content is exposed.

Membership, RSVP, and encrypted-device identities have compound uniqueness
constraints. Tenant and ownership relationships cannot be reassigned by normal
members, and cross-community plan/event relationships are rejected during
validation.

## Guided production installation

For a clean Debian 12 or 13 headless machine, use the guided installer. It
installs Docker, PostgreSQL, migrations, Cloudflare Tunnel, SMTP verification,
the first administrator/community, scheduled backups, update/restore tools,
and optional laptop no-sleep settings. It is safe to rerun and preserves data
and secrets by default.

See [the fresh-Debian self-hosting guide](docs/SELF_HOSTING.md). After setup,
normal administration is through `sudo heritage-community <command>`.

For an Intel Surface Pro 7, the pre-baked Debian installer and verified macOS
USB writer are documented in [appliance/README.md](appliance/README.md).
