# SyncShow and Heritage Community integration

The Community server can hold the church-managed records that SyncShow uses
while planning a service. Protocol v2 advertises five independent resources.
The `servicePlans` resource itself advertises schema 2 while retaining
schema-v1 document compatibility:

- `songs`
- `songPublicLinks`
- `sermons`
- `sermonPublications`
- `servicePlans`

Each resource has its own scopes and can be withdrawn without disabling the
others. Community is not the live-show runtime: SyncShow's local songs,
sermons, ServiceProjects, ShowPackages, output settings, and cues remain local
and offline-capable. Complete ServiceProjects are not uploaded or synchronized
by this integration.

This guide describes the implementation copied onto the real Heritage branch
`codex/syncshow-community-integration`. Its intended paths match the validated
isolated worktree. The branch remains uncommitted and unmerged and has not been
deployed to the production-named WOTBC stack. A separate loopback-only WOTBC
candidate now runs the integration and all 14 migrations; the final isolated
candidate evidence below does not make that a production deployment.

## Connecting an installation

SyncShow discovers the integration at
`/.well-known/heritage-community.json`, then uses the advertised
`/api/community/syncshow/v1` endpoints.

1. In SyncShow, enter the Community server address and the email address of an
   existing church manager.
2. SyncShow shows an eight-character approval code and opens the server's
   approval page.
3. Sign in with the exact requested account. The account must be a Community
   `owner`, `admin`, or `leader`.
4. Review the installation name and every requested resource scope, then
   explicitly press **Approve connection**. Merely opening the link never
   approves it.

The request uses PKCE S256 and a dedicated device secret. Only hashes of device
secrets, approval codes, and access tokens are stored. The resulting opaque
token is a SyncShow token, not a general Community bearer token. Advertised
scopes are:

- `syncshow:songs:read`
- `syncshow:songs:write`
- `syncshow:song-public-links:read`
- `syncshow:song-public-links:write`
- `syncshow:sermons:read`
- `syncshow:sermons:write`
- `syncshow:sermon-publications:read`
- `syncshow:service-plans:read`

Write scopes carry their documented read dependencies. SyncShow treats a
capability as effective only when it is both advertised now and present in the
saved manager-approved grant. Existing installations never inherit a newly
added scope; reconnect and review the expanded request. Removing one resource
or role disables only the affected operations and does not erase local
content.

SMTP is helpful but not required for this flow. When mail is configured, the
server sends the approval link to a matching manager as a convenience. If mail
is unavailable, use the approval URL and code already shown in SyncShow. The
same signed-in approval page works without an email delivery.

Connections last 180 days and have no refresh token. Reapprove the installation
after expiry. Every API request rechecks that the approving user is still an
owner, admin, or leader, so removing that role stops the connection
immediately. A manager can review or revoke installations under Payload admin
**Integrations → SyncShow connections**. SyncShow can also revoke its current
token through the advertised revoke endpoint.

Token exchange is transactional and retryable. If a successful HTTP response
is lost, SyncShow may retry the consumed grant during the short recovery
window and receives the same token; the server does not create a second
connection.

## Song visibility

Visibility is independent from song rights metadata:

- **Private** is visible only to Community owners, admins, and leaders.
- **Public** means visible to signed-in members of that Community. It does not
  mean anonymous Internet access.
- **Scheduled-public** stays manager-only until `publishAt`, evaluated with the
  Community server clock, then becomes visible to signed-in members.
- **Archived** is a sync tombstone. It is hidden from normal Community catalogs
  and cannot be physically deleted through the song API.

Anonymous catalog and content requests never expose the mutable current
Community song. Manager catalog requests include private and not-yet-public
scheduled songs so they can be reviewed and edited. The only anonymous song
exception is a separately reviewed bearer link, described below, that serves
one immutable snapshot rather than the mutable song record.

## Song synchronization

Each song has a stable `syncId`, monotonic `syncVersion`, visibility fields,
and lossless `syncDocuments`. SyncShow uses cursor pagination, so libraries
larger than 100 songs are not truncated. Updates and archives require the
current ETag (`"song:<syncId>:<syncVersion>"`) in `If-Match`; a stale version
returns a conflict instead of overwriting another editor.

Canonical song documents remain the lossless representation for multiple
languages, arrangements, slide boundaries, and custom metadata. Heritage also
projects the first applicable English, Russian, or other-language document
into its older title/lyrics fields. Edits from the Payload admin update only
the applicable canonical document fields. Other languages, secondary
arrangements, unknown front matter, and unedited slide bodies are preserved.
Existing CCLI, copyright, permission, and rights-note fields are not erased
when a SyncShow document omits them.

