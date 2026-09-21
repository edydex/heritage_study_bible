import { BSB_VERSE_MAXIMUMS_BY_BOOK_NAME } from './BsbVersification'

export const BIBLE_RANGE_SCHEMA_VERSION = 1

export type BibleRangeEndpoint = Readonly<{
  chapter: number
  verse: number | null
}>

export type CanonicalBibleRange = Readonly<{
  schemaVersion: typeof BIBLE_RANGE_SCHEMA_VERSION
  bookId: string
  start: BibleRangeEndpoint
  end: BibleRangeEndpoint
}>

export type CanonicalBibleBook = Readonly<{
  id: string
  name: string
  chapters: number
  testament: 'OT' | 'NT'
  order: number
}>

type BibleBookSource = Omit<CanonicalBibleBook, 'id' | 'order'>

// This is the same fixed 66-book canon and chapter metadata used by SyncShow.
// Keeping it beside the server validator prevents reader display-name changes
// from silently changing persisted sermon reference identities.
const BIBLE_BOOKS: readonly BibleBookSource[] = [
  { name: 'Genesis', chapters: 50, testament: 'OT' },
  { name: 'Exodus', chapters: 40, testament: 'OT' },
  { name: 'Leviticus', chapters: 27, testament: 'OT' },
  { name: 'Numbers', chapters: 36, testament: 'OT' },
  { name: 'Deuteronomy', chapters: 34, testament: 'OT' },
  { name: 'Joshua', chapters: 24, testament: 'OT' },
  { name: 'Judges', chapters: 21, testament: 'OT' },
  { name: 'Ruth', chapters: 4, testament: 'OT' },
  { name: '1 Samuel', chapters: 31, testament: 'OT' },
  { name: '2 Samuel', chapters: 24, testament: 'OT' },
  { name: '1 Kings', chapters: 22, testament: 'OT' },
  { name: '2 Kings', chapters: 25, testament: 'OT' },
  { name: '1 Chronicles', chapters: 29, testament: 'OT' },
  { name: '2 Chronicles', chapters: 36, testament: 'OT' },
  { name: 'Ezra', chapters: 10, testament: 'OT' },
  { name: 'Nehemiah', chapters: 13, testament: 'OT' },
  { name: 'Esther', chapters: 10, testament: 'OT' },
  { name: 'Job', chapters: 42, testament: 'OT' },
  { name: 'Psalms', chapters: 150, testament: 'OT' },
  { name: 'Proverbs', chapters: 31, testament: 'OT' },
  { name: 'Ecclesiastes', chapters: 12, testament: 'OT' },
  { name: 'Song of Solomon', chapters: 8, testament: 'OT' },
  { name: 'Isaiah', chapters: 66, testament: 'OT' },
  { name: 'Jeremiah', chapters: 52, testament: 'OT' },
  { name: 'Lamentations', chapters: 5, testament: 'OT' },
  { name: 'Ezekiel', chapters: 48, testament: 'OT' },
  { name: 'Daniel', chapters: 12, testament: 'OT' },
  { name: 'Hosea', chapters: 14, testament: 'OT' },
  { name: 'Joel', chapters: 3, testament: 'OT' },
  { name: 'Amos', chapters: 9, testament: 'OT' },
  { name: 'Obadiah', chapters: 1, testament: 'OT' },
  { name: 'Jonah', chapters: 4, testament: 'OT' },
  { name: 'Micah', chapters: 7, testament: 'OT' },
  { name: 'Nahum', chapters: 3, testament: 'OT' },
  { name: 'Habakkuk', chapters: 3, testament: 'OT' },
  { name: 'Zephaniah', chapters: 3, testament: 'OT' },
  { name: 'Haggai', chapters: 2, testament: 'OT' },
  { name: 'Zechariah', chapters: 14, testament: 'OT' },
  { name: 'Malachi', chapters: 4, testament: 'OT' },
  { name: 'Matthew', chapters: 28, testament: 'NT' },
  { name: 'Mark', chapters: 16, testament: 'NT' },
  { name: 'Luke', chapters: 24, testament: 'NT' },
  { name: 'John', chapters: 21, testament: 'NT' },
  { name: 'Acts', chapters: 28, testament: 'NT' },
  { name: 'Romans', chapters: 16, testament: 'NT' },
  { name: '1 Corinthians', chapters: 16, testament: 'NT' },
  { name: '2 Corinthians', chapters: 13, testament: 'NT' },
  { name: 'Galatians', chapters: 6, testament: 'NT' },
  { name: 'Ephesians', chapters: 6, testament: 'NT' },
  { name: 'Philippians', chapters: 4, testament: 'NT' },
  { name: 'Colossians', chapters: 4, testament: 'NT' },
  { name: '1 Thessalonians', chapters: 5, testament: 'NT' },
  { name: '2 Thessalonians', chapters: 3, testament: 'NT' },
  { name: '1 Timothy', chapters: 6, testament: 'NT' },
  { name: '2 Timothy', chapters: 4, testament: 'NT' },
  { name: 'Titus', chapters: 3, testament: 'NT' },
  { name: 'Philemon', chapters: 1, testament: 'NT' },
  { name: 'Hebrews', chapters: 13, testament: 'NT' },
  { name: 'James', chapters: 5, testament: 'NT' },
  { name: '1 Peter', chapters: 5, testament: 'NT' },
  { name: '2 Peter', chapters: 3, testament: 'NT' },
  { name: '1 John', chapters: 5, testament: 'NT' },
  { name: '2 John', chapters: 1, testament: 'NT' },
  { name: '3 John', chapters: 1, testament: 'NT' },
  { name: 'Jude', chapters: 1, testament: 'NT' },
  { name: 'Revelation', chapters: 22, testament: 'NT' },
]

