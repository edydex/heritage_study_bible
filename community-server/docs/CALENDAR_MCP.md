# Church calendar MCP (disabled by default)

This adds a remote Streamable HTTP MCP endpoint to the existing Heritage Community server. It operates on that server's configured church calendar. It does not create a second calendar, move the church to Sites, or grant access to other church content.

## Interface and permissions

Endpoint: `/api/community/calendar/mcp`. OAuth discovery: `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`.

Exactly three tools exist:

| Tool | Required permission | Behavior |
| --- | --- | --- |
| `church_calendar_read` | `calendar:read` | Read event series and occurrences for up to 63 days; return current versions and church timezone/default visibility. |
| `church_calendar_create` | `calendar:create` | Create a single event, using a stable source identity and request ID. |
| `church_calendar_update` | `calendar:update` | Edit allowed event fields only, with a current `expectedVersion` and request ID. |

Every grant also requires `calendar:read`. No tools expose deletion, cancellation, recurrence management, RSVP/member data, users, settings changes, or arbitrary HTTP requests. A manager can edit an existing recurring series' title/time/description; its recurrence rules remain intact. Read responses include cancelled event flags so people can assess existing records; cancellation cannot be changed by the integration.

New events use `visibility: inherit` unless explicitly supplied. At WOTBC this inherits the members-only church default. Explicit `members` and `public` visibility are accepted; publication must be an intentional user request. Event text is data, never authorization or instructions.

Example create arguments (illustrative fixture, not an approved live event):

```json
{
  "requestId": "approved-announcement-2026-10-04-v1",
  "source": "church-approved-calendar",
  "sourceId": "announcement-2026-10-04",
  "event": {
    "title": "Example church event",
    "startsAt": "2026-10-04T10:00:00-07:00",
    "endsAt": "2026-10-04T11:00:00-07:00",
    "timeZone": "America/Los_Angeles"
  }
}
```

Use the same `source`/`sourceId` for one external event across retries, and the same `requestId` for one unchanged mutation. Request IDs are unique per church and registered client. Reusing a request ID with different input returns a conflict. A new request ID with an existing source identity returns its current event without overwriting human edits; different input for that identity requires an explicit update. Source identity deduplication does not guess matches against previously hand-entered events: read the date range and review existing events before adding a newly sourced item.

Update arguments are `{ requestId, eventId, expectedVersion, changes }`. Versions are decimal strings. A PostgreSQL trigger increments the version on *every* event update, including Payload/admin and direct SQL updates. MCP holds the event row lock, compares the version, then writes through Payload with its normal event validation. Stale input returns `VERSION_CONFLICT`/412. Read and review the changed event before submitting a new approved mutation. A retry of a completed mutation returns its original recorded result with `replayed: true`; that snapshot is not a new read of current state.

Dates must be RFC3339 with seconds and an explicit offset or `Z`, plus an IANA timezone. Offset/zone mismatches and nonexistent DST times are rejected. Fall-back overlaps require choosing the correct offset. Times are stored as UTC instants; the existing church calendar occurrence logic preserves local service time across DST. Read results are capped at 500 matching series / 1 MiB; request smaller ranges if needed.

## OAuth lifecycle

The maintained `@node-oauth/oauth2-server` library handles authorization-code exchange and S256 PKCE validation; the official MCP TypeScript SDK handles MCP transport/schema/protocol behavior. No custom transport or PKCE cryptography is implemented. Temporal validates calendar instants and timezone offsets.

Only one preconfigured **public OAuth client** is accepted. No DCR, CIMD fetching, client-credentials grant, password grant, wildcard callback, or external identity-provider container is introduced. The client ID is not a secret. Token requests use `token_endpoint_auth_method: none` and include the exact `resource` URI. Issuer identification (`iss`) is included in every redirect response. Discovery advertises S256 and the narrow scopes only.

A current `owner`, `admin`, or `leader` membership in the configured church is required, including for system administrators. The existing Heritage manager login authenticates the consent page, not MCP calls. Consent requests have a five-minute, user-bound, single-use nonce and require same-origin approval. Read is preselected; create/update must be selected by the manager. Callback, client ID, requested scopes, state, audience, and S256 challenge are checked before consent is offered.