## Public song links

Public links are separate from signed-in member visibility. Creating one
requires the exact current original-plus-translation family, a dedicated
`public-link` review, explicit evidence, and a matching cross-runtime digest.
A CCLI or SongSelect number is not blanket anonymous redistribution
permission.

The server transaction checks the current song ETag and family hash, stores an
immutable public snapshot and private audit record, and creates a
high-entropy bearer ID. The management API supports bounded scoped
list/create/revoke with durable idempotency and link-version compare-and-swap.
SyncShow derives the same-origin URL; the server does not return an arbitrary
URL.

`/community/songs/shared/<linkId>` requires no session because possession of
the unguessable path is the capability. It serves only the pinned reviewed
fields, excludes rights evidence and Community/private data, sends no-store
and no-index headers, and fails closed after expiry or revocation. Editing the
song never retargets an issued link. Payload admin can revoke a link even when
SyncShow is unavailable.

See the matching SyncShow
`docs/COMMUNITY_SONG_PUBLIC_LINK_CONTRACT.md` before changing review
normalization, snapshot projection, expiry, or revocation behavior.

## Member-only Heritage song links

Sharing a song that is already member-visible does not create an anonymous
publication. Heritage's **Share member-only link** route accepts exactly
`access=member`, `server=<configured server id>`, and
`url=<query-free protected song URL>`. The protected URL must be HTTPS, except
for an explicit loopback development origin, and its path must be exactly
`/content/songs/<id>`.

The receiver must have the same Community joined and a saved session for that
configured server. Only then does Heritage send the `Community` authorization
header to the exact configured origin, with browser credentials omitted, no
referrer, and redirects rejected. Missing, signed-out, and mismatched states
show an explicit gate and make zero protected requests. The legacy anonymous-
looking `?url=...` route is rejected. Anonymous bearer links remain the
separate rights-reviewed workflow above.

## Manager sermon preparation

Signed-in owners, admins, and leaders can use `/admin/prepare-sermon` to paste
a manuscript and/or slide notes, enter one exact primary passage, and confirm
their review. The guided client submits through the signed-in manager's
same-origin session. `POST /api/community/sermon-preparations` rejects
SyncShow bearer authority, accepts at most 2 MiB of strict schema-1 JSON, and
uses an exact retry-safe idempotency key. Payload manager JWTs remain valid for
trusted administrative clients; every route rechecks the manager membership
inside the canonical-sermon transaction.

One confirmed preparation creates one private Ready canonical schema-v3 sermon
with typed-text source hashes and provenance. It does not publish anything and
does not upload or retain the original DOCX/PPTX files. The generic Payload
form remains available as **Add an older sermon**, but those legacy records are
not eligible for canonical service-plan pins.

Canonical passage coordinates use the Protestant 66-book versification in
Heritage's bundled default BSB files (`public/data/translations/BSB`). The
shared range validator uses a compact table derived from each chapter's exact
final verse in that source and rejects nonexistent verses; this coordinate
contract includes no translation text in Community sermon documents.
Heritage and SyncShow independently pin the same versioned coordinate fixture
at SHA-256
`878253daa85e874da525fd58cbc5fb22522c30fe494522bf356da3ecbf874069`,
so any versification change requires an explicit update in both repositories.

Payload's data-less create-form permission probe now opens ordinary Community
content and service-plan forms for managers who have at least one eligible
membership. A real write still requires the `community` relationship, and any
supplied Community ID remains tenant-bound; missing or cross-tenant writes fail.

## Sermon synchronization and publication

The sermon lane stores one canonical SyncShow current document with a stable
`syncId`, monotonic `syncVersion`, lowercase SHA-256 current revision,
compare-and-swap updates, archive state, and a bounded durable change feed.
SyncShow explicitly chooses when to create or update a sermon through its
device contract; a manager may also create the initial canonical sermon through
the guided preparation path above. Private
manuscript, presentation, transcript, and attachment bytes are not
transferred; the canonical document may retain bounded source descriptors and
the human-reviewed body.

Private synchronization does not publish a sermon. Managers use the separate
publication workflow to select an eligible exact canonical revision and its
reviewed public body/media fields. The transaction updates a separate
`publicRevision`, publication receipt, public catalog, detail artifact, and
confirmed primary/mentioned-passage index together. Withdrawal removes public
eligibility without rewriting the private current sermon.

