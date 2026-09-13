import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canonicalBibleRangeKey,
  formatCanonicalBibleRange,
  selectedVersesToCanonicalRange,
} from '../src/utils/sermonPassageSelection.js'

test('a single selected verse becomes one exact canonical passage query', () => {
  const selection = selectedVersesToCanonicalRange({
    selectedVerse: { book: 'Ephesians', chapter: 3, verse: 18 },
    fallbackBookName: 'Genesis',
  })

  assert.equal(selection.reason, null)
  assert.deepEqual(selection.range, {
    schemaVersion: 1,
    bookId: 'Eph',
    start: { chapter: 3, verse: 18 },
    end: { chapter: 3, verse: 18 },
  })
  assert.equal(selection.label, 'Ephesians 3:18')
  assert.equal(canonicalBibleRangeKey(selection.range), 'Eph:3:18:3:18')
})

test('same-book multi-selection queries the smallest canonical encompassing range', () => {
  const selection = selectedVersesToCanonicalRange({
    selectedVerses: [
      { book: 'Ephesians', chapter: 4, verse: 3 },
      { book: 'Ephesians', chapter: 3, verse: 21 },
      { book: 'Ephesians', chapter: 4, verse: 1 },
    ],
    fallbackBookName: 'Ephesians',
  })

  assert.deepEqual(selection.range, {
    schemaVersion: 1,
    bookId: 'Eph',
    start: { chapter: 3, verse: 21 },
    end: { chapter: 4, verse: 3 },
  })
  assert.equal(selection.label, 'Ephesians 3:21–4:3')
  assert.equal(selection.verseCount, 3)
})

test('cross-book selections fail closed instead of expanding across the canon', () => {
  const selection = selectedVersesToCanonicalRange({
    selectedVerses: [
      { book: 'Malachi', chapter: 4, verse: 6 },
      { book: 'Matthew', chapter: 1, verse: 1 },
    ],
    fallbackBookName: 'Matthew',
  })

  assert.equal(selection.range, null)
  assert.equal(selection.reason, 'cross-book')
})

test('missing book names use the current reader book but invalid verses do not query', () => {
  const fallback = selectedVersesToCanonicalRange({
    selectedVerses: [
      { chapter: 5, verse: 1 },
      { chapter: 5, verse: 2 },
    ],
    fallbackBookName: 'Ephesians',
  })
  assert.equal(formatCanonicalBibleRange(fallback.range), 'Ephesians 5:1–2')

  const invalid = selectedVersesToCanonicalRange({
    selectedVerse: { book: 'Ephesians', chapter: 7, verse: 1 },
  })
  assert.equal(invalid.range, null)
  assert.equal(invalid.reason, 'invalid-selection')
})
