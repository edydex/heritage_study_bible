import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  BIBLE_RANGE_SCHEMA_VERSION,
  BibleRangeError,
  CANONICAL_BIBLE_BOOKS,
  bibleRangesIntersect,
  canonicalBibleChapterVerseMaximum,
  formatBibleRange,
  normalizeBibleRange,
  serializeBibleRange,
} from '../src/lib/syncshow/BibleRange.ts'
import {
  MAX_SERMON_BODY_BYTES,
  MAX_SERMON_BODY_ENTRIES,
  MAX_SERMON_BODY_ENTRY_BYTES,
  MAX_SERMON_SOURCE_BYTES,
  SERMON_SCHEMA_VERSION,
  SermonDocumentError,
  createSermonRevision,
  normalizeSermonDocument,
  parseSermonDocument,
  serializeSermonDocument,
  sermonDocumentSha256,
  upgradeSermonDocument,
} from '../src/lib/syncshow/SermonDocument.ts'
import {
  COMMUNITY_SERMON_WIRE_SCHEMA_VERSION,
  CommunitySermonWireError,
  MAX_SERMON_CHANGE_ITEMS,
  MAX_SERMON_CURSOR_BYTES,
  MAX_SERMON_SOURCE_OBJECTS,
  buildSermonCreateBody,
  buildSermonIdempotencyHeaders,
  buildSermonIfMatchHeaders,
  buildSermonUpdateBody,
  normalizeRemoteSermonEnvelope,
  normalizeSermonChangePage,
  normalizeSermonChangeSummary,
} from '../src/lib/syncshow/CommunitySermonWire.ts'

type GoldenCase = {
  document: Record<string, any>
  canonicalSource: string
  revision: string
}

type GoldenFixture = {
  schemaVersion: number
  bibleRanges: {
    wholeChapter: Record<string, any>
    verseBounded: Record<string, any>
  }
  sermons: {
    v1: GoldenCase
    v2: GoldenCase
    v3: GoldenCase
  }
}

type BundledBibleIndex = {
  books: Array<{
    name: string
    chapters: number
    file: string
  }>
}

type BundledBibleBook = {
  name: string
  chapters: Array<{
    number: number
    verses: Array<{ number: number }>
  }>
}

type BibleVersificationContract = {
  schemaVersion: 1
  kind: 'heritage-syncshow-bsb-versification'
  sourceTranslation: 'BSB'
  canon: 'protestant-66'
  books: Array<{
    id: string
    name: string
    verseMaximums: number[]
  }>
}

const fixture = JSON.parse(readFileSync(
  new URL('./fixtures/syncshow-sermon-contract-v1.json', import.meta.url),
  'utf8',
)) as GoldenFixture

function clone<T>(value: T): T {
  return structuredClone(value)
}

function expectDocumentCode(code: string, callback: () => unknown) {
  assert.throws(callback, error => {
    assert.ok(error instanceof SermonDocumentError)
    assert.equal(error.code, code)
    return true
  })
}

function expectRangeCode(code: string, callback: () => unknown) {
  assert.throws(callback, error => {
    assert.ok(error instanceof BibleRangeError)
    assert.equal(error.code, code)
    return true
  })
}

function expectWireCode(code: string, callback: () => unknown) {
  assert.throws(callback, error => {
    assert.ok(error instanceof CommunitySermonWireError)
    assert.equal(error.code, code)
    return true
  })
}

function sourceObjectsFor(golden: GoldenCase) {
  return [...golden.document.sources].reverse().map((source: Record<string, any>) => ({
    sourceId: source.id,
    sha256: source.sha256,
    sizeBytes: source.sizeBytes,
    available: false,
  }))
}

function envelopeFor(
  golden: GoldenCase,
  overrides: Record<string, unknown> = {},
) {
  return {
    syncId: golden.document.id,
    syncVersion: 3,
    revision: golden.revision,
    documentSource: golden.canonicalSource,
    archived: golden.document.publication.status === 'archived',
    updatedAt: '2026-07-27T01:30:00.000Z',
    sourceObjects: sourceObjectsFor(golden),
    ...overrides,
  }
}

