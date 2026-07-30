import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import test from 'node:test'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { getPayload, type Payload } from 'payload'
import config from '../src/payload.config.ts'
import { managerSermonPreparationEndpoints } from '../src/endpoints/sermonPreparations.ts'
import { syncShowEndpoints } from '../src/endpoints/syncShow.ts'
import {
  SYNCSHOW_SERMON_READ_SCOPE,
  SYNCSHOW_SERVICE_PLAN_READ_SCOPE,
} from '../src/lib/syncShowProtocol.ts'
import { hashOpaqueToken } from '../src/lib/tokens.ts'
import { validateCommunityServicePlanSource } from '../src/lib/syncshow/CommunityServicePlan.ts'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase.ts'

type AnyRecord = Record<string, any>
const liveDatabaseUrl = process.env.SERVICE_PLAN_LIVE_DATABASE_URL

function endpoint(path: string, method: 'get' | 'post' = 'get') {
  const handler = syncShowEndpoints.find(candidate => (
    candidate.path === path && candidate.method === method
  ))?.handler
  assert.ok(handler, `missing ${method.toUpperCase()} ${path}`)
  return handler
}

const listServicePlans = endpoint('/community/syncshow/v1/service-plans')
const getServicePlan = endpoint('/community/syncshow/v1/service-plans/:syncId')
const listSermons = endpoint('/community/syncshow/v1/sermons')
const prepareSermon = managerSermonPreparationEndpoints.find(candidate => (
  candidate.path === '/community/sermon-preparations'
  && candidate.method === 'post'
))?.handler
assert.ok(prepareSermon, 'missing POST /community/sermon-preparations')

function request(
  payload: Payload,
  token: string,
  path: string,
  routeParams: Record<string, string> = {},
) {
  return {
    headers: new Headers({ Authorization: `SyncShow ${token}` }),
    payload,
    routeParams,
    url: `http://localhost/api/community/syncshow/v1/${path}`,
  }
}

function relationshipId(value: unknown) {
  return value && typeof value === 'object' && 'id' in value
    ? (value as { id: number | string }).id
    : value as number | string
}

function sermonPreparationRequest(payload: Payload, user: AnyRecord) {
  const requestId = 'f5bf106a-a7a8-4255-991a-93ef65c5d54f'
  return {
    headers: new Headers({
      'Content-Type': 'application/json',
      'Idempotency-Key': `manager-sermon-${requestId}`,
    }),
    method: 'POST',
    payload,
    routeParams: {},
    user,
    text: async () => JSON.stringify({
      schemaVersion: 1,
      requestId,
      title: 'Runtime manager-prepared sermon',
      speaker: 'Runtime Pastor',
      serviceDate: '2026-08-02',
      language: 'en',
      primaryPassage: {
        bookId: 'Eph',
        startChapter: 3,
        startVerse: 14,
        endChapter: 3,
        endVerse: 21,
      },
      manuscript: 'A reviewed manager-prepared manuscript for the live service-plan contract.',
      slideNotes: 'Faithful prayer.\nStrength through the Spirit.\nThe love of Christ.',
      reviewConfirmed: true,
    }),
    transactionID: undefined,
    url: 'http://localhost/api/community/sermon-preparations',
  }
}

function songDocument(id: string) {
  const source = [
    '---',
    `id: ${JSON.stringify(id)}`,
    'title: "Runtime service-plan song"',
    'language: en',
    '---',
    '',
    '^1',
    'A deliberately short integration-test lyric.',
    '',
  ].join('\n')
  return {
    id,
    source,
    revision: createHash('sha256').update(source, 'utf8').digest('hex'),
  }
}

