import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'
import { getPayload, type Payload, type Where } from 'payload'
import core from '../packages/service-core/node.js'
import {
  blankServiceDocument,
  managerServiceDocumentEndpoints,
} from '../src/endpoints/serviceDocuments'
import { serviceHistoryEndpoints } from '../src/endpoints/serviceHistory'
import {
  mutateServiceDocument,
  serviceSaveRequestHash,
} from '../src/endpoints/syncShow'
import {
  up,
  down,
} from '../src/migrations/20261001_230000_service_save_history'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase'

type Value = Record<string, any>
const databaseUrl = process.env.SERVICE_HISTORY_LIVE_DATABASE_URL
const marker = 'heritage-community-history-payload-live-v1'
function endpoint(path: string, method: string, history = false) {
  const handler = (
    history ? serviceHistoryEndpoints : managerServiceDocumentEndpoints
  ).find((entry) => entry.path === path && entry.method === method)?.handler
  assert.ok(handler, `missing ${method} ${path}`)
  return handler
}
const create = endpoint('/community/service-documents', 'post')
const update = endpoint('/community/service-documents/:syncId', 'put')
const read = endpoint('/community/service-documents/:syncId', 'get')
const history = endpoint(
  '/community/service-documents/:syncId/history',
  'get',
  true,
)
const historical = endpoint(
  '/community/service-documents/:syncId/history/:syncVersion',
  'get',
  true,
)
function request(
  payload: Payload,
  user: Value | undefined,
  syncId: string,
  body?: Value,
  extra = {},
) {
  return {
    payload,
    user: user ? { ...user, collection: 'users' } : undefined,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    routeParams: { syncId },
    query: { page: '1' },
    url: `http://localhost/api/community/service-documents/${syncId}`,
    text: async () => JSON.stringify(body),
    transactionID: undefined,
    ...extra,
  } as never
}
async function body(response: Response, expected = 200) {
  const value = (await response.json()) as Value
  assert.equal(response.status, expected, JSON.stringify(value))
  return value
}
function edit(envelope: Value, text: string) {
  const project = JSON.parse(
    JSON.stringify(
      core.parseHeritageServiceDocumentSource(envelope.documentSource).project,
    ),
  )
  project.revision++
  project.updatedAt = new Date().toISOString()
  project.items.notice = {
    id: 'notice',
    kind: 'notice',
    title: 'Projected point',
    operatorNotes: '',
    textByChannel: { english: text, russian: text, media: text },
    presetId: 'notice-text',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
  project.rootItemIds = ['notice']
  return core.serializeHeritageServiceDocument(
    core.createHeritageServiceDocument(project),
  )
}
function save(
  envelope: Value,
  saveKind = 'automatic',
  source = envelope.documentSource,
  status = envelope.status,
) {
  return {
    schemaVersion: 1,
    requestId: randomUUID(),
    syncId: envelope.syncId,
    baseSyncVersion: envelope.syncVersion,
    baseRevision: envelope.revision,
    documentSource: source,
    status,
    saveKind,
  }
}
async function close(payload: Payload) {
  const adapter = payload.db as any,
    pool = adapter.pool
  if (pool) {
    const ending = pool.end()
    if (
      !(await Promise.race([
        ending.then(() => true),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), 1000)),
      ]))
    ) {
      const idle = new Set((pool._idle || []).map((entry: any) => entry.client))
      for (const client of pool._clients || [])
        if (!idle.has(client)) {
          if (typeof client.release === 'function') client.release(true)
          else await client.end?.()
        }
      await ending
    }
  }
  await adapter.destroy?.()
}