test('BibleRangeV1 matches the fixed 66-book canon and canonical range bytes', () => {
  assert.equal(BIBLE_RANGE_SCHEMA_VERSION, 1)
  assert.equal(CANONICAL_BIBLE_BOOKS.length, 66)
  assert.deepEqual(CANONICAL_BIBLE_BOOKS[0], {
    id: 'Gen',
    name: 'Genesis',
    chapters: 50,
    testament: 'OT',
    order: 1,
  })
  assert.equal(CANONICAL_BIBLE_BOOKS.at(-1)?.id, 'Rev')

  assert.deepEqual(
    normalizeBibleRange({
      book: 'Ephesians',
      chapter: 3,
      verse: null,
    }),
    fixture.bibleRanges.wholeChapter,
  )
  assert.equal(
    serializeBibleRange(fixture.bibleRanges.wholeChapter),
    '{"bookId":"Eph","end":{"chapter":3,"verse":null},"schemaVersion":1,"start":{"chapter":3,"verse":null}}\n',
  )
  assert.equal(formatBibleRange(fixture.bibleRanges.wholeChapter), 'Ephesians 3')
  assert.equal(formatBibleRange(fixture.bibleRanges.verseBounded), 'John 15:5-8')
  assert.equal(
    bibleRangesIntersect(
      fixture.bibleRanges.verseBounded,
      {
        schemaVersion: 1,
        bookId: 'John',
        start: { chapter: 15, verse: 8 },
        end: { chapter: 15, verse: 10 },
      },
    ),
    true,
  )
})

test('BibleRangeV1 rejects unknown books, reversed ranges, and numeric overflow', () => {
  expectRangeCode('UNKNOWN_BIBLE_BOOK', () => normalizeBibleRange({
    bookId: 'NotABook',
    start: { chapter: 1, verse: 1 },
    end: { chapter: 1, verse: 1 },
  }))
  expectRangeCode('REVERSED_BIBLE_RANGE', () => normalizeBibleRange({
    schemaVersion: 1,
    bookId: 'Eph',
    start: { chapter: 3, verse: 21 },
    end: { chapter: 3, verse: 14 },
  }))
  expectRangeCode('INVALID_RANGE_NUMBER', () => normalizeBibleRange({
    schemaVersion: 1,
    bookId: 'Eph',
    start: { chapter: 7, verse: 1 },
    end: { chapter: 7, verse: 1 },
  }))
  expectRangeCode('INVALID_RANGE_NUMBER', () => normalizeBibleRange({
    schemaVersion: 1,
    bookId: 'Eph',
    start: { chapter: 3, verse: 1000 },
    end: { chapter: 3, verse: 1000 },
  }))
})

test('BibleRangeV1 fails closed at the bundled BSB per-chapter verse maximum', () => {
  assert.equal(canonicalBibleChapterVerseMaximum('Genesis', 1), 31)
  assert.equal(canonicalBibleChapterVerseMaximum('Ps', 119), 176)
  assert.equal(canonicalBibleChapterVerseMaximum('Eph', 3), 21)
  assert.equal(canonicalBibleChapterVerseMaximum('Eph', 7), null)

  assert.equal(normalizeBibleRange({
    schemaVersion: 1,
    bookId: 'Eph',
    start: { chapter: 3, verse: 21 },
    end: { chapter: 3, verse: 21 },
  }).start.verse, 21)

  for (const impossibleVerse of [22, 999]) {
    expectRangeCode('INVALID_RANGE_NUMBER', () => normalizeBibleRange({
      schemaVersion: 1,
      bookId: 'Eph',
      start: { chapter: 3, verse: impossibleVerse },
      end: { chapter: 3, verse: impossibleVerse },
    }))
  }
})

