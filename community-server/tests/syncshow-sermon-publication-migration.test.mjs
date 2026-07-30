import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sourceRoot = new URL('../src/', import.meta.url)
const migrationName = '20260729_002359_syncshow_sermon_publications'
const passageIndexMigrationName = '20260729_005827_sermon_passage_index'

async function source(path) {
  return readFile(new URL(path, sourceRoot), 'utf8')
}

test('publication migration is a narrow successor with immutable detail and catalog authority', async () => {
  const [migration, snapshot, index] = await Promise.all([
    source(`migrations/${migrationName}.ts`),
    source(`migrations/${migrationName}.json`),
    source('migrations/index.ts'),
  ])
  assert.ok(
    index.indexOf('20260728_234856_syncshow_sermon_roundtrip')
      < index.indexOf(migrationName),
  )
  for (const expected of [
    'CREATE TABLE "syncshow_sermon_publications"',
    '"published_document_source" varchar NOT NULL',
    '"detail_source" varchar NOT NULL',
    '"detail_checksum" varchar NOT NULL',
    '"catalog_item_source" varchar NOT NULL',
    '"catalog_item_checksum" varchar NOT NULL',
    'CREATE TABLE "syncshow_sermon_publication_catalogs"',
    '"generation" numeric NOT NULL',
    '"checksum" varchar NOT NULL',
    '"source" varchar NOT NULL',
    'CREATE UNIQUE INDEX "community_sermon_idx"',
    'CREATE UNIQUE INDEX "community_publicId_idx"',
    'CREATE UNIQUE INDEX "syncshow_sermon_publication_catalogs_community_idx"',
    'ON DELETE restrict',
    'ADD COLUMN "sync_publication_status"',
    'ADD COLUMN "sync_visibility"',
    '"sync_current_document_source"::jsonb',
    '2c8d818469dc72882c2da93cba63d47a65fcb96aea8d0a52bdb000d7c255617d',
    '{"contentType":"sermons","items":[],"schemaVersion":2}',
  ]) assert.match(migration, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.equal((migration.match(/ALTER TABLE "sermons" ADD COLUMN/g) || []).length, 2)
  assert.doesNotMatch(migration, /ALTER TABLE "(users|songs|events|memberships)" ADD COLUMN/)

  const lockedConstraint = migration.indexOf(
    'DROP CONSTRAINT "payload_locked_documents_rels_syncshow_sermon_publication_fk"',
  )
  const publicationDrop = migration.indexOf('DROP TABLE "syncshow_sermon_publications"')
  assert.ok(lockedConstraint > -1 && lockedConstraint < publicationDrop)

  const parsed = JSON.parse(snapshot)
  const tables = parsed.tables
  assert.ok(tables['public.syncshow_sermon_publications'])
  assert.ok(tables['public.syncshow_sermon_publication_catalogs'])
  assert.ok(tables['public.sermons'].columns.sync_publication_status)
  assert.ok(tables['public.sermons'].columns.sync_visibility)
})

test('collection schema protects authority rows without redacting internal overrideAccess reads', async () => {
  const [publication, catalog, config] = await Promise.all([
    source('collections/SyncShowSermonPublications.ts'),
    source('collections/SyncShowSermonPublicationCatalogs.ts'),
    source('payload.config.ts'),
  ])
  for (const text of [publication, catalog]) {
    assert.match(text, /admin: \{ hidden: true \}/)
    assert.match(text, /create: \(\) => false/)
    assert.match(text, /update: \(\) => false/)
    assert.match(text, /delete: \(\) => false/)
    assert.doesNotMatch(text, /FieldAccess|protectedFieldAccess/)
    assert.equal((text.match(/\baccess:/g) || []).length, 1)
  }
  assert.match(publication, /fields: \['community', 'sermon'\], unique: true/)
  assert.match(publication, /fields: \['community', 'publicId'\], unique: true/)
  assert.match(publication, /name: 'publishedDocumentSource'/)
  assert.match(publication, /name: 'catalogItemSource'/)
  assert.match(catalog, /name: 'community'[\s\S]*unique: true/)
  assert.match(catalog, /name: 'passageIndexChecksum'/)
  assert.match(catalog, /name: 'passageIndexSource'/)
  assert.match(config, /syncshow_sermon_publications/)
  assert.match(config, /syncshow_sermon_publication_catalogs/)
  assert.match(config, /column\.reference\.onDelete = 'restrict'/)
  assert.match(config, /ensurePublicSermonCatalog/)
})

test('passage-index authority is an additive successor after service plans', async () => {
  const [migration, snapshot, index] = await Promise.all([
    source(`migrations/${passageIndexMigrationName}.ts`),
    source(`migrations/${passageIndexMigrationName}.json`),
    source('migrations/index.ts'),
  ])
  assert.ok(
    index.indexOf('20260729_005039_service_plans')
      < index.indexOf(passageIndexMigrationName),
  )
  assert.match(
    migration,
    /ADD COLUMN "passage_index_checksum" varchar/,
  )
  assert.match(
    migration,
    /ADD COLUMN "passage_index_source" varchar/,
  )
  assert.match(migration, /buildPublicSermonPassageIndex/)
  assert.match(migration, /parsePublicSermonCatalogSource/)
  assert.match(migration, /ALTER COLUMN "passage_index_checksum" SET NOT NULL/)
  assert.match(migration, /ALTER COLUMN "passage_index_source" SET NOT NULL/)
  assert.match(migration, /DROP COLUMN "passage_index_checksum"/)
  assert.match(migration, /DROP COLUMN "passage_index_source"/)

  const parsed = JSON.parse(snapshot)
  const columns = parsed.tables['public.syncshow_sermon_publication_catalogs'].columns
  assert.equal(columns.passage_index_checksum.type, 'varchar')
  assert.equal(columns.passage_index_checksum.notNull, true)
  assert.equal(columns.passage_index_source.type, 'varchar')
  assert.equal(columns.passage_index_source.notNull, true)
})

test('publication Local API calls explicitly request hidden authority fields', async () => {
  const [managerEndpoint, store] = await Promise.all([
    source('endpoints/sermonPublications.ts'),
    source('lib/syncshow/SermonPublicationStore.ts'),
  ])
  assert.equal(
    (managerEndpoint.match(/collection: 'sermons'[\s\S]{0,180}showHiddenFields: true/g) || []).length,
    2,
  )
  assert.equal(
    (managerEndpoint.match(/collection: 'syncshow-sermon-publications'[\s\S]{0,180}showHiddenFields: true/g) || []).length,
    2,
  )
  assert.equal(
    (store.match(/collection: 'syncshow-sermon-publications'[\s\S]{0,180}showHiddenFields: true/g) || []).length,
    2,
  )
  assert.equal(
    (store.match(/collection: 'syncshow-sermon-publication-catalogs'[\s\S]{0,180}showHiddenFields: true/g) || []).length,
    4,
  )
})

test('every publication state mutation materializes the catalog in its existing transaction', async () => {
  const [managerEndpoint, syncEndpoint, store] = await Promise.all([
    source('endpoints/sermonPublications.ts'),
    source('endpoints/syncShow.ts'),
    source('lib/syncshow/SermonPublicationStore.ts'),
  ])
  assert.match(managerEndpoint, /Community manager is required/)
  assert.match(managerEndpoint, /startsWith\('SyncShow '\)/)
  assert.match(managerEndpoint, /assertLiveManager/)
  assert.match(managerEndpoint, /FOR SHARE/)
  assert.match(
    managerEndpoint,
    /s\."sync_publication_status" = 'ready'[\s\S]*OR p\."active" = true/,
  )
  assert.match(managerEndpoint, /refreshPublicSermonCatalog\(req, communityId, publishedAt\)/)
  assert.match(managerEndpoint, /deactivateSermonPublicationForArchive/)
  assert.match(syncEndpoint, /deactivateSermonPublicationForArchive/)
  assert.match(store, /refreshPublicSermonCatalog\(req, communityId, monotonicWithdrawnAt\)/)
  const lock = store.indexOf('FROM "syncshow_sermon_publication_catalogs"')
  const snapshot = store.indexOf('SELECT p."catalog_item_source"')
  assert.ok(lock > -1 && lock < snapshot)
  assert.match(store, /Sermon catalog authority has not been initialized/)
  assert.match(store, /nextCanonicalPublicationTime/)
})
