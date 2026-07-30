import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import {
  MAX_MANAGER_SERMON_MENTIONED_PASSAGES,
  ManagerSermonPreparationError,
  prepareManagerSermon,
} from '../src/lib/syncshow/ManagerSermonPreparation.ts'
import { buildManagerSermonPublicationTransition } from '../src/lib/syncshow/ManagerSermonPublication.ts'
import {
  buildPublicSermonCatalogFromItemSources,
  buildPublicSermonPassageIndex,
  serializePublicSermonCatalogItem,
} from '../src/lib/syncshow/PublicSermonPublication.ts'
import {
  parseSermonDocument,
  serializeSermonDocument,
} from '../src/lib/syncshow/SermonDocument.ts'
import { managerSermonPreparationResponse } from '../src/endpoints/sermonPreparations.ts'

const requestId = '8fe3df49-48b7-47cc-aabe-cf56212b3189'

function intent(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    requestId,
    title: 'Faithful Prayer',
    speaker: 'Pastor Example',
    serviceDate: '2026-08-02',
    language: 'EN',
    primaryPassage: {
      bookId: 'Eph',
      startChapter: 3,
      startVerse: 14,
      endChapter: 3,
      endVerse: 21,
    },
    manuscript: 'First line.\r\n\r\nSecond line.',
    slideNotes: 'Pray for strength.\nKnow Christ’s love.',
    reviewConfirmed: true,
    ...overrides,
  }
}

function intentV2(overrides: Record<string, unknown> = {}) {
  return {
    ...intent(),
    schemaVersion: 2,
    mentionedPassages: [{
      bookId: 'John',
      startChapter: 15,
      startVerse: 5,
      endChapter: 15,
      endVerse: 5,
    }],
    ...overrides,
  }
}

test('manager preparation creates one exact private Ready schema-v3 sermon', () => {
  const prepared = prepareManagerSermon(intent())
  assert.equal(prepared.requestId, requestId)
  assert.equal(prepared.idempotencyKey, `manager-sermon-${requestId}`)
  assert.equal(prepared.syncId, `sermon-${requestId}`)
  assert.equal(prepared.passageLabel, 'Ephesians 3:14–21')
  assert.equal(prepared.write.syncId, prepared.syncId)
  assert.equal(
    prepared.write.revision,
    createHash('sha256').update(prepared.write.documentSource).digest('hex'),
  )

  const document = parseSermonDocument(prepared.write.documentSource)
  assert.equal(document.schemaVersion, 3)
  assert.equal(document.id, prepared.syncId)
  assert.deepEqual(document.titles, { en: 'Faithful Prayer' })
  assert.equal(document.defaultLanguage, 'en')
  assert.equal(document.speaker.name, 'Pastor Example')
  assert.equal(document.serviceDate, '2026-08-02')
  assert.deepEqual(document.publication, {
    status: 'ready',
    visibility: 'private',
    publishedAt: null,
    canonicalUrl: null,
  })
  assert.equal(document.references.length, 1)
  assert.equal(document.references[0].role, 'primary')
  assert.equal(document.references[0].reviewStatus, 'confirmed')
  assert.equal(document.references[0].source, 'pastor')
  assert.equal(document.references[0].enteredText, 'Ephesians 3:14–21')
  assert.deepEqual(document.references[0].range, {
    schemaVersion: 1,
    bookId: 'Eph',
    start: { chapter: 3, verse: 14 },
    end: { chapter: 3, verse: 21 },
  })
  assert.deepEqual(document.body?.map(entry => ({
    id: entry.id,
    kind: entry.kind,
    language: entry.language,
    text: entry.text,
  })), [
    {
      id: 'body-manuscript-en',
      kind: 'manuscript',
      language: 'en',
      text: 'First line.\n\nSecond line.',
    },
    {
      id: 'body-slide-notes-en',
      kind: 'slide-notes',
      language: 'en',
      text: 'Pray for strength.\nKnow Christ’s love.',
    },
  ])
  assert.equal(document.sources.length, 2)
  assert.equal(document.sources[0].provenance.sourceSystem, 'heritage-community-manager')
  assert.equal(document.sources[0].provenance.externalId, `${requestId}:manuscript`)
  assert.equal(document.sources[0].sha256, createHash('sha256')
    .update('First line.\n\nSecond line.')
    .digest('hex'))
  assert.equal(serializeSermonDocument(document), prepared.write.documentSource)
})