test('BibleRangeV1 verse maxima stay aligned with every bundled BSB chapter', () => {
  const bsbDirectory = new URL('../../public/data/translations/BSB/', import.meta.url)
  const index = JSON.parse(readFileSync(
    new URL('index.json', bsbDirectory),
    'utf8',
  )) as BundledBibleIndex

  assert.equal(index.books.length, CANONICAL_BIBLE_BOOKS.length)
  for (const metadata of index.books) {
    const canonicalBook = CANONICAL_BIBLE_BOOKS.find(book => book.name === metadata.name)
    assert.ok(canonicalBook, `canonical book metadata for ${metadata.name}`)

    const bundledBook = JSON.parse(readFileSync(
      new URL(metadata.file, bsbDirectory),
      'utf8',
    )) as BundledBibleBook
    assert.equal(bundledBook.name, metadata.name)
    assert.equal(bundledBook.chapters.length, metadata.chapters)
    assert.equal(metadata.chapters, canonicalBook.chapters)

    for (const [chapterIndex, chapter] of bundledBook.chapters.entries()) {
      assert.equal(chapter.number, chapterIndex + 1)
      assert.ok(chapter.verses.length > 0, `${metadata.name} ${chapter.number} has verses`)
      for (const [verseIndex, verse] of chapter.verses.entries()) {
        assert.equal(verse.number, verseIndex + 1)
      }
      assert.equal(
        canonicalBibleChapterVerseMaximum(canonicalBook.id, chapter.number),
        chapter.verses.at(-1)?.number,
        `${metadata.name} ${chapter.number} final verse`,
      )
    }
  }
})

test('BibleRangeV1 matches the shared versioned SyncShow BSB coordinate vector', () => {
  const contractSource = readFileSync(
    new URL('./fixtures/bible-versification-bsb-v1.json', import.meta.url),
    'utf8',
  )
  const contract = JSON.parse(contractSource) as BibleVersificationContract
  assert.equal(contractSource, `${JSON.stringify(contract)}\n`)
  assert.equal(
    createHash('sha256').update(contractSource).digest('hex'),
    '878253daa85e874da525fd58cbc5fb22522c30fe494522bf356da3ecbf874069',
  )

  const generatedContract: BibleVersificationContract = {
    schemaVersion: 1,
    kind: 'heritage-syncshow-bsb-versification',
    sourceTranslation: 'BSB',
    canon: 'protestant-66',
    books: CANONICAL_BIBLE_BOOKS.map(book => ({
      id: book.id,
      name: book.name,
      verseMaximums: Array.from(
        { length: book.chapters },
        (_, chapterIndex) => canonicalBibleChapterVerseMaximum(book.id, chapterIndex + 1)!,
      ),
    })),
  }
  assert.deepEqual(generatedContract, contract)
  assert.equal(contract.books.length, 66)
  assert.equal(
    contract.books.reduce((count, book) => count + book.verseMaximums.length, 0),
    1189,
  )
  assert.equal(
    contract.books.reduce(
      (count, book) => count + book.verseMaximums.reduce(
        (bookCount, maximum) => bookCount + maximum,
        0,
      ),
      0,
    ),
    31102,
  )
})

test('SyncShow v1, v2, and v3 goldens keep exact canonical bytes and revisions', () => {
  assert.equal(fixture.schemaVersion, 1)
  assert.equal(SERMON_SCHEMA_VERSION, 3)

  for (const [version, golden] of Object.entries(fixture.sermons)) {
    const canonicalSource = serializeSermonDocument(golden.document)
    assert.equal(canonicalSource, golden.canonicalSource, `${version} canonical source`)
    assert.equal(canonicalSource.endsWith('\n'), true)
    assert.equal(sermonDocumentSha256(golden.document), golden.revision)

    const parsed = parseSermonDocument(golden.canonicalSource)
    assert.equal(parsed.schemaVersion, Number(version.slice(1)))
    assert.equal(serializeSermonDocument(parsed), golden.canonicalSource)
    assert.equal(Object.isFrozen(parsed), true)
    assert.equal(Object.isFrozen(parsed.sources), true)

    const revision = createSermonRevision(parsed)
    assert.equal(revision.id, `sha256:${golden.revision}`)
    assert.equal(revision.source, golden.canonicalSource)
    assert.equal(revision.sha256, golden.revision)
    assert.equal(Object.isFrozen(revision), true)
  }
})

