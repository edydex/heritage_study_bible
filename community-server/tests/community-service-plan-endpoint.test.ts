import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { GET as getDiscovery } from '../src/app/.well-known/heritage-community.json/route.ts'
import { syncShowEndpoints } from '../src/endpoints/syncShow.ts'
import {
  COMMUNITY_SERVICE_PLAN_KIND,
  communityServicePlanRevision,
  serializeCommunityServicePlan,
} from '../src/lib/syncshow/CommunityServicePlan.ts'
import {
  SYNCSHOW_SCOPES,
  SYNCSHOW_SERVICE_PLAN_READ_SCOPE,
} from '../src/lib/syncShowProtocol.ts'
import { hashOpaqueToken } from '../src/lib/tokens.ts'

type AnyRecord = Record<string, any>

const servicePlanV2Fixture = JSON.parse(readFileSync(
  new URL(
    '../../tests/fixtures/community-service-plan-conformance-v2.json',
    import.meta.url,
  ),
  'utf8',
)) as AnyRecord

const listServicePlans = endpoint(
  '/community/syncshow/v1/service-plans',
  'get',
)
const getServicePlan = endpoint(
  '/community/syncshow/v1/service-plans/:syncId',
  'get',
)

function endpoint(path: string, method: string) {
  const handler = syncShowEndpoints.find(candidate => (
    candidate.path === path && candidate.method === method
  ))?.handler
  assert.ok(handler, `missing ${method.toUpperCase()} ${path}`)
  return handler
}

function relationValue(value: unknown) {
  return value && typeof value === 'object' && 'id' in value
    ? (value as { id: unknown }).id
    : value
}

function matchesWhere(document: AnyRecord, where: AnyRecord | undefined): boolean {
  if (!where) return true
  if (
    Array.isArray(where.and)
    && !where.and.every((entry: AnyRecord) => matchesWhere(document, entry))
  ) {
    return false
  }
  if (
    Array.isArray(where.or)
    && !where.or.some((entry: AnyRecord) => matchesWhere(document, entry))
  ) {
    return false
  }
  for (const [field, condition] of Object.entries(where)) {
    if (field === 'and' || field === 'or') continue
    const actual = relationValue(document[field])
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
      if (actual !== condition) return false
      continue
    }
    const operation = condition as AnyRecord
    const comparableActual = actual as any
    const greaterThan = relationValue(operation.greater_than) as any
    const lessThan = relationValue(operation.less_than) as any
    if ('equals' in operation && actual !== relationValue(operation.equals)) return false
    if ('exists' in operation) {
      const exists = actual !== undefined && actual !== null
      if (exists !== operation.exists) return false
    }
    if (
      'greater_than' in operation
      && !(comparableActual > greaterThan)
    ) {
      return false
    }
    if (
      'less_than' in operation
      && !(comparableActual < lessThan)
    ) {
      return false
    }
    if (
      'in' in operation
      && (!Array.isArray(operation.in) || !operation.in.includes(actual))
    ) {
      return false
    }
  }
  return true
}

function storedPlan({
  id,
  syncId,
  status,
  changedAt,
  community = 7,
  schemaVersion = 1,
}: {
  id: number
  syncId: string
  status: 'draft' | 'ready' | 'archived' | 'cancelled'
  changedAt: string
  community?: number
  schemaVersion?: 1 | 2
}) {
  const plan = schemaVersion === 2
    ? {
        ...structuredClone(servicePlanV2Fixture.plan),
        id: syncId,
        title: `${syncId} title`,
      }
    : {
        schemaVersion: 1,
        kind: COMMUNITY_SERVICE_PLAN_KIND,
        id: syncId,
        title: `${syncId} title`,
        serviceDate: '2026-08-02',
        startTime: '10:30',
        teamNotes: '',
        entries: [{
          id: `${syncId}-opening`,
          kind: 'section',
          title: 'Opening',
        }],
      }
  const documentSource = serializeCommunityServicePlan(plan)
  return {
    id,
    community,
    status,
    syncId,
    syncVersion: id,
    revision: communityServicePlanRevision(documentSource),
    documentSource,
    changedAt,
  }
}