test('v2 preparation canonicalizes, sorts, and deduplicates confirmed mentioned passages', () => {
  const prepared = prepareManagerSermon(intentV2({
    mentionedPassages: [{
      bookId: 'John',
      startChapter: 15,
      startVerse: 5,
      endChapter: 15,
      endVerse: 5,
    }, {
      // Same canonical range entered through a supported book alias.
      bookId: 'JOHN',
      startChapter: 15,
      startVerse: 5,
      endChapter: 15,
      endVerse: 5,
    }, {
      bookId: 'Gen',
      startChapter: 1,
      startVerse: 1,
      endChapter: 1,
      endVerse: 2,
    }, {
      // A primary-range duplicate must not become a mentioned reference.
      bookId: 'Ephesians',
      startChapter: 3,
      startVerse: 14,
      endChapter: 3,
      endVerse: 21,
    }],
  }))

  assert.deepEqual(prepared.document.references.map(reference => ({
    id: reference.id,
    role: reference.role,
    source: reference.source,
    reviewStatus: reference.reviewStatus,
    enteredText: reference.enteredText,
  })), [{
    id: 'primary-Eph-3-14-3-21',
    role: 'primary',
    source: 'pastor',
    reviewStatus: 'confirmed',
    enteredText: 'Ephesians 3:14–21',
  }, {
    id: 'mentioned-Gen-1-1-1-2',
    role: 'mentioned',
    source: 'operator',
    reviewStatus: 'confirmed',
    enteredText: 'Genesis 1:1–2',
  }, {
    id: 'mentioned-John-15-5-15-5',
    role: 'mentioned',
    source: 'operator',
    reviewStatus: 'confirmed',
    enteredText: 'John 15:5',
  }])
})

test('response v1 preserves its exact legacy shape while response v2 reports mentioned passages', () => {
  const legacy = prepareManagerSermon(intent())
  const current = prepareManagerSermon(intentV2())
  const stored = (prepared: typeof legacy) => ({
    id: 27,
    syncVersion: 1,
    syncCurrentDocumentSource: prepared.write.documentSource,
    syncCurrentRevision: prepared.write.revision,
  })

  const legacyResponse = managerSermonPreparationResponse(
    stored(legacy),
    true,
    legacy.schemaVersion,
  )
  assert.equal(legacyResponse.schemaVersion, 1)
  assert.deepEqual(Object.keys(legacyResponse), ['schemaVersion', 'created', 'sermon'])
  assert.deepEqual(Object.keys(legacyResponse.sermon), [
    'recordId',
    'syncId',
    'syncVersion',
    'currentRevision',
    'title',
    'speaker',
    'serviceDate',
    'passageLabel',
    'publicationStatus',
    'visibility',
    'bodyEntryCount',
  ])
  assert.equal('mentionedPassageCount' in legacyResponse.sermon, false)

  const currentResponse = managerSermonPreparationResponse(
    stored(current),
    false,
    current.schemaVersion,
  )
  assert.equal(currentResponse.schemaVersion, 2)
  assert.deepEqual(Object.keys(currentResponse.sermon), [
    ...Object.keys(legacyResponse.sermon),
    'mentionedPassageCount',
  ])
  assert.equal(currentResponse.sermon.mentionedPassageCount, 1)
})

test('manager v2 mentioned passage survives projection, catalog, and passage index composition', () => {
  const prepared = prepareManagerSermon(intentV2())
  const transition = buildManagerSermonPublicationTransition({
    documentSource: prepared.write.documentSource,
    publishedAt: '2026-08-02T20:00:00.000Z',
    selectedBodyEntryIds: (prepared.document.body || []).map(entry => entry.id),
    selectedMediaIds: [],
  })
  const catalog = buildPublicSermonCatalogFromItemSources([
    serializePublicSermonCatalogItem(transition.projection.catalogItem),
  ])
  const passageIndex = buildPublicSermonPassageIndex(catalog.catalog)
  const expectedMention = {
    role: 'mentioned',
    range: {
      schemaVersion: 1,
      bookId: 'John',
      start: { chapter: 15, verse: 5 },
      end: { chapter: 15, verse: 5 },
    },
  }

  assert.deepEqual(
    transition.projection.detail.references.find(reference => (
      reference.role === 'mentioned'
    )),
    expectedMention,
  )
  assert.deepEqual(
    catalog.catalog.items[0].references.find(reference => (
      reference.role === 'mentioned'
    )),
    expectedMention,
  )
  assert.deepEqual(
    passageIndex.passageIndex.items[0].references.find(reference => (
      reference.role === 'mentioned'
    )),
    expectedMention,
  )
})

