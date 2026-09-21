import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { syncShowEndpoints } from '../src/endpoints/syncShow.ts'
import {
  buildManagerSermonPublicationTransition,
} from '../src/lib/syncshow/ManagerSermonPublication.ts'
import {
  buildPublicSermonCatalogFromItemSources,
  buildPublicSermonPassageIndex,
  serializePublicSermonCatalogItem,
} from '../src/lib/syncshow/PublicSermonPublication.ts'
import {
  SYNCSHOW_SERMON_PUBLICATION_READ_SCOPE,
  SYNCSHOW_SERMON_READ_SCOPE,
} from '../src/lib/syncShowProtocol.ts'
import { hashOpaqueToken } from '../src/lib/tokens.ts'

type AnyRecord = Record<string, any>

const golden = (JSON.parse(readFileSync(
  new URL('./fixtures/syncshow-sermon-contract-v1.json', import.meta.url),
  'utf8',
)) as AnyRecord).sermons.v3

const getPublicationState = syncShowEndpoints.find(endpoint =>
  endpoint.path === '/community/syncshow/v1/sermon-publications/:syncId'
    && endpoint.method === 'get')?.handler
assert.ok(getPublicationState)

function relationValue(value: any): any {
  return value && typeof value === 'object' && 'id' in value ? value.id : value
}

function matchesWhere(document: AnyRecord, where: AnyRecord | undefined): boolean {
  if (!where) return true
  if (Array.isArray(where.and) && !where.and.every((part: AnyRecord) =>
    matchesWhere(document, part))) return false
  for (const [field, condition] of Object.entries(where)) {
    if (field === 'and') continue
    const actual = relationValue(document[field])
    const operation = condition as AnyRecord
    if ('equals' in operation && actual !== relationValue(operation.equals)) return false
    if ('exists' in operation) {
      const exists = actual !== undefined && actual !== null
      if (exists !== operation.exists) return false
    }
    if ('greater_than' in operation && !(actual > operation.greater_than)) return false
    if ('in' in operation && !operation.in.includes(actual)) return false
  }
  return true
}

function makeHarness() {
  const publishedAt = '2026-07-29T00:00:00.000Z'
  const transition = buildManagerSermonPublicationTransition({
    documentSource: golden.canonicalSource,
    publishedAt,
    selectedBodyEntryIds: ['manuscript-opening'],
    selectedMediaIds: [],
  })
  const catalogItemSource = serializePublicSermonCatalogItem(
    transition.projection.catalogItem,
  )
  const catalog = buildPublicSermonCatalogFromItemSources([catalogItemSource])
  const passageIndex = buildPublicSermonPassageIndex(catalog.catalog)
  const state = {
    connections: [] as AnyRecord[],
    memberships: [{ id: 1, community: 7, user: 11, role: 'leader' }] as AnyRecord[],
    sermons: [{
      id: 1,
      community: 7,
      syncId: golden.document.id,
      syncVersion: 2,
      syncCurrentRevision: transition.publicRevision,
    }] as AnyRecord[],
    publications: [{
      id: 1,
      community: 7,
      sermon: 1,
      schemaVersion: 1,
      active: true,
      visibility: 'public',
      publicationVersion: 1,
      publishedAt,
      withdrawnAt: null,
      syncId: golden.document.id,
      publicId: transition.projection.detail.publicId,
      publicRevision: transition.publicRevision,
      publishedDocumentSource: transition.documentSource,
      selectedBodyEntryIds: transition.selectedBodyEntryIds,
      selectedMediaIds: transition.selectedMediaIds,
      detailChecksum: transition.projection.detailChecksum,
      detailSource: transition.projection.detailSource,
      catalogItemChecksum: createHash('sha256')
        .update(catalogItemSource, 'utf8')
        .digest('hex'),
      catalogItemSource,
    }] as AnyRecord[],
    catalog: {
      schemaVersion: 1,
      generation: 2,
      changedAt: new Date(publishedAt),
      checksum: catalog.checksum,
      source: catalog.source,
      passageIndexChecksum: passageIndex.checksum,
      passageIndexSource: passageIndex.source,
    },
  }

  function documentsFor(collection: string) {
    if (collection === 'syncshow-connections') return state.connections
    if (collection === 'memberships') return state.memberships
    if (collection === 'sermons') return state.sermons
    if (collection === 'syncshow-sermon-publications') return state.publications
    return []
  }

  const payload = {
    config: { cors: '*' },
    logger: { error: () => undefined },
    db: {
      drizzle: {
        // Payload adapters have returned both a RowList and { rows }. Keep
        // this contract test on the direct-array shape.
        execute: async () => [structuredClone(state.catalog)],
      },
    },
    find: async (args: AnyRecord) => {
      const collection = String(args.collection)
      const documents = documentsFor(collection)
        .filter(document => matchesWhere(document, args.where))
        .slice(0, Number(args.limit) || undefined)
      if (
        ['syncshow-connections', 'syncshow-sermon-publications'].includes(collection)
        && args.showHiddenFields !== true
      ) {
        return { docs: documents.map(document => ({ id: document.id })) }
      }
      return { docs: structuredClone(documents) }
    },
    update: async () => undefined,
  }

  function addConnection(token: string, scopes: string[]) {
    state.connections.push({
      id: state.connections.length + 1,
      community: 7,
      user: 11,
      tokenHash: hashOpaqueToken(token),
      scopes,
      expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      lastUsedAt: new Date().toISOString(),
      revokedAt: null,
    })
  }

  function request(token: string, syncId = golden.document.id) {
    return {
      headers: new Headers({ authorization: `SyncShow ${token}` }),
      payload,
      routeParams: { syncId },
      transactionID: undefined,
      url: `http://localhost/api/community/syncshow/v1/sermon-publications/${syncId}`,
    }
  }

  return { addConnection, request, state, transition }
}