SyncShow receives publication state only through the read-only
`sermonPublications` resource. Its **Verify live sermon** flow compares the
authenticated receipt before and after anonymous reads of:

- `/heritage-content.json`
- `/content/sermons/<publicId>`
- `/indexes/sermon-passages`

The Heritage Study Bible validates the manifest publication marker, reads the
verified public sermon catalog, matches the exact primary/mentioned references
carried by each catalog item to the open passage, and then reads the exact
detail artifact for its sermon viewer. The separately published passage index
is part of the atomic public contract and is independently verified by
SyncShow; it is not yet the reader's discovery source. Public projection
excludes private source descriptors and source bytes.

During that same manager review, an operator may optionally enter one direct
service-recording URL. This uses manager publish intent schema 2; schema-1
publish requests and withdrawals remain valid. The server accepts only a
stable anonymous HTTPS file URL on a public DNS hostname, without credentials,
a query string, fragment, private/IP host, or nonstandard port, and only a
small explicit audio MIME allowlist. Existing canonical media must meet that
same stable-public-URL rule before it can be selected; older HTTP or otherwise
unsafe inventory remains visible to the manager but is not publishable. The
server does not fetch, probe, transcode, copy, or otherwise verify the remote
file. A deterministic server-owned media ID is added to the exact published
canonical revision and selected in the same atomic publication transaction,
so the current sermon, immutable receipt, public detail, catalog, and private
change journal cannot disagree. A same-URL title, language, MIME, or duration
correction safely replaces only an existing server-owned Ready URL-only audio
entry; ownership, ID, URL, kind, or status disagreement still fails closed.

The manager must separately confirm permission to publish the recording,
speaker and participant privacy, and clearance of embedded music or other
third-party material. Publishing any audio also requires at least one selected
written sermon section, so Community does not intentionally create an
audio-only public sermon without an accessible written alternative. The
rights/privacy checkbox is an operational publication gate; this small slice
does not persist approver identity or a rights/consent basis as a first-class
field. Durable attestations would require a separate schema and migration. The
resulting URL is anonymously public and copyable, and its host receives
listener network/browser metadata when playback begins. Both the admin preview
and Heritage reader use `preload="none"`; the reader exposes an inline player
plus a visible external-link fallback, identifies its language and destination
host, pauses sibling players, and tears down playback when the viewer closes.
Actual reachability, redirects, response content type, codec support,
byte-range seeking, and remote URL immutability remain deployment-smoke
responsibilities.

Every sermon create, content update, archive, and manager publish that changes
the canonical source appends a private journal row atomically with the current
pointer. That row retains the version's exact canonical v1/v2/v3 or archive
`documentSource`, including its trailing newline; later edits do not retarget
historical rows. The normal change feed projects only bounded summary metadata
and does not return these private historical sources.

The hidden journal accepts creates only from the internal sermon transaction.
Its hook verifies exact canonical reserialization, stable ID, UTF-8 SHA-256
revision, and archive state. Updates are rejected, and an unconditional
`beforeDelete` rejects deletion even for a Payload Local API caller using
`overrideAccess: true`. Direct SQL remains the privileged
migration/backup/repair boundary outside Payload hooks. The database CHECK binds
retained source bytes to their revision, and backups containing this private
canonical sermon text require restricted handling.

## Service planning

Managers create ordered service plans under **Planning → Service plans**.
Plans move through Draft, Ready, Archived, or Cancelled and may contain
section, song, Scripture, and sermon rows. Server-owned plan/entry IDs,
canonical source, revision, version, timestamps, and resource pins are hidden
from ordinary editor writes.

Saving Draft captures current song and sermon pins. Ready requires every
selected resource to remain current, canonical, unarchived, and in the same
Community. If a resource changed, save as Draft to refresh the pin, review it,
then mark the plan Ready. Archived and Cancelled plans retain the exact
canonical bytes and pins and cannot be edited until restored to Draft. Plans
are never physically deleted through normal collection access.

New manager saves use service-plan schema v2. Every Scripture row has an
explicit `sermonReading`: either `null` for an unrelated reading or a
relationship to one exact later sermon row plus that sermon revision's stable
confirmed-primary `referenceId`. The editor resolves the selected sermon once,
requires the reading to be contained by that confirmed primary passage, limits
the linked reading to eight verses in one chapter, and requires the uppercase
translation wire form. One sermon row may have only one linked reading.
Duplicate later rows for the same selected sermon are rejected instead of
guessed. Titles and range overlap never create a relationship. Existing
terminal schema-v1 sources remain byte-for-byte v1 when their lifecycle state
changes.