test('historical v1/v2 shapes are preserved and upgrade only when explicitly requested', () => {
  const v1 = parseSermonDocument(fixture.sermons.v1.canonicalSource)
  const v2 = parseSermonDocument(fixture.sermons.v2.canonicalSource)
  assert.equal(v1.sources[0].language, 'en')
  assert.equal(Object.hasOwn(v1.sources[0], 'languages'), false)
  assert.deepEqual(v2.sources[0].languages, ['en', 'ru'])
  assert.equal(Object.hasOwn(v2.sources[0], 'language'), false)
  assert.equal(Object.hasOwn(v1, 'body'), false)
  assert.equal(Object.hasOwn(v2, 'body'), false)
  assert.equal(serializeSermonDocument(v1), fixture.sermons.v1.canonicalSource)
  assert.equal(serializeSermonDocument(v2), fixture.sermons.v2.canonicalSource)

  const upgraded = upgradeSermonDocument(v1)
  assert.equal(upgraded.schemaVersion, 3)
  assert.deepEqual(upgraded.sources[0].languages, ['en'])
  assert.deepEqual(upgraded.body, [])
  assert.notEqual(sermonDocumentSha256(upgraded), fixture.sermons.v1.revision)
})

test('v3 keeps ordered reviewed body text and exact source provenance', () => {
  const normalized = normalizeSermonDocument(fixture.sermons.v3.document)
  assert.deepEqual(normalized.body?.map(entry => entry.id), [
    'manuscript-opening',
    'slides-summary',
  ])
  assert.equal(normalized.body?.[0].sourceId, 'pastor-manuscript')
  assert.equal(normalized.body?.[0].sectionId, 'prayer')
  assert.equal(normalized.sources[1].kind, 'slide-notes')
  assert.equal(normalized.sources[1].provenance.sourceSystem, 'church-drive')

  const lineEndingCandidate = clone(fixture.sermons.v3.document)
  lineEndingCandidate.body[0].text = 'Cafe\u0301\r\nFirst line\rSecond line\tkept'
  assert.equal(
    normalizeSermonDocument(lineEndingCandidate).body?.[0].text,
    'Café\nFirst line\nSecond line\tkept',
  )
})

test('sermon body and source bounds fail closed without persisting unsafe text', () => {
  const candidate = (body: Array<Record<string, any>>) => ({
    ...clone(fixture.sermons.v3.document),
    body,
  })
  const baseEntry = clone(fixture.sermons.v3.document.body[0])

  expectDocumentCode('BODY_ENTRY_TOO_LARGE', () => normalizeSermonDocument(candidate([{
    ...baseEntry,
    text: 'x'.repeat(MAX_SERMON_BODY_ENTRY_BYTES + 1),
  }])))
  expectDocumentCode('BODY_TOO_LARGE', () => normalizeSermonDocument(candidate([{
    ...baseEntry,
    id: 'large-body-one',
    text: 'x'.repeat(Math.floor(MAX_SERMON_BODY_BYTES / 2) + 1),
  }, {
    ...baseEntry,
    id: 'large-body-two',
    text: 'y'.repeat(Math.floor(MAX_SERMON_BODY_BYTES / 2) + 1),
  }])))
  expectDocumentCode('BODY_TOO_LARGE', () => normalizeSermonDocument(candidate(
    Array.from({ length: MAX_SERMON_BODY_ENTRIES + 1 }, (_, index) => ({
      ...baseEntry,
      id: `body-${index}`,
      text: `Reviewed ${index}`,
    })),
  )))
  expectDocumentCode('INVALID_BODY_ENTRY', () => normalizeSermonDocument(candidate([{
    ...baseEntry,
    reviewStatus: 'confirmed',
  }])))
  expectDocumentCode('UNSAFE_BODY_TEXT', () => normalizeSermonDocument(candidate([{
    ...baseEntry,
    text: 'Unsafe\u0000text',
  }])))
  expectDocumentCode('SERMON_SOURCE_TOO_LARGE', () =>
    parseSermonDocument('x'.repeat(MAX_SERMON_SOURCE_BYTES + 1)))
})