Grants last at most 30 days. Access tokens last at most ten minutes. Refresh tokens rotate and cannot extend the grant expiration. Reuse of a rotated refresh token revokes the grant. Tokens and authorization codes are persisted only as SHA-256 digests. Manager membership, audience, client, grant expiry and revocation are checked for token use, issuance, and each tool operation. Write transactions lock the grant and manager membership against concurrent revocation or demotion.

Managers can review and revoke their connections at `/api/community/calendar/oauth/connections`. The RFC7009 token revocation endpoint is `/api/community/calendar/oauth/revoke`; revoking an access or refresh token revokes its entire grant. Disabling the feature immediately blocks discovery, consent and MCP calls. OAuth tokens cannot authorize the existing general Payload API or SyncShow device endpoints.

## Storage, deployment and rollback

Migration `20261005_120000_calendar_mcp` adds one hidden Events version field/trigger and seven private SQL tables for grants, consent nonces, codes, tokens, source mappings, idempotency receipts, and audit records. These tables are not registered Payload collections and have no public REST/GraphQL CRUD. All successful tool operations, consent, token issuance/refresh, replays and revocations create an audit record containing actor/church/client/grant, action, event ID and versions, and request ID when applicable. Audit rows are immutable to ordinary update/delete SQL. Calendar writes, source mappings, receipts and audit inserts commit or roll back together.

Regular database backups include these tables. Preserve source mappings/receipts for duplicate safety. Audit and rotated-token tombstones are retained; no automated retention task is added. Expired consent nonces are cleaned on new consent requests. An operator with database ownership can still alter/drop schema; these are application audit records, not an external tamper-proof archive.

The migration initializes existing event versions to `1` without changing event content. The reverse migration deletes integration grants, receipts, audits, and the version field/trigger. Prefer disabling MCP while keeping this additive schema during an application rollback, so audit and duplicate-safety history survive. Do not run the reverse migration on a live database without separately approving that data loss.

Production Compose passes these disabled-by-default variables:

```text
COMMUNITY_CALENDAR_MCP_ENABLED=false
COMMUNITY_CALENDAR_MCP_CLIENT_ID=
COMMUNITY_CALENDAR_MCP_REDIRECT_URI=
```

There is no additional service, port, signing key, production credential, or provider account. TLS remains on the existing public church proxy. The proxy must preserve the public `Host`; MCP validates it exactly and never trusts arbitrary `X-Forwarded-Host`. Browser Origin must equal the church origin. Server-to-server calls can omit Origin. POST is the supported stateless MCP transport; GET/SSE sessions and DELETE are not supported.

### Baseline compatibility: do not deploy main wholesale

Implementation baseline: `0585b2f2c72a82e1cbd5ee28f2d81ec7477e0487` (main). The deployable port is based on `211066bb6eb6e10a1f8f4061906617046838d35f` (also PR46 head), with all of that baseline preserved. The supplied deployment commit is `3ff1599719692b994c825d370d031f3d6a4cafc4`; its Events, calendar endpoints and event validator match main's baseline. Read-only SSH verification on October 5 found the production source checkout at `/opt/heritage-community/app` clean at `211066bb`, branch `codex/unified-companion-20260913`. The installed management status command reported healthy app/database/tunnel/translation and backups. No production environment files, credentials or event data were read. Container image provenance should still be confirmed by the normal release procedure.

The original Mac checkout at `/Users/omayo/GitHub/heritage_study_bible` is on `codex/syncshow-community-integration`, HEAD `711d8345810b57780773ff958628c88f6c6f085e`, with extensive pre-existing changes. That committed Events schema predates visibility, recurrence and the current event validator. It is not a deployable target for this patch without first reconciling the calendar foundation. Its tracked/untracked files were left untouched.