const BOOK_IDS_BY_NAME: Readonly<Record<string, string>> = Object.freeze({
  Genesis: 'Gen',
  Exodus: 'Exod',
  Leviticus: 'Lev',
  Numbers: 'Num',
  Deuteronomy: 'Deut',
  Joshua: 'Josh',
  Judges: 'Judg',
  Ruth: 'Ruth',
  '1 Samuel': '1Sam',
  '2 Samuel': '2Sam',
  '1 Kings': '1Kgs',
  '2 Kings': '2Kgs',
  '1 Chronicles': '1Chr',
  '2 Chronicles': '2Chr',
  Ezra: 'Ezra',
  Nehemiah: 'Neh',
  Esther: 'Esth',
  Job: 'Job',
  Psalms: 'Ps',
  Proverbs: 'Prov',
  Ecclesiastes: 'Eccl',
  'Song of Solomon': 'Song',
  Isaiah: 'Isa',
  Jeremiah: 'Jer',
  Lamentations: 'Lam',
  Ezekiel: 'Ezek',
  Daniel: 'Dan',
  Hosea: 'Hos',
  Joel: 'Joel',
  Amos: 'Amos',
  Obadiah: 'Obad',
  Jonah: 'Jonah',
  Micah: 'Mic',
  Nahum: 'Nah',
  Habakkuk: 'Hab',
  Zephaniah: 'Zeph',
  Haggai: 'Hag',
  Zechariah: 'Zech',
  Malachi: 'Mal',
  Matthew: 'Matt',
  Mark: 'Mark',
  Luke: 'Luke',
  John: 'John',
  Acts: 'Acts',
  Romans: 'Rom',
  '1 Corinthians': '1Cor',
  '2 Corinthians': '2Cor',
  Galatians: 'Gal',
  Ephesians: 'Eph',
  Philippians: 'Phil',
  Colossians: 'Col',
  '1 Thessalonians': '1Thess',
  '2 Thessalonians': '2Thess',
  '1 Timothy': '1Tim',
  '2 Timothy': '2Tim',
  Titus: 'Titus',
  Philemon: 'Phlm',
  Hebrews: 'Heb',
  James: 'Jas',
  '1 Peter': '1Pet',
  '2 Peter': '2Pet',
  '1 John': '1John',
  '2 John': '2John',
  '3 John': '3John',
  Jude: 'Jude',
  Revelation: 'Rev',
})

export class BibleRangeError extends Error {
  code: string
  details: Record<string, unknown>

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'BibleRangeError'
    this.code = code
    this.details = details
  }
}

function fail(
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): never {
  throw new BibleRangeError(code, message, details)
}

if (
  BIBLE_BOOKS.length !== 66
  || Object.keys(BOOK_IDS_BY_NAME).length !== 66
  || Object.keys(BSB_VERSE_MAXIMUMS_BY_BOOK_NAME).length !== 66
) {
  fail('INVALID_BOOK_CANON', 'The Bible range canon must contain exactly 66 books.')
}