function makeHarness() {
  const token = 'service-plan-token-community-7'
  const otherToken = 'service-plan-token-community-8'
  const wrongScopeToken = 'song-only-token'
  const state = {
    calls: [] as AnyRecord[],
    connections: [{
      id: 101,
      community: 7,
      user: 11,
      tokenHash: hashOpaqueToken(token),
      scopes: [SYNCSHOW_SERVICE_PLAN_READ_SCOPE],
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      revokedAt: null,
      lastUsedAt: new Date().toISOString(),
    }, {
      id: 102,
      community: 8,
      user: 12,
      tokenHash: hashOpaqueToken(otherToken),
      scopes: [SYNCSHOW_SERVICE_PLAN_READ_SCOPE],
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      revokedAt: null,
      lastUsedAt: new Date().toISOString(),
    }, {
      id: 103,
      community: 7,
      user: 11,
      tokenHash: hashOpaqueToken(wrongScopeToken),
      scopes: ['syncshow:songs:read'],
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      revokedAt: null,
      lastUsedAt: new Date().toISOString(),
    }],
    memberships: [{
      id: 201,
      community: 7,
      user: 11,
      role: 'leader',
    }, {
      id: 202,
      community: 8,
      user: 12,
      role: 'admin',
    }],
    plans: [
      storedPlan({
        id: 1,
        syncId: 'plan-draft',
        status: 'draft',
        changedAt: '2026-07-28T20:00:00.000Z',
      }),
      storedPlan({
        id: 2,
        syncId: 'plan-ready',
        status: 'ready',
        changedAt: '2026-07-28T21:00:00.000Z',
        schemaVersion: 2,
      }),
      storedPlan({
        id: 3,
        syncId: 'plan-archived',
        status: 'archived',
        changedAt: '2026-07-28T21:00:00.000Z',
      }),
      storedPlan({
        id: 4,
        syncId: 'plan-cancelled',
        status: 'cancelled',
        changedAt: '2026-07-28T22:00:00.000Z',
      }),
      storedPlan({
        id: 5,
        syncId: 'other-community-plan',
        status: 'ready',
        changedAt: '2026-07-28T23:00:00.000Z',
        community: 8,
      }),
    ],
  }

  function documentsFor(collection: string): AnyRecord[] {
    if (collection === 'syncshow-connections') return state.connections
    if (collection === 'memberships') return state.memberships
    if (collection === 'service-plans') return state.plans
    return []
  }

  const payload = {
    secret: 'service-plan-endpoint-test-secret',
    config: { cors: '*' },
    logger: {
      error: () => undefined,
      warn: () => undefined,
    },
    find: async (args: AnyRecord) => {
      state.calls.push(args)
      let documents: AnyRecord[] = documentsFor(String(args.collection))
        .filter(document => matchesWhere(document, args.where))
      const sortFields = Array.isArray(args.sort)
        ? args.sort
        : args.sort ? [args.sort] : []
      if (sortFields.length) {
        documents = [...documents].sort((left, right) => {
          for (const rawField of sortFields) {
            const descending = String(rawField).startsWith('-')
            const field = descending
              ? String(rawField).slice(1)
              : String(rawField)
            const a = relationValue(left[field]) as any
            const b = relationValue(right[field]) as any
            if (a === b) continue
            const comparison = a < b ? -1 : 1
            return descending ? -comparison : comparison
          }
          return 0
        })
      }
      const limit = Number.isSafeInteger(args.limit)
        ? Number(args.limit)
        : documents.length
      return {
        docs: documents.slice(0, limit),
        totalDocs: documents.length,
      }
    },
    update: async () => ({}),
  }

  function request({
    accessToken = token,
    cursor,
    limit,
    syncId,
  }: {
    accessToken?: string | null
    cursor?: string
    limit?: string
    syncId?: string
  } = {}) {
    const url = new URL(
      syncId
        ? `http://localhost/api/community/syncshow/v1/service-plans/${syncId}`
        : 'http://localhost/api/community/syncshow/v1/service-plans',
    )
    if (cursor !== undefined) url.searchParams.set('cursor', cursor)
    if (limit !== undefined) url.searchParams.set('limit', limit)
    return {
      headers: new Headers(accessToken
        ? { Authorization: `SyncShow ${accessToken}` }
        : {}),
      payload,
      routeParams: syncId ? { syncId } : {},
      url: url.toString(),
    }
  }

  return {
    otherToken,
    payload,
    request,
    state,
    token,
    wrongScopeToken,
  }
}

test('schema-v2 discovery advertises service plans beside the independent song and sermon resources', async () => {
  const response = getDiscovery()
  assert.equal(response.status, 200)
  const discovery = await response.json() as AnyRecord
  const integration = discovery.integrations.syncShow

  assert.equal(integration.schemaVersion, 2)
  assert.deepEqual(Object.keys(integration.resources).sort(), [
    'sermonPublications',
    'sermons',
    'servicePlans',
    'songPublicLinks',
    'songs',
  ])
  assert.deepEqual(integration.resources.servicePlans, {
    schemaVersion: 2,
    endpoint: 'service-plans',
    scopes: [SYNCSHOW_SERVICE_PLAN_READ_SCOPE],
  })
  assert.equal(
    integration.resources.servicePlans.scopes.some(
      (scope: string) => scope.endsWith(':write'),
    ),
    false,
  )
  assert.ok(SYNCSHOW_SCOPES.includes(SYNCSHOW_SERVICE_PLAN_READ_SCOPE))
})