Deployment commit `3ff1599` has migrations absent from main: `20261001_220000_people_language`, `20261001_230000_service_save_history`, `20261002_000000_retire_song_member_sharing`, and `20261002_010000_workspace_activity`. **Do not replace the deployment files with main's versions.** This port preserves the deployment migration registry, Payload config, lockfile additions, Compose configuration, generated types, and retired-feature constraints. It adds only the feature imports/registration/field, new files/migration, four dependency additions, three runtime environment keys, and tests/CI wiring. The production updater should receive the reviewed deployment-based patch, not the main-based artifact. The complete 33-migration chain and full Payload configuration were tested on a fresh disposable local database, including retired song-sharing constraints, MCP writes and human-edit version conflicts. A restored production backup was not used; staging against a production backup remains part of deployment approval.

### Approval gates before activation

1. Review this port from the verified deployment source `211066bb`; approve push/PR if desired. Recheck the source revision before releasing if other work has landed.
2. Approve the reviewed release, production backup, additive migration and deployment using the established Heritage updater. Existing baseline dependency audit findings need a separate release decision; this patch does not upgrade them.
3. Approve the public OAuth client ID and exact callback shown in the personal-plugin management page, enabling the three runtime variables on the church server. Use the HTTPS WOTBC MCP resource URL. Do not reuse an admin cookie or SyncShow token as a credential.
4. Create/install a personal plugin pointing at the existing server's MCP endpoint using OAuth and the configured public client; a church manager approves the selected read/create/update permissions. Verify real connection and revocation in a staging calendar first. This live OpenAI-host handshake remains untested locally.
5. Only after the connection is confirmed, approve live event changes/import separately. The parent's seven-event import is not performed by this implementation. For future automation, start with a read-only grant and separately authorize any automated writes; expect manager reconsent when the 30-day grant expires.

Official setup references: [custom MCP servers](https://developers.openai.com/api/docs/guides/custom-mcp-server), [plugin OAuth authentication](https://developers.openai.com/plugins/build/auth).

## Verification

`npm run typecheck`, `npm run build`, and `npm run test:calendar-mcp` (contract tests; database test skips unless explicitly enabled).

For real integration tests, create a **disposable loopback** database named `heritage_calendar_mcp_test`, set both `CALENDAR_MCP_TEST_DATABASE_URL` and `DATABASE_URL` to that exact database URL, and set `HERITAGE_DISPOSABLE_CI=heritage-calendar-mcp-test-v1`. Then run `npm run test:calendar-mcp`. The test intentionally drops/recreates its guarded schema, uses real Payload event validation and PostgreSQL transactions, and verifies migration up/down. It never reads a production environment file. CI supplies PostgreSQL 17 and the same guard.

Local verification used Node 24.3.0 and PostgreSQL 17. The new packages are pinned: MCP SDK `1.32.1`, OAuth server `5.3.0`, Temporal polyfill `0.5.1`, and Zod `4.6.5`. Baseline and integration lockfiles report the same 25 npm audit findings; no new affected package names were introduced. No unrelated dependency upgrades were applied.

The deployment port also includes `tests/calendar-mcp-migration-history.test.ts`. Enable it with `CALENDAR_MCP_MIGRATION_TEST_DATABASE_URL` and `DATABASE_URL` naming the same disposable loopback database `heritage_calendar_mcp_deployment_test`, and `HERITAGE_DISPOSABLE_CI=heritage-calendar-mcp-migration-test-v1`. Run it explicitly with `node --import tsx --test --test-force-exit tests/calendar-mcp-migration-history.test.ts`, a disposable `PAYLOAD_SECRET`, `COMMUNITY_ID=local-church`, and `NODE_ENV=production`. It recreates only that guarded database schema and applies the entire preserved deployment migration chain.

Final deployment-port validation: 25 adversarial MCP/OAuth/Payload/Postgres tests passed; the separately enabled full deployment migration/config test passed (33 migrations); 59 existing calendar, access, auth and current deployment planner regressions passed; TypeScript checking and the production Next build passed. The optional full-history test is intentionally skipped in the ordinary adversarial-suite invocation and is run separately with its own guarded database.