Both sermon selectors show only non-archived canonical `syncId` sermons
belonging to the selected Community. Records created through **Add an older
sermon** are therefore never presented as pinnable canonical resources.

SyncShow has only `syncshow:service-plans:read`. It lists and reads plans,
strictly verifies canonical source and SHA-256 revision, and imports only Ready
plans after explicit local review. Every exact song, sermon, and Scripture
resource must already be available for the selected local outputs. Import
creates a local editable ServiceProject with Community provenance; it never
writes the project back. A newer remote revision is shown for explicit review
and never silently overwrites the local project. **Check Community revision**
obtains a fresh reviewed diff. **Replace with reviewed revision & open
Planning** then uses a separate one-use main-owned authority bound to the exact
connection/server, venue/output contract, remote envelope and diff, project
ID, and current local revision. It refetches and re-reviews before a
compare-and-swap replacement under the same project ID, retains immutable
history, and reopens Planning without mutating Load, Show, or an existing
ShowPackage. Stale, blocked, non-Ready, changed-profile, changed-connection,
and replay attempts fail closed.

For a linked reading, SyncShow revalidates the exact pinned sermon source,
confirmed-primary reference, range containment, translation, and one-owner
relationship before import. The local Bible item and later sermon group reuse
the same exact sermon resource. SyncShow does not invoke its fallback reading
planner or fuzzy-match titles. Ordinary duplication cannot clone an exact
sermon-owner subtree, and readiness blocks multiple material sets sharing one
exact sermon resource.

See the matching SyncShow
`docs/COMMUNITY_SERVICE_PLAN_CONTRACT.md` for the canonical schema, endpoints,
import blockers, and proof gates.

## Migrations and existing libraries

The integration branch adds these migrations in order:

- `20260725_160000_syncshow_song_library`
- `20260728_234856_syncshow_sermon_roundtrip`
- `20260729_002359_syncshow_sermon_publications`
- `20260729_005039_service_plans`
- `20260729_005827_sermon_passage_index`
- `20260729_010500_syncshow_song_public_links`
- `20260729_045710_syncshow_sermon_change_sources`
- `20260729_130000_service_plan_sermon_readings`
- `20260729_220000_canonical_sermon_preached_date_projection`

The first migration adds song sync identity, visibility, scheduling, versions,
canonical documents, device grants, and connections. Existing safe slugs
become `syncId`; other records receive a stable `heritage:<database-id>`
identity. Existing published songs become member-public and other songs become
private. Later migrations add sermon synchronization/publication, service
plans, the public passage index, immutable public song-link snapshots, and
exact private sermon-change sources. The service-plan migration adds
only two nullable entry columns, a `SET NULL` sermon foreign key, and its
relationship index; it does not rewrite or backfill canonical plan bytes.
The final projection-only migration derives `preachedAt` from each exact
canonical `serviceDate` as noon in the locked Community IANA time zone. It
round-trips that civil date, repairs the previous-day display without changing
canonical source or journal bytes, and fails closed on an invalid time zone or
an incomplete or noncanonical row. These are nine integration migrations after
five earlier migrations, for a clean 14-migration chain. Automated coverage
includes Los Angeles, UTC, Auckland, and Kiritimati. Payload's generic admin
date cell still renders in the browser's time zone, so an administrator whose
browser zone differs from the Community zone may need a custom date-only cell;
the canonical projection and manager review API remain Community-zone based.

The final history migration stages a nullable journal source and backfills only
an exact current community/sermon/sync-ID/revision/archive match. PostgreSQL 17
must reproduce SHA-256, JSON identity/archive state must agree, and the shared
TypeScript parser/serializer must accept the exact canonical source. A
noncanonical candidate aborts before the schema changes. After staging, any row
still lacking an exact source raises SQLSTATE `23514` transactionally before
`NOT NULL` and the source/revision CHECK are added. Down migration also raises
`23514` before dropping a distinct historical source that is not still exactly
reconstructable from the current sermon. Empty or all-current journals can roll
back; retained distinct history cannot be silently destroyed.

