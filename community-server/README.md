# Heritage Community Server

This is the dynamic, self-hostable companion to the Heritage Study Bible app.
It is a separate deployable built on Payload, Next.js, and PostgreSQL. Its
Payload admin manages the same resource types as a static Content Server, plus
memberships, shared plan cohorts and notes, events, RSVPs, and opaque encrypted
sync blobs. Reading plans use an ordered day builder, so editors can interleave
Bible passages and contextual notes without writing JSON.

## Local development

1. Copy `.env.example` to `.env` and replace `PAYLOAD_SECRET`.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Install packages with `npm install --legacy-peer-deps`.
4. Run `npm run dev` and open `http://localhost:3000/admin`.
5. Create the first Payload user, set its `systemRole` to `system-admin`, then
   create a Community and its initial owner Membership.

Without SMTP settings, development uses Nodemailer's local JSON transport and
the magic-link response includes a `debugLink`; no real message is sent.
Public, member-enabled deployments must set real SMTP credentials and HTTPS.
Every production deployment needs strong secrets and backups. Local-only
production can explicitly set `COMMUNITY_AUTH_ENABLED=false` and omit SMTP.

The public static-compatible endpoint is `/heritage-content.json`. Community
discovery is `/.well-known/heritage-community.json`. Published song listings
are returned only to current Community members, so the Community library is not
publicly discoverable. A published song's exact content URL remains readable
without a session so a congregant can open an unlisted Heritage share link
without first joining the Community. Song responses send `X-Robots-Tag:
noindex, nofollow, noarchive`. This is an unlisted-link boundary, not
access-control or DRM. Use a separate Content Server for resources intended to
be publicly browsable.

## Validation and deployment

```sh
npm run typecheck
npm run build
```

Production must provide `DATABASE_URL`, `PAYLOAD_SECRET`,
`COMMUNITY_PUBLIC_URL`, `COMMUNITY_ID`, `HERITAGE_APP_URL`, and allowed app
origins. Member-enabled servers also require SMTP settings. Run Payload
migrations as part of the release process and back up both PostgreSQL and the
media volume. Public catalog routes fail closed unless `COMMUNITY_ID` resolves
to an existing Community, and only that community's published listings are
exposed. Song catalog discovery requires a current member session. Published
song documents are intentionally unlisted but link-accessible; their rights
records should identify the church's license or permission basis. Set
`COMMUNITY_CCLI_LICENSE_NUMBER` so CCLI-covered song sheets can display the
church license number required by CCLI's attribution format. Set
`COMMUNITY_COPYRIGHT_CONTACT_EMAIL` (it falls back to `SMTP_FROM`) so rights
holders have a visible correction or takedown contact.

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