test('real Payload/Postgres leader lifecycle stays exact through scoped SyncShow reads', {
  skip: !liveDatabaseUrl,
  timeout: 120_000,
}, async () => {
  const milestone = (message: string) => {
    process.stdout.write(`# service-plan live: ${message}\n`)
  }
  assertDisposableLiveDatabase({
    databaseUrl: liveDatabaseUrl,
    expectedDatabase: 'heritage_syncshow_payload_live',
    expectedMarker: 'heritage-community-syncshow-payload-live-v1',
    variableName: 'SERVICE_PLAN_LIVE_DATABASE_URL',
  })

  const resolvedConfig = await config
  resolvedConfig.db = postgresAdapter({
    pool: { connectionString: liveDatabaseUrl },
    push: false,
  }) as typeof resolvedConfig.db
  const payload = await getPayload({ config })
  milestone('Payload initialized')
  const created: {
    connection?: number | string
    grant?: number | string
    plan?: number | string
    song?: number | string
  } = {}

  try {
    const community = (await payload.find({
      collection: 'communities',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: { slug: { equals: 'local-church' } },
    })).docs[0] as AnyRecord | undefined
    assert.ok(community)

    const membership = (await payload.find({
      collection: 'memberships',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      where: {
        and: [
          { community: { equals: community.id } },
          { role: { in: ['owner', 'admin', 'leader'] } },
        ],
      },
    })).docs[0] as AnyRecord | undefined
    assert.ok(membership)

    const leaderDocument = await payload.findByID({
      collection: 'users',
      id: relationshipId(membership.user),
      depth: 0,
      overrideAccess: true,
    }) as AnyRecord
    const leader = { ...leaderDocument, collection: 'users' } as never

    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`
    const sermonCreateResponse = await prepareSermon(
      sermonPreparationRequest(payload, leader) as never,
    )
    assert.ok(
      [200, 201].includes(sermonCreateResponse.status),
      `expected an exact sermon create or replay, received ${sermonCreateResponse.status}`,
    )
    const preparedSermon = (await sermonCreateResponse.json() as AnyRecord).sermon
    assert.equal(preparedSermon.syncId, 'sermon-f5bf106a-a7a8-4255-991a-93ef65c5d54f')
    assert.equal(preparedSermon.publicationStatus, 'ready')
    assert.equal(preparedSermon.visibility, 'private')
    assert.equal(preparedSermon.passageLabel, 'Ephesians 3:14–21')
    assert.equal(preparedSermon.bodyEntryCount, 2)
    const journal = await payload.find({
      collection: 'syncshow-sermon-changes',
      depth: 0,
      limit: 2,
      overrideAccess: true,
      showHiddenFields: true,
      where: {
        and: [
          { community: { equals: community.id } },
          { syncId: { equals: preparedSermon.syncId } },
        ],
      },
    })
    assert.equal(journal.totalDocs, 1)
    assert.equal(journal.docs[0]?.revision, preparedSermon.currentRevision)
    milestone('manager prepared canonical sermon and immutable journal')

    const sermon = (await payload.find({
      collection: 'sermons',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      showHiddenFields: true,
      where: {
        and: [
          { community: { equals: community.id } },
          { syncId: { equals: preparedSermon.syncId } },
          { syncArchived: { equals: false } },
        ],
      },
    })).docs[0] as AnyRecord | undefined
    assert.ok(sermon?.syncId)
    assert.ok(sermon?.syncCurrentRevision)
    assert.ok(sermon?.syncCurrentDocumentSource)

    const songSyncId = `service-plan-runtime-${suffix}`
    const createdSong = await payload.create({
      collection: 'songs',
      depth: 0,
      overrideAccess: false,
      showHiddenFields: true,
      user: leader,
      data: {
        community: community.id,
        status: 'draft',
        title: 'Runtime service-plan song',
        syncId: songSyncId,
        syncVersion: 1,
        syncDocuments: [songDocument(songSyncId)],
        visibility: 'private',
      } as never,
    }) as AnyRecord
    created.song = createdSong.id
    milestone('leader created canonical song')
    assert.equal(createdSong.syncId, songSyncId)
    assert.equal(createdSong.syncVersion, 1)

    const createdPlan = await payload.create({
      collection: 'service-plans',
      depth: 0,
      overrideAccess: false,
      showHiddenFields: true,
      user: leader,
      data: {
        community: community.id,
        status: 'draft',
        serviceDate: '2026-08-02T00:00:00.000Z',
        startTime: '10:30',
        title: 'Runtime Sunday service',
        teamNotes: 'Sound check at 09:45.',
        // Every technical value below is hostile client input. The server must
        // replace it with generated identity and resolved pins.
        syncId: 'client-chosen-plan-id',
        syncVersion: 999,
        revision: 'client-chosen-revision',
        documentSource: 'client-chosen-source',
        changedAt: '2000-01-01T00:00:00.000Z',
        entries: [{
          entryId: 'client-chosen-entry-id',
          kind: 'section',
          title: 'Opening',
        }, {
          entryId: 'client-chosen-song-entry-id',
          kind: 'song',
          title: 'Runtime service-plan song',
          song: createdSong.id,
          resolvedSyncId: 'wrong',
          resolvedSyncVersion: 999,
          resolvedRevision: 'wrong',
        }, {
          entryId: 'client-chosen-scripture-entry-id',
          kind: 'scripture',
          title: 'Ephesians 3:14–21',
          scripture: {
            bookId: 'Eph',
            startChapter: 3,
            startVerse: 14,
            endChapter: 3,
            endVerse: 21,
            translationId: 'BSB',
            sermonReading: {
              sermon: sermon.id,
              referenceId: 'primary-Eph-3-14-3-21',
            },
          },
        }, {
          entryId: 'client-chosen-sermon-entry-id',
          kind: 'sermon',
          title: String(sermon.title || 'Runtime sermon'),
          sermon: sermon.id,
          resolvedSyncId: 'wrong',
          resolvedSyncVersion: 999,
          resolvedRevision: 'wrong',
        }],
      } as never,
    }) as AnyRecord
    created.plan = createdPlan.id
    milestone('leader created Draft plan')

    assert.match(String(createdPlan.syncId), /^service-/)
    assert.notEqual(createdPlan.syncId, 'client-chosen-plan-id')
    assert.equal(createdPlan.syncVersion, 1)
    assert.notEqual(createdPlan.revision, 'client-chosen-revision')
    assert.notEqual(createdPlan.documentSource, 'client-chosen-source')
    assert.notEqual(createdPlan.changedAt, '2000-01-01T00:00:00.000Z')
    assert.equal(createdPlan.entries[1].resolvedSyncId, songSyncId)
    assert.equal(createdPlan.entries[1].resolvedSyncVersion, 1)
    assert.equal(
      createdPlan.entries[1].resolvedRevision,
      `song:${songSyncId}:1`,
    )
    assert.equal(createdPlan.entries[3].resolvedSyncId, sermon.syncId)
    assert.equal(createdPlan.entries[3].resolvedSyncVersion, sermon.syncVersion)
    assert.equal(createdPlan.entries[3].resolvedRevision, sermon.syncCurrentRevision)
    assert.equal(
      relationshipId(createdPlan.entries[2].scripture.sermonReading.sermon),
      sermon.id,
    )
    assert.equal(
      createdPlan.entries[2].scripture.sermonReading.referenceId,
      'primary-Eph-3-14-3-21',
    )
    const createdCanonicalPlan = validateCommunityServicePlanSource(
      createdPlan.documentSource,
    ).plan
    assert.equal(createdCanonicalPlan.schemaVersion, 2)
    const createdCanonicalReading = createdCanonicalPlan.entries[2]
    if (createdCanonicalReading?.kind !== 'scripture') {
      assert.fail('expected the third canonical service-plan row to be Scripture')
    }
    assert.deepEqual(
      createdCanonicalReading.sermonReading,
      {
        sermonEntryId: String(createdPlan.entries[3].entryId),
        referenceId: 'primary-Eph-3-14-3-21',
      },
    )
    assert.equal(
      createdPlan.entries.some((entry: AnyRecord) => (
        String(entry.entryId).startsWith('client-chosen-')
      )),
      false,
    )

    const managerFacing = await payload.findByID({
      collection: 'service-plans',
      id: createdPlan.id,
      depth: 0,
      overrideAccess: false,
      user: leader,
    }) as AnyRecord
    for (const field of [
      'syncId',
      'syncVersion',
      'revision',
      'documentSource',
      'changedAt',
    ]) {
      assert.equal(field in managerFacing, false, `${field} leaked without showHiddenFields`)
    }
    assert.equal('entryId' in managerFacing.entries[0], false)
    assert.equal('resolvedSyncId' in managerFacing.entries[1], false)
    assert.equal('resolvedSyncVersion' in managerFacing.entries[1], false)
    assert.equal('resolvedRevision' in managerFacing.entries[1], false)
    milestone('ordinary manager read hid technical state')

    const editedPlan = await payload.update({
      collection: 'service-plans',
      id: createdPlan.id,
      depth: 0,
      overrideAccess: false,
      showHiddenFields: true,
      user: leader,
      data: {
        title: 'Runtime Sunday service — reviewed',
        teamNotes: 'Sound check at 09:30.',
      },
    }) as AnyRecord
    assert.equal(editedPlan.syncVersion, 2)
    assert.notEqual(editedPlan.documentSource, createdPlan.documentSource)
    milestone('leader edited Draft plan')

    const readyPlan = await payload.update({
      collection: 'service-plans',
      id: createdPlan.id,
      depth: 0,
      overrideAccess: false,
      showHiddenFields: true,
      user: leader,
      data: { status: 'ready' },
    }) as AnyRecord
    assert.equal(readyPlan.status, 'ready')
    assert.equal(readyPlan.syncVersion, 3)
    milestone('leader marked plan Ready')

    const token = `service-plan-token-${suffix}`
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60_000).toISOString()
    const grant = await payload.create({
      collection: 'syncshow-device-grants',
      depth: 0,
      overrideAccess: true,
      showHiddenFields: true,
      data: {
        community: community.id,
        requestedEmail: String(leaderDocument.email),
        clientName: 'Service-plan runtime validation',
        deviceId: `service-plan-device-${suffix}`,
        deviceSecretHash: hashOpaqueToken(`device-secret-${suffix}`),
        userCodeHash: hashOpaqueToken(`user-code-${suffix}`),
        codeChallenge: hashOpaqueToken(`challenge-${suffix}`),
        scopes: [
          SYNCSHOW_SERMON_READ_SCOPE,
          SYNCSHOW_SERVICE_PLAN_READ_SCOPE,
        ],
        status: 'consumed',
        expiresAt,
        approvedBy: leaderDocument.id,
        approvedAt: now.toISOString(),
        consumedAt: now.toISOString(),
      } as never,
    }) as AnyRecord
    created.grant = grant.id

    const connection = await payload.create({
      collection: 'syncshow-connections',
      depth: 0,
      overrideAccess: true,
      showHiddenFields: true,
      data: {
        community: community.id,
        user: leaderDocument.id,
        grant: grant.id,
        clientName: 'Service-plan runtime validation',
        tokenHash: hashOpaqueToken(token),
        scopes: [
          SYNCSHOW_SERMON_READ_SCOPE,
          SYNCSHOW_SERVICE_PLAN_READ_SCOPE,
        ],
        expiresAt,
        lastUsedAt: now.toISOString(),
      } as never,
    }) as AnyRecord
    created.connection = connection.id
    milestone('scoped device connection created')
    assert.equal(connection.tokenHash, hashOpaqueToken(token))
    assert.deepEqual(connection.scopes, [
      SYNCSHOW_SERMON_READ_SCOPE,
      SYNCSHOW_SERVICE_PLAN_READ_SCOPE,
    ])

    const listResponse = await listServicePlans(
      request(payload, token, 'service-plans?limit=10') as never,
    )
    assert.equal(listResponse.status, 200)
    const list = await listResponse.json() as AnyRecord
    const summary = list.items.find((item: AnyRecord) => (
      item.syncId === readyPlan.syncId
    ))
    assert.ok(summary)
    assert.equal(summary.status, 'ready')
    assert.equal(summary.syncVersion, 3)
    milestone('scoped service-plan list returned Ready plan')

    const getResponse = await getServicePlan(
      request(
        payload,
        token,
        `service-plans/${encodeURIComponent(String(readyPlan.syncId))}`,
        { syncId: String(readyPlan.syncId) },
      ) as never,
    )
    assert.equal(getResponse.status, 200)
    const getBody = await getResponse.json() as AnyRecord
    assert.deepEqual(Object.keys(getBody), ['plan'])
    assert.deepEqual(Object.keys(getBody.plan), [
      'syncId',
      'syncVersion',
      'revision',
      'documentSource',
      'status',
      'changedAt',
    ])
    assert.equal(getBody.plan.documentSource, readyPlan.documentSource)
    assert.equal('plan' in getBody.plan, false)
    milestone('scoped service-plan get returned exact envelope')

    // This endpoint uses Drizzle directly. Running it against the real adapter
    // proves its array-shaped execute result is consumed correctly.
    const sermonListResponse = await listSermons(
      request(payload, token, 'sermons?limit=10') as never,
    )
    assert.equal(sermonListResponse.status, 200)
    const sermonList = await sermonListResponse.json() as AnyRecord
    assert.ok(sermonList.items.length > 0)
    milestone('real Drizzle sermon list returned journal rows')

    const changedSong = await payload.update({
      collection: 'songs',
      id: createdSong.id,
      depth: 0,
      overrideAccess: false,
      showHiddenFields: true,
      user: leader,
      data: { title: 'Runtime service-plan song — changed after Ready' },
    }) as AnyRecord
    assert.equal(changedSong.syncVersion, 2)
    milestone('canonical song drifted after Ready')

    const archivedPlan = await payload.update({
      collection: 'service-plans',
      id: createdPlan.id,
      depth: 0,
      overrideAccess: false,
      showHiddenFields: true,
      user: leader,
      data: { status: 'archived' },
    }) as AnyRecord
    assert.equal(archivedPlan.status, 'archived')
    assert.equal(archivedPlan.syncVersion, 4)
    assert.equal(archivedPlan.documentSource, readyPlan.documentSource)
    assert.equal(archivedPlan.revision, readyPlan.revision)
    assert.deepEqual(archivedPlan.entries, readyPlan.entries)
    milestone('leader archived plan with exact audit bytes')

    const archivedResponse = await getServicePlan(
      request(
        payload,
        token,
        `service-plans/${encodeURIComponent(String(archivedPlan.syncId))}`,
        { syncId: String(archivedPlan.syncId) },
      ) as never,
    )
    assert.equal(archivedResponse.status, 200)
    const archivedBody = await archivedResponse.json() as AnyRecord
    assert.equal(archivedBody.plan.status, 'archived')
    assert.equal(archivedBody.plan.documentSource, readyPlan.documentSource)

    let terminalEditError: unknown
    try {
      await payload.update({
        collection: 'service-plans',
        id: createdPlan.id,
        depth: 0,
        overrideAccess: false,
        showHiddenFields: true,
        user: leader,
        data: { title: 'An archived plan must not be edited' },
      })
    } catch (error) {
      terminalEditError = error
    }
    assert.ok(terminalEditError)
    const terminalErrorText = [
      terminalEditError instanceof Error ? terminalEditError.message : '',
      JSON.stringify(terminalEditError),
    ].join(' ')
    assert.match(
      terminalErrorText,
      /Restore this plan to Draft first, save it, and then make content changes/,
    )
    milestone('terminal content edit rejected')
  } finally {
    for (const [collection, id] of [
      ['service-plans', created.plan],
      ['syncshow-connections', created.connection],
      ['syncshow-device-grants', created.grant],
      ['songs', created.song],
    ] as const) {
      if (id === undefined) continue
      await payload.delete({
        collection,
        id,
        overrideAccess: true,
      } as never)
      milestone(`cleaned ${collection}`)
    }
    // Payload's generic drizzle `destroy()` clears adapter metadata but does
    // not close the postgres Pool. End the disposable integration-test pool
    // explicitly so Node's test runner can report the completed assertions.
    const database = payload.db as {
      destroy?: () => Promise<void>
      pool?: {
        _clients?: Array<{
          end?: () => Promise<void>
          release?: (destroy?: boolean) => void
        }>
        _idle?: Array<{ client?: object }>
        end: () => Promise<void>
        idleCount?: number
        totalCount?: number
      }
    }
    if (database.pool) {
      const pool = database.pool
      milestone(
        `closing Postgres pool (${pool.idleCount ?? '?'} idle / ${pool.totalCount ?? '?'} total)`,
      )
      const ending = pool.end()
      const endedNormally = await Promise.race([
        ending.then(() => true),
        new Promise<false>(resolve => setTimeout(() => resolve(false), 1_000)),
      ])
      if (!endedNormally) {
        // Payload 3.86's dev-schema introspection can retain one checked-out,
        // transaction-free client. It is safe to destroy only that disposable
        // test client after every asserted row has been deleted.
        const idleClients = new Set(
          (pool._idle || []).map(entry => entry.client),
        )
        for (const client of pool._clients || []) {
          if (idleClients.has(client)) continue
          if (typeof client.release === 'function') client.release(true)
          else await client.end?.()
        }
        await ending
        milestone('released retained schema-introspection client')
      }
      milestone('Postgres pool closed')
    }
    await database.destroy?.()
    milestone('Payload adapter destroyed')
  }
})
