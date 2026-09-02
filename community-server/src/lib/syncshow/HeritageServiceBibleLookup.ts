import {
  CANONICAL_BIBLE_BOOKS,
  formatBibleRange,
  normalizeBibleRange,
  type CanonicalBibleRange,
} from './BibleRange'

const MAX_TRANSLATION_BOOK_BYTES = 4 * 1024 * 1024
const TRANSLATIONS = Object.freeze({
  english: {
    id: 'BSB',
    attribution: 'Berean Standard Bible (BSB); exact text pinned from Heritage Study Bible reader data.',
  },
  russian: {
    id: 'SYNO-W',
    attribution: 'Russian Synodal Bible (SYNO-W); exact text pinned from Heritage Study Bible reader data.',
  },
})

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type TranslationBook = {
  name: string
  chapters: Array<{
    number: number
    verses: Array<{ number: number; text: string }>
  }>
}

export class HeritageServiceBibleLookupError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = 'HeritageServiceBibleLookupError'
    this.code = code
    this.status = status
  }
}

function heritageReaderBaseUrl(value: string | undefined) {
  let url: URL
  try {
    url = new URL(value || 'https://heritage.faith')
  } catch {
    throw new HeritageServiceBibleLookupError(
      'BIBLE_LOOKUP_UNAVAILABLE',
      'Heritage reader data is not configured correctly.',
      503,
    )
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new HeritageServiceBibleLookupError(
      'BIBLE_LOOKUP_UNAVAILABLE',
      'Heritage reader data is not configured correctly.',
      503,
    )
  }
  url.search = ''
  url.hash = ''
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`
  return url
}

function bookFileName(name: string) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}.json`
}

async function fetchTranslationBook(
  fetchImpl: FetchLike,
  baseUrl: URL,
  translationId: string,
  fileName: string,
) {
  const url = new URL(`data/translations/${translationId}/${fileName}`, baseUrl)
  let response: Response
  try {
    response = await fetchImpl(url, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    throw new HeritageServiceBibleLookupError(
      'BIBLE_LOOKUP_UNAVAILABLE',
      `The ${translationId} reader text is temporarily unavailable.`,
      503,
    )
  }
  if (!response.ok) {
    throw new HeritageServiceBibleLookupError(
      'BIBLE_LOOKUP_UNAVAILABLE',
      `The ${translationId} reader text is temporarily unavailable.`,
      503,
    )
  }
  const source = await response.text()
  if (source.length < 2 || Buffer.byteLength(source, 'utf8') > MAX_TRANSLATION_BOOK_BYTES) {
    throw new HeritageServiceBibleLookupError(
      'INVALID_BIBLE_SOURCE',
      `The ${translationId} reader text is invalid.`,
      502,
    )
  }
  try {
    const value = JSON.parse(source) as TranslationBook
    if (!value || typeof value.name !== 'string' || !Array.isArray(value.chapters)) throw new Error('invalid')
    return { value, sourceUrl: url.toString() }
  } catch {
    throw new HeritageServiceBibleLookupError(
      'INVALID_BIBLE_SOURCE',
      `The ${translationId} reader text is invalid.`,
      502,
    )
  }
}

function exactVerses(book: TranslationBook, range: CanonicalBibleRange, translationId: string) {
  const chapter = book.chapters.find(candidate => Number(candidate?.number) === range.start.chapter)
  if (!chapter || !Array.isArray(chapter.verses)) {
    throw new HeritageServiceBibleLookupError(
      'INVALID_BIBLE_SOURCE',
      `The ${translationId} reader text does not contain that chapter.`,
      502,
    )
  }
  const byNumber = new Map(chapter.verses.map(verse => [Number(verse?.number), verse]))
  const verses = []
  for (let number = range.start.verse as number; number <= (range.end.verse as number); number += 1) {
    const verse = byNumber.get(number)
    const text = typeof verse?.text === 'string' ? verse.text.trim() : ''
    if (!text) {
      throw new HeritageServiceBibleLookupError(
        'INVALID_BIBLE_SOURCE',
        `The ${translationId} reader text is missing verse ${number}.`,
        502,
      )
    }
    verses.push({ number, text })
  }
  return verses
}

export async function loadHeritageServiceBiblePassage(
  rawRange: unknown,
  {
    fetchImpl = globalThis.fetch,
    heritageAppUrl = process.env.HERITAGE_APP_URL,
  }: { fetchImpl?: FetchLike; heritageAppUrl?: string } = {},
) {
  let range: CanonicalBibleRange
  try {
    range = normalizeBibleRange(rawRange)
  } catch {
    throw new HeritageServiceBibleLookupError(
      'INVALID_BIBLE_RANGE',
      'Choose one valid Bible passage with exact starting and ending verses.',
    )
  }
  if (
    range.start.verse === null
    || range.end.verse === null
    || range.start.chapter !== range.end.chapter
  ) {
    throw new HeritageServiceBibleLookupError(
      'INVALID_BIBLE_RANGE',
      'A service reading currently needs exact verses within one chapter.',
    )
  }
  const book = CANONICAL_BIBLE_BOOKS.find(candidate => candidate.id === range.bookId)
  if (!book) {
    throw new HeritageServiceBibleLookupError('INVALID_BIBLE_RANGE', 'Choose a canonical Bible book.')
  }
  const fileName = bookFileName(book.name)
  const baseUrl = heritageReaderBaseUrl(heritageAppUrl)
  const [english, russian] = await Promise.all([
    fetchTranslationBook(fetchImpl, baseUrl, TRANSLATIONS.english.id, fileName),
    fetchTranslationBook(fetchImpl, baseUrl, TRANSLATIONS.russian.id, fileName),
  ])
  for (const candidate of [english.value, russian.value]) {
    if (candidate.name !== book.name) {
      throw new HeritageServiceBibleLookupError(
        'INVALID_BIBLE_SOURCE',
        'Heritage reader data returned the wrong Bible book.',
        502,
      )
    }
  }
  const reference = formatBibleRange(range)
  const englishPassage = {
    reference,
    translationId: TRANSLATIONS.english.id,
    attribution: TRANSLATIONS.english.attribution,
    verses: exactVerses(english.value, range, TRANSLATIONS.english.id),
  }
  const russianPassage = {
    reference,
    translationId: TRANSLATIONS.russian.id,
    attribution: TRANSLATIONS.russian.attribution,
    verses: exactVerses(russian.value, range, TRANSLATIONS.russian.id),
  }
  return Object.freeze({
    schemaVersion: 1,
    range,
    title: reference,
    passagesByChannel: Object.freeze({
      english: englishPassage,
      russian: russianPassage,
      media: russianPassage,
    }),
    sources: Object.freeze({
      english: english.sourceUrl,
      russian: russian.sourceUrl,
    }),
  })
}
