# SyncShow song-library integration

The Community server can be the shared source of truth for a church's
SyncShow song library. Version 1 intentionally covers songs only. Sermons,
services, media, and other resources are not granted by these endpoints.

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
4. Review the installation name and requested song scopes, then explicitly
   press **Approve connection**. Merely opening the link never approves it.

The request uses PKCE S256 and a dedicated device secret. Only hashes of device
secrets, approval codes, and access tokens are stored. The resulting opaque
token is a SyncShow token, not a general Community bearer token. Its scopes are
limited to `syncshow:songs:read` and, when requested together with read,
`syncshow:songs:write`.

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

Anonymous catalog and content requests never expose Community songs. Manager
catalog requests include private and not-yet-public scheduled songs so they can
be reviewed and edited.

## Sync behavior

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

## Migration and existing libraries

Migration `20260725_160000_syncshow_song_library` adds song sync identity,
visibility, scheduling, versions, canonical documents, device grants, and
connections. Existing safe slugs become `syncId`; other records receive a
stable `heritage:<database-id>` identity. Existing published songs become
member-public and other songs become private.

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
stops the app for migrations, and requires health checks to pass. After
release, verify discovery, complete one test approval, sync a private test
song, and confirm an ordinary member cannot see it.

Do not run the migration's `down` operation against production as a casual
code rollback: it drops SyncShow connection data and the new song fields. If a
rollback must also revert the database, stop writes and restore the complete
pre-migration backup together with the prior application release. A code-only
rollback should be tested against a copy of production first.

Never commit `PAYLOAD_SECRET`, database credentials, device secrets, approval
codes, access tokens, SMTP passwords, or generated environment files. A strong,
stable `PAYLOAD_SECRET` is required because it protects server authentication
and the recoverable device-token derivation.
