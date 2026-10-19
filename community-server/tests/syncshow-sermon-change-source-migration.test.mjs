import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationName = '20260729_045710_syncshow_sermon_change_sources'
const sourceRoot = new URL('../src/', import.meta.url)

async function source(path) {
  return readFile(new URL(path, sourceRoot), 'utf8')
}

async function migrationParts() {
  const migration = await source(`migrations/${migrationName}.ts`)
  const downStart = migration.indexOf('export async function down')
  assert.notEqual(downStart, -1)
  return {
    migration,
    up: migration.slice(0, downStart),
    down: migration.slice(downStart),
  }
}

test('sermon history source migration is generated, additive, and ordered after 010500', async () => {
  const [{ up }, snapshotSource, index, packageSource, payloadConfig] = await Promise.all([
    migrationParts(),
    source(`migrations/${migrationName}.json`),
    source('migrations/index.ts'),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
    source('payload.config.ts'),
  ])
  const snapshot = JSON.parse(snapshotSource)
  const journal = snapshot.tables['public.syncshow_sermon_changes']

  assert.ok(
    index.indexOf('20260729_010500_syncshow_song_public_links')
      < index.indexOf(migrationName),
  )
  assert.match(index, new RegExp(`name: '${migrationName}'`))
  assert.match(
    packageSource,
    /tests\/syncshow-sermon-change-source-migration\.test\.mjs/,
  )
  assert.match(
    packageSource,
    /test:syncshow:sermon-history-live[\s\S]*tests\/syncshow-sermon-change-source-postgres\.test\.ts/,
  )
  assert.deepEqual(journal.columns.document_source, {
    name: 'document_source',
    type: 'varchar',
    primaryKey: false,
    notNull: true,
  })
  assert.deepEqual(
    journal.checkConstraints.syncshow_sermon_changes_document_revision_check,
    {
      name: 'syncshow_sermon_changes_document_revision_check',
      value: '"syncshow_sermon_changes"."revision" ~ \'^[0-9a-f]{64}$\' AND encode(sha256(convert_to("syncshow_sermon_changes"."document_source", \'UTF8\')), \'hex\') = "syncshow_sermon_changes"."revision"',
    },
  )
  assert.match(
    payloadConfig,
    /afterSchemaInit: \[preserveSermonHistoryChecksum\]/,
  )
  assert.match(
    payloadConfig,
    /check\([\s\S]*syncshow_sermon_changes_document_revision_check/,
  )
  assert.ok(snapshot.tables['public.syncshow_song_public_links'])
  assert.equal(
    (up.match(/ADD COLUMN "document_source"/g) || []).length,
    1,
  )
  assert.doesNotMatch(
    up,
    /ALTER TABLE "(?!syncshow_sermon_changes")[^"]+"\s+(?:ADD|DROP) COLUMN/,
  )
})

test('migration backfills only exact current revisions and fails closed on older history', async () => {
  const { up } = await migrationParts()
  const canonicalPreflight = up.indexOf('const candidates = resultRows')
  const addColumn = up.indexOf('ADD COLUMN "document_source" varchar')
  const backfill = up.indexOf('UPDATE "syncshow_sermon_changes" AS journal')
  const failClosed = up.indexOf('unreconstructable_count')
  const notNull = up.indexOf('ALTER COLUMN "document_source" SET NOT NULL')
  const checksumConstraint = up.indexOf(
    'ADD CONSTRAINT "syncshow_sermon_changes_document_revision_check"',
  )

  assert.ok(canonicalPreflight > -1)
  assert.ok(canonicalPreflight < addColumn)
  assert.ok(addColumn < backfill)
  assert.ok(backfill < failClosed)
  assert.ok(failClosed < notNull)
  assert.ok(notNull < checksumConstraint)
  assert.match(up, /journal\."sermon_id" = sermon\."id"/)
  assert.match(up, /journal\."community_id" = sermon\."community_id"/)
  assert.match(up, /journal\."sync_id" = sermon\."sync_id"/)
  assert.match(up, /journal\."revision" = sermon\."sync_current_revision"/)
  assert.match(
    up,
    /journal\."archived" IS NOT DISTINCT FROM sermon\."sync_archived"/,
  )
  assert.match(
    up,
    /sha256\(convert_to\(sermon\."sync_current_document_source", 'UTF8'\)\)/,
  )
  assert.match(
    up,
    /sermon\."sync_current_document_source"::jsonb ->> 'id'[\s\S]*= journal\."sync_id"/,
  )
  assert.match(up, /#>> '\{publication,status\}'/)
  assert.match(up, /\) = 'archived'[\s\S]*IS NOT DISTINCT FROM journal\."archived"/)
  assert.match(up, /WHERE "document_source" IS NULL/)
  assert.match(up, /RAISE EXCEPTION USING/)
  assert.match(up, /ERRCODE = '23514'/)
  assert.match(up, /no reconstructable canonical source/)
  assert.match(up, /parseSermonDocument\(documentSource\)/)
  assert.match(
    up,
    /serializeSermonDocument\(document\) !== documentSource/,
  )
})

test('database constraint binds every retained source byte-for-byte to its revision', async () => {
  const { up } = await migrationParts()
  assert.match(up, /"revision" ~ '\^\[0-9a-f\]\{64\}\$'/)
  assert.match(
    up,
    /sha256\(convert_to\("document_source", 'UTF8'\)\)/,
  )
  assert.match(
    up,
    /encode\([\s\S]*sha256\([\s\S]*\),[\s\S]*'hex'[\s\S]*\) = "revision"/,
  )
})

test('rollback refuses to erase distinct history before removing only its own additions', async () => {
  const { down } = await migrationParts()
  const failClosed = down.indexOf('historical_count')
  const constraint = down.indexOf(
    'DROP CONSTRAINT "syncshow_sermon_changes_document_revision_check"',
  )
  const column = down.indexOf('DROP COLUMN "document_source"')
  assert.ok(failClosed > -1)
  assert.ok(failClosed < constraint)
  assert.ok(constraint > -1)
  assert.ok(constraint < column)
  assert.match(
    down,
    /journal\."revision" IS DISTINCT FROM sermon\."sync_current_revision"/,
  )
  assert.match(
    down,
    /journal\."document_source"[\s\S]*IS DISTINCT FROM sermon\."sync_current_document_source"/,
  )
  assert.match(
    down,
    /journal\."archived" IS DISTINCT FROM sermon\."sync_archived"/,
  )
  assert.match(down, /Cannot roll back exact sermon revision history/)
  assert.match(down, /RAISE EXCEPTION USING/)
  assert.match(down, /ERRCODE = '23514'/)
  assert.equal((down.match(/DROP CONSTRAINT/g) || []).length, 1)
  assert.equal((down.match(/DROP COLUMN/g) || []).length, 1)
  assert.doesNotMatch(down, /DROP TABLE|CASCADE/)
})

test('journal collection keeps source authority hidden, internal-only, and immutable', async () => {
  const collection = await source('collections/SyncShowSermonChanges.ts')
  assert.match(collection, /admin: \{ hidden: true \}/)
  assert.match(collection, /read: isSystemAdmin/)
  assert.match(collection, /create: \(\) => false/)
  assert.match(collection, /update: \(\) => false/)
  assert.match(collection, /delete: \(\) => false/)
  assert.match(
    collection,
    /name: 'documentSource'[\s\S]*type: 'textarea'[\s\S]*required: true[\s\S]*hidden: true/,
  )
  assert.match(collection, /operation !== 'create'/)
  assert.match(collection, /append-only and immutable/)
  assert.match(collection, /beforeDelete: \[rejectSermonChangeDeletion\]/)
  assert.match(collection, /syncShowSermonChangeMutation/)
  assert.match(collection, /serializeSermonDocument\(document\) !== documentSource/)
})