The complete Community contract suite passes 202/202, including v1/v2
service-plan conformance, manager editor behavior, migrations, ordinary manager
sermon preparation/review and direct-recording publication tests, and
disposable-database/CI guards. A local disposable
PostgreSQL 17 run also applied the first 13 migrations before the later
projection-only migration was added and passed the schema-v2
manager relationship, Draft → Ready → Archived lifecycle, scoped list/get,
resource-drift, terminal-byte-retention, and cleanup path. Earlier disposable
runs passed song-link lifecycle and tenant isolation, and real history
up/down/up with fail-closed destructive downgrade, transactional rejection of
an unreconstructable upgrade, and rejected
`payload.delete({ overrideAccess: true })` with the journal bytes retained. The
service-plan Payload lifecycle now self-seeds its exact sermon through the
signed-in manager preparation endpoint rather than manufacturing a device
grant. CI assigns the cases one migrated database and assigns the table-dropping
history case a different fresh database; these hardened jobs still need their
first GitHub Actions run. Type checking and generated Payload types are clean,
and schema-changing migrations retain their generated JSON artifacts.
The same intended paths are present on the real integration branch. This local
source/runtime evidence plus the isolated WOTBC evidence below is not proof of
a commit, merge, production deployment, production data, packaged
authorization, browser/phone accessibility, production-copy recovery, or venue
operation.

### Earlier WOTBC isolated post-service audit (superseded; 2026-07-29)

This section retains the original post-service publish/play/backup/withdrawal
audit for chronology. The final manager/operator candidate section below
supersedes its source, image, migration-count, and current-runtime facts. The
original audit used a disposable Compose project bound only to host loopback
port 3410, with its own PostgreSQL database and volumes; the production-named
`heritage-community` project, its containers, and its data were not changed.
That earlier candidate applied the 13 migrations available at the time.

The audit created an exact sermon, pinned it from an exact Ready service plan,
published a direct six-second Ogg recording with reviewed rights/privacy
metadata and a written alternative, and verified the authenticated receipt
against the anonymous manifest, catalog, detail, and passage-index bytes. The
installed Heritage web app then showed the sermon on Ephesians 3:14-21,
distinguished its primary and mentioned references, disclosed the third-party
audio host, retained `preload="none"`, played the recording only after an
operator action, and removed the audio element when the viewer closed.

That browser pass exposed a real protocol drift: the live manifest advertised
the current five-key sermon marker, including `passageIndex`, while the client
accepted only the legacy four-key marker. The reader now accepts exactly the
legacy or current marker, validates the optional passage-index descriptor as
same-origin public JSON, and fails closed for credentials, fragments,
backslashes, insecure/cross-origin URLs, the wrong MIME type, or extra keys.
The full Heritage suite passes with 154 Vitest cases and 82 content-protocol
cases after the later member-link correction; its focused browser coverage
passes 6/6.

A quiesced candidate backup was created at
`/opt/heritage-community-postservice-audio-audit/backups/backup-20260729T234532Z-published-postservice-audio`.
Its strict checksums and PostgreSQL custom-dump catalog passed, and after a
candidate restart the exact published ETags and bytes were unchanged. The
test plan was then archived, the public sermon withdrawn, all matching smoke
OAuth connections revoked, and anonymous catalog/index/detail reads confirmed
the publication was gone. Root-only audit evidence remains at
`/opt/heritage-community-postservice-audio-audit/evidence/publish-evidence.json`
and `cleanup-evidence.json`; the deployed source archive has SHA-256
`bb5f38cfa69cc387ec290707bcef5cb8fb8288f09048874515b9bb7787ed03b1`.

This proves the isolated host contract, backup/restart durability, and one
desktop browser playback path. It is not a production rollout, authenticated
phone/LAN test, production-copy restore, presentation-machine test, or venue
rehearsal.

### Final WOTBC isolated manager/operator candidate (supersedes earlier audit; 2026-07-29)

The final loopback-only candidate runs the source archive with SHA-256
`236b7d68a8e431761d4b97ec6b3acbde559475e9271f1dcd9ff09c4411698426`.
Its Community image ID is
`sha256:ce7d844c896b5e5b416a036b0faea567f3d108b2f970c9f6c143b08219fb88c3`
and its migration image ID is
`sha256:08ee8f1c8b908f1c7cf8d2f9f07dc6a39d69f60b05fb1b6ceb2aac290362bb00`.
Candidate container `789c8a…` is healthy, and its isolated PostgreSQL ledger
contains all 14 migrations. The complete Community contract suite passes
202/202 with clean type checking; the corresponding SyncShow source passes
1,551/1,551 tests.

