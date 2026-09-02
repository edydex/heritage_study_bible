import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import serviceCore from '../packages/service-core/index.js'
import {
  prepareHeritageServiceDocument,
  ServiceDocuments,
} from '../src/collections/ServiceDocuments.ts'
import { SyncShowServiceDocumentChanges } from '../src/collections/SyncShowServiceDocumentChanges.ts'
import { syncShowEndpoints } from '../src/endpoints/syncShow.ts'
import {
  blankServiceDocument,
  managerServiceDocumentEndpoints,
  managerWrite,
} from '../src/endpoints/serviceDocuments.ts'
import {
  normalizeServiceDocumentWrite,
  serviceDocumentChangePage,
  serviceDocumentResponse,
  serviceDocumentSummary,
} from '../src/lib/syncshow/HeritageServiceDocumentServer.ts'
import { legacyServicePlanToServiceDocument } from '../src/lib/syncshow/LegacyServicePlanToServiceDocument.ts'
import {
  parsePlannerLibrarySongDocument,
  projectFromServiceEnvelope,
} from '../src/components/serviceDocumentPlannerModel.ts'

type AnyRecord = Record<string, any>

const NOW = '2026-08-13T22:00:00.000Z'
const {
  createHeritageServiceDocument,
  parseHeritageServiceDocumentSource,
  serializeHeritageServiceDocument,
} = serviceCore

function source(title = 'July 26 Service') {
  return serializeHeritageServiceDocument(createHeritageServiceDocument({
    schemaVersion: 1,
    kind: 'syncshow-service-project',
    id: 'service-2026-07-26',
    title,
    serviceDate: '2026-07-26',
    createdAt: NOW,
    updatedAt: NOW,
    revision: 1,
    preferredProfileId: 'main-sanctuary',
    channelIds: ['english', 'russian', 'media'],
    channels: {
      english: { id: 'english', label: 'English', language: 'en' },
      russian: { id: 'russian', label: 'Russian', language: 'ru' },
      media: { id: 'media', label: 'Media', language: 'und' },
    },
    rootItemIds: [],
    items: {},
    resources: {},
    assets: {},
    presetPack: { id: 'main-sanctuary', version: 1, sha256: null },
  }))
}

function revision(documentSource: string) {
  return createHash('sha256').update(documentSource, 'utf8').digest('hex')
}

test('Community accepts the exact shared source and builds SyncShow envelopes', () => {
  const documentSource = source()
  const write = normalizeServiceDocumentWrite({
    syncId: 'service-2026-07-26',
    documentSource,
    status: 'planning',
  })
  assert.equal(write.revision, revision(documentSource))

  const row = {
    syncId: write.syncId,
    syncVersion: 4,
    revision: write.revision,
    documentSource,
    status: 'planning',
    changedAt: NOW,
  }
  assert.equal(serviceDocumentResponse(row).documentSource, documentSource)
  assert.equal(
    projectFromServiceEnvelope(serviceDocumentResponse(row)).title,
    'July 26 Service',
  )
  assert.deepEqual(serviceDocumentSummary(row), {
    syncId: 'service-2026-07-26',
    syncVersion: 4,
    revision: write.revision,
    status: 'planning',
    title: 'July 26 Service',
    serviceDate: '2026-07-26',
    changedAt: NOW,
  })
  assert.equal(serviceDocumentChangePage({
    items: [serviceDocumentSummary(row)],
    nextCursor: 'signed-checkpoint',
    hasMore: false,
  }, 50).nextCursor, 'signed-checkpoint')
})

test('service documents and their append-only history accept real service-sized sources', () => {
  for (const collection of [ServiceDocuments, SyncShowServiceDocumentChanges]) {
    const field = collection.fields.find(candidate => (
      'name' in candidate && candidate.name === 'documentSource'
    )) as { maxLength?: number } | undefined
    assert.equal(field?.maxLength, 16 * 1024 * 1024)
  }
})

test('planner turns identical repeated library sections into an arrangement', () => {
  const parsed = parsePlannerLibrarySongDocument(`---
id: repeated-chorus
title: Repeated Chorus
language: en
---

^1
First verse

^chorus
Same chorus

^2
Second verse

^chorus
Same chorus
`, { fileName: 'repeated-chorus.md' })

  assert.deepEqual(
    parsed.document.sections.map((section: AnyRecord) => section.id),
    ['verse-1', 'chorus', 'verse-2'],
  )
  assert.deepEqual(
    parsed.arrangementSectionIds,
    ['verse-1', 'chorus', 'verse-2', 'chorus'],
  )
})