test(
  'real disposable PostgreSQL editor history preserves transactions, retries, restoration and church access',
  {
    skip: !databaseUrl,
    timeout: 180_000,
  },
  async (t) => {
    assertDisposableLiveDatabase({
      databaseUrl,
      expectedDatabase: 'heritage_history_test',
      expectedMarker: marker,
      variableName: 'SERVICE_HISTORY_LIVE_DATABASE_URL',
    })
    const client = new Client({ connectionString: databaseUrl })
    await client.connect()
    assert.equal(
      (await client.query('SELECT current_database() AS name')).rows[0].name,
      'heritage_history_test',
    )
    // This dedicated database contains disposable fixtures only. Rebuild its
    // schema on each explicitly opted-in run so migration tests are repeatable.
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
    let activePayload: Payload | undefined
    try {
      const { default: config } = await import('../src/payload.config')
      const resolved = await config
      // Full production collections/hooks, with setup/maintenance jobs disabled:
      // this fixture must never send email, seed an outside service, or run a job.
      resolved.onInit = async () => {}
      resolved.db = postgresAdapter({
        pool: { connectionString: databaseUrl },
        push: true,
      }) as typeof resolved.db
      const payload = await getPayload({ config })
      activePayload = payload
      t.diagnostic(
        'Fresh full Payload schema initialized in dedicated history database',
      )
      const columns = async () =>
        (
          await client.query(
            "SELECT column_name,is_nullable FROM information_schema.columns WHERE table_name='service_document_saves' ORDER BY ordinal_position",
          )
        ).rows
      assert.equal(
        (await columns()).find(
          (column) => column.column_name === 'request_hash',
        )?.is_nullable,
        'NO',
      )
      // The table is newly initialized and empty; exercise the shipped migration
      // independently of development schema push before writing fixtures.
      assert.equal(
        Number(
          (
            await client.query(
              'SELECT count(*) AS count FROM service_document_saves',
            )
          ).rows[0].count,
        ),
        0,
      )
      await down({ db: drizzle(client) } as never)
      assert.equal(
        (
          await client.query(
            "SELECT to_regclass('public.service_document_saves') AS name",
          )
        ).rows[0].name,
        null,
      )
      await up({ db: drizzle(client) } as never)
      assert.equal(
        (await columns()).find(
          (column) => column.column_name === 'request_hash',
        )?.is_nullable,
        'NO',
      )
      t.diagnostic(
        'New save-history migration down/up and required request hash verified',
      )

      const suffix = randomUUID().slice(0, 8)
      const community = await payload.create({
        collection: 'communities',
        overrideAccess: true,
        data: {
          name: 'History test church',
          slug: process.env.COMMUNITY_ID || 'local-church',
          timeZone: 'America/Los_Angeles',
          joinPolicy: 'invite',
          calendarDefaultVisibility: 'members',
        },
      })
      const other = await payload.create({
        collection: 'communities',
        overrideAccess: true,
        data: {
          name: 'Other test church',
          slug: `history-other-${suffix}`,
          timeZone: 'UTC',
          joinPolicy: 'invite',
          calendarDefaultVisibility: 'members',
        },
      })
      const leader = await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: {
          email: `leader-${suffix}@example.invalid`,
          password: 'Disposable_history_test_password_20261001',
          displayName: 'History Pastor',
          systemRole: 'member',
          accountProtection: 'email',
          syncGeneration: 1,
        },
      })
      const member = await payload.create({
        collection: 'users',
        overrideAccess: true,
        data: {
          email: `member-${suffix}@example.invalid`,
          password: 'Disposable_history_test_password_20261001',
          displayName: 'History Member',
          systemRole: 'member',
          accountProtection: 'email',
          syncGeneration: 1,
        },
      })
      await payload.create({
        collection: 'memberships',
        overrideAccess: true,
        data: {
          community: community.id,
          user: leader.id,
          role: 'leader',
          joinedAt: new Date().toISOString(),
        },
      })
      await payload.create({
        collection: 'memberships',
        overrideAccess: true,
        data: {
          community: community.id,
          user: member.id,
          role: 'member',
          joinedAt: new Date().toISOString(),
        },
      })
      const syncId = `history-live-${suffix}`
      let current = (
        await body(
          await create(
            request(payload, leader, syncId, {
              schemaVersion: 1,
              requestId: randomUUID(),
              syncId,
              title: 'History fixture',
              serviceDate: '2026-10-04',
            }),
          ),
          201,
        )
      ).serviceDocument
      assert.equal(current.syncVersion, 1)
      const firstAutomatic = save(
        current,
        'automatic',
        edit(current, 'First projected point'),
        'planning',
      )
      current = (
        await body(
          await update(request(payload, leader, syncId, firstAutomatic)),
        )
      ).serviceDocument
      assert.equal(current.syncVersion, 2)
      const firstSnapshot = current
      current = (
        await body(
          await update(
            request(
              payload,
              leader,
              syncId,
              save(current, 'automatic', current.documentSource, 'ready'),
            ),
          ),
        )
      ).serviceDocument
      assert.equal(current.syncVersion, 3)
      assert.equal(current.status, 'ready')
      const manual = save(current, 'manual'),
        manualSnapshot = current
      current = (
        await body(await update(request(payload, leader, syncId, manual)))
      ).serviceDocument
      assert.equal(current.syncVersion, 3)
      assert.equal(current.status, 'ready')
      const journalScope: Where = {
        and: [
          { community: { equals: community.id } },
          { syncId: { equals: syncId } },
        ],
      }
      const journal = () =>
        payload.find({
          collection: 'syncshow-service-document-changes',
          overrideAccess: true,
          showHiddenFields: true,
          limit: 100,
          where: journalScope,
        })
      assert.equal((await journal()).totalDocs, 3)
      const saveScope: Where = {
        and: [
          { community: { equals: community.id } },
          {
            serviceDocument: {
              equals: (
                await payload.find({
                  collection: 'service-documents',
                  overrideAccess: true,
                  limit: 1,
                  where: { syncId: { equals: syncId } },
                })
              ).docs[0].id,
            },
          },
        ],
      }
      const checkpoints = () =>
        payload.find({
          collection: 'service-document-saves',
          overrideAccess: true,
          limit: 100,
          where: saveScope,
        })
      const checkpoint = (await checkpoints()).docs.find(
        (entry) => entry.requestId === `manager-service-${manual.requestId}`,
      )!
      const { managerWrite } = await import('../src/endpoints/serviceDocuments')
      assert.equal(
        checkpoint.requestHash,
        serviceSaveRequestHash(managerWrite(manual).write, 'manual'),
      )
      current = (
        await body(
          await update(
            request(
              payload,
              leader,
              syncId,
              save(
                current,
                'automatic',
                edit(current, 'A later projected point'),
                'planning',
              ),
            ),
          ),
        )
      ).serviceDocument
      assert.equal(current.syncVersion, 4)
      assert.equal(
        (await body(await update(request(payload, leader, syncId, manual))))
          .serviceDocument.documentSource,
        manualSnapshot.documentSource,
      )
      assert.equal(
        (
          await body(
            await update(request(payload, leader, syncId, firstAutomatic)),
          )
        ).serviceDocument.documentSource,
        firstSnapshot.documentSource,
      )
      assert.equal(
        (await body(await read(request(payload, leader, syncId))))
          .serviceDocument.documentSource,
        current.documentSource,
      )
      assert.equal((await checkpoints()).totalDocs, 4)
      await body(
        await update(
          request(payload, leader, syncId, {
            ...manual,
            baseSyncVersion: current.syncVersion,
          }),
        ),
        409,
      )
      await body(
        await update(
          request(payload, leader, syncId, {
            ...manual,
            baseRevision: current.revision,
          }),
        ),
        409,
      )
      await body(
        await update(
          request(payload, leader, syncId, {
            ...manual,
            requestId: randomUUID(),
          }),
        ),
        412,
      )
      assert.equal((await journal()).totalDocs, 4)
      t.diagnostic(
        'Real unchanged Ready checkpoint, older exact retries, request-base409 and stale CAS412 passed',
      )

      const listed = await body(await history(request(payload, leader, syncId)))
      assert.ok(
        listed.groups.some(
          (group: Value) =>
            group.saveKind === 'manual' && group.savedBy === 'History Pastor',
        ),
      )
      assert.ok(
        listed.groups.some(
          (group: Value) =>
            group.saveKind === 'automatic' && group.entries.length > 1,
        ),
      )
      assert.equal(
        listed.groups
          .flatMap((group: Value) => group.entries)
          .some((entry: Value) => 'requestHash' in entry),
        false,
      )
      const beforeRestore = await body(
        await historical(
          request(payload, leader, syncId, undefined, {
            routeParams: { syncId, syncVersion: '2' },
          }),
        ),
      )
      assert.equal(
        beforeRestore.serviceDocument.documentSource,
        firstSnapshot.documentSource,
      )
      const restoredProject = JSON.parse(
        JSON.stringify(
          core.parseHeritageServiceDocumentSource(firstSnapshot.documentSource)
            .project,
        ),
      )
      restoredProject.revision =
        core.parseHeritageServiceDocumentSource(current.documentSource).project
          .revision + 1
      restoredProject.updatedAt = new Date().toISOString()
      current = (
        await body(
          await update(
            request(
              payload,
              leader,
              syncId,
              save(
                current,
                'restore',
                core.serializeHeritageServiceDocument(
                  core.createHeritageServiceDocument(restoredProject),
                ),
                'planning',
              ),
            ),
          ),
        )
      ).serviceDocument
      assert.equal(current.syncVersion, 5)
      assert.equal(
        core.parseHeritageServiceDocumentSource(current.documentSource).project
          .items.notice.textByChannel.english,
        'First projected point',
      )
      assert.equal(
        (
          await body(
            await historical(
              request(payload, leader, syncId, undefined, {
                routeParams: { syncId, syncVersion: '2' },
              }),
            ),
          )
        ).serviceDocument.documentSource,
        firstSnapshot.documentSource,
      )
      assert.ok(
        (
          await body(await history(request(payload, leader, syncId)))
        ).groups.some((group: Value) => group.saveKind === 'restore'),
      )
      await body(await history(request(payload, member, syncId)), 403)
      await body(
        await update(request(payload, member, syncId, save(current, 'manual'))),
        403,
      )
      await body(
        await historical(
          request(payload, undefined, syncId, undefined, {
            routeParams: { syncId, syncVersion: '2' },
          }),
        ),
        401,
      )
      const foreignId = `foreign-history-${suffix}`
      const foreign = blankServiceDocument({
        schemaVersion: 1,
        requestId: randomUUID(),
        syncId: foreignId,
        title: 'Other church private fixture',
        serviceDate: '2026-10-04',
      })
      await mutateServiceDocument(
        request(payload, leader, foreignId),
        Number(other.id),
        foreign.write,
        foreign.idempotencyKey,
      )
      await body(await history(request(payload, leader, foreignId)), 404)
      t.diagnostic(
        'History groups/source preview, non-destructive restore and manager/church scope passed',
      )

      const concurrent = [
        save(current, 'automatic', edit(current, 'Concurrent A'), 'planning'),
        save(current, 'automatic', edit(current, 'Concurrent B'), 'planning'),
      ]
      const results = await Promise.all(
        concurrent.map((input) =>
          update(request(payload, leader, syncId, input)),
        ),
      )
      assert.deepEqual(
        results.map((response) => response.status).sort(),
        [200, 412],
      )
      current = (await body(await read(request(payload, leader, syncId))))
        .serviceDocument
      assert.equal(current.syncVersion, 6)
      assert.equal((await journal()).totalDocs, 6)
      assert.equal((await checkpoints()).totalDocs, 6)
      const originalCreate = payload.create.bind(payload),
        before = current
      try {
        ;(payload as any).create = async (args: any) => {
          if (args.collection === 'service-document-saves')
            throw new Error('Intentional checkpoint rollback fixture')
          return originalCreate(args)
        }
        await body(
          await update(
            request(
              payload,
              leader,
              syncId,
              save(
                current,
                'automatic',
                edit(current, 'Must roll back'),
                'planning',
              ),
            ),
          ),
          500,
        )
      } finally {
        ;(payload as any).create = originalCreate
      }
      current = (await body(await read(request(payload, leader, syncId))))
        .serviceDocument
      assert.equal(current.documentSource, before.documentSource)
      assert.equal(current.syncVersion, before.syncVersion)
      assert.equal((await journal()).totalDocs, 6)
      assert.equal((await checkpoints()).totalDocs, 6)
      t.diagnostic(
        'Concurrent writer CAS and rollback of content+journal when checkpoint insertion fails passed',
      )
    } finally {
      if (activePayload) await close(activePayload)
      await client.end()
    }
  },
)