test('same reviewed intent produces the same write and idempotency identity', () => {
  const first = prepareManagerSermon(intent())
  const second = prepareManagerSermon(intent())
  assert.deepEqual(second.write, first.write)
  assert.equal(second.idempotencyKey, first.idempotencyKey)
})

test('mentioned passages participate in the exact idempotent write', () => {
  const first = prepareManagerSermon(intentV2())
  const changed = prepareManagerSermon(intentV2({
    mentionedPassages: [{
      bookId: 'Rom',
      startChapter: 8,
      startVerse: 1,
      endChapter: 8,
      endVerse: 2,
    }],
  }))

  assert.equal(changed.idempotencyKey, first.idempotencyKey)
  assert.notEqual(changed.write.revision, first.write.revision)
  assert.notEqual(changed.write.documentSource, first.write.documentSource)
})

test('one pasted source is enough and remains explicitly source-bound', () => {
  const prepared = prepareManagerSermon(intent({ manuscript: '' }))
  assert.deepEqual(prepared.document.sources.map(source => source.kind), ['slide-notes'])
  assert.deepEqual(prepared.document.body?.map(body => body.sourceId), ['source-slide-notes'])
})

test('manager title and speaker boundaries match the canonical sermon document', () => {
  const title = 'T'.repeat(300)
  const speaker = 'S'.repeat(200)
  const prepared = prepareManagerSermon(intent({ title, speaker }))
  assert.equal(prepared.document.titles.en, title)
  assert.equal(prepared.document.speaker.name, speaker)

  for (const [overrides, message] of [
    [{ title: 'T'.repeat(301) }, 'Sermon title must be 300 characters or fewer.'],
    [{ speaker: 'S'.repeat(201) }, 'Speaker must be 200 characters or fewer.'],
  ] as const) {
    assert.throws(
      () => prepareManagerSermon(intent(overrides)),
      (error: unknown) => (
        error instanceof ManagerSermonPreparationError
        && error.code === 'INVALID_PREPARATION'
        && error.message === message
      ),
    )
  }
})

test('preparation fails closed for unreviewed, textless, imprecise, or shaped input', () => {
  for (const [value, code] of [
    [intent({ reviewConfirmed: false }), 'REVIEW_REQUIRED'],
    [intent({ manuscript: ' ', slideNotes: '' }), 'MISSING_SERMON_TEXT'],
    [intent({ requestId: 'not-a-uuid' }), 'INVALID_PREPARATION'],
    [intent({ language: 'english' }), 'INVALID_PREPARATION'],
    [intent({ primaryPassage: {
      bookId: 'Eph',
      startChapter: 99,
      startVerse: 1,
      endChapter: 99,
      endVerse: 2,
    } }), 'INVALID_PRIMARY_PASSAGE'],
    [{ ...intent(), unexpected: true }, 'INVALID_PREPARATION'],
  ] as const) {
    assert.throws(
      () => prepareManagerSermon(value),
      (error: unknown) => (
        error instanceof ManagerSermonPreparationError
        && error.code === code
      ),
    )
  }
})

test('v2 preparation bounds and validates every mentioned passage while v1 stays strict', () => {
  const tooMany = Array.from(
    { length: MAX_MANAGER_SERMON_MENTIONED_PASSAGES + 1 },
    () => ({
      bookId: 'John',
      startChapter: 1,
      startVerse: 1,
      endChapter: 1,
      endVerse: 1,
    }),
  )
  for (const [value, code] of [
    [intentV2({ mentionedPassages: tooMany }), 'INVALID_MENTIONED_PASSAGES'],
    [intentV2({ mentionedPassages: [{
      bookId: 'John',
      startChapter: 99,
      startVerse: 1,
      endChapter: 99,
      endVerse: 2,
    }] }), 'INVALID_MENTIONED_PASSAGE'],
    [intentV2({ mentionedPassages: 'John 15:5' }), 'INVALID_MENTIONED_PASSAGES'],
    [{ ...intent(), mentionedPassages: [] }, 'INVALID_PREPARATION'],
    [(() => {
      const value = intentV2()
      delete (value as Record<string, unknown>).mentionedPassages
      return value
    })(), 'INVALID_PREPARATION'],
  ] as const) {
    assert.throws(
      () => prepareManagerSermon(value),
      (error: unknown) => (
        error instanceof ManagerSermonPreparationError
        && error.code === code
      ),
    )
  }
})
