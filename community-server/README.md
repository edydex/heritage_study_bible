# Heritage Community Server

The optional Community Accounts service provides record-level personal reading
progress synchronization without granting church membership. Its authentication,
strict-password, device-revocation, encryption-at-rest, merge/conflict, export,
and retention contract is documented in
[`docs/PERSONAL_PROGRESS_SYNC.md`](docs/PERSONAL_PROGRESS_SYNC.md).

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
   **Start here** cards link directly to ordinary tasks including **Plan a
   service**, **Review SyncShow sermons**, **Add a song**, invitations, and
   events.

Without SMTP settings, development uses Nodemailer's local JSON transport and
the magic-link response includes a `debugLink`; no real message is sent.
Public, member-enabled deployments must set real SMTP credentials and HTTPS.
Every production deployment needs strong secrets and backups. Local-only
production can explicitly set `COMMUNITY_AUTH_ENABLED=false` and omit SMTP.

Managed sermon-recording storage is currently a private-only prototype. The
server keeps it disabled unless
`HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED=true`; when disabled, discovery omits
the capability and no managed-media endpoint is registered. The
production stack isolates finalized content-addressed objects in the dedicated
`heritage-community-sermon-media` Docker volume, mounted read/write at
`/app/private/sermon-media` while the application root filesystem stays
read-only. Completion returns a durable `202 finalizing` claim and uses
authoritative `GET` polling while a single background worker assembles the
object; expired leases are reclaimed after restart only with live authority.
If that original authority is revoked or expires, maintenance instead expires
the stale upload and removes its private staging so backup is not blocked.
Format 2 quiesced backups include those finalized bytes and refuse
nonexpired active staging. Before database export they run supported quiesced
maintenance, lock the recording tables, prove active/finalizing work is zero,
and immediately remove verified unreferenced objects left by failed finalizers.
They then hash every retained object against its tenant-scoped path and record
a checksummed canonical inventory. Online backup is refused whenever
managed upload is enabled or its database/private store is nonempty. Run
`sudo heritage-community sermon-media-maintenance` for the same supported
quiesced reconciliation outside backup; `status` remains read-only.
Same-disk nightly backups and full-copy retention without deduplication are not
production-ready for a real recording library. Configure verified encrypted
off-device replication and deduplicated retention before relying on this lane
for church recordings. See [the self-hosting guide](docs/SELF_HOSTING.md).

The public static-compatible endpoint is `/heritage-content.json`. Community
discovery is `/.well-known/heritage-community.json`. Community song catalogs
and exact mutable song content require a current member session; anonymous
requests do not expose them. Song responses also send `X-Robots-Tag: noindex,
nofollow, noarchive`. Anonymous access is deliberately limited to eligible
manager-published sermon catalog/detail/passage-index artifacts and possession
of a separately reviewed, revocable song-snapshot bearer link. Use a separate
Content Server for a generally browsable public song library or other public
collections.

SyncShow installations can connect through manager-approved, independently
scoped resources for canonical songs, public-song-link management, canonical
sermons, read-only sermon-publication receipts, and read-only service plans.
Discovery names them `songs`, `songPublicLinks`, `sermons`,
`sermonPublications`, and `servicePlans`.
The service-plan lane imports one reviewed Ready outline into a local
ServiceProject; complete ServiceProjects and ShowPackages are not synchronized.
See
[the SyncShow integration and operator guide](docs/SYNCSHOW_INTEGRATION.md) for
approval, scopes, visibility, publication, planning, expiry/reapproval,
migrations, tests, and safe rollback. The implementation's presence in an
uncommitted integration branch is not proof that it has been merged or
deployed.

New Communities default to
invite-only sign-in. Create a **Member invitation** before giving someone the
sign-in address; existing active members may continue to request links.

## Validation and deployment

```sh
npm run typecheck
npm run test:syncshow
npm run build
```

