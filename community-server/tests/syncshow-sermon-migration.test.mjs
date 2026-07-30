import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationName = '20260728_234856_syncshow_sermon_roundtrip'
const migrationUrl = new URL(`../src/migrations/${migrationName}.ts`, import.meta.url)
const snapshotUrl = new URL(`../src/migrations/${migrationName}.json`, import.meta.url)
const dateProjectionMigrationName =
  '20260729_220000_canonical_sermon_preached_date_projection'
const dateProjectionMigrationUrl = new URL(
  `../src/migrations/${dateProjectionMigrationName}.ts`,
  import.meta.url,
)

async function migrationParts() {
  const source = await readFile(migrationUrl, 'utf8')
  const downStart = source.indexOf('export async function down')
  assert.notEqual(downStart, -1)
  return {
    source,
    up: source.slice(0, downStart),
    down: source.slice(downStart),
  }
}

async function snapshot() {
  return JSON.parse(await readFile(snapshotUrl, 'utf8'))
}

test('sermon migration applies only the new sermon schema delta', async () => {
  const [{ source, up, down }, index] = await Promise.all([
    migrationParts(),
    readFile(new URL('../src/migrations/index.ts', import.meta.url), 'utf8'),
  ])

  assert.match(up, /CREATE TABLE "syncshow_sermon_changes"/)
  assert.match(up, /ALTER TABLE "sermons" ADD COLUMN "sync_id"/)
  assert.match(up, /ALTER TABLE "payload_locked_documents_rels"[\s\S]*ADD COLUMN "syncshow_sermon_changes_id"/)
  assert.match(down, /DROP TABLE "syncshow_sermon_changes" CASCADE/)
  assert.match(index, new RegExp(migrationName))

  for (const priorMigrationObject of [
    '"songs"',
    '"syncshow_device_grants"',
    '"syncshow_connections"',
    '"enum_songs_visibility"',
    '"enum_syncshow_device_grants_status"',
    "'community-translation'",
  ]) {
    assert.doesNotMatch(source, new RegExp(priorMigrationObject))
  }
})

test('all stable sermon sync fields leave legacy sermon rows null', async () => {
  const [{ up }, schema] = await Promise.all([migrationParts(), snapshot()])
  const expectedColumns = [
    'sync_id',
    'sync_version',
    'sync_current_document_source',
    'sync_current_revision',
    'sync_archived',
    'sync_source_objects',
    'sync_changed_at',
    'sync_create_idempotency_key',
    'sync_create_idempotency_hash',
  ]
  const addColumnLines = up.match(/ALTER TABLE "sermons" ADD COLUMN [^;]+;/g) ?? []
  assert.equal(addColumnLines.length, expectedColumns.length)

  const sermonColumns = schema.tables['public.sermons'].columns
  for (const column of expectedColumns) {
    const line = addColumnLines.find(candidate => candidate.includes(`"${column}"`))
    assert.ok(line, `missing ${column} from migration`)
    assert.doesNotMatch(line, /\bDEFAULT\b|\bNOT NULL\b/)
    assert.equal(sermonColumns[column].notNull, false)
    assert.equal(
      Object.hasOwn(sermonColumns[column], 'default'),
      false,
      `${column} must not backfill a default`,
    )
  }
})

test('append-only journal uses required restrictive parents and a cascading lock relation', async () => {
  const [{ up }, schema, config] = await Promise.all([
    migrationParts(),
    snapshot(),
    readFile(new URL('../src/payload.config.ts', import.meta.url), 'utf8'),
  ])
  const journal = schema.tables['public.syncshow_sermon_changes']
  const lockedRelations = schema.tables['public.payload_locked_documents_rels']

  assert.equal(journal.columns.community_id.notNull, true)
  assert.equal(journal.columns.sermon_id.notNull, true)
  assert.equal(
    journal.foreignKeys.syncshow_sermon_changes_community_id_communities_id_fk.onDelete,
    'restrict',
  )
  assert.equal(
    journal.foreignKeys.syncshow_sermon_changes_sermon_id_sermons_id_fk.onDelete,
    'restrict',
  )
  assert.equal(
    lockedRelations.foreignKeys.payload_locked_documents_rels_syncshow_sermon_changes_fk.onDelete,
    'cascade',
  )
  assert.ok(lockedRelations.columns.syncshow_sermon_changes_id)
  assert.ok(lockedRelations.indexes.payload_locked_documents_rels_syncshow_sermon_changes_id_idx)

  assert.match(
    up,
    /syncshow_sermon_changes_community_id_communities_id_fk[\s\S]*ON DELETE restrict/,
  )
  assert.match(
    up,
    /syncshow_sermon_changes_sermon_id_sermons_id_fk[\s\S]*ON DELETE restrict/,
  )
  assert.match(
    up,
    /payload_locked_documents_rels_syncshow_sermon_changes_fk[\s\S]*ON DELETE cascade/,
  )
  assert.match(config, /beforeSchemaInit: \[restrictSermonSystemParentDeletes\]/)
  assert.match(
    config,
    /\['syncshow_sermon_changes', 'journal', \['community_id', 'sermon_id'\]\]/,
  )
  assert.match(config, /new Set<string>\(parentColumnNames\)/)
  assert.match(config, /column\.reference\.onDelete = 'restrict'/)
})

