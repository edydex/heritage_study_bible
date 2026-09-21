import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { buildConfig, getPayload } from 'payload'
import { SyncShowSermonChanges } from '../src/collections/SyncShowSermonChanges.ts'
import {
  down,
  up,
} from '../src/migrations/20260729_045710_syncshow_sermon_change_sources.ts'
import { createSermonRevision } from '../src/lib/syncshow/SermonDocument.ts'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase.ts'

type AnyRecord = Record<string, any>

const liveDatabaseUrl = process.env.SERMON_HISTORY_LIVE_DATABASE_URL
const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/syncshow-sermon-contract-v1.json', import.meta.url),
  'utf8',
)) as {
  sermons: {
    v3: {
      document: AnyRecord
      canonicalSource: string
      revision: string
    }
  }
}

test('real PostgreSQL migration and Payload overrideAccess deletion preserve exact history', {
  skip: !liveDatabaseUrl,
  timeout: 60_000,
}, async () => {
  assertDisposableLiveDatabase({
    databaseUrl: liveDatabaseUrl,
    expectedDatabase: 'heritage_syncshow_sermon_history_live',
    expectedMarker: 'heritage-community-syncshow-sermon-history-live-v1',
    variableName: 'SERMON_HISTORY_LIVE_DATABASE_URL',
  })
  const pool = new pg.Pool({ connectionString: liveDatabaseUrl })
  const db = drizzle(pool)
  const original = fixture.sermons.v3
  const revisedDocument = structuredClone(original.document)
  revisedDocument.titles[revisedDocument.defaultLanguage] =
    'A distinct retained history revision'
  const revised = createSermonRevision(revisedDocument)

  async function resetBase({
    currentSource,
    currentRevision,
    journalRevision,
  }: {
    currentSource: string
    currentRevision: string
    journalRevision: string
  }) {
    await pool.query(`
      DROP TABLE IF EXISTS "syncshow_sermon_changes";
      DROP TABLE IF EXISTS "sermons";
      DROP TABLE IF EXISTS "communities";
      CREATE TABLE "communities" (
        "id" integer PRIMARY KEY
      );
      CREATE TABLE "sermons" (
        "id" integer PRIMARY KEY,
        "community_id" integer NOT NULL,
        "sync_id" varchar NOT NULL,
        "sync_current_revision" varchar,
        "sync_current_document_source" varchar,
        "sync_archived" boolean
      );
      CREATE TABLE "syncshow_sermon_changes" (
        "id" serial PRIMARY KEY,
        "community_id" integer NOT NULL,
        "sermon_id" integer NOT NULL,
        "sync_id" varchar NOT NULL,
        "sync_version" numeric NOT NULL,
        "revision" varchar NOT NULL,
        "archived" boolean DEFAULT false NOT NULL,
        "changed_at" timestamp(3) with time zone NOT NULL
      );
    `)
    await pool.query(
      `INSERT INTO "communities" ("id") VALUES (7)`,
    )
    await pool.query(
      `INSERT INTO "sermons" (
        "id",
        "community_id",
        "sync_id",
        "sync_current_revision",
        "sync_current_document_source",
        "sync_archived"
      ) VALUES (1, 7, $1, $2, $3, false)`,
      [original.document.id, currentRevision, currentSource],
    )
    await pool.query(
      `INSERT INTO "syncshow_sermon_changes" (
        "community_id",
        "sermon_id",
        "sync_id",
        "sync_version",
        "revision",
        "archived",
        "changed_at"
      ) VALUES (7, 1, $1, 1, $2, false, now())`,
      [original.document.id, journalRevision],
    )
  }

  async function migrateUp() {
    await db.transaction(async transaction => {
      await up({ db: transaction } as never)
    })
  }

  async function migrateDown() {
    await db.transaction(async transaction => {
      await down({ db: transaction } as never)
    })
  }

  async function documentSourceColumn() {
    return (await pool.query(`
      SELECT "is_nullable" AS "isNullable"
      FROM "information_schema"."columns"
      WHERE "table_schema" = 'public'
        AND "table_name" = 'syncshow_sermon_changes'
        AND "column_name" = 'document_source';
    `)).rows[0] as { isNullable: string } | undefined
  }

  try {
    await resetBase({
      currentSource: original.canonicalSource,
      currentRevision: original.revision,
      journalRevision: original.revision,
    })

    await migrateUp()
    assert.deepEqual(await documentSourceColumn(), { isNullable: 'NO' })
    assert.deepEqual(
      (await pool.query(
        `SELECT "document_source" AS "documentSource", "revision"
         FROM "syncshow_sermon_changes"`,
      )).rows,
      [{
        documentSource: original.canonicalSource,
        revision: original.revision,
      }],
    )

    await migrateDown()
    assert.equal(await documentSourceColumn(), undefined)
    await migrateUp()
    assert.deepEqual(await documentSourceColumn(), { isNullable: 'NO' })

    await assert.rejects(
      pool.query(
        `UPDATE "syncshow_sermon_changes"
         SET "document_source" = $1
         WHERE "id" = 1`,
        [revised.source],
      ),
      /syncshow_sermon_changes_document_revision_check/,
    )
    assert.equal(
      (await pool.query(
        `SELECT "document_source" AS "documentSource"
         FROM "syncshow_sermon_changes"
         WHERE "id" = 1`,
      )).rows[0].documentSource,
      original.canonicalSource,
    )

    await pool.query(
      `UPDATE "sermons"
       SET
         "sync_current_revision" = $1,
         "sync_current_document_source" = $2
       WHERE "id" = 1`,
      [revised.sha256, revised.source],
    )
    await pool.query(
      `INSERT INTO "syncshow_sermon_changes" (
        "community_id",
        "sermon_id",
        "sync_id",
        "sync_version",
        "revision",
        "document_source",
        "archived",
        "changed_at"
      ) VALUES (7, 1, $1, 2, $2, $3, false, now())`,
      [original.document.id, revised.sha256, revised.source],
    )
    await assert.rejects(
      migrateDown(),
      /Cannot roll back exact sermon revision history/,
    )
    assert.deepEqual(await documentSourceColumn(), { isNullable: 'NO' })
    assert.equal(
      (await pool.query(
        `SELECT COUNT(*)::integer AS "count"
         FROM "syncshow_sermon_changes"`,
      )).rows[0].count,
      2,
    )

    await resetBase({
      currentSource: revised.source,
      currentRevision: revised.sha256,
      journalRevision: original.revision,
    })
    await assert.rejects(
      migrateUp(),
      /no reconstructable canonical source/,
    )
    assert.equal(
      await documentSourceColumn(),
      undefined,
      'failed migration must roll back the nullable staging column',
    )

    const noncanonicalSource = `${original.canonicalSource.slice(0, -1)} \n`
    const noncanonicalRevision = createHash('sha256')
      .update(noncanonicalSource, 'utf8')
      .digest('hex')
    await resetBase({
      currentSource: noncanonicalSource,
      currentRevision: noncanonicalRevision,
      journalRevision: noncanonicalRevision,
    })
    await assert.rejects(
      migrateUp(),
      /no reconstructable canonical source/,
    )
    assert.equal(
      await documentSourceColumn(),
      undefined,
      'noncanonical legacy bytes must fail before the schema is changed',
    )
  } finally {
    await pool.query(`
      DROP TABLE IF EXISTS "syncshow_sermon_changes";
      DROP TABLE IF EXISTS "sermons";
      DROP TABLE IF EXISTS "communities";
    `)
    await pool.end()
  }

  const payloadConfig = await buildConfig({
    secret: 'sermon-history-local-api-test-secret',
    db: postgresAdapter({
      pool: { connectionString: liveDatabaseUrl },
      push: true,
    }),
    collections: [
      {
        slug: 'users',
        auth: true,
        fields: [],
      },
      {
        slug: 'communities',
        fields: [{ name: 'name', type: 'text', required: true }],
      },
      {
        slug: 'sermons',
        fields: [{ name: 'title', type: 'text', required: true }],
      },
      SyncShowSermonChanges,
    ],
  })
  const payload = await getPayload({ config: payloadConfig })
  try {
    const community = await payload.create({
      collection: 'communities',
      overrideAccess: true,
      data: { name: 'Local API immutability test' },
    } as never) as AnyRecord
    const sermon = await payload.create({
      collection: 'sermons',
      overrideAccess: true,
      data: { title: 'Retained exact history' },
    } as never) as AnyRecord
    const change = await payload.create({
      collection: 'syncshow-sermon-changes',
      overrideAccess: true,
      context: { syncShowSermonChangeMutation: true },
      data: {
        community: community.id,
        sermon: sermon.id,
        syncId: original.document.id,
        syncVersion: 1,
        revision: original.revision,
        documentSource: original.canonicalSource,
        archived: false,
        changedAt: new Date().toISOString(),
      },
    })

    await assert.rejects(
      payload.delete({
        collection: 'syncshow-sermon-changes',
        id: change.id,
        overrideAccess: true,
      }),
      /append-only and immutable/i,
    )
    const retained = await payload.findByID({
      collection: 'syncshow-sermon-changes',
      id: change.id,
      overrideAccess: true,
      showHiddenFields: true,
    })
    assert.equal(retained.documentSource, original.canonicalSource)
    assert.equal(retained.revision, original.revision)
  } finally {
    const database = payload.db as {
      destroy?: () => Promise<void>
      pool?: {
        _clients?: Array<{
          end?: () => Promise<void>
          release?: (destroy?: boolean) => void
        }>
        _idle?: Array<{ client?: object }>
        end: () => Promise<void>
      }
    }
    if (database.pool) {
      const pool = database.pool
      const ending = pool.end()
      const endedNormally = await Promise.race([
        ending.then(() => true),
        new Promise<false>(resolve => setTimeout(() => resolve(false), 1_000)),
      ])
      if (!endedNormally) {
        const idleClients = new Set(
          (pool._idle || []).map(entry => entry.client),
        )
        for (const client of pool._clients || []) {
          if (idleClients.has(client)) continue
          if (typeof client.release === 'function') client.release(true)
          else await client.end?.()
        }
        await ending
      }
    }
    await database.destroy?.()
  }
})
