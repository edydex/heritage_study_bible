# Personal reading-progress synchronization

Heritage Community Accounts are an optional, private synchronization service
for the Heritage Bible app. They are separate from church membership: a reader
may synchronize through a Community server without becoming a member of that
church or receiving its member-only content.

## Data and privacy model

Synchronization is record based. The supported record families are the Bible
position, per-resource positions, active reading-plan position, reading-plan
days and items, reading-plan day notes, Bible and resource bookmarks, verse
notes, and highlights. Stable client IDs identify independently editable
records. Deletes become tombstones, and a PostgreSQL sequence assigns every
accepted mutation a server-monotonic revision.

Record bodies are encrypted individually with AES-256-GCM. The key is derived
from the server's Payload secret, the account ID, and an explicit key-version
context using HKDF-SHA-256; authenticated metadata binds ciphertext to its
account, record type, record ID, schema version, and tombstone state. Plaintext
note, bookmark, and highlight bodies are not exposed in Payload's admin UI.
The database does retain operational metadata such as account ID, record type,
record ID, revisions, timestamps, device IDs, and tombstone state.

This is **server-authorized encryption at rest, not end-to-end encryption**.
The running server must decrypt records for an authenticated owner to sync or
export them. A person with both database/runtime access and the Payload secret
can therefore decrypt personal records. Keep the secret and backups protected.
Changing the Payload secret requires a deliberate data re-encryption migration;
blind secret rotation will make existing synchronized payloads unreadable.

Tombstones and conflict copies are retained so an offline device cannot
silently resurrect a deletion and a collision remains recoverable. They are
removed when the reader uses **Erase synchronized server data**. Account
security events contain action metadata, not personal reading text.

## Authentication and protection

Email magic links are the default. Tokens are random, short lived, single use,
stored only as hashes, invalidated by resend, and subject to persistent
email/address attempt limits. A successful sign-in creates a separate,
revocable session for the requesting device. A session token is never included
in Heritage data exports. Android stores it encrypted by an Android Keystore
key; the web app keeps it in tab/session storage and requires sign-in again
after that browser session ends.

Readers can opt into **Strict password protection** after a recent email
re-verification and, where supported, local device authentication. Adding a new
device then requires both a valid email link and the strict password. Strict
passwords are hashed with Argon2id and are never logged or returned. There is no
logged-out password-reset route, recovery code, administrator override, or
support backdoor. Losing the password while signed out everywhere means losing
access to the synchronized account data. Readers should export their data and
save the password in a password manager before enabling this mode.

Protection changes, new device sign-ins, and revocations create in-app security
events and attempt to send a notification email. Connected devices can be
reviewed and revoked under **Settings → Sync → Manage account**.

## Merge and conflict behavior

The first sync takes a local rollback export before changing data. Independent
record IDs merge. An overlapping local record replaces an older server record
only when the server verifies that this is a first-sync request and the local
timestamp is newer; the displaced encrypted value is retained. Older or
ambiguous overlaps and later same-record concurrent edits become explicit
conflicts, leaving the local attempted value intact rather than silently
overwriting it. Imported Heritage backups merge synchronized record families;
an import cannot replace a record already acknowledged by the current sync
state or resurrect a known tombstone.

Synchronization is intentionally safe to interrupt. A request batch commits in
one database transaction, and per-account/per-record transaction locks prevent
two devices from both accepting the same base revision. Offline edits stay
local until the reader selects **Sync now** again.

## Owner operations and deployment

The owner-only account API provides device and security-event metadata,
personal-data export, conflict recovery, per-device revocation, current-device
sign-out, and synchronized-data erasure. All personal queries are scoped to the
authenticated account. System administrators can manage church memberships,
but Community bearer sessions cannot use the generic Payload user-update API.

Before applying this schema to a self-hosted server, test the migration against
a disposable restore of a current backup. Production updates must use the
supported `heritage-community backup` and `heritage-community update` commands;
do not run ad-hoc schema changes against the live database. A backup contains
encrypted personal records and the secret material needed to decrypt them, so
it must receive the same protection as the live server.
