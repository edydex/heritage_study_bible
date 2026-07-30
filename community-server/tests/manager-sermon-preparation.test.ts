import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import {
  ManagerSermonPreparationError,
  prepareManagerSermon,
} from '../src/lib/syncshow/ManagerSermonPreparation.ts'
import {
  parseSermonDocument,
  serializeSermonDocument,
} from '../src/lib/syncshow/SermonDocument.ts'

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

test('same reviewed intent produces the same write and idempotency identity', () => {
  const first = prepareManagerSermon(intent())
  const second = prepareManagerSermon(intent())
  assert.deepEqual(second.write, first.write)
  assert.equal(second.idempotencyKey, first.idempotencyKey)
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