export const CANONICAL_BIBLE_BOOKS: readonly CanonicalBibleBook[] = Object.freeze(
  BIBLE_BOOKS.map((book, index) => {
    const id = BOOK_IDS_BY_NAME[book.name]
    if (!id) fail('INVALID_BOOK_CANON', `The Bible range canon has no id for ${book.name}.`)
    return Object.freeze({
      id,
      name: book.name,
      chapters: book.chapters,
      testament: book.testament,
      order: index + 1,
    })
  }),
)

const BOOK_BY_ID = new Map(CANONICAL_BIBLE_BOOKS.map(book => [book.id, book]))
const BOOK_ID_BY_NORMALIZED_NAME = new Map<string, string>()
const VERSE_MAXIMUMS_BY_BOOK_ID = new Map<string, readonly number[]>()
let greatestCanonicalVerse = 0

for (const book of CANONICAL_BIBLE_BOOKS) {
  const verseMaximums = BSB_VERSE_MAXIMUMS_BY_BOOK_NAME[book.name]
  if (
    !verseMaximums
    || verseMaximums.length !== book.chapters
    || verseMaximums.some(maximum => !Number.isSafeInteger(maximum) || maximum < 1)
  ) {
    fail(
      'INVALID_VERSE_CANON',
      `The bundled BSB versification is incomplete for ${book.name}.`,
      { bookId: book.id, chapters: book.chapters },
    )
  }
  VERSE_MAXIMUMS_BY_BOOK_ID.set(book.id, verseMaximums)
  greatestCanonicalVerse = verseMaximums.reduce(
    (greatest, maximum) => Math.max(greatest, maximum),
    greatestCanonicalVerse,
  )

  for (const alias of [book.id, book.name]) {
    BOOK_ID_BY_NORMALIZED_NAME.set(
      alias.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, ''),
      book.id,
    )
  }
}

const WHOLE_CHAPTER_END_VERSE_POSITION = greatestCanonicalVerse + 1
const CHAPTER_POSITION_STRIDE = greatestCanonicalVerse + 2

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const pairs = Object.keys(record)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    return `{${pairs.join(',')}}`
  }
  return JSON.stringify(value)
}

export function resolveBookId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const compact = value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '')
  return BOOK_ID_BY_NORMALIZED_NAME.get(compact) || null
}

export function canonicalBibleChapterVerseMaximum(
  bookValue: unknown,
  chapterValue: unknown,
): number | null {
  const bookId = resolveBookId(bookValue)
  if (!bookId || !Number.isSafeInteger(chapterValue)) return null
  const verseMaximums = VERSE_MAXIMUMS_BY_BOOK_ID.get(bookId)
  const chapter = chapterValue as number
  if (!verseMaximums || chapter < 1 || chapter > verseMaximums.length) return null
  return verseMaximums[chapter - 1] ?? null
}

function normalizeInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    fail(
      'INVALID_RANGE_NUMBER',
      `${field} must be an integer from ${minimum} through ${maximum}.`,
      { field, minimum, maximum, value },
    )
  }
  return value as number
}

function normalizeEndpoint(
  raw: unknown,
  field: string,
  book: CanonicalBibleBook,
): BibleRangeEndpoint {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('INVALID_RANGE_ENDPOINT', `${field} must contain a chapter and optional verse.`, { field })
  }
  const record = raw as Record<string, unknown>
  const chapter = normalizeInteger(record.chapter, `${field}.chapter`, 1, book.chapters)
  const verseMaximum = canonicalBibleChapterVerseMaximum(book.id, chapter)
  if (verseMaximum === null) {
    fail('INVALID_VERSE_CANON', `No canonical verse bounds exist for ${book.name} ${chapter}.`, {
      bookId: book.id,
      chapter,
    })
  }
  const verse = record.verse === undefined || record.verse === null
    ? null
    : normalizeInteger(record.verse, `${field}.verse`, 1, verseMaximum)
  return { chapter, verse }
}

function endpointPosition(endpoint: BibleRangeEndpoint, edge: 'start' | 'end'): number {
  const verse = endpoint.verse === null
    ? (edge === 'start' ? 0 : WHOLE_CHAPTER_END_VERSE_POSITION)
    : endpoint.verse
  return (endpoint.chapter * CHAPTER_POSITION_STRIDE) + verse
}

