# Heritage Study Bible

Heritage is a Bible-reading and church-resource app for the web and Android.
It is designed to work well as a useful standalone study Bible while also
letting a church turn the same app into its own library and community hub.

## Product model

Heritage has three deliberately separate layers:

1. **The app and bundled library** provide Scripture, commentary, search,
   bookmarks, notes, reading plans, and offline-friendly reading without an
   account.
2. **Content Servers** are public, read-only static sites. A user reviews one
   before adding it, then its Bible plans, songs, sermons, books, and
   commentaries appear alongside bundled resources. Static servers cannot read
   personal notes or sign users in.
3. **Communities** are optional church-hosted services. They include a Content
   Server plus email sign-in, memberships, shared plan cohorts and notes,
   events, RSVPs, calendar export, and storage for client-encrypted sync data.

The static Content Server contract lives in [`protocol/`](protocol/). The
reference dynamic service is the separate deployable in
[`community-server/`](community-server/).

## Current features

- Six Bible translations with parallel reading and versification support.
- Source-backed paragraph and poetry layout where the translation source
  publishes it; the BSB metadata is generated from its USFM source.
- Commentary, library, transcript, Bible, and book search.
- Verse and commentary bookmarks, notes, progress persistence, import/export,
  and Android-native storage support.
- A 365-day chronological plan with stable progress migration, contextual plan
  notes, optional reflections, and compact plan-day navigation.
- Android volume-button scrolling with configurable distance and animation.
- Installable public Content Servers with preview, validation, metadata
  refresh, on-demand resource loading, and explicit offline saves.
- Multiple Community registrations with one primary community, email magic
  links, events, RSVPs, reminders in exported calendar files, and public
  content installation.

## App development

Use Node.js 22 or newer.

```sh
npm install
npm run dev
```

Validation:

```sh
npm test
npm run build
git diff --check
```

The web app uses React 19, Vite 6, Tailwind CSS 4, and a hash router so the same
build can be hosted statically and embedded in Capacitor. Android build and
debug instructions are in [`ANDROID.md`](ANDROID.md).

## Content Server development

A static server publishes `/heritage-content.json`, one catalog per supported
resource type, and the files referenced by those catalogs. URLs may be
relative, but the host must allow cross-origin `GET` requests.

The companion `foolish-and-weak` repository is the reference static server. It
uses Eleventy and Decap CMS, including structured editors for Bible plans,
songs and attachments, sermons, books, and commentary. Its local Decap proxy
works without a GitLab account:

```sh
npm install
npm run dev:cms
# open http://localhost:8080/admin/
```

The first screen may still say **Login**; clicking it enters the credential-free
local proxy and writes edits into that working tree.

## Community server development

The reference server uses Payload, Next.js, and PostgreSQL and is deployed
independently from the static app.

```sh
cd community-server
cp .env.example .env
docker compose up -d postgres
npm install --legacy-peer-deps
npm run dev
```

Open `http://localhost:3000/admin`, create the first system administrator, then
create a Community and its initial owner Membership. Development uses a local
JSON mail transport and returns a test magic link. Public/member-enabled
production requires HTTPS and SMTP; every production server requires a strong
Payload secret and backups. See
[`community-server/README.md`](community-server/README.md) for the deployment
contract.

For production on a fresh Debian headless laptop, the guided installer handles
Docker, secrets, PostgreSQL migrations, first-user/community setup, Cloudflare
Tunnel, SMTP testing, backups, updates, restores, and closed-lid operation;
Cloudflare and SMTP may both be skipped for local/SSH testing.
Follow [`community-server/docs/SELF_HOSTING.md`](community-server/docs/SELF_HOSTING.md).

## Data and provenance

Bundled and remote resources retain source, rights, attribution, and revision
metadata. Reading-plan item IDs are stable across day rebalancing so an updated
plan does not silently discard completed chapters. Personal Community session
tokens are intentionally excluded from Heritage backup exports.

Heritage is MIT licensed. Individual Bible translations, books, commentaries,
sermons, songs, and other resources retain their own stated licenses and
attribution requirements.
