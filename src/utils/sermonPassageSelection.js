import {
  CANONICAL_BIBLE_BOOKS,
  normalizeCanonicalBibleRange,
  resolveCanonicalBookId,
} from './canonicalBibleRanges.js'

function versePosition(verse) {
  return (verse.chapter * 1000) + verse.verse
}

export function selectedVersesToCanonicalRange({
  selectedVerse = null,
  selectedVerses = [],
  fallbackBookName = '',
} = {}) {
  const candidates = Array.isArray(selectedVerses) && selectedVerses.length > 0
    ? selectedVerses
    : (selectedVerse ? [selectedVerse] : [])
  if (candidates.length === 0) {
    return { range: null, reason: 'no-selection', verseCount: 0 }
  }

  const normalized = []
  for (const candidate of candidates) {
    const bookId = resolveCanonicalBookId(candidate?.book || fallbackBookName)
    if (
      !bookId
      || !Number.isSafeInteger(candidate?.chapter)
      || candidate.chapter < 1
      || !Number.isSafeInteger(candidate?.verse)
      || candidate.verse < 1
    ) {
      return { range: null, reason: 'invalid-selection', verseCount: candidates.length }
    }
    normalized.push({
      bookId,
      chapter: candidate.chapter,
      verse: candidate.verse,
    })
  }

  const bookIds = new Set(normalized.map(candidate => candidate.bookId))
  if (bookIds.size !== 1) {
    return { range: null, reason: 'cross-book', verseCount: candidates.length }
  }

  normalized.sort((left, right) => versePosition(left) - versePosition(right))
  const first = normalized[0]
  const last = normalized[normalized.length - 1]
  try {
    const range = normalizeCanonicalBibleRange({
      schemaVersion: 1,
      bookId: first.bookId,
      start: { chapter: first.chapter, verse: first.verse },
      end: { chapter: last.chapter, verse: last.verse },
    })
    return {
      range,
      reason: null,
      verseCount: candidates.length,
      label: formatCanonicalBibleRange(range),
    }
  } catch {
    return { range: null, reason: 'invalid-selection', verseCount: candidates.length }
  }
}

export function canonicalBibleRangeKey(rawRange) {
  if (!rawRange) return ''
  const range = normalizeCanonicalBibleRange(rawRange)
  return [
    range.bookId,
    range.start.chapter,
    range.start.verse ?? '',
    range.end.chapter,
    range.end.verse ?? '',
  ].join(':')
}

export function formatCanonicalBibleRange(rawRange) {
  const range = normalizeCanonicalBibleRange(rawRange)
  const book = CANONICAL_BIBLE_BOOKS.find(candidate => candidate.id === range.bookId)
  const bookName = book?.name || range.bookId
  const startVerse = range.start.verse
  const endVerse = range.end.verse

  if (startVerse === null && endVerse === null) {
    return range.start.chapter === range.end.chapter
      ? `${bookName} ${range.start.chapter}`
      : `${bookName} ${range.start.chapter}–${range.end.chapter}`
  }
  if (range.start.chapter === range.end.chapter) {
    if (startVerse === endVerse) return `${bookName} ${range.start.chapter}:${startVerse}`
    return `${bookName} ${range.start.chapter}:${startVerse ?? 1}–${endVerse ?? ''}`
  }
  return `${bookName} ${range.start.chapter}:${startVerse ?? 1}–${range.end.chapter}:${endVerse ?? ''}`
}
