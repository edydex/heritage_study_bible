import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sourceRoot = new URL('../src/', import.meta.url)
const migrationName = '20260729_005039_service_plans'
const sermonReadingMigrationName = '20260729_130000_service_plan_sermon_readings'

async function source(path) {
  return readFile(new URL(path, sourceRoot), 'utf8')
}

test('service-plan migration is additive, narrow, and ordered after sermon authority', async () => {
  const [migration, snapshot, index] = await Promise.all([
    source(`migrations/${migrationName}.ts`),
    source(`migrations/${migrationName}.json`),
    source('migrations/index.ts'),
  ])

  assert.ok(
    index.indexOf('20260729_002359_syncshow_sermon_publications')
      < index.indexOf(migrationName),
  )
  for (const expected of [
    'CREATE TYPE "public"."enum_service_plans_entries_kind"',
    'CREATE TYPE "public"."enum_service_plans_status"',
    'CREATE TABLE "service_plans_entries"',
    'CREATE TABLE "service_plans"',
    '"document_source" varchar NOT NULL',
    '"changed_at" timestamp(3) with time zone NOT NULL',
    'CREATE UNIQUE INDEX "community_syncId_2_idx"',
    'CREATE INDEX "community_changedAt_idx"',
    'ADD COLUMN "service_plans_id" integer',
  ]) {
    assert.match(
      migration,
      new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    )
  }
  assert.equal(
    (migration.match(/CREATE TABLE "service_plans(?:_entries)?"/g) || []).length,
    2,
  )
  assert.doesNotMatch(
    migration,
    /ALTER TABLE "(users|communities|songs|sermons|syncshow_sermon_(?:changes|publications|publication_catalogs))" (?:ADD|DROP) COLUMN/,
  )

  const parsed = JSON.parse(snapshot)
  assert.ok(parsed.tables['public.service_plans'])
  assert.ok(parsed.tables['public.service_plans_entries'])
  assert.ok(parsed.enums['public.enum_service_plans_entries_kind'])
  assert.ok(parsed.enums['public.enum_service_plans_entries_scripture_book_id'])
  assert.ok(parsed.enums['public.enum_service_plans_status'])
})

test('service-plan rollback removes lock ownership before dropping only its own tables', async () => {
  const migration = await source(`migrations/${migrationName}.ts`)
  const down = migration.slice(migration.indexOf('export async function down'))
  const lockConstraint = down.indexOf(
    'DROP CONSTRAINT "payload_locked_documents_rels_service_plans_fk"',
  )
  const lockIndex = down.indexOf(
    'DROP INDEX "payload_locked_documents_rels_service_plans_id_idx"',
  )
  const lockColumn = down.indexOf(
    'DROP COLUMN "service_plans_id"',
  )
  const entriesDrop = down.indexOf('DROP TABLE "service_plans_entries"')
  const planDrop = down.indexOf('DROP TABLE "service_plans"')

  assert.ok(lockConstraint > -1)
  assert.ok(lockConstraint < lockIndex)
  assert.ok(lockIndex < lockColumn)
  assert.ok(lockColumn < entriesDrop)
  assert.ok(entriesDrop < planDrop)
  assert.doesNotMatch(down, /DROP TABLE .*CASCADE/)
  assert.doesNotMatch(
    down,
    /DROP (?:TABLE|TYPE|INDEX) "(?:songs|sermons|syncshow_sermon_)/,
  )
})

test('Payload registers service plans after canonical sermon pins and before successors', async () => {
  const [config, collection, index] = await Promise.all([
    source('payload.config.ts'),
    source('collections/ServicePlans.ts'),
    source('migrations/index.ts'),
  ])
  assert.ok(config.indexOf('Sermons,') < config.indexOf('ServicePlans,'))
  assert.ok(
    config.indexOf('ServicePlans,')
      < config.indexOf('SyncShowSermonChanges,'),
  )
  assert.match(collection, /slug: 'service-plans'/)
  assert.match(collection, /beforeValidate: \[prepareCommunityServicePlanFields\]/)
  assert.match(collection, /fields: \['community', 'syncId'\], unique: true/)
  assert.match(index, new RegExp(`name: '${migrationName}'`))
})