test('planner does not discard repeated section markers with different lyrics', () => {
  assert.throws(
    () => parsePlannerLibrarySongDocument(`---
id: changed-chorus
title: Changed Chorus
language: en
---

^chorus
First wording

^chorus
Different wording
`, { fileName: 'changed-chorus.md' }),
    /appears more than once/i,
  )
})

test('editing a ready revision creates a new planning revision', async () => {
  const firstSource = source()
  const firstRevision = revision(firstSource)
  const result = await prepareHeritageServiceDocument({
    operation: 'update',
    data: {
      status: 'ready',
      documentSource: source('July 26 Service — corrected'),
      community: 7,
    },
    originalDoc: {
      community: 7,
      syncVersion: 8,
      revision: firstRevision,
      documentSource: firstSource,
      status: 'ready',
      changedAt: NOW,
      readyRevision: firstRevision,
      readyAt: NOW,
    },
    context: { serviceDocumentChangedAt: '2026-08-13T22:05:00.000Z' },
  } as never) as AnyRecord

  assert.equal(result.status, 'planning')
  assert.equal(result.syncVersion, 9)
  assert.equal(result.readyRevision, null)
  assert.equal(result.readyAt, null)
})

test('legacy Community plans become native reviewable documents, not a second entity', () => {
  const fixture = JSON.parse(readFileSync(
    new URL('../../tests/fixtures/community-service-plan-conformance-v2.json', import.meta.url),
    'utf8',
  )) as AnyRecord
  const migrated = legacyServicePlanToServiceDocument({
    communityId: 7,
    syncId: fixture.envelope.syncId,
    syncVersion: fixture.envelope.syncVersion,
    revision: fixture.envelope.revision,
    documentSource: fixture.envelope.documentSource,
    status: fixture.envelope.status,
    changedAt: fixture.envelope.changedAt,
  })
  const document = parseHeritageServiceDocumentSource(migrated.documentSource)

  assert.equal(document.id, fixture.envelope.syncId)
  assert.deepEqual(document.project.channelIds, ['english', 'russian', 'media'])
  assert.equal(
    document.project.rootItemIds.length,
    fixture.plan.entries.length,
  )
  assert.match(
    JSON.stringify(document.project.items),
    /Review and replace this migrated outline item|former Community service-plan editor/,
  )
})

test('Community exposes list, change, create, read, and CAS update routes', () => {
  const routes = new Set(syncShowEndpoints.map(endpoint =>
    `${endpoint.method.toUpperCase()} ${endpoint.path}`))
  for (const route of [
    'GET /community/syncshow/v1/service-documents',
    'GET /community/syncshow/v1/service-documents/changes',
    'POST /community/syncshow/v1/service-documents',
    'GET /community/syncshow/v1/service-documents/:syncId',
    'PUT /community/syncshow/v1/service-documents/:syncId',
  ]) assert.ok(routes.has(route), route)
})

test('manager visual planning creates and updates the same canonical document', () => {
  const created = blankServiceDocument({
    schemaVersion: 1,
    requestId: '00000000-0000-4000-8000-000000000001',
    syncId: 'service-2026-08-16',
    title: 'Sunday Morning Service',
    serviceDate: '2026-08-16',
  })
  const parsed = parseHeritageServiceDocumentSource(
    created.write.documentSource,
  )
  assert.equal(parsed.project.revision, 1)
  assert.deepEqual(parsed.project.channelIds, ['english', 'russian', 'media'])
  assert.equal(created.write.baseSyncVersion, null)

  const updated = managerWrite({
    schemaVersion: 1,
    requestId: '00000000-0000-4000-8000-000000000002',
    syncId: 'service-2026-08-16',
    baseSyncVersion: 4,
    baseRevision: 'a'.repeat(64),
    documentSource: created.write.documentSource,
    status: 'planning',
  }, 'service-2026-08-16')
  assert.equal(updated.write.baseSyncVersion, 4)
  assert.equal(updated.write.baseRevision, 'a'.repeat(64))
  assert.match(updated.idempotencyKey, /^manager-service-/)
})