test('private sermon envelopes verify identity, revision, bytes, and unavailable source metadata', () => {
  const golden = fixture.sermons.v3
  const normalized = normalizeRemoteSermonEnvelope(envelopeFor(golden))

  assert.equal(normalized.syncId, 'sermon-golden-v3')
  assert.equal(normalized.documentSource, golden.canonicalSource)
  assert.equal(normalized.revision, golden.revision)
  assert.deepEqual(normalized.sourceObjects.map(source => source.sourceId), [
    'pastor-manuscript',
    'sermon-slides',
  ])
  assert.equal(normalized.sourceObjects.every(source => source.available === false), true)
  assert.equal(Object.isFrozen(normalized), true)
  assert.equal(Object.isFrozen(normalized.sourceObjects[0]), true)
})

test('private sermon envelopes reject noncanonical bytes and mismatched identity or metadata', () => {
  const golden = fixture.sermons.v3
  const prettySource = `${JSON.stringify(golden.document, null, 2)}\n`
  const noTrailingNewline = golden.canonicalSource.slice(0, -1)

  expectWireCode('INVALID_RESPONSE', () => normalizeRemoteSermonEnvelope(envelopeFor(golden, {
    documentSource: prettySource,
    revision: sermonDocumentSha256(JSON.parse(prettySource)),
  })))
  expectWireCode('INVALID_RESPONSE', () => normalizeRemoteSermonEnvelope(envelopeFor(golden, {
    documentSource: noTrailingNewline,
    revision: golden.revision,
  })))
  expectWireCode('INVALID_RESPONSE', () => normalizeRemoteSermonEnvelope(envelopeFor(golden, {
    syncId: 'different-sermon',
  })))
  expectWireCode('INVALID_RESPONSE', () => normalizeRemoteSermonEnvelope(envelopeFor(golden, {
    revision: 'd'.repeat(64),
  })))
  expectWireCode('INVALID_RESPONSE', () => normalizeRemoteSermonEnvelope(envelopeFor(golden, {
    archived: true,
  })))

  const missingSource = envelopeFor(golden)
  missingSource.sourceObjects.pop()
  expectWireCode('INVALID_RESPONSE', () => normalizeRemoteSermonEnvelope(missingSource))

  const conflictingSource = envelopeFor(golden)
  conflictingSource.sourceObjects[0].sizeBytes += 1
  expectWireCode('INVALID_RESPONSE', () => normalizeRemoteSermonEnvelope(conflictingSource))
})

test('create/update wire bodies derive one exact revision and reject noncanonical input', () => {
  for (const golden of [fixture.sermons.v1, fixture.sermons.v2, fixture.sermons.v3]) {
    for (const builder of [buildSermonCreateBody, buildSermonUpdateBody]) {
      assert.deepEqual(builder({
        syncId: golden.document.id,
        documentSource: golden.canonicalSource,
      }), {
        syncId: golden.document.id,
        revision: golden.revision,
        documentSource: golden.canonicalSource,
      })
    }
  }

  expectWireCode('INVALID_INPUT', () => buildSermonCreateBody({
    syncId: 'different-sermon',
    documentSource: fixture.sermons.v3.canonicalSource,
  }))
  expectWireCode('INVALID_INPUT', () => buildSermonUpdateBody({
    syncId: fixture.sermons.v3.document.id,
    documentSource: JSON.stringify(fixture.sermons.v3.document),
  }))
  expectWireCode('INVALID_INPUT', () => buildSermonCreateBody({
    syncId: fixture.sermons.v3.document.id,
    documentSource: fixture.sermons.v3.canonicalSource,
    sourceBytes: 'not part of the private sermon metadata protocol',
  }))
})