test('sermon-reading migration is an ordered, nullable, relationship-only extension', async () => {
  const [migration, index] = await Promise.all([
    source(`migrations/${sermonReadingMigrationName}.ts`),
    source('migrations/index.ts'),
  ])
  const up = migration.slice(
    migration.indexOf('export async function up'),
    migration.indexOf('export async function down'),
  )

  assert.ok(
    index.indexOf('20260729_045710_syncshow_sermon_change_sources')
      < index.indexOf(sermonReadingMigrationName),
  )
  for (const expected of [
    'ADD COLUMN "scripture_sermon_reading_sermon_id" integer',
    'ADD COLUMN "scripture_sermon_reading_reference_id" varchar',
    'ADD CONSTRAINT "service_plans_entries_scripture_sermon_reading_sermon_id_sermons_id_fk"',
    'FOREIGN KEY ("scripture_sermon_reading_sermon_id")',
    'REFERENCES "public"."sermons"("id")',
    'ON DELETE set null ON UPDATE no action',
    'CREATE INDEX "service_plans_entries_scripture_sermon_reading_scripture_idx"',
    'USING btree ("scripture_sermon_reading_sermon_id")',
  ]) {
    assert.match(
      up,
      new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    )
  }

  assert.equal(
    (up.match(/ALTER TABLE "service_plans_entries"/g) || []).length,
    3,
  )
  assert.doesNotMatch(
    up,
    /(?:^|;)\s*(?:UPDATE|INSERT INTO|DELETE FROM|TRUNCATE)\b/m,
  )
  assert.doesNotMatch(up, /ADD COLUMN[^;]*(?:NOT NULL|DEFAULT)/)
  assert.doesNotMatch(
    up,
    /ALTER TABLE "(?!service_plans_entries")/,
  )
  assert.doesNotMatch(
    up,
    /(?:ADD|DROP) COLUMN "(?!scripture_sermon_reading_(?:sermon_id|reference_id)")/,
  )
})

test('sermon-reading rollback removes only its index, foreign key, and nullable columns', async () => {
  const migration = await source(`migrations/${sermonReadingMigrationName}.ts`)
  const down = migration.slice(migration.indexOf('export async function down'))
  const constraint = down.indexOf(
    'DROP CONSTRAINT "service_plans_entries_scripture_sermon_reading_sermon_id_sermons_id_fk"',
  )
  const index = down.indexOf(
    'DROP INDEX "service_plans_entries_scripture_sermon_reading_scripture_idx"',
  )
  const sermonColumn = down.indexOf(
    'DROP COLUMN "scripture_sermon_reading_sermon_id"',
  )
  const referenceColumn = down.indexOf(
    'DROP COLUMN "scripture_sermon_reading_reference_id"',
  )

  assert.ok(constraint > -1)
  assert.ok(constraint < index)
  assert.ok(index < sermonColumn)
  assert.ok(sermonColumn < referenceColumn)
  assert.equal((down.match(/DROP CONSTRAINT/g) || []).length, 1)
  assert.equal((down.match(/DROP INDEX/g) || []).length, 1)
  assert.equal((down.match(/DROP COLUMN/g) || []).length, 2)
  assert.doesNotMatch(
    down,
    /(?:^|;)\s*(?:UPDATE|INSERT INTO|DELETE FROM|TRUNCATE)\b/m,
  )
  assert.doesNotMatch(down, /\bDROP (?:TABLE|TYPE)\b/)
  assert.doesNotMatch(
    down,
    /ALTER TABLE "(?!service_plans_entries")/,
  )
})

test('sermon-reading schema snapshot changes only the two fields, relationship, and index', async () => {
  const [beforeSource, afterSource] = await Promise.all([
    source('migrations/20260729_045710_syncshow_sermon_change_sources.json'),
    source(`migrations/${sermonReadingMigrationName}.json`),
  ])
  const before = JSON.parse(beforeSource)
  const after = JSON.parse(afterSource)
  const table = after.tables['public.service_plans_entries']

  assert.deepEqual(
    table.columns.scripture_sermon_reading_sermon_id,
    {
      name: 'scripture_sermon_reading_sermon_id',
      type: 'integer',
      primaryKey: false,
      notNull: false,
    },
  )
  assert.deepEqual(
    table.columns.scripture_sermon_reading_reference_id,
    {
      name: 'scripture_sermon_reading_reference_id',
      type: 'varchar',
      primaryKey: false,
      notNull: false,
    },
  )
  assert.deepEqual(
    table.foreignKeys
      .service_plans_entries_scripture_sermon_reading_sermon_id_sermons_id_fk,
    {
      name: 'service_plans_entries_scripture_sermon_reading_sermon_id_sermons_id_fk',
      tableFrom: 'service_plans_entries',
      tableTo: 'sermons',
      columnsFrom: ['scripture_sermon_reading_sermon_id'],
      columnsTo: ['id'],
      onDelete: 'set null',
      onUpdate: 'no action',
    },
  )
  assert.deepEqual(
    table.indexes
      .service_plans_entries_scripture_sermon_reading_scripture_idx.columns,
    [{
      expression: 'scripture_sermon_reading_sermon_id',
      isExpression: false,
      asc: true,
      nulls: 'last',
    }],
  )

  delete table.columns.scripture_sermon_reading_sermon_id
  delete table.columns.scripture_sermon_reading_reference_id
  delete table.foreignKeys
    .service_plans_entries_scripture_sermon_reading_sermon_id_sermons_id_fk
  delete table.indexes
    .service_plans_entries_scripture_sermon_reading_scripture_idx
  after.id = before.id

  assert.deepEqual(after, before)
})
