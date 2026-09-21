import { describe, it, expect } from 'vitest'
import { verseWordLinks, visibleVerseText } from './originalLanguages'
import original from '../../public/data/original-languages/greek-nt-n1904.json'
import alignment from '../../public/data/original-languages/romans-bsb-links.json'
import bsb from '../../public/data/translations/BSB.json'

describe('named original-language corpus and attested links', () => {
  it('contains the complete named Greek NT and preserves explicit edition metadata', () => {
    expect(original.books).toHaveLength(27)
    expect(original.books.flatMap(book => book.chapters)).toHaveLength(260)
    expect(original.books.flatMap(book => book.chapters.flatMap(chapter => chapter.verses))).toHaveLength(7943)
    expect(original.sources[0].revision).toBe('713f28a3b7d4d66132f5aa809fa223fe79762e5d')
    expect(original.sources[0].license).toBe('Public domain / CC0')
    for (const book of original.books) {
      for (const chapter of book.chapters) {
        expect(new Set(chapter.verses.map(verse => verse.number)).size).toBe(chapter.verses.length)
        expect(chapter.verses.every(verse => /[\u0370-\u03ff\u1f00-\u1fff]/.test(verse.text))).toBe(true)
      }
    }
  })
  it('validates every shipped alignment against the actual displayed Greek and English text', () => {
    const greek = original.books.find(book => book.name === 'Romans')
    const english = bsb.books.find(book => book.name === 'Romans')
    let linked = 0, unmatched = 0, groups = 0
    for (const chapter of greek.chapters) for (const verse of chapter.verses) {
      const text = english.chapters.find(c => c.number === chapter.number)?.verses.find(v => v.number === verse.number)?.text || ''
      const links = verseWordLinks(alignment, chapter.number, verse.number, verse.text, text)
      if (!links) {
        expect(alignment.unavailable[`${chapter.number}:${verse.number}`]).toMatch(/edition-differs/)
        unmatched++
        continue
      }
      linked++
      expect(links.source.length).toBe(links.target.length)
      for (let i = 0; i < links.source.length; i++) {
        expect(links.source[i].id).toBe(links.target[i].id)
        expect(links.source[i].pattern).toBe(links.target[i].pattern)
        expect(links.source[i].label).toContain(' ↔ ')
        groups++
      }
    }
    expect({ linked, unmatched, groups }).toEqual({ linked: 376, unmatched: 56, groups: 5187 })
  })
  it('does not transfer mappings onto changed translations or unsupported verses', () => {
    const verse = alignment.verses['1:1']
    expect(verseWordLinks(alignment, 1, 1, verse.sourceText, verse.targetText.replace('servant', 'slave'))).toBeNull()
    expect(verseWordLinks(alignment, 1, 1, verse.sourceText.replace('Παῦλος', 'Ἰωάννης'), verse.targetText)).toBeNull()
    expect(verseWordLinks(alignment, 3, 25, 'anything', 'anything')).toBeNull()
  })
  it('uses visible text offsets without adding paragraph or formatting markup to the text', () => {
    expect(visibleVerseText('¶For <b>God</b> so loved || the world.')).toBe('For God so loved\nthe world.')
  })
})