test('signed keyset pages are recent-first, deterministic, and include every lifecycle state', async () => {
  const harness = makeHarness()
  const firstResponse = await listServicePlans(
    harness.request({ limit: '2' }) as never,
  )
  assert.equal(firstResponse.status, 200)
  const first = await firstResponse.json() as AnyRecord
  assert.deepEqual(
    first.items.map((item: AnyRecord) => item.syncId),
    ['plan-cancelled', 'plan-archived'],
  )
  assert.equal(first.hasMore, true)
  assert.equal(typeof first.nextCursor, 'string')
  for (const item of first.items) {
    assert.deepEqual(Object.keys(item).sort(), [
      'changedAt',
      'revision',
      'serviceDate',
      'startTime',
      'status',
      'syncId',
      'syncVersion',
      'title',
    ])
  }

  const secondResponse = await listServicePlans(harness.request({
    cursor: first.nextCursor,
    limit: '2',
  }) as never)
  assert.equal(secondResponse.status, 200)
  const second = await secondResponse.json() as AnyRecord
  assert.deepEqual(
    second.items.map((item: AnyRecord) => item.syncId),
    ['plan-ready', 'plan-draft'],
  )
  assert.deepEqual(
    [...first.items, ...second.items].map((item: AnyRecord) => item.status),
    ['cancelled', 'archived', 'ready', 'draft'],
  )
  assert.equal(second.hasMore, false)
  assert.equal(second.nextCursor, null)

  const planFinds = harness.state.calls.filter(call => (
    call.collection === 'service-plans'
  ))
  assert.equal(planFinds.length, 2)
  assert.deepEqual(planFinds[0].sort, ['-changedAt', '-id'])
  assert.equal(planFinds.every(call => call.showHiddenFields === true), true)
  const connectionFinds = harness.state.calls.filter(call => (
    call.collection === 'syncshow-connections'
  ))
  assert.equal(connectionFinds.every(call => call.showHiddenFields === true), true)
})

test('service-plan cursors are signed, community-bound, and limits fail closed', async () => {
  const harness = makeHarness()
  const first = await (
    await listServicePlans(harness.request({ limit: '1' }) as never)
  ).json() as AnyRecord
  const [payload, signature] = String(first.nextCursor).split('.')
  const tamperedSignature = `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`

  const tamperedResponse = await listServicePlans(harness.request({
    cursor: `${payload}.${tamperedSignature}`,
    limit: '1',
  }) as never)
  assert.equal(tamperedResponse.status, 400)
  assert.equal((await tamperedResponse.json() as AnyRecord).code, 'INVALID_CURSOR')

  const crossCommunityResponse = await listServicePlans(harness.request({
    accessToken: harness.otherToken,
    cursor: first.nextCursor,
    limit: '1',
  }) as never)
  assert.equal(crossCommunityResponse.status, 400)
  assert.equal(
    (await crossCommunityResponse.json() as AnyRecord).code,
    'INVALID_CURSOR',
  )

  for (const limit of ['0', '101', '1.5', '01', 'not-a-number']) {
    const response = await listServicePlans(
      harness.request({ limit }) as never,
    )
    assert.equal(response.status, 400, limit)
    assert.equal((await response.json() as AnyRecord).code, 'INVALID_LIMIT')
  }
})

test('service-plan list and get require the independent read scope', async () => {
  const harness = makeHarness()
  for (const accessToken of [null, harness.wrongScopeToken]) {
    const response = await listServicePlans(
      harness.request({ accessToken }) as never,
    )
    assert.equal(response.status, 401)
    assert.equal((await response.json() as AnyRecord).code, 'UNAUTHORIZED')
  }

  const response = await getServicePlan(harness.request({
    syncId: 'plan-ready',
  }) as never)
  assert.equal(response.status, 200)
  const body = await response.json() as AnyRecord
  assert.deepEqual(Object.keys(body), ['plan'])
  assert.deepEqual(Object.keys(body.plan).sort(), [
    'changedAt',
    'documentSource',
    'revision',
    'status',
    'syncId',
    'syncVersion',
  ])
  assert.equal(Object.hasOwn(body.plan, 'plan'), false)
  const readyDocument = JSON.parse(body.plan.documentSource)
  assert.equal(readyDocument.id, 'plan-ready')
  assert.equal(readyDocument.schemaVersion, 2)
  assert.deepEqual(
    readyDocument.entries.find(
      (entry: AnyRecord) => entry.kind === 'scripture',
    ).sermonReading,
    {
      referenceId: 'primary-eph-3',
      sermonEntryId: 'sermon-prayer',
    },
  )

  const legacyResponse = await getServicePlan(harness.request({
    syncId: 'plan-draft',
  }) as never)
  assert.equal(legacyResponse.status, 200)
  const legacyBody = await legacyResponse.json() as AnyRecord
  assert.equal(JSON.parse(legacyBody.plan.documentSource).schemaVersion, 1)

  const otherCommunity = await getServicePlan(harness.request({
    syncId: 'other-community-plan',
  }) as never)
  assert.equal(otherCommunity.status, 404)
})

test('the service-plan SyncShow lane exposes no write endpoint', () => {
  const methods = syncShowEndpoints
    .filter(candidate => candidate.path.startsWith(
      '/community/syncshow/v1/service-plans',
    ))
    .map(candidate => candidate.method)
  assert.deepEqual(methods, ['get', 'get'])
})