export function normalizeBibleRange(raw: unknown): CanonicalBibleRange {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('INVALID_BIBLE_RANGE', 'Bible range must be an object.')
  }
  const record = raw as Record<string, unknown>
  const schemaVersion = record.schemaVersion === undefined
    ? BIBLE_RANGE_SCHEMA_VERSION
    : record.schemaVersion
  if (schemaVersion !== BIBLE_RANGE_SCHEMA_VERSION) {
    fail(
      'UNSUPPORTED_BIBLE_RANGE_SCHEMA',
      `Bible range schema version ${schemaVersion} is not supported.`,
      { actual: schemaVersion, supported: BIBLE_RANGE_SCHEMA_VERSION },
    )
  }

  const bookId = resolveBookId(record.bookId || record.book)
  const book = bookId ? BOOK_BY_ID.get(bookId) : null
  if (!book) {
    fail('UNKNOWN_BIBLE_BOOK', 'Bible range must use a canonical 66-book id.', {
      bookId: record.bookId || record.book || null,
    })
  }

  let startSource = record.start
  let endSource = record.end
  if (!startSource && record.chapter !== undefined) {
    startSource = { chapter: record.chapter, verse: record.verse ?? null }
    endSource = {
      chapter: record.endChapter ?? record.chapter,
      verse: record.endVerse ?? record.verse ?? null,
    }
  }
  const start = normalizeEndpoint(startSource, 'Bible range start', book)
  const end = normalizeEndpoint(endSource || startSource, 'Bible range end', book)
  if (endpointPosition(start, 'start') > endpointPosition(end, 'end')) {
    fail('REVERSED_BIBLE_RANGE', 'Bible range end must not precede its start.', { start, end })
  }

  return {
    schemaVersion: BIBLE_RANGE_SCHEMA_VERSION,
    bookId: book.id,
    start,
    end,
  }
}

export function serializeBibleRange(raw: unknown): string {
  return `${canonicalJson(normalizeBibleRange(raw))}\n`
}

export function formatBibleRange(raw: unknown): string {
  const range = normalizeBibleRange(raw)
  const book = BOOK_BY_ID.get(range.bookId)!
  const startVerse = range.start.verse === null ? '' : `:${range.start.verse}`
  if (range.start.chapter === range.end.chapter) {
    if (range.start.verse === range.end.verse) {
      return `${book.name} ${range.start.chapter}${startVerse}`
    }
    const displayStart = range.start.verse === null ? ':1' : startVerse
    const displayEnd = range.end.verse === null ? 'end' : range.end.verse
    return `${book.name} ${range.start.chapter}${displayStart}-${displayEnd}`
  }
  const endVerse = range.end.verse === null ? '' : `:${range.end.verse}`
  return `${book.name} ${range.start.chapter}${startVerse}-${range.end.chapter}${endVerse}`
}

export function bibleRangesIntersect(leftRaw: unknown, rightRaw: unknown): boolean {
  const left = normalizeBibleRange(leftRaw)
  const right = normalizeBibleRange(rightRaw)
  if (left.bookId !== right.bookId) return false
  return endpointPosition(left.start, 'start') <= endpointPosition(right.end, 'end')
    && endpointPosition(right.start, 'start') <= endpointPosition(left.end, 'end')
}

export function bibleRangeContains(containerRaw: unknown, candidateRaw: unknown): boolean {
  const container = normalizeBibleRange(containerRaw)
  const candidate = normalizeBibleRange(candidateRaw)
  if (container.bookId !== candidate.bookId) return false
  return endpointPosition(container.start, 'start')
      <= endpointPosition(candidate.start, 'start')
    && endpointPosition(candidate.end, 'end')
      <= endpointPosition(container.end, 'end')
}

export function compareBibleRanges(leftRaw: unknown, rightRaw: unknown): number {
  const left = normalizeBibleRange(leftRaw)
  const right = normalizeBibleRange(rightRaw)
  const leftBook = BOOK_BY_ID.get(left.bookId)!
  const rightBook = BOOK_BY_ID.get(right.bookId)!
  return leftBook.order - rightBook.order
    || endpointPosition(left.start, 'start') - endpointPosition(right.start, 'start')
    || endpointPosition(left.end, 'end') - endpointPosition(right.end, 'end')
}
