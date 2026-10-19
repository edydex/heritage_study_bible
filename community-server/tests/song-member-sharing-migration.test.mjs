import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL(
  '../src/migrations/20260730_120000_song_member_sharing.ts',
  import.meta.url,
), 'utf8')
const migrationIndex = readFileSync(new URL(
  '../src/migrations/index.ts',
  import.meta.url,
), 'utf8')
const payloadConfig = readFileSync(new URL(
  '../src/payload.config.ts',
  import.meta.url,
), 'utf8')
const songs = readFileSync(new URL(
  '../src/collections/Songs.ts',
  import.meta.url,
), 'utf8')
const collection = readFileSync(new URL(
  '../src/collections/SyncShowSongMemberShares.ts',
  import.meta.url,
), 'utf8')
const catalog = readFileSync(new URL(
  '../src/app/catalogs/[type]/route.ts',
  import.meta.url,
), 'utf8')
const content = readFileSync(new URL(
  '../src/app/content/[type]/[id]/route.ts',
  import.meta.url,
), 'utf8')
const syncShowEndpoint = readFileSync(new URL(
  '../src/endpoints/syncShow.ts',
  import.meta.url,
), 'utf8')
const packageSource = readFileSync(new URL(
  '../package.json',
  import.meta.url,
), 'utf8')

test('migration fails closed and persists exact immutable review receipts', () => {
  assert.match(
    migration,
    /UPDATE "songs"[\s\S]*"visibility" = 'private'[\s\S]*WHERE "visibility" IN \('public', 'scheduled-public'\)/,
  )
  assert.match(migration, /CREATE TABLE "syncshow_song_member_shares"/)
  assert.match(
    migration,
    /CREATE TYPE "public"\."enum_syncshow_song_member_shares_visibility"[\s\S]*AS ENUM\('public', 'scheduled-public'\)/,
  )
  assert.match(migration, /"review_source" varchar NOT NULL/)
  assert.match(migration, /"audit_source" varchar NOT NULL/)
  assert.match(migration, /"idempotency_key_hash" varchar NOT NULL/)
  assert.match(migration, /"request_hash" varchar NOT NULL/)
  assert.match(migration, /ADD CONSTRAINT "songs_member_share_authority_check"/)
  assert.match(
    migration,
    /"member_share_song_sync_version" = "sync_version"/,
  )
  assert.match(
    migration,
    /"member_share_visibility" = "visibility"::text/,
  )
  assert.match(
    migration,
    /FOREIGN KEY \("song_id"\)[\s\S]*ON DELETE restrict/,
  )
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "syncshow_song_member_shares_idempotency_key_hash_idx"/,
  )
  assert.doesNotMatch(
    migration,
    /DROP TABLE "syncshow_song_member_shares" CASCADE/,
  )
  assert.match(
    migration,
    /DROP TYPE "public"\."enum_syncshow_song_member_shares_visibility"/,
  )
})

test('Payload registration and admin paths cannot bypass the gate', () => {
  assert.match(collection, /slug: 'syncshow-song-member-shares'/)
  assert.match(collection, /create: \(\) => false/)
  assert.match(collection, /update: \(\) => false/)
  assert.match(collection, /delete: \(\) => false/)
  assert.match(songs, /enforceSongMemberSharingMutation/)
  assert.match(
    payloadConfig,
    /import \{ SyncShowSongMemberShares \} from '@\/collections\/SyncShowSongMemberShares'/,
  )
  assert.match(
    payloadConfig,
    /import \{ songMemberSharingEndpoints \} from '@\/endpoints\/songMemberSharing'/,
  )
  assert.match(
    payloadConfig,
    /collections: \[[\s\S]*SyncShowSongMemberShares,/,
  )
  assert.match(
    payloadConfig,
    /endpoints: \[[\s\S]*\.\.\.songMemberSharingEndpoints,/,
  )
  assert.match(
    migrationIndex,
    /name: '20260730_120000_song_member_sharing'/,
  )
  assert.match(packageSource, /tests\/song-member-sharing-contract\.test\.ts/)
  assert.match(packageSource, /tests\/song-member-sharing-store\.test\.ts/)
  assert.match(packageSource, /tests\/song-member-sharing-migration\.test\.mjs/)
})

test('member catalog and detail routes require receipts and project fields', () => {
  assert.match(catalog, /memberShareReceiptId: \{ exists: true \}/)
  assert.match(catalog, /memberShareValidThrough: \{ greater_than_equal: now \}/)
  assert.match(catalog, /isSongVisibleToMember/)
  assert.match(catalog, /showHiddenFields: type === 'songs'/)
  assert.match(content, /memberSongContentProjection/)
  assert.match(content, /showHiddenFields: type === 'songs'/)
  assert.doesNotMatch(content, /\.\.\.doc,/)
})

test('authenticated SyncShow reads explicitly load hidden receipt authority', () => {
  const findSongStart = syncShowEndpoint.indexOf('async function findSong')
  const findSongEnd = syncShowEndpoint.indexOf(
    'function routeSyncId',
    findSongStart,
  )
  const listStart = syncShowEndpoint.indexOf('const songsListGet')
  const listEnd = syncShowEndpoint.indexOf('const songsCreate', listStart)
  assert.ok(findSongStart >= 0 && findSongEnd > findSongStart)
  assert.ok(listStart >= 0 && listEnd > listStart)
  assert.match(
    syncShowEndpoint.slice(findSongStart, findSongEnd),
    /showHiddenFields: true,[\s\S]*\breq,/,
  )
  assert.match(
    syncShowEndpoint.slice(listStart, listEnd),
    /showHiddenFields: true,[\s\S]*\breq,/,
  )
})
