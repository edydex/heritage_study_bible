import { describe, expect, it } from 'vitest'
import { bibleBooks } from '../data/bible-books'
import {
  getNumberedBookReferenceChoices,
  parseBibleReference,
  resolveBookAliasPrefix,
} from './parseBibleReference'

describe('resolveBookAliasPrefix', () => {
  it('matches common abbreviations', () => {
    expect(resolveBookAliasPrefix('ps 23')).toEqual({
      alias: 'ps',
      book: 'Psalms',
      rest: '23',
    })
  })

  it('matches numbered books with spaces', () => {
    expect(resolveBookAliasPrefix('1 cor 13:4')).toEqual({
      alias: '1 cor',
      book: '1 Corinthians',
      rest: '13:4',
    })
  })

  it('matches compact aliases for every numbered book', () => {
    const numberedBooks = bibleBooks.filter(book => /^\d\s/.test(book.name))

    for (const book of numberedBooks) {
      const chapter = Math.min(2, book.chapters)
      const compactName = book.name.replace(/\s+/g, '').toLowerCase()
      const compactAbbr = book.abbr.replace(/\s+/g, '').toLowerCase()

      expect(parseBibleReference(`${compactName}${chapter}`)).toEqual({
        book: book.name,
        chapter,
        verse: null,
      })
      expect(parseBibleReference(`${compactAbbr}${chapter}`)).toEqual({
        book: book.name,
        chapter,
        verse: null,
      })
    }
  })

  it('derives compact forms from spaced aliases', () => {
    expect(resolveBookAliasPrefix('1ch2')).toEqual({
      alias: '1ch',
      book: '1 Chronicles',
      rest: '2',
    })
  })

  it('rejects partial alias collisions', () => {
    expect(resolveBookAliasPrefix('johnny 3:16')).toBeNull()
  })
})

describe('getNumberedBookReferenceChoices', () => {
  it('offers numbered books when the family shortcut omits the leading number', () => {
    expect(getNumberedBookReferenceChoices('pet2')).toEqual([
      { book: '1 Peter', chapter: 2, verse: null },
      { book: '2 Peter', chapter: 2, verse: null },
    ])
  })

  it('accepts a full family name and verse', () => {
    expect(getNumberedBookReferenceChoices('Kings 7:14')).toEqual([
      { book: '1 Kings', chapter: 7, verse: 14 },
      { book: '2 Kings', chapter: 7, verse: 14 },
    ])
  })

  it('defaults a bare family name to chapter one', () => {
    expect(getNumberedBookReferenceChoices('tim')).toEqual([
      { book: '1 Timothy', chapter: 1, verse: null },
      { book: '2 Timothy', chapter: 1, verse: null },
    ])
  })

  it('returns only choices where the requested chapter exists', () => {
    expect(getNumberedBookReferenceChoices('thess4')).toEqual([
      { book: '1 Thessalonians', chapter: 4, verse: null },
    ])
  })

  it('does not reinterpret exact numbered or unnumbered books', () => {
    expect(getNumberedBookReferenceChoices('1pet2')).toEqual([])
    expect(getNumberedBookReferenceChoices('john2')).toEqual([])
  })

  it('resolves unique prefixes after an explicit ordinal', () => {
    expect(getNumberedBookReferenceChoices('2thes 2')).toEqual([
      { book: '2 Thessalonians', chapter: 2, verse: null },
    ])
    expect(getNumberedBookReferenceChoices('3 joh 1')).toEqual([
      { book: '3 John', chapter: 1, verse: null },
    ])
  })

  it('offers a choice instead of guessing when an explicit prefix is ambiguous', () => {
    expect(getNumberedBookReferenceChoices('1 c 2')).toEqual([
      { book: '1 Chronicles', chapter: 2, verse: null },
      { book: '1 Corinthians', chapter: 2, verse: null },
    ])
  })
})

describe('parseBibleReference', () => {
  it('parses book chapter and verse with colon separator', () => {
    expect(parseBibleReference('Psalm 23:1')).toEqual({
      book: 'Psalms',
      chapter: 23,
      verse: 1,
    })
  })

  it('parses book chapter without verse', () => {
    expect(parseBibleReference('Genesis 1')).toEqual({
      book: 'Genesis',
      chapter: 1,
      verse: null,
    })
  })

  it('parses abbreviations and space-separated verse numbers', () => {
    expect(parseBibleReference('Jn 3 16')).toEqual({
      book: 'John',
      chapter: 3,
      verse: 16,
    })
  })

  it('opens an explicit numbered book at chapter one when no chapter is given', () => {
    expect(parseBibleReference('1pet')).toEqual({
      book: '1 Peter',
      chapter: 1,
      verse: null,
    })
  })

  it('accepts any uniquely identifying numbered-book prefix', () => {
    expect(parseBibleReference('2thes 2')).toEqual({
      book: '2 Thessalonians',
      chapter: 2,
      verse: null,
    })
    expect(parseBibleReference('3 joh 1')).toEqual({
      book: '3 John',
      chapter: 1,
      verse: null,
    })
  })

  it('accepts the shortest unique canonical prefix for every numbered book', () => {
    const numberedBooks = bibleBooks.filter(book => /^\d\s/.test(book.name))

    for (const book of numberedBooks) {
      const [, ordinal, baseName] = book.name.match(/^(\d)\s+(.+)$/)
      const peers = numberedBooks
        .filter(peer => peer.name.startsWith(`${ordinal} `))
        .map(peer => peer.name.replace(/^\d\s+/, '').toLowerCase())
      const prefix = [...baseName.toLowerCase()].map((_, index) => baseName.slice(0, index + 1).toLowerCase())
        .find(candidate => peers.filter(peer => peer.startsWith(candidate)).length === 1)
      const chapter = Math.min(2, book.chapters)

      expect(parseBibleReference(`${ordinal} ${prefix} ${chapter}`)).toEqual({
        book: book.name,
        chapter,
        verse: null,
      })
      expect(parseBibleReference(`${ordinal}${prefix}${chapter}`)).toEqual({
        book: book.name,
        chapter,
        verse: null,
      })
    }
  })

  it('uses default book for bare chapter:verse input', () => {
    expect(parseBibleReference('10:4', 'Romans')).toEqual({
      book: 'Romans',
      chapter: 10,
      verse: 4,
    })
  })

  it('rejects chapter numbers outside book range', () => {
    expect(parseBibleReference('Obadiah 2')).toBeNull()
  })

  it('returns null for an unnumbered book name without chapter', () => {
    expect(parseBibleReference('Genesis')).toBeNull()
  })

  it('returns null for empty or non-reference input', () => {
    expect(parseBibleReference('')).toBeNull()
    expect(parseBibleReference('   ')).toBeNull()
    expect(parseBibleReference('faith hope love')).toBeNull()
  })

  it('does not apply default book to non-numeric prefixed input', () => {
    expect(parseBibleReference('Genesis chapter one', 'Romans')).toBeNull()
  })
})
