# Signed-in member song sharing

Ordinary song saves are private. Making lyrics visible to signed-in Community
members is a separate, exact-family review transaction:

`POST /api/community/syncshow/v1/song-member-sharing/:syncId`

The transaction requires the normal SyncShow song read/write scopes,
`If-Match: "song:<syncId>:<syncVersion>"`, and an `Idempotency-Key`. Discovery
advertises it at:

```json
{
  "resources": {
    "songs": {
      "memberSharing": {
        "schemaVersion": 1,
        "endpoint": "song-member-sharing",
        "reviewScope": "community-members"
      }
    }
  }
}
```

The request pins the exact family revision, a digest-bound
`community-members` review, and either immediate or scheduled member
visibility. A finite review records a civil `validUntil` date. The Community
server locks the configured IANA time zone and stores the final millisecond of
that local day; clients never guess the server's offset.

Inside one database transaction the server rechecks the connection and manager
role, serializes on the idempotency key, locks the exact Community song, checks
its version and exact family digest, derives the review boundary, writes an
immutable receipt/audit row, and attaches the redacted receipt to the new song
version. A lost-response retry returns the same receipt.

Visibility flags alone are not authority. Member reads additionally require the
attached receipt to match the current song version, visibility, schedule, and
unexpired review. Ordinary SyncShow or Payload-admin edits cannot set Public or
Scheduled. An ordinary edit without an explicit visibility choice demotes a
shared song and clears its active receipt; explicit Private demotion is always
allowed.

Anonymous bearer links remain a different permission scope and collection.
Their `public-link` review never satisfies a `community-members` review, or the
reverse.

Migration `20260730_120000_song_member_sharing` deliberately demotes every
legacy Public/Scheduled song to Private because those older rows have no
exact-family receipt. Each song must be reviewed again before members can see
its lyrics.
