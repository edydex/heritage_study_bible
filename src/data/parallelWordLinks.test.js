import { describe, expect, it } from 'vitest'
import { parallelVerseWordLinks, verseWordLinks } from './originalLanguages'
import { greekLemmaIds } from '../services/wordStudy'

const source = 'λόγος καὶ λόγος'
const mapping = (targetId, targetText, groups) => ({ targetId, verses: { '1:1': { sourceText: source, targetText, groups } } })
const primary = mapping('BSB', 'word and word', [
  { id: 0, source: [0, 5], target: [0, 4] },
  { id: 1, source: [6, 9], target: [5, 8] },
  { id: 2, source: [10, 15], target: [9, 13] },
])
const secondary = mapping('KJV', 'word and saying', [
  { id: 0, source: [0, 5], target: [0, 4] },
  { id: 1, source: [6, 9], target: [5, 8] },
  { id: 2, source: [10, 15], target: [9, 15] },
])

describe('translation links through exact source positions', () => {
  it('distinguishes repeated occurrences of the same lemma in one verse', () => {
    const links = parallelVerseWordLinks(primary, secondary, 1, 1, source, 'word and word', 'word and saying')
    expect(links.primary).toHaveLength(3)
    expect(links.primary[0].id).toBe(links.secondary[0].id)
    expect(links.primary[2].id).toBe(links.secondary[2].id)
    expect(links.primary[0].id).not.toBe(links.primary[2].id)
    expect(links.primary[2].label).toContain('BSB: word ↔ KJV: saying')
    expect(links.primary.map(link => link.pattern)).toEqual(links.secondary.map(link => link.pattern))
  })
  it('accepts an original-language column as exact identity ranges', () => {
    const links = parallelVerseWordLinks(null, primary, 1, 1, source, source, 'word and word')
    expect(links.primary.map(link => link.sourceRange)).toEqual([[0, 5], [6, 9], [10, 15]])
    expect(links.primary[2].id).toBe(links.secondary[2].id)
  })
  it('does not transfer colors onto changed text or an absent mapping', () => {
    expect(parallelVerseWordLinks(primary, secondary, 1, 1, source, 'word and WORD CHANGED', 'word and saying')).toBeNull()
    expect(parallelVerseWordLinks(primary, null, 1, 1, source, 'word and word', 'a different translation')).toBeNull()
  })
  it('joins multiword renderings without including unrelated source words between them', () => {
    const phrase = mapping('LSV', 'words together', [
      { id: 0, source: [0, 5], target: [0, 5] },
      { id: 2, source: [10, 15], target: [0, 5] },
    ])
    const links = parallelVerseWordLinks(primary, phrase, 1, 1, source, 'word and word', 'words together')
    expect(links.primary.map(link => link.startOffset)).toEqual([0, 9])
    expect(links.primary[0].id).toBe(links.primary[1].id)
    expect(links.primary[0].sourceRanges).toEqual([[0, 5], [10, 15]])
    const concordance = { books: [{ name: 'Test', verses: { '1:1': [[0, 5, 10], [6, 9, 20], [10, 15, 10]] } }] }
    expect(greekLemmaIds(concordance, { ...links.primary[0], book: 'Test', chapter: 1, verse: 1, translationId: 'BSB' })).toEqual([10])
  })
  it('preserves separated English pieces without coloring the intervening word', () => {
    const split = mapping('KJV', 'speak the word', [{ id: 0, source: [0, 5], target: [0, 5], targetRanges: [[0, 5], [10, 14]] }])
    const links = verseWordLinks(split, 1, 1, source, 'speak the word')
    expect(links.target.map(link => [link.startOffset, link.endOffset])).toEqual([[0, 5], [10, 14]])
    expect(links.target[0].id).toBe(links.target[1].id)
    expect(links.source[0].label).toBe('λόγος ↔ speak … word')
    const pivot = parallelVerseWordLinks(primary, split, 1, 1, source, 'word and word', 'speak the word')
    expect(pivot.secondary.map(link => [link.startOffset, link.endOffset])).toEqual([[0, 5], [10, 14]])
  })
  it('rejects an invalid additional phrase offset rather than trusting the first span', () => {
    const bad = mapping('KJV', 'word', [{ id: 0, source: [0, 5], target: [0, 4], targetRanges: [[0, 4], [5, 99]] }])
    expect(verseWordLinks(bad, 1, 1, source, 'word')).toBeNull()
  })
  it('keeps a discontinuous Greek phrase separate from intervening source words', () => {
    const split = mapping('KJV', 'words', [{ id: 0, source: [0, 5], sourceRanges: [[0, 5], [10, 15]], target: [0, 5] }])
    const links = verseWordLinks(split, 1, 1, source, 'words')
    expect(links.source.map(link => [link.startOffset, link.endOffset])).toEqual([[0, 5], [10, 15]])
    expect(links.source[0].id).toBe(links.source[1].id)
    const pivot = parallelVerseWordLinks(primary, split, 1, 1, source, 'word and word', 'words')
    expect(pivot.primary.map(link => link.startOffset)).toEqual([0, 9])
    expect(pivot.primary[0].id).toBe(pivot.primary[1].id)
    expect(pivot.primary[0].sourceRanges).toEqual([[0, 5], [10, 15]])
  })
  it('refuses to flatten a foreign source reference in the single-verse compatibility helper', () => {
    const foreign = mapping('LSV', 'word', [{ id: 0, source: [0, 5], target: [0, 4], sourceAnchors: [{ chapter: 1, verse: 2, startOffset: 0, endOffset: 5 }] }])
    expect(verseWordLinks(foreign, 1, 1, source, 'word')).toBeNull()
  })
})
