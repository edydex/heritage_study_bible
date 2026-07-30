import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ServicePlans } from '../src/collections/ServicePlans.ts'
import {
  COMMUNITY_SERVICE_PLAN_KIND,
  COMMUNITY_SERVICE_PLAN_SCHEMA_VERSION,
  COMMUNITY_SERVICE_PLAN_SCHEMA_VERSIONS,
  CommunityServicePlanError,
  MAX_COMMUNITY_SERVICE_PLAN_LINKED_READING_VERSES,
  communityServicePlanRevision,
  normalizeCommunityServicePlan,
  normalizeCommunityServicePlanEnvelope,
  normalizeCommunityServicePlanPage,
  serializeCommunityServicePlan,
} from '../src/lib/syncshow/CommunityServicePlan.ts'
import { bibleRangeContains } from '../src/lib/syncshow/BibleRange.ts'
import {
  CommunityServicePlanPreparationError,
  prepareCommunityServicePlanChange,
  prepareCommunityServicePlanFields,
} from '../src/lib/syncshow/CommunityServicePlanEditor.ts'
import { serializeSermonDocument } from '../src/lib/syncshow/SermonDocument.ts'

type AnyRecord = Record<string, any>

const servicePlanFixtureUrl = new URL(
  '../../tests/fixtures/community-service-plan-conformance-v1.json',
  import.meta.url,
)
const servicePlanFixtureBytes = readFileSync(servicePlanFixtureUrl)
const servicePlanFixture = JSON.parse(servicePlanFixtureBytes.toString('utf8')) as {
  schemaVersion: number
  kind: string
  plan: AnyRecord
  canonicalSource: string
  revision: string
  envelope: AnyRecord
  invalidCases: Array<{
    name: string
    override: AnyRecord
    expectedCode: string
  }>
}
const servicePlanV2FixtureUrl = new URL(
  '../../tests/fixtures/community-service-plan-conformance-v2.json',
  import.meta.url,
)
const servicePlanV2FixtureBytes = readFileSync(servicePlanV2FixtureUrl)
const servicePlanV2Fixture = JSON.parse(
  servicePlanV2FixtureBytes.toString('utf8'),
) as {
  schemaVersion: number
  kind: string
  plan: AnyRecord
  canonicalSource: string
  revision: string
  envelope: AnyRecord
}
const sermonFixture = JSON.parse(readFileSync(
  new URL('./fixtures/syncshow-sermon-contract-v1.json', import.meta.url),
  'utf8',
)) as {
  sermons: {
    v3: {
      canonicalSource: string
      revision: string
      document: AnyRecord
    }
  }
}

function songDocument(id = 'family-grace-alone') {
  const source = [
    '---',
    `id: ${JSON.stringify(id)}`,
    'title: "Grace Alone"',
    'language: en',
    '---',
    '',
    '^1',
    'Grace alone, through faith alone',
    '',
  ].join('\n')
  return {
    id,
    source,
    revision: createHash('sha256').update(source).digest('hex'),
  }
}

function song(overrides: AnyRecord = {}) {
  return {
    id: 10,
    community: 7,
    status: 'published',
    syncId: 'family-grace-alone',
    syncVersion: 7,
    syncDocuments: [songDocument()],
    ...overrides,
  }
}

function sermon(overrides: AnyRecord = {}) {
  const golden = sermonFixture.sermons.v3
  return {
    id: 20,
    community: 7,
    syncId: golden.document.id,
    syncVersion: 4,
    syncCurrentRevision: golden.revision,
    syncCurrentDocumentSource: golden.canonicalSource,
    syncArchived: false,
    ...overrides,
  }
}

function sermonWithReferences(references: AnyRecord[]) {
  const document = {
    ...clone(sermonFixture.sermons.v3.document),
    references,
  }
  const source = serializeSermonDocument(document)
  return sermon({
    syncCurrentRevision: createHash('sha256').update(source).digest('hex'),
    syncCurrentDocumentSource: source,
  })
}

function sermonWithPublicationStatus(
  status: 'draft' | 'ready' | 'published' | 'archived',
) {
  const document = {
    ...clone(sermonFixture.sermons.v3.document),
    publication: {
      ...clone(sermonFixture.sermons.v3.document.publication),
      status,
      publishedAt: status === 'published' ? '2026-07-28T19:00:00.000Z' : null,
    },
  }
  const source = serializeSermonDocument(document)
  return sermon({
    syncArchived: status === 'archived',
    syncCurrentRevision: createHash('sha256').update(source).digest('hex'),
    syncCurrentDocumentSource: source,
  })
}