test('Community rejects a project shell whose native content is invalid', () => {
  const created = blankServiceDocument({
    schemaVersion: 1,
    requestId: '00000000-0000-4000-8000-000000000003',
    syncId: 'service-2026-08-23',
    title: 'Sunday Morning Service',
    serviceDate: '2026-08-23',
  })
  const parsed = JSON.parse(created.write.documentSource) as AnyRecord
  parsed.project.rootItemIds = ['notice-invalid']
  parsed.project.items = {
    'notice-invalid': {
      id: 'notice-invalid',
      kind: 'notice',
      title: 'Invalid notice',
      operatorNotes: '',
      createdAt: NOW,
      updatedAt: NOW,
      textByChannel: {},
      presetId: 'notice-text',
    },
  }
  const noncanonicalSource = `${JSON.stringify(parsed)}\n`
  assert.throws(
    () => managerWrite({
      schemaVersion: 1,
      requestId: '00000000-0000-4000-8000-000000000004',
      syncId: 'service-2026-08-23',
      baseSyncVersion: 1,
      baseRevision: 'b'.repeat(64),
      documentSource: noncanonicalSource,
      status: 'planning',
    }, 'service-2026-08-23'),
    /service content is invalid/i,
  )
})

test('Community dashboard routes service planning through the visual shared editor', () => {
  const welcome = readFileSync(
    new URL('../src/components/AdminWelcome.tsx', import.meta.url),
    'utf8',
  )
  const dashboard = readFileSync(
    new URL('../src/components/AdminDashboard.tsx', import.meta.url),
    'utf8',
  )
  const planner = readFileSync(
    new URL('../src/components/PlanServiceClient.tsx', import.meta.url),
    'utf8',
  )
  const adminStyles = readFileSync(
    new URL('../src/app/(payload)/custom.scss', import.meta.url),
    'utf8',
  )
  assert.match(welcome, /href: '\/admin\/plan-service'/)
  assert.match(dashboard, /heritage-admin-workspace/)
  assert.doesNotMatch(dashboard, /DefaultTemplate/)
  assert.match(planner, /aria-label="Preview output"/)
  assert.match(planner, /Add song to service/)
  assert.match(planner, /Add reading/)
  assert.match(planner, /Open sermon publication review/)
  assert.match(planner, /Song library.*Media.*Scripture/s)
  assert.match(planner, /mode: 'derive-next-text'/)
  assert.match(planner, /channelId: 'media'/)
  assert.match(planner, /Section overview/)
  assert.match(planner, /Content preview/)
  assert.match(planner, /Slides in this item/)
  assert.match(planner, /data-kind=\{row\.item\.kind\}/)
  assert.match(planner, /compileServiceProject\(draft/)
  assert.match(planner, /cue\.itemId === selectedId/)
  assert.match(planner, /nextPreviewOutput/)
  assert.doesNotMatch(planner, /Pinned song lyrics/)
  assert.doesNotMatch(planner, /Service item filmstrip/)
  assert.match(planner, /visibleBibleChapter/)
  assert.match(planner, /visibleBibleBookId/)
  assert.match(planner, /bibleBookInput\.current\?\.value/)
  assert.match(planner, /bibleChapterInput\.current\?\.value/)
  assert.match(planner, /selected\?\.kind === 'group' \? selected\.id : null/g)
  assert.match(planner, /project\.items\[parentId\]\.childIds\.push\(id\)/g)
  assert.doesNotMatch(planner, /__inspector/)
  assert.match(planner, /This service changed somewhere else/)
  assert.match(adminStyles, /\.heritage-admin-workspace\s*\{[^}]*place-items:\s*center/s)
  assert.match(adminStyles, /\.heritage-service-planner\s*\{[^}]*height:\s*calc\(100svh - var\(--app-header-height\)\)[^}]*overflow:\s*hidden/s)
  assert.match(adminStyles, /grid-template-rows:\s*minmax\(0, 1fr\) auto/)
  assert.match(adminStyles, /border-bottom:\s*1px dotted var\(--theme-elevation-200\)/)
  assert.match(adminStyles, /min-height:\s*1\.9rem/)

  const routes = new Set(managerServiceDocumentEndpoints.map(endpoint =>
    `${endpoint.method.toUpperCase()} ${endpoint.path}`))
  for (const route of [
    'GET /community/service-documents/library/songs',
    'GET /community/service-documents/library/songs/:syncId',
    'GET /community/service-documents/library/bible-passage',
    'POST /community/service-documents/library/bible-passage',
  ]) assert.ok(routes.has(route), route)
})

test('service-document change locks have their required Payload relation column', () => {
  const migration = readFileSync(
    new URL('../src/migrations/20260902_053500_service_document_lock_relations.ts', import.meta.url),
    'utf8',
  )
  const registry = readFileSync(
    new URL('../src/migrations/index.ts', import.meta.url),
    'utf8',
  )
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "syncshow_service_document_changes_id"/)
  assert.match(migration, /payload_locked_documents_rels_service_document_changes_fk/)
  assert.match(migration, /ON DELETE cascade/)
  assert.match(registry, /20260902_053500_service_document_lock_relations/)
})
