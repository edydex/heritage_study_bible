import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL(
  '../src/migrations/20260729_010500_syncshow_song_public_links.ts',
  import.meta.url,
), 'utf8')
const collection = readFileSync(new URL(
  '../src/collections/SyncShowSongPublicLinks.ts',
  import.meta.url,
), 'utf8')
const snapshot = JSON.parse(readFileSync(new URL(
  '../src/migrations/20260729_010500_syncshow_song_public_links.json',
  import.meta.url,
), 'utf8'))
const migrationIndex = readFileSync(new URL(
  '../src/migrations/index.ts',
  import.meta.url,
), 'utf8')
const payloadConfig = readFileSync(new URL(
  '../src/payload.config.ts',
  import.meta.url,
), 'utf8')
const packageSource = readFileSync(new URL(
  '../package.json',
  import.meta.url,
), 'utf8')

test('song public-link migration preserves immutable authority and history', () => {
  assert.match(migration, /CREATE TABLE "syncshow_song_public_links"/)
  assert.match(migration, /"snapshot_checksum" varchar NOT NULL/)
  assert.match(migration, /"snapshot_source" varchar NOT NULL/)
  assert.match(migration, /"review_source" varchar NOT NULL/)
  assert.match(migration, /"audit_source" varchar NOT NULL/)
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "syncshow_song_public_links_link_id_idx"/,
  )
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "syncshow_song_public_links_create_idempotency_key_hash_idx"/,
  )
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "syncshow_song_public_links_revoke_idempotency_key_hash_idx"/,
  )
  assert.match(
    migration,
    /FOREIGN KEY \("song_id"\)[\s\S]*ON DELETE restrict/,
  )
  assert.match(
    migration,
    /"revoke_idempotency_key_hash" IS NULL[\s\S]*"revoke_request_hash" IS NULL/,
  )
  assert.match(migration, /DROP TABLE "syncshow_song_public_links";/)
  assert.doesNotMatch(
    migration,
    /DROP TABLE "syncshow_song_public_links" CASCADE/,
  )
})

test('collection exposes manager revocation but forbids create and deletion', () => {
  assert.match(collection, /slug: 'syncshow-song-public-links'/)
  assert.match(collection, /create: \(\) => false/)
  assert.match(collection, /delete: \(\) => false/)
  assert.match(collection, /Song public links are immutable except for revocation/)
  assert.match(collection, /songPublicLinkInternalMutation/)
  assert.match(collection, /source: 'community-admin'/)
})

test('schema snapshot and locked-document mapping match the registered collection', () => {
  const table = snapshot.tables['public.syncshow_song_public_links']
  assert.ok(table)
  assert.deepEqual(Object.keys(table.columns), [
    'id',
    'community_id',
    'song_id',
    'schema_version',
    'link_id',
    'link_version',
    'song_sync_id',
    'song_sync_version',
    'family_revision',
    'review_revision',
    'label',
    'issued_at',
    'expires_at',
    'revoked_at',
    'snapshot_checksum',
    'snapshot_source',
    'review_source',
    'audit_source',
    'create_idempotency_key_hash',
    'create_request_hash',
    'revoke_idempotency_key_hash',
    'revoke_request_hash',
    'updated_at',
    'created_at',
  ])
  assert.equal(
    table.foreignKeys
      .syncshow_song_public_links_community_id_communities_id_fk
      .onDelete,
    'restrict',
  )
  assert.equal(
    table.foreignKeys.syncshow_song_public_links_song_id_songs_id_fk
      .onDelete,
    'restrict',
  )
  const locked = snapshot.tables['public.payload_locked_documents_rels']
  assert.ok(locked.columns.syncshow_song_public_links_id)
  assert.ok(
    locked.indexes
      .payload_locked_documents_rels_syncshow_song_public_links_idx,
  )
  assert.equal(
    locked.foreignKeys
      .payload_locked_documents_rels_syncshow_song_public_links_fk
      .tableTo,
    'syncshow_song_public_links',
  )
})

test('migration, Payload config, endpoints, and test suite registrations are reachable', () => {
  const prior = migrationIndex.indexOf(
    "name: '20260729_005827_sermon_passage_index'",
  )
  const current = migrationIndex.indexOf(
    "name: '20260729_010500_syncshow_song_public_links'",
  )
  assert.notEqual(prior, -1)
  assert.ok(current > prior)
  assert.match(
    migrationIndex,
    /import \* as migration_20260729_010500_syncshow_song_public_links/,
  )
  assert.match(
    payloadConfig,
    /import \{ SyncShowSongPublicLinks \} from '@\/collections\/SyncShowSongPublicLinks'/,
  )
  assert.match(payloadConfig, /collections: \[[\s\S]*SyncShowSongPublicLinks,/)
  assert.match(
    payloadConfig,
    /import \{ songPublicLinkEndpoints \} from '@\/endpoints\/songPublicLinks'/,
  )
  assert.match(payloadConfig, /endpoints: \[[\s\S]*\.\.\.songPublicLinkEndpoints,/)
  assert.match(
    payloadConfig,
    /typescript: \{ outputFile: path\.resolve\(dirname, 'payload-types\.ts'\) \}/,
  )
  assert.match(packageSource, /tests\/song-public-link-contract\.test\.ts/)
  assert.match(packageSource, /tests\/song-public-link-endpoint\.test\.ts/)
  assert.match(packageSource, /tests\/song-public-link-migration\.test\.mjs/)
})
