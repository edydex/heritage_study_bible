import { describe, expect, it } from 'vitest'
import { parseBibleReference, resolveBookAliasPrefix } from './parseBibleReference'

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

  it('rejects partial alias collisions', () => {
    expect(resolveBookAliasPrefix('johnny 3:16')).toBeNull()
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

  it('returns null for book name without chapter', () => {
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