function editorData(overrides: AnyRecord = {}): AnyRecord {
  return {
    community: 7,
    status: 'draft',
    serviceDate: '2026-08-02T00:00:00.000Z',
    startTime: '10:30',
    title: 'Sunday Service — August 2',
    teamNotes: 'Communion this week.\r\nSound check at 09:45.',
    entries: [{
      id: 'payload-row-opening',
      entryId: 'client-cannot-choose-this',
      kind: 'section',
      title: 'Opening',
    }, {
      id: 'payload-row-song',
      entryId: 'client-cannot-choose-this-either',
      kind: 'song',
      title: 'Grace Alone',
      song: 10,
    }, {
      id: 'payload-row-reading',
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
          sermon: 20,
        },
      },
    }, {
      id: 'payload-row-sermon',
      kind: 'sermon',
      title: 'The Prayer That Transforms the Church',
      sermon: 20,
    }],
    ...overrides,
  }
}

function plan(overrides: AnyRecord = {}): AnyRecord {
  return {
    schemaVersion: 1,
    kind: COMMUNITY_SERVICE_PLAN_KIND,
    id: 'service-2026-08-02',
    title: 'Sunday Service — August 2',
    serviceDate: '2026-08-02',
    startTime: '10:30',
    teamNotes: 'Communion this week.\nSound check at 09:45.',
    entries: [{
      id: 'opening',
      kind: 'section',
      title: 'Opening',
    }, {
      id: 'song-grace',
      kind: 'song',
      title: 'Grace Alone',
      syncId: 'family-grace-alone',
      expectedRevision: 'song:family-grace-alone:7',
      expectedSyncVersion: 7,
    }, {
      id: 'reading',
      kind: 'scripture',
      title: 'Ephesians 3:14–21',
      range: {
        schemaVersion: 1,
        bookId: 'Eph',
        start: { chapter: 3, verse: 14 },
        end: { chapter: 3, verse: 21 },
      },
      translationId: 'BSB',
    }, {
      id: 'sermon-prayer',
      kind: 'sermon',
      title: 'The Prayer That Transforms the Church',
      syncId: sermonFixture.sermons.v3.document.id,
      expectedRevision: sermonFixture.sermons.v3.revision,
      expectedSyncVersion: 4,
    }],
    ...overrides,
  }
}

