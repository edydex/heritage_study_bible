import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { extendDrizzleTable } from '@payloadcms/drizzle'
import { generateDrizzleJson } from 'drizzle-kit/api'
import { pgTable, varchar } from 'drizzle-orm/pg-core'
import { up } from '../src/migrations/20260729_045710_syncshow_sermon_change_sources.ts'
import { preserveSermonHistoryChecksum } from '../src/payload.config.ts'

type AnyRecord = Record<string, any>

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/syncshow-sermon-contract-v1.json', import.meta.url),
  'utf8',
)) as {
  sermons: {
    v3: {
      canonicalSource: string
      document: AnyRecord
    }
  }
}

test('Payload schema generation retains the sermon history checksum constraint', async () => {
  const journal = pgTable('syncshow_sermon_changes', {
    revision: varchar('revision').notNull(),
    documentSource: varchar('document_source').notNull(),
  }, () => ({}))
  const schema = {
    enums: {},
    relations: {},
    tables: { syncshow_sermon_changes: journal },
  }
  const result = await preserveSermonHistoryChecksum({
    adapter: {} as never,
    extendTable: extendDrizzleTable,
    schema: schema as never,
  })
  assert.equal(result, schema)

  const snapshot = generateDrizzleJson({ journal })
  assert.deepEqual(
    snapshot.tables['public.syncshow_sermon_changes']
      .checkConstraints.syncshow_sermon_changes_document_revision_check,
    {
      name: 'syncshow_sermon_changes_document_revision_check',
      value: '"syncshow_sermon_changes"."revision" ~ \'^[0-9a-f]{64}$\' AND encode(sha256(convert_to("syncshow_sermon_changes"."document_source", \'UTF8\')), \'hex\') = "syncshow_sermon_changes"."revision"',
    },
  )
})

test('migration rejects noncanonical legacy authority before any schema change', async () => {
  const original = fixture.sermons.v3
  const noncanonicalSource = `${original.canonicalSource.slice(0, -1)} \n`
  let executeCalls = 0
  const db = {
    execute: async () => {
      executeCalls += 1
      return {
        rows: [{
          journalId: 1,
          syncId: original.document.id,
          archived: false,
          documentSource: noncanonicalSource,
        }],
      }
    },
  }

  await assert.rejects(
    up({ db } as never),
    /no reconstructable canonical source/,
  )
  assert.equal(
    executeCalls,
    1,
    'canonical preflight must fail before ALTER TABLE is executed',
  )
})