The live manager walkthrough created canonical sermon record 3 as Ready and
private through **Prepare a sermon**. The service-plan picker defect was not a
manager-role failure: only `syncId` and `syncArchived` used Payload's top-level
`hidden`, which also made those fields unavailable to the relationship option
query. Moving those two fields to `admin.hidden` keeps them out of the ordinary
editor while preserving the canonical picker filter. The leader picker then
listed exactly three canonical, non-archived sermons and successfully selected
record 3. Malformed published canonical rows remained blocked.

The live date projection stores noon in the locked Community IANA time zone and
round-trips the canonical civil date, including Auckland and Kiritimati. The
generic Payload admin date cell remains browser-zone rendered, as described
above; that display caveat does not change the canonical Community-zone date.

After the walkthrough, the temporary user and membership were deleted. The
production-named app and PostgreSQL container identities remained unchanged at
`1b0669…` and `a987f8…`, and the production database retained its five baseline
migrations. The root-only final record is
`/opt/heritage-community-postservice-audio-audit/evidence/manager-operator-final-evidence.json`.
This proves the isolated manager/operator slice, not a production rollout,
packaged SyncShow authorization, authenticated phone/LAN access,
production-copy restore, presentation-machine test, or venue rehearsal.

After startup, the idempotent backfill materializes canonical documents from
legacy lyrics when a song does not have them yet. It preserves original title,
lyrics, Russian fields, rights fields, and existing IDs. Re-running it does not
duplicate documents.

## Safe release and rollback

Before deploying:

```sh
npm run test:syncshow
npm run typecheck
npm run build
```

Run the read-only database preflight against a backup or the live database
before its maintenance window:

```sh
SYNCSHOW_EXPECTED_SONGS=31 npm run preflight:syncshow
```

It opens a repeatable-read, read-only transaction and reports the total,
projected visibility counts, convertible/title-only songs, duplicate sync IDs,
canonical-family topology, and per-song conversion failures. It prints no
credentials or lyrics. A count mismatch, duplicate, split family, or conversion
failure exits nonzero. `DATABASE_URL` must be supplied through the server's
normal secret environment; never paste it into shell history.

Take and verify a PostgreSQL and media backup before applying migrations. The
guided `heritage-community update` command already takes a safety backup,
stops the app for migrations, and requires health checks to pass. Backup and
restore validate the custom PostgreSQL dump catalog before publishing the
backup or reaching database replacement; this rejects an unreadable archive.
The production-stack workflow also wires a guarded synthetic recovery
regression after its smoke test. In a second temporary Compose project with
unique PostgreSQL/media volumes, it seeds two exact sermon-history revisions,
publication/catalog/passage bytes, Ready service-plan pins, a revoked song
link with its snapshot/review/audit, and a media sentinel. It then runs the
real quiesced `backup.sh`, removes those records and bytes, runs the real
`restore.sh --skip-safety-backup`, compares exact pre/post evidence, and checks
public health. Fixture rows are inserted directly and canonically for backup
semantics only; this does not claim those inserts exercised the manager APIs.
The script refuses every host except the exact marked GitHub Actions
`ci-church` loopback environment. Treat this as wired synthetic coverage until
the workflow has actually passed; it does not replace a production-copy or
appliance restore rehearsal. After release, verify
discovery and all five advertised resources, complete one test approval with
the exact intended scopes, and exercise only disposable test records. At
minimum:

- sync a private song and confirm an ordinary member cannot see it;
- publish and withdraw a test sermon, then verify catalog/detail/passage-index
  bytes and Study Bible consumption;
- move a test service plan Draft → Ready → Archived and read it with a scoped
  SyncShow token; and
- create, anonymously read, restart, and revoke one expiring test song link
  while confirming private review evidence never enters its response.

Run those checks first against a database copy or staging deployment. Source
tests and a disposable PostgreSQL runtime do not prove the packaged SyncShow
authorization flow, deployed reverse proxy, desktop/phone accessibility,
production restart durability, production-data recovery, or physical venue
behavior.

Do not run migration `down` operations against production as a casual code
rollback: they can drop SyncShow connections, canonical content, publication
state, planning records, passage indexes, links, snapshots, and audits. If a
rollback must also revert the database, stop writes and restore the complete
pre-migration PostgreSQL and media backup together with the prior application
release. A code-only rollback must be tested against a copy of production
first.

Never commit `PAYLOAD_SECRET`, database credentials, device secrets, approval
codes, access tokens, SMTP passwords, or generated environment files. A strong,
stable `PAYLOAD_SECRET` is required because it protects server authentication
and the recoverable device-token derivation.