test('sermon identity, idempotency, and journal version indexes match the contract', async () => {
  const schema = await snapshot()
  const sermons = schema.tables['public.sermons'].indexes
  const journal = schema.tables['public.syncshow_sermon_changes'].indexes

  assert.equal(sermons.community_syncId_1_idx.isUnique, true)
  assert.deepEqual(
    sermons.community_syncId_1_idx.columns.map(column => column.expression),
    ['community_id', 'sync_id'],
  )
  assert.equal(sermons.community_syncCreateIdempotencyKey_idx.isUnique, true)
  assert.deepEqual(
    sermons.community_syncCreateIdempotencyKey_idx.columns.map(column => column.expression),
    ['community_id', 'sync_create_idempotency_key'],
  )
  assert.equal(journal.sermon_syncVersion_idx.isUnique, true)
  assert.deepEqual(
    journal.sermon_syncVersion_idx.columns.map(column => column.expression),
    ['sermon_id', 'sync_version'],
  )
})

test('down migration reverses only sermon additions in dependency order', async () => {
  const { down } = await migrationParts()
  const lockIndex = down.indexOf('DROP INDEX "payload_locked_documents_rels_syncshow_sermon_changes_id_idx"')
  const lockConstraint = down.indexOf('DROP CONSTRAINT "payload_locked_documents_rels_syncshow_sermon_changes_fk"')
  const lockColumn = down.indexOf('DROP COLUMN "syncshow_sermon_changes_id"')
  const journalTable = down.indexOf('DROP TABLE "syncshow_sermon_changes" CASCADE')

  assert.ok(lockIndex < lockConstraint)
  assert.ok(lockConstraint < lockColumn)
  assert.ok(lockColumn < journalTable)
  assert.equal((down.match(/DROP TABLE/g) ?? []).length, 1)
  assert.equal((down.match(/ALTER TABLE "sermons" DROP COLUMN/g) ?? []).length, 9)
})

test('full generated snapshot carries forward the two prior manual migrations', async () => {
  const schema = await snapshot()
  assert.ok(schema.tables['public.syncshow_device_grants'])
  assert.ok(schema.tables['public.syncshow_connections'])
  assert.ok(schema.tables['public.songs'].columns.sync_id)
  assert.ok(schema.enums['public.enum_songs_visibility'])
  assert.ok(
    schema.enums['public.enum_songs_rights_status'].values.includes('community-translation'),
  )
})

test('canonical sermon date repair is a bounded projection-only migration', async () => {
  const [migration, index] = await Promise.all([
    readFile(dateProjectionMigrationUrl, 'utf8'),
    readFile(new URL('../src/migrations/index.ts', import.meta.url), 'utf8'),
  ])
  const up = migration.slice(
    migration.indexOf('export async function up'),
    migration.indexOf('export async function down'),
  )
  const down = migration.slice(migration.indexOf('export async function down'))

  assert.ok(index.indexOf(migrationName) < index.indexOf(dateProjectionMigrationName))
  assert.match(up, /"community_id" AS "communityId"/)
  assert.match(up, /WHERE "sync_id" IS NOT NULL/)
  assert.match(up, /OR "sync_current_document_source" IS NOT NULL/)
  assert.match(up, /incomplete canonical identity/)
  assert.match(up, /FOR UPDATE/)
  assert.match(up, /parseSermonDocument\(documentSource\)/)
  assert.match(up, /serializeSermonDocument\(document\) !== documentSource/)
  assert.match(up, /lockedCommunityTimeZone\(/)
  assert.match(up, /payloadPreachedAtForServiceDate\([\s\S]*timeZone/)
  assert.match(up, /SET "preached_at" = \$\{preachedAt\}::timestamptz/)
  assert.match(up, /"preached_at" IS DISTINCT FROM \$\{preachedAt\}::timestamptz/)
  assert.doesNotMatch(up, /SET "sync_current_document_source"/)
  assert.doesNotMatch(up, /UPDATE "syncshow_sermon_changes"/)
  assert.doesNotMatch(up, /SET "updated_at"/)
  assert.doesNotMatch(down, /UPDATE|DELETE|DROP|ALTER/)
  assert.match(index, new RegExp(`name: '${dateProjectionMigrationName}'`))
})