Production must provide `DATABASE_URL`, `PAYLOAD_SECRET`,
`COMMUNITY_PUBLIC_URL`, `COMMUNITY_ID`, `HERITAGE_APP_URL`, and allowed app
origins. Member-enabled servers also require SMTP settings. Run Payload
migrations as part of the release process and back up both PostgreSQL and the
uploaded-media and private-sermon volumes. Public catalog routes fail closed unless `COMMUNITY_ID` resolves
to an existing Community, and only that community's published listings are
exposed. Song catalogs and exact song documents require a current member
session; managers can additionally review private and scheduled songs. Song
rights records should identify the church's license or permission basis. Set
`COMMUNITY_CCLI_LICENSE_NUMBER` so CCLI-covered song sheets can display the
church license number required by CCLI's attribution format. Set
`COMMUNITY_COPYRIGHT_CONTACT_EMAIL` (it falls back to `SMTP_FROM`) so rights
holders have a visible correction or takedown contact.

The SyncShow integration currently depends on these additive migrations:

- `20260725_160000_syncshow_song_library`
- `20260728_234856_syncshow_sermon_roundtrip`
- `20260729_002359_syncshow_sermon_publications`
- `20260729_005039_service_plans`
- `20260729_005827_sermon_passage_index`
- `20260729_010500_syncshow_song_public_links`
- `20260729_045710_syncshow_sermon_change_sources`
- `20260729_130000_service_plan_sermon_readings`
- `20260729_220000_canonical_sermon_preached_date_projection`
- `20260730_120000_song_member_sharing`
- `20260730_230000_sermon_media_staging`

These are eleven integration migrations after five earlier migrations, for a
clean 16-migration chain. The sermon-history migration makes the private sermon
change journal retain every version's exact canonical `documentSource`. Its backfill
accepts only an exact current community/sermon/sync-ID/revision/archive match
whose PostgreSQL 17 SHA-256, JSON identity/archive state, and shared canonical
parser agree. A noncanonical candidate aborts before any schema change; a
remaining unreconstructable staged row raises SQLSTATE `23514`. Down migration
also raises `23514` before dropping distinct historical source bytes.

Payload journal hooks permit only internal creates, reject updates, and
unconditionally reject deletion, including a privileged Local API call with
`overrideAccess: true`. Direct SQL remains the privileged
migration/backup/repair boundary. PostgreSQL backups therefore contain private
canonical sermon text and must be protected accordingly.

Focused validation passes 14/14 sermon-publication endpoint tests and 5/5
history migration tests; the complete Community contract suite passes 264/264, including the
ordinary manager sermon-review tests and the disposable-database/CI wiring
guards. Earlier disposable PostgreSQL 17 runs passed the three underlying live
cases: service-plan lifecycle and scoped reads, song-link lifecycle and tenant
isolation, and real history up/down/up with fail-closed downgrade/upgrade plus
retained bytes after an actual
`payload.delete({ overrideAccess: true })` attempt. The payload cases now
self-seed one canonical sermon through the real transactional endpoint, and CI
wires them to a migrated database while the table-dropping history case runs in
a separate fresh database. The hardened jobs still need their first GitHub
Actions run. Type checking and generated Payload types are clean, and the final
migration has both TypeScript and JSON artifacts.

Rehearse all nine integration migrations against a database copy before
release. Backup and restore validate the custom PostgreSQL dump catalog before
publishing the backup or reaching a destructive restore phase. A guarded CI
regression is also wired after the production-stack smoke test: it creates a
second disposable Compose project and uniquely named volumes, seeds two exact
sermon revisions plus publication/catalog, Ready service-plan pins, a revoked
song link, and media bytes, then runs the real quiesced backup and destructive
restore and compares every retained row and media byte before checking public
health. It refuses to run without the exact disposable marker, GitHub Actions
CI, loopback URL, and `ci-church` identity. This is synthetic recovery coverage;
the workflow result still needs to run, and it does not replace a rehearsal
against a protected copy of production data or a real appliance recovery. The
operator update and restore paths never stop or reconcile an already-running
Cloudflare connector during app quiescence or failure, because that connector
may carry the SSH recovery session. When data safety requires quiescence, the
Community app remains stopped and the public origin can be unavailable while
the recovery transport stays running. A mocked deploy regression covers failed
update migration, destructive restore failure, and `restore --no-start`. The
validated source has been copied onto
`codex/syncshow-community-integration`; those changes remain uncommitted,
unmerged, and undeployed. This source/runtime proof does not replace a real
packaged SyncShow authorization/reapproval, deployed public sermon read,
song-link restart/revoke check, service-plan browser workflow, desktop/phone
accessibility pass, production-copy recovery rehearsal, or physical-venue test.

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