test('publication-state scope depends on sermon read and remains resource-scoped', async () => {
  const harness = makeHarness()
  harness.addConnection('publication-only', [SYNCSHOW_SERMON_PUBLICATION_READ_SCOPE])
  harness.addConnection('sermon-only', [SYNCSHOW_SERMON_READ_SCOPE])
  harness.addConnection('publication-reader', [
    SYNCSHOW_SERMON_READ_SCOPE,
    SYNCSHOW_SERMON_PUBLICATION_READ_SCOPE,
  ])

  assert.equal(
    (await getPublicationState(harness.request('publication-only') as never)).status,
    401,
  )
  assert.equal(
    (await getPublicationState(harness.request('sermon-only') as never)).status,
    401,
  )
  assert.equal(
    (await getPublicationState(harness.request('publication-reader') as never)).status,
    200,
  )
})

test('active publication state is exact, community-bound, and contains no manuscript bytes', async () => {
  const harness = makeHarness()
  harness.addConnection('publication-reader', [
    SYNCSHOW_SERMON_READ_SCOPE,
    SYNCSHOW_SERMON_PUBLICATION_READ_SCOPE,
  ])
  const response = await getPublicationState(
    harness.request('publication-reader') as never,
  )
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  const body = await response.json() as AnyRecord
  assert.deepEqual(Object.keys(body), ['publication'])
  assert.deepEqual(Object.keys(body.publication), [
    'schemaVersion',
    'syncId',
    'currentRevision',
    'syncVersion',
    'publicationVersion',
    'publicRevision',
    'publicId',
    'detailChecksum',
    'catalogChecksum',
    'passageIndexChecksum',
    'publishedAt',
    'selectedBodyEntryIds',
    'selectedMediaIds',
  ])
  assert.equal(body.publication.currentRevision, harness.transition.publicRevision)
  assert.equal(body.publication.publicRevision, harness.transition.publicRevision)
  assert.equal(body.publication.publicId, harness.transition.projection.detail.publicId)
  assert.equal(body.publication.detailChecksum, harness.transition.projection.detailChecksum)
  const source = JSON.stringify(body)
  for (const privateField of [
    'documentSource',
    'publishedDocumentSource',
    'detailSource',
    'catalogItemSource',
    'pastor-manuscript',
  ]) {
    assert.equal(source.includes(privateField), false, privateField)
  }

  harness.state.publications[0].community = 8
  const unbound = await getPublicationState(
    harness.request('publication-reader') as never,
  )
  assert.equal(unbound.status, 200)
  assert.equal((await unbound.json()).publication.publicationVersion, null)
})

test('withdrawn and never-published states null every public projection field', async () => {
  const harness = makeHarness()
  harness.addConnection('publication-reader', [
    SYNCSHOW_SERMON_READ_SCOPE,
    SYNCSHOW_SERMON_PUBLICATION_READ_SCOPE,
  ])
  Object.assign(harness.state.publications[0], {
    active: false,
    publicationVersion: 2,
    withdrawnAt: '2026-07-29T00:00:00.001Z',
  })
  const withdrawn = await getPublicationState(
    harness.request('publication-reader') as never,
  )
  assert.equal(withdrawn.status, 200)
  const withdrawnState = (await withdrawn.json()).publication
  assert.equal(withdrawnState.publicationVersion, 2)
  for (const field of [
    'publicRevision',
    'publicId',
    'detailChecksum',
    'catalogChecksum',
    'passageIndexChecksum',
    'publishedAt',
  ]) assert.equal(withdrawnState[field], null)
  assert.deepEqual(withdrawnState.selectedBodyEntryIds, [])
  assert.deepEqual(withdrawnState.selectedMediaIds, [])

  harness.state.publications.length = 0
  const neverPublished = await getPublicationState(
    harness.request('publication-reader') as never,
  )
  assert.equal(neverPublished.status, 200)
  assert.equal((await neverPublished.json()).publication.publicationVersion, null)
})