function planV2(overrides: AnyRecord = {}): AnyRecord {
  const legacy = plan()
  return {
    ...legacy,
    schemaVersion: 2,
    entries: legacy.entries.map((entry: AnyRecord) => (
      entry.kind === 'scripture'
        ? {
            ...entry,
            sermonReading: {
              sermonEntryId: 'sermon-prayer',
              referenceId: 'primary-eph-3',
            },
          }
        : entry
    )),
    ...overrides,
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function expectPlanCode(code: string, operation: () => unknown) {
  assert.throws(operation, error => {
    assert.ok(error instanceof CommunityServicePlanError)
    assert.equal(error.code, code)
    return true
  })
}

function fixedUuid(values: string[]) {
  let index = 0
  return () => values[index++] || `uuid-${index}`
}

function prepare(
  data: AnyRecord,
  options: {
    originalDoc?: AnyRecord
    operation?: 'create' | 'update'
    resolvedSong?: AnyRecord | null
    resolvedSermon?: AnyRecord | null
    sermonResolveCalls?: Array<number | string>
    uuids?: string[]
    now?: string
  } = {},
) {
  return prepareCommunityServicePlanChange({
    data,
    originalDoc: options.originalDoc,
    operation: options.operation || 'create',
    resolveSong: async id => {
      const resolved = options.resolvedSong === undefined ? song() : options.resolvedSong
      return resolved && String(id) === String(resolved.id) ? resolved : null
    },
    resolveSermon: async id => {
      options.sermonResolveCalls?.push(id)
      const resolved = options.resolvedSermon === undefined ? sermon() : options.resolvedSermon
      return resolved && String(id) === String(resolved.id) ? resolved : null
    },
    uuid: fixedUuid(options.uuids || [
      'opening-id',
      'song-id',
      'reading-id',
      'sermon-id',
      'plan-id',
    ]),
    now: () => new Date(options.now || '2026-07-28T20:00:00.000Z'),
  })
}

function expectPreparationError(
  path: string,
  operation: () => Promise<unknown>,
) {
  return assert.rejects(operation, error => {
    assert.ok(error instanceof CommunityServicePlanPreparationError)
    assert.ok(error.errors.some(item => item.path === path))
    return true
  })
}

test('fixed cross-repo service-plan fixture preserves canonical bytes and envelope', () => {
  assert.equal(
    createHash('sha256').update(servicePlanFixtureBytes).digest('hex'),
    '26b6bd29cd9b8bb97aa32cebbb4b0359bf50ef39dcafea1803dfa1889f578afc',
  )
  assert.equal(servicePlanFixture.schemaVersion, 1)
  assert.equal(
    servicePlanFixture.kind,
    'syncshow-community-service-plan-conformance',
  )
  const heritageSource = serializeCommunityServicePlan(servicePlanFixture.plan)
  assert.equal(heritageSource, servicePlanFixture.canonicalSource)
  assert.equal(
    communityServicePlanRevision(heritageSource),
    servicePlanFixture.revision,
  )
  assert.deepEqual(
    normalizeCommunityServicePlanEnvelope(servicePlanFixture.envelope),
    {
      ...servicePlanFixture.envelope,
      plan: servicePlanFixture.plan,
    },
  )
})

test('fixed cross-repo service-plan fixture preserves rejection codes', () => {
  for (const invalid of servicePlanFixture.invalidCases) {
    let heritageCode = ''
    try {
      serializeCommunityServicePlan({
        ...servicePlanFixture.plan,
        ...invalid.override,
      })
    } catch (error) {
      assert.ok(error instanceof CommunityServicePlanError)
      heritageCode = error.code
    }
    assert.equal(heritageCode, invalid.expectedCode, invalid.name)
  }
})

test('fixed schema-v2 fixture pins the linked sermon-reading wire contract', () => {
  assert.equal(
    createHash('sha256').update(servicePlanV2FixtureBytes).digest('hex'),
    '16b2bdcda04b35efdbed4561add015bfd1e2a3c9989a2eb1bb52470732345774',
  )
  assert.equal(COMMUNITY_SERVICE_PLAN_SCHEMA_VERSION, 2)
  assert.deepEqual(COMMUNITY_SERVICE_PLAN_SCHEMA_VERSIONS, [1, 2])
  assert.equal(MAX_COMMUNITY_SERVICE_PLAN_LINKED_READING_VERSES, 8)
  assert.equal(servicePlanV2Fixture.schemaVersion, 2)
  assert.equal(
    servicePlanV2Fixture.kind,
    'syncshow-community-service-plan-conformance',
  )
  const source = serializeCommunityServicePlan(servicePlanV2Fixture.plan)
  assert.equal(source, servicePlanV2Fixture.canonicalSource)
  assert.equal(
    communityServicePlanRevision(source),
    servicePlanV2Fixture.revision,
  )
  assert.deepEqual(
    normalizeCommunityServicePlanEnvelope(servicePlanV2Fixture.envelope),
    {
      ...servicePlanV2Fixture.envelope,
      plan: normalizeCommunityServicePlan(servicePlanV2Fixture.plan),
    },
  )
})

test('schema v2 requires an explicit null or bounded sermon-reading link while v1 stays accepted', () => {
  const normalized = normalizeCommunityServicePlan(planV2())
  assert.deepEqual((normalized.entries[2] as AnyRecord).sermonReading, {
    sermonEntryId: 'sermon-prayer',
    referenceId: 'primary-eph-3',
  })

  const unlinkedV2 = planV2()
  unlinkedV2.entries[2] = {
    ...unlinkedV2.entries[2],
    title: 'Genesis 1:31–2:2',
    range: {
      schemaVersion: 1,
      bookId: 'Gen',
      start: { chapter: 1, verse: 31 },
      end: { chapter: 2, verse: 2 },
    },
    translationId: 'bSb',
    sermonReading: null,
  }
  assert.equal(
    (normalizeCommunityServicePlan(unlinkedV2).entries[2] as AnyRecord)
      .sermonReading,
    null,
  )

  const legacy = plan()
  legacy.entries[2] = {
    ...unlinkedV2.entries[2],
  }
  delete legacy.entries[2].sermonReading
  assert.equal(normalizeCommunityServicePlan(legacy).schemaVersion, 1)
  assert.equal(
    Object.hasOwn(
      normalizeCommunityServicePlan(legacy).entries[2] as AnyRecord,
      'sermonReading',
    ),
    false,
  )

  const missing = planV2()
  delete missing.entries[2].sermonReading
  expectPlanCode(
    'INVALID_SERVICE_PLAN_FIELDS',
    () => normalizeCommunityServicePlan(missing),
  )
  const malformed = planV2()
  malformed.entries[2].sermonReading = false
  expectPlanCode(
    'INVALID_SERVICE_PLAN_SERMON_READING',
    () => normalizeCommunityServicePlan(malformed),
  )
  const unsafeId = planV2()
  unsafeId.entries[2].sermonReading.referenceId = '../private-reference'
  expectPlanCode(
    'INVALID_SERVICE_PLAN_SERMON_READING',
    () => normalizeCommunityServicePlan(unsafeId),
  )
  const v1WithV2Field = plan()
  v1WithV2Field.entries[2].sermonReading = null
  expectPlanCode(
    'INVALID_SERVICE_PLAN_FIELDS',
    () => normalizeCommunityServicePlan(v1WithV2Field),
  )
})

test('linked v2 readings require one uppercase same-chapter row of at most eight verses', () => {
  const exactlyEight = planV2()
  exactlyEight.entries[2] = {
    ...exactlyEight.entries[2],
    title: 'Psalm 119:1–8',
    range: {
      schemaVersion: 1,
      bookId: 'Ps',
      start: { chapter: 119, verse: 1 },
      end: { chapter: 119, verse: 8 },
    },
    translationId: 'LSV',
  }
  assert.deepEqual(
    (normalizeCommunityServicePlan(exactlyEight).entries[2] as AnyRecord).range,
    exactlyEight.entries[2].range,
  )

  const nineVerses = clone(exactlyEight)
  nineVerses.entries[2].range.end.verse = 9
  expectPlanCode(
    'INVALID_SERVICE_PLAN_SERMON_READING_RANGE',
    () => normalizeCommunityServicePlan(nineVerses),
  )
  const crossChapter = clone(exactlyEight)
  crossChapter.entries[2].range = {
    schemaVersion: 1,
    bookId: 'Gen',
    start: { chapter: 1, verse: 31 },
    end: { chapter: 2, verse: 2 },
  }
  expectPlanCode(
    'INVALID_SERVICE_PLAN_SERMON_READING_RANGE',
    () => normalizeCommunityServicePlan(crossChapter),
  )
  const lowercaseTranslation = clone(exactlyEight)
  lowercaseTranslation.entries[2].translationId = 'bSb'
  expectPlanCode(
    'INVALID_SERVICE_PLAN_SERMON_READING_TRANSLATION',
    () => normalizeCommunityServicePlan(lowercaseTranslation),
  )
})

test('linked v2 readings target one later sermon entry with deterministic relationship failures', () => {
  const missing = planV2()
  missing.entries[2].sermonReading.sermonEntryId = 'missing-sermon'
  expectPlanCode(
    'SERVICE_PLAN_SERMON_READING_TARGET_MISSING',
    () => normalizeCommunityServicePlan(missing),
  )

  const wrongKind = planV2()
  wrongKind.entries[2].sermonReading.sermonEntryId = 'song-grace'
  expectPlanCode(
    'SERVICE_PLAN_SERMON_READING_TARGET_KIND',
    () => normalizeCommunityServicePlan(wrongKind),
  )

  const reversed = planV2()
  const sermonEntry = reversed.entries.pop()
  reversed.entries.splice(2, 0, sermonEntry)
  expectPlanCode(
    'SERVICE_PLAN_SERMON_READING_ORDER',
    () => normalizeCommunityServicePlan(reversed),
  )

  const duplicate = planV2()
  duplicate.entries.splice(3, 0, {
    ...clone(duplicate.entries[2]),
    id: 'second-reading',
    title: 'Ephesians 3:14–16',
    range: {
      schemaVersion: 1,
      bookId: 'Eph',
      start: { chapter: 3, verse: 14 },
      end: { chapter: 3, verse: 16 },
    },
  })
  expectPlanCode(
    'DUPLICATE_SERVICE_PLAN_SERMON_READING',
    () => normalizeCommunityServicePlan(duplicate),
  )
})

test('whole-chapter sermon ranges contain their explicit linked reading edges', () => {
  const primary = sermonFixture.sermons.v3.document.references.find(
    (reference: AnyRecord) => reference.id === 'primary-eph-3',
  )
  assert.ok(primary)
  const linkedReading = servicePlanV2Fixture.plan.entries.find(
    (entry: AnyRecord) => entry.id === 'reading',
  )
  assert.ok(linkedReading)
  assert.equal(bibleRangeContains(primary.range, linkedReading.range), true)
  assert.equal(bibleRangeContains(linkedReading.range, primary.range), false)
  assert.equal(
    bibleRangeContains(primary.range, {
      schemaVersion: 1,
      bookId: 'Eph',
      start: { chapter: 4, verse: 1 },
      end: { chapter: 4, verse: 1 },
    }),
    false,
  )
})

test('manager edits generate immutable identities, exact resource pins, and canonical bytes', async () => {
  const created = await prepare(editorData())
  const source = JSON.parse(created.documentSource)

  assert.equal(created.syncId, 'service-plan-id')
  assert.equal(created.syncVersion, 1)
  assert.equal(source.schemaVersion, 2)
  assert.equal(created.changedAt, '2026-07-28T20:00:00.000Z')
  assert.equal(
    created.revision,
    createHash('sha256').update(created.documentSource).digest('hex'),
  )
  assert.deepEqual(source.entries.map((entry: AnyRecord) => entry.kind), [
    'section',
    'song',
    'scripture',
    'sermon',
  ])
  assert.equal(source.entries[1].expectedRevision, 'song:family-grace-alone:7')
  assert.equal(source.entries[1].expectedSyncVersion, 7)
  assert.equal(source.entries[3].expectedRevision, sermonFixture.sermons.v3.revision)
  assert.equal(source.entries[3].expectedSyncVersion, 4)
  assert.deepEqual(source.entries[2].sermonReading, {
    sermonEntryId: 'entry-sermon-id',
    referenceId: 'primary-eph-3',
  })
  assert.deepEqual(created.entries[2].scripture.sermonReading, {
    sermon: 20,
    referenceId: 'primary-eph-3',
  })
  assert.deepEqual(created.entries[0].scripture, {})
  assert.deepEqual(created.entries[1].scripture, {})
  assert.deepEqual(created.entries[3].scripture, {})
  assert.equal(source.serviceDate, '2026-08-02')
  assert.equal(source.teamNotes, 'Communion this week.\nSound check at 09:45.')
  assert.equal(created.entries[0].entryId, 'entry-opening-id')
  assert.notEqual(created.entries[0].entryId, 'client-cannot-choose-this')

  const reorderedEntries = [
    created.entries[1],
    created.entries[0],
    created.entries[2],
    created.entries[3],
  ]
  const reordered = await prepare({
    syncId: 'client-rewrite',
    syncVersion: 999,
    revision: 'f'.repeat(64),
    documentSource: '{"client":"rewrite"}',
    changedAt: '1999-01-01T00:00:00.000Z',
    entries: reorderedEntries.map(entry => ({
      ...entry,
      entryId: 'client-rewrite',
    })),
  }, {
    originalDoc: created,
    operation: 'update',
    now: '2026-07-28T19:00:00.000Z',
  })

  assert.equal(reordered.syncId, created.syncId)
  assert.equal(reordered.syncVersion, 2)
  assert.equal(reordered.changedAt, '2026-07-28T20:00:00.001Z')
  assert.deepEqual(
    reordered.entries.map((entry: AnyRecord) => entry.entryId),
    reorderedEntries.map((entry: AnyRecord) => entry.entryId),
  )
  assert.deepEqual(
    JSON.parse(reordered.documentSource).entries.map((entry: AnyRecord) => entry.id),
    reorderedEntries.map((entry: AnyRecord) => entry.entryId),
  )
})

test('manager emits explicit unlinked rows and resolves one exact forward sermon row only once', async () => {
  const unlinkedData = editorData()
  unlinkedData.entries[2].scripture.sermonReading = null
  const unlinked = await prepare(unlinkedData)
  assert.equal(
    JSON.parse(unlinked.documentSource).entries[2].sermonReading,
    null,
  )
  assert.equal(unlinked.entries[2].scripture.sermonReading, null)

  const sermonBeforeReading = editorData()
  sermonBeforeReading.entries = [
    sermonBeforeReading.entries[0],
    sermonBeforeReading.entries[1],
    sermonBeforeReading.entries[3],
    sermonBeforeReading.entries[2],
  ]
  await expectPreparationError(
    'entries.3.scripture.sermonReading.sermon',
    () => prepare(sermonBeforeReading),
  )

  const wrongRelationship = editorData()
  wrongRelationship.entries[2].scripture.sermonReading.sermon = 999
  await expectPreparationError(
    'entries.2.scripture.sermonReading.sermon',
    () => prepare(wrongRelationship),
  )

  const duplicateTarget = editorData()
  duplicateTarget.entries.push({
    ...clone(duplicateTarget.entries[3]),
    id: 'payload-row-sermon-copy',
  })
  const sermonResolveCalls: Array<number | string> = []
  await expectPreparationError(
    'entries.2.scripture.sermonReading.sermon',
    () => prepare(duplicateTarget, {
      sermonResolveCalls,
      uuids: [
        'opening-id',
        'song-id',
        'reading-id',
        'sermon-id',
        'sermon-copy-id',
        'plan-id',
      ],
    }),
  )
  assert.deepEqual(sermonResolveCalls, [20])

  const duplicateReading = editorData()
  duplicateReading.entries.splice(3, 0, {
    ...clone(duplicateReading.entries[2]),
    id: 'payload-row-reading-copy',
    title: 'Ephesians 3:14–16',
    scripture: {
      ...clone(duplicateReading.entries[2].scripture),
      endVerse: 16,
    },
  })
  await expectPreparationError(
    'entries.3.scripture.sermonReading.sermon',
    () => prepare(duplicateReading),
  )
})

test('manager validates the selected exact sermon reference and shared linked-reading bounds', async () => {
  const exactMismatchSource = `${sermonFixture.sermons.v3.canonicalSource} `
  await expectPreparationError(
    'entries.2.scripture.sermonReading.referenceId',
    () => prepare(editorData(), {
      resolvedSermon: sermon({
        syncCurrentDocumentSource: exactMismatchSource,
        syncCurrentRevision: createHash('sha256')
          .update(exactMismatchSource)
          .digest('hex'),
      }),
    }),
  )

  const unknownReference = editorData()
  unknownReference.entries[2].scripture.sermonReading.referenceId =
    'missing-reference'
  await expectPreparationError(
    'entries.2.scripture.sermonReading.referenceId',
    () => prepare(unknownReference),
  )

  const mentionedReference = editorData()
  mentionedReference.entries[2].scripture.sermonReading.referenceId =
    'mentioned-john-15'
  await expectPreparationError(
    'entries.2.scripture.sermonReading.referenceId',
    () => prepare(mentionedReference),
  )

  const primary = clone(
    sermonFixture.sermons.v3.document.references.find(
      (reference: AnyRecord) => reference.id === 'primary-eph-3',
    ),
  )
  assert.ok(primary)
  const suggestedPrimary = {
    ...primary,
    id: 'suggested-eph-3',
    reviewStatus: 'suggested',
  }
  const suggestedReference = editorData()
  suggestedReference.entries[2].scripture.sermonReading.referenceId =
    suggestedPrimary.id
  await expectPreparationError(
    'entries.2.scripture.sermonReading.referenceId',
    () => prepare(suggestedReference, {
      resolvedSermon: sermonWithReferences([
        ...clone(sermonFixture.sermons.v3.document.references),
        suggestedPrimary,
      ]),
    }),
  )

  const secondPrimary = {
    ...primary,
    id: 'primary-eph-3-second',
    enteredText: 'Ephesians 3:14-21',
  }
  const multiplePrimarySermon = sermonWithReferences([
    ...clone(sermonFixture.sermons.v3.document.references),
    secondPrimary,
  ])
  await expectPreparationError(
    'entries.2.scripture.sermonReading.referenceId',
    () => prepare(editorData(), {
      resolvedSermon: multiplePrimarySermon,
    }),
  )
  const explicitReference = editorData()
  explicitReference.entries[2].scripture.sermonReading.referenceId =
    secondPrimary.id
  const selected = await prepare(explicitReference, {
    resolvedSermon: multiplePrimarySermon,
  })
  assert.equal(
    JSON.parse(selected.documentSource).entries[2].sermonReading.referenceId,
    secondPrimary.id,
  )

  const outsidePrimary = editorData()
  outsidePrimary.entries[2].scripture = {
    ...outsidePrimary.entries[2].scripture,
    bookId: 'Eph',
    startChapter: 4,
    startVerse: 1,
    endChapter: 4,
    endVerse: 2,
  }
  await expectPreparationError(
    'entries.2.scripture.sermonReading.referenceId',
    () => prepare(outsidePrimary),
  )

  const nineVerses = editorData()
  nineVerses.entries[2].scripture.startVerse = 13
  await expectPreparationError(
    'entries',
    () => prepare(nineVerses),
  )

  const lowercaseTranslation = editorData()
  lowercaseTranslation.entries[2].scripture.translationId = 'bSb'
  await expectPreparationError(
    'entries',
    () => prepare(lowercaseTranslation),
  )
})

test('Ready requires current canonical resources and an explicit draft refresh after pin drift', async () => {
  await expectPreparationError(
    'entries.1.song',
    () => prepare(editorData({ status: 'ready' }), {
      resolvedSong: song({ status: 'archived' }),
    }),
  )
  await expectPreparationError(
    'entries.1.song',
    () => prepare(editorData({ status: 'ready' }), {
      resolvedSong: song({ syncDocuments: [] }),
    }),
  )
  await expectPreparationError(
    'entries.3.sermon',
    () => prepare(editorData({ status: 'ready' }), {
      resolvedSermon: sermon({
        syncCurrentDocumentSource: `${sermonFixture.sermons.v3.canonicalSource} `,
      }),
    }),
  )
  await expectPreparationError(
    'entries.3.sermon',
    () => prepare(editorData({ status: 'ready' }), {
      resolvedSermon: null,
    }),
  )
  await expectPreparationError(
    'entries.3.sermon',
    () => prepare(editorData({ status: 'ready' }), {
      resolvedSermon: sermonWithPublicationStatus('draft'),
    }),
  )
  assert.equal(
    (await prepare(editorData({ status: 'ready' }), {
      resolvedSermon: sermonWithPublicationStatus('published'),
    })).status,
    'ready',
  )

  const draft = await prepare(editorData())
  const changedSong = song({ syncVersion: 8 })
  await expectPreparationError(
    'entries.1.song',
    () => prepare({ status: 'ready' }, {
      originalDoc: draft,
      operation: 'update',
      resolvedSong: changedSong,
    }),
  )

  const refreshedDraft = await prepare({ status: 'draft' }, {
    originalDoc: draft,
    operation: 'update',
    resolvedSong: changedSong,
  })
  assert.equal(
    JSON.parse(refreshedDraft.documentSource).entries[1].expectedRevision,
    'song:family-grace-alone:8',
  )

  const persistedRefreshedDraft = { ...draft, ...refreshedDraft }
  const ready = await prepare({ status: 'ready' }, {
    originalDoc: persistedRefreshedDraft,
    operation: 'update',
    resolvedSong: changedSong,
  })
  assert.equal(ready.status, 'ready')
  assert.equal(ready.syncVersion, 3)

  const replacementSong = song({
    id: 11,
    syncId: 'replacement-song',
    syncVersion: 1,
    syncDocuments: [songDocument('replacement-song')],
  })
  const replacementEntries = draft.entries.map((entry: AnyRecord) => (
    entry.id === 'payload-row-song' ? { ...entry, song: 11 } : entry
  ))
  await expectPreparationError(
    'entries.1.song',
    () => prepare({
      status: 'ready',
      entries: replacementEntries,
    }, {
      originalDoc: draft,
      operation: 'update',
      resolvedSong: replacementSong,
    }),
  )
})

test('archive and cancellation preserve exact historical pins even when resources changed or vanished', async () => {
  const ready = await prepare(editorData({ status: 'ready' }))

  const archived = await prepare({ status: 'archived' }, {
    originalDoc: ready,
    operation: 'update',
    resolvedSong: null,
    resolvedSermon: null,
    now: '2026-07-28T21:00:00.000Z',
  })
  assert.equal(archived.status, 'archived')
  assert.equal(archived.syncVersion, 2)
  assert.equal(archived.documentSource, ready.documentSource)
  assert.equal(archived.revision, ready.revision)
  assert.deepEqual(archived.entries, ready.entries)
  assert.equal(
    JSON.parse(archived.documentSource).entries[1].expectedRevision,
    'song:family-grace-alone:7',
  )

  const cancelled = await prepare({ status: 'cancelled' }, {
    originalDoc: ready,
    operation: 'update',
    resolvedSong: song({ syncVersion: 99 }),
    resolvedSermon: sermon({
      syncVersion: 99,
      syncCurrentRevision: 'c'.repeat(64),
    }),
    now: '2026-07-28T22:00:00.000Z',
  })
  assert.equal(cancelled.documentSource, ready.documentSource)
  assert.equal(cancelled.revision, ready.revision)
  assert.deepEqual(cancelled.entries, ready.entries)

  const storedArchive = { ...ready, ...archived }
  await expectPreparationError(
    'title',
    () => prepare({ title: 'Edited after archive' }, {
      originalDoc: storedArchive,
      operation: 'update',
      resolvedSong: null,
      resolvedSermon: null,
    }),
  )
  const changedReadingLinkEntries = clone(storedArchive.entries)
  changedReadingLinkEntries[2].scripture.sermonReading.referenceId =
    'different-reference'
  await expectPreparationError(
    'entries',
    () => prepare({ entries: changedReadingLinkEntries }, {
      originalDoc: storedArchive,
      operation: 'update',
      resolvedSong: null,
      resolvedSermon: null,
    }),
  )
  await expectPreparationError(
    'status',
    () => prepare({ status: 'ready' }, {
      originalDoc: storedArchive,
      operation: 'update',
      resolvedSong: null,
      resolvedSermon: null,
    }),
  )

  const restored = await prepare({ status: 'draft' }, {
    originalDoc: storedArchive,
    operation: 'update',
    resolvedSong: null,
    resolvedSermon: null,
  })
  assert.equal(restored.documentSource, ready.documentSource)
  assert.equal(restored.revision, ready.revision)

  const storedRestored = { ...storedArchive, ...restored }
  const editedDraft = await prepare({ title: 'Restored and editable' }, {
    originalDoc: storedRestored,
    operation: 'update',
  })
  assert.equal(
    JSON.parse(editedDraft.documentSource).title,
    'Restored and editable',
  )
  assert.notEqual(editedDraft.documentSource, ready.documentSource)
})

test('terminal lifecycle transitions preserve legacy schema-v1 audit bytes and revision', async () => {
  const legacyEntries = clone(editorData().entries)
  delete legacyEntries[2].scripture.sermonReading
  const legacyReady = {
    ...editorData({
      status: 'ready',
      entries: legacyEntries,
    }),
    ...servicePlanFixture.envelope,
  }

  const archived = await prepare({ status: 'archived' }, {
    originalDoc: legacyReady,
    operation: 'update',
    resolvedSong: null,
    resolvedSermon: null,
    now: '2026-07-28T21:00:00.000Z',
  })

  assert.equal(archived.status, 'archived')
  assert.equal(archived.syncVersion, servicePlanFixture.envelope.syncVersion + 1)
  assert.equal(archived.documentSource, servicePlanFixture.canonicalSource)
  assert.equal(archived.revision, servicePlanFixture.revision)
  assert.equal(JSON.parse(archived.documentSource).schemaVersion, 1)
})

test('page validators preserve all four lifecycle states and exact cursor semantics', () => {
  const base = {
    syncVersion: 1,
    revision: communityServicePlanRevision(plan()),
    title: plan().title,
    serviceDate: plan().serviceDate,
    startTime: plan().startTime,
    changedAt: '2026-07-28T20:00:00.000Z',
  }
  const statuses = ['draft', 'ready', 'archived', 'cancelled'] as const
  const page = normalizeCommunityServicePlanPage({
    items: statuses.map((status, index) => ({
      ...base,
      syncId: `plan-${index}`,
      status,
    })),
    nextCursor: null,
    hasMore: false,
  })
  assert.deepEqual(page.items.map(item => item.status), statuses)
  assert.throws(
    () => normalizeCommunityServicePlanPage({
      items: [],
      nextCursor: 'cursor-without-more',
      hasMore: false,
    }),
    (error: unknown) => (
      error instanceof CommunityServicePlanError
      && error.code === 'INVALID_SERVICE_PLAN_PAGE'
    ),
  )
})

test('Payload service-plan collection is manager-owned, ordered, and never physically deleted', () => {
  assert.equal(ServicePlans.slug, 'service-plans')
  assert.equal(ServicePlans.access?.delete?.({} as never), false)
  const entries = ServicePlans.fields.find(field => (
    'name' in field && field.name === 'entries'
  )) as AnyRecord
  assert.equal(entries.type, 'array')
  assert.equal(entries.maxRows, 500)
  assert.deepEqual(
    entries.fields.find((field: AnyRecord) => field.name === 'kind').options
      .map((option: AnyRecord) => option.value),
    ['section', 'song', 'scripture', 'sermon'],
  )
  for (const fieldName of [
    'entryId',
    'resolvedSyncId',
    'resolvedSyncVersion',
    'resolvedRevision',
  ]) {
    assert.equal(
      entries.fields.find((field: AnyRecord) => field.name === fieldName).hidden,
      true,
    )
  }
  const scripture = entries.fields.find(
    (field: AnyRecord) => field.name === 'scripture',
  )
  assert.equal(scripture.type, 'group')
  const sermonReading = scripture.fields.find(
    (field: AnyRecord) => field.name === 'sermonReading',
  )
  assert.equal(sermonReading.type, 'group')
  const linkedSermon = sermonReading.fields.find(
    (field: AnyRecord) => field.name === 'sermon',
  )
  assert.equal(linkedSermon.type, 'relationship')
  assert.equal(linkedSermon.relationTo, 'sermons')
  const sermonEntry = entries.fields.find(
    (field: AnyRecord) => field.name === 'sermon',
  )
  for (const relationship of [linkedSermon, sermonEntry]) {
    assert.equal(relationship.filterOptions({ data: {} }), false)
    assert.deepEqual(
      relationship.filterOptions({ data: { community: { id: 7 } } }),
      {
        and: [
          { syncId: { exists: true } },
          { syncArchived: { not_equals: true } },
          { community: { equals: 7 } },
        ],
      },
    )
  }
  assert.equal(
    sermonReading.fields.find(
      (field: AnyRecord) => field.name === 'referenceId',
    ).type,
    'text',
  )
  for (const fieldName of [
    'syncId',
    'syncVersion',
    'revision',
    'documentSource',
    'changedAt',
  ]) {
    const field = ServicePlans.fields.find(candidate => (
      'name' in candidate && candidate.name === fieldName
    )) as AnyRecord
    assert.equal(field.hidden, true)
    assert.equal(field.access.create({} as never), false)
    assert.equal(field.access.update({} as never), false)
  }
})

test('Community admin gives service planning a first-class ordinary-task entry point', () => {
  const welcome = readFileSync(
    new URL('../src/components/AdminWelcome.tsx', import.meta.url),
    'utf8',
  )
  assert.match(welcome, /href: '\/admin\/collections\/service-plans\/create'/)
  assert.match(welcome, /title: 'Plan a service'/)
  assert.match(
    welcome,
    /sections, songs, Scripture readings, and the sermon/,
  )
})

test('Payload hook explicitly resolves hidden canonical sermon fields for exact plan pins', async () => {
  const calls: AnyRecord[] = []
  const req = {
    payload: {
      findByID: async (args: AnyRecord) => {
        calls.push(args)
        return args.collection === 'songs' ? song() : sermon()
      },
    },
  }
  const result = await prepareCommunityServicePlanFields({
    data: editorData(),
    operation: 'create',
    originalDoc: undefined,
    req,
  } as never) as AnyRecord

  assert.equal(calls.length, 2)
  assert.equal(calls.every(call => call.overrideAccess === true), true)
  assert.equal(calls.every(call => call.showHiddenFields === true), true)
  assert.equal(
    JSON.parse(result.documentSource).entries[3].expectedRevision,
    sermonFixture.sermons.v3.revision,
  )
})
