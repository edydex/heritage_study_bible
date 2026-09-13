import { bibleBooks } from '../data/bible-books.js'

export const BIBLE_RANGE_SCHEMA_VERSION = 1

const MAX_VERSE_NUMBER = 999

export class CanonicalBibleRangeError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'CanonicalBibleRangeError'
    this.code = code
    this.details = details
  }
}

function fail(code, message, details = {}) {
  throw new CanonicalBibleRangeError(code, message, details)
}

if (bibleBooks.length !== 66) {
  fail('INVALID_BOOK_CANON', 'Canonical Bible ranges require exactly 66 books.')
}

export const CANONICAL_BIBLE_BOOKS = Object.freeze(bibleBooks.map((book, index) => Object.freeze({
  id: book.abbr,
  name: book.name,
  chapters: book.chapters,
  testament: book.testament,
  order: index + 1,
})))

const BOOK_BY_ID = new Map(CANONICAL_BIBLE_BOOKS.map(book => [book.id, book]))
const BOOK_ID_BY_NORMALIZED_NAME = new Map()

for (const book of CANONICAL_BIBLE_BOOKS) {
  for (const alias of [book.id, book.name]) {
    BOOK_ID_BY_NORMALIZED_NAME.set(
      alias.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, ''),
      book.id,
    )
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function resolveCanonicalBookId(value) {
  if (typeof value !== 'string') return null
  const compact = value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '')
  return BOOK_ID_BY_NORMALIZED_NAME.get(compact) || null
}

function normalizeInteger(value, field, minimum, maximum) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(
      'INVALID_RANGE_NUMBER',
      `${field} must be an integer from ${minimum} through ${maximum}.`,
      { field, minimum, maximum, value },
    )
  }
  return value
}

function normalizeEndpoint(raw, field, book) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail(
      'INVALID_RANGE_ENDPOINT',
      `${field} must contain a chapter and optional verse.`,
      { field },
    )
  }
  const chapter = normalizeInteger(raw.chapter, `${field}.chapter`, 1, book.chapters)
  const verse = raw.verse === undefined || raw.verse === null
    ? null
    : normalizeInteger(raw.verse, `${field}.verse`, 1, MAX_VERSE_NUMBER)
  return { chapter, verse }
}

function endpointPosition(endpoint, edge) {
  const verse = endpoint.verse === null
    ? (edge === 'start' ? 0 : MAX_VERSE_NUMBER + 1)
    : endpoint.verse
  return (endpoint.chapter * (MAX_VERSE_NUMBER + 2)) + verse
}

export function normalizeCanonicalBibleRange(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('INVALID_BIBLE_RANGE', 'Bible range must be an object.')
  }
  const schemaVersion = raw.schemaVersion === undefined
    ? BIBLE_RANGE_SCHEMA_VERSION
    : raw.schemaVersion
  if (schemaVersion !== BIBLE_RANGE_SCHEMA_VERSION) {
    fail(
      'UNSUPPORTED_BIBLE_RANGE_SCHEMA',
      `Bible range schema version ${schemaVersion} is not supported.`,
      { actual: schemaVersion, supported: BIBLE_RANGE_SCHEMA_VERSION },
    )
  }

  const bookId = resolveCanonicalBookId(raw.bookId || raw.book)
  const book = bookId ? BOOK_BY_ID.get(bookId) : null
  if (!book) {
    fail('UNKNOWN_BIBLE_BOOK', 'Bible range must use a canonical 66-book id.', {
      bookId: raw.bookId || raw.book || null,
    })
  }

  let startSource = raw.start
  let endSource = raw.end
  if (!startSource && raw.chapter !== undefined) {
    startSource = { chapter: raw.chapter, verse: raw.verse ?? null }
    endSource = {
      chapter: raw.endChapter ?? raw.chapter,
      verse: raw.endVerse ?? raw.verse ?? null,
    }
  }
  const start = normalizeEndpoint(startSource, 'Bible range start', book)
  const end = normalizeEndpoint(endSource || startSource, 'Bible range end', book)
  if (endpointPosition(start, 'start') > endpointPosition(end, 'end')) {
    fail('REVERSED_BIBLE_RANGE', 'Bible range end must not precede its start.', {
      start,
      end,
    })
  }

  return {
    schemaVersion: BIBLE_RANGE_SCHEMA_VERSION,
    bookId,
    start,
    end,
  }
}

export function serializeCanonicalBibleRange(raw) {
  return `${canonicalJson(normalizeCanonicalBibleRange(raw))}\n`
}

export function canonicalBibleRangesIntersect(leftRaw, rightRaw) {
  const left = normalizeCanonicalBibleRange(leftRaw)
  const right = normalizeCanonicalBibleRange(rightRaw)
  if (left.bookId !== right.bookId) return false
  return endpointPosition(left.start, 'start') <= endpointPosition(right.end, 'end')
    && endpointPosition(right.start, 'start') <= endpointPosition(left.end, 'end')
}

export function compareCanonicalBibleRanges(leftRaw, rightRaw) {
  const left = normalizeCanonicalBibleRange(leftRaw)
  const right = normalizeCanonicalBibleRange(rightRaw)
  const leftBook = BOOK_BY_ID.get(left.bookId)
  const rightBook = BOOK_BY_ID.get(right.bookId)
  return leftBook.order - rightBook.order
    || endpointPosition(left.start, 'start') - endpointPosition(right.start, 'start')
    || endpointPosition(left.end, 'end') - endpointPosition(right.end, 'end')
}