test('change summaries/pages are strict, durable, bounded, and immutable', () => {
  const summary = {
    syncId: 'sermon-golden-v3',
    syncVersion: 3,
    revision: fixture.sermons.v3.revision,
    archived: false,
    updatedAt: '2026-07-26T18:30:00-07:00',
  }
  assert.deepEqual(normalizeSermonChangeSummary(summary), {
    ...summary,
    updatedAt: '2026-07-27T01:30:00.000Z',
  })

  const page = normalizeSermonChangePage({
    schemaVersion: COMMUNITY_SERMON_WIRE_SCHEMA_VERSION,
    items: [summary],
    nextCursor: 'durable-cursor-2',
    hasMore: true,
  })
  assert.equal(page.nextCursor, 'durable-cursor-2')
  assert.equal(Object.isFrozen(page), true)

  assert.deepEqual(normalizeSermonChangePage({
    schemaVersion: 1,
    items: [],
    nextCursor: 'durable-final-cursor',
    hasMore: false,
  }), {
    schemaVersion: 1,
    items: [],
    nextCursor: 'durable-final-cursor',
    hasMore: false,
  })

  expectWireCode('INVALID_RESPONSE', () => normalizeSermonChangePage({
    schemaVersion: 1,
    items: [],
    nextCursor: null,
    hasMore: false,
  }))
  expectWireCode('INVALID_RESPONSE', () => normalizeSermonChangePage({
    schemaVersion: 1,
    items: [],
    nextCursor: 'cursor-without-items',
    hasMore: true,
  }))
  expectWireCode('INVALID_RESPONSE', () => normalizeSermonChangePage({
    schemaVersion: 1,
    items: Array.from({ length: MAX_SERMON_CHANGE_ITEMS + 1 }, (_, index) => ({
      ...summary,
      syncId: `sermon-${index}`,
    })),
    nextCursor: 'oversized-page',
    hasMore: false,
  }))
  expectWireCode('INVALID_RESPONSE', () => normalizeSermonChangePage({
    schemaVersion: 1,
    items: [summary],
    nextCursor: 'x'.repeat(MAX_SERMON_CURSOR_BYTES + 1),
    hasMore: false,
  }))
})

test('source-object and document wire limits reject oversized private responses', () => {
  const tooManySourceObjects = envelopeFor(fixture.sermons.v3)
  tooManySourceObjects.sourceObjects = Array.from(
    { length: MAX_SERMON_SOURCE_OBJECTS + 1 },
    (_, index) => ({
      sourceId: `source-${index}`,
      sha256: 'a'.repeat(64),
      sizeBytes: 1,
      available: false,
    }),
  )
  expectWireCode('INVALID_RESPONSE', () =>
    normalizeRemoteSermonEnvelope(tooManySourceObjects))

  expectWireCode('INVALID_INPUT', () => buildSermonCreateBody({
    syncId: 'sermon-too-large',
    documentSource: 'x'.repeat(MAX_SERMON_SOURCE_BYTES + 1),
  }))
})

test('CAS and idempotency helpers emit injection-safe exact headers', () => {
  assert.deepEqual(buildSermonIfMatchHeaders({
    syncId: 'sermon-golden-v3',
    expectedSyncVersion: 9,
  }), {
    'If-Match': '"sermon:sermon-golden-v3:9"',
  })
  assert.deepEqual(
    buildSermonIdempotencyHeaders('sermon-create.2026-07-26:retry-1'),
    { 'Idempotency-Key': 'sermon-create.2026-07-26:retry-1' },
  )

  expectWireCode('INVALID_INPUT', () => buildSermonIfMatchHeaders({
    syncId: 'sermon\r\nX-Evil: yes',
    expectedSyncVersion: 1,
  }))
  expectWireCode('INVALID_INPUT', () => buildSermonIfMatchHeaders({
    syncId: 'sermon-valid',
    expectedSyncVersion: 0,
  }))
  expectWireCode('INVALID_INPUT', () => buildSermonIdempotencyHeaders('short'))
  expectWireCode('INVALID_INPUT', () =>
    buildSermonIdempotencyHeaders('safe-key\r\nX-Evil: yes'))
})
