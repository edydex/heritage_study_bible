import { describe, expect, it } from 'vitest'
import { chapterWordAnchors, checkedAnchorGroups, occurrenceWordAnchors } from './parallelWordAnchors'
import { greekLemmaIds, interactiveWordRanges } from './wordStudy'

const book = verses => ({ name: 'Example', chapters: [{ number: 1, verses: Object.entries(verses).map(([number, text]) => ({ number: Number(number), text })) }] })
const sourceBook = book({ 1: 'λόγος', 2: 'λόγος' })
const primaryBook = book({ 1: 'second', 2: 'first' })
const secondaryBook = book({ 1: 'first', 2: 'second' })
const entry = (targetText, sourceVerse) => ({
  sourceText: 'λόγος', targetText, sourceReference: { chapter: 1, verse: sourceVerse },
  groups: [{ id: 0, source: [0, 5], target: [0, targetText.length], sourceAnchors: [{ chapter: 1, verse: sourceVerse, startOffset: 0, endOffset: 5, text: 'λόγος' }] }],
})
const primaryData = { book: 'Example', targetId: 'LSV', verses: { '1:1': entry('second', 2), '1:2': entry('first', 1) } }
const secondaryData = { book: 'Example', targetId: 'BSB', verses: { '1:1': entry('first', 1), '1:2': entry('second', 2) } }

describe('original witness anchors across translated verse boundaries', () => {
  it('highlights the actual source word in the neighboring row instead of matching by verse number', () => {
    const links = chapterWordAnchors({ primaryData, secondaryData: null, primaryBook, secondaryBook: sourceBook, sourceBook, chapter: 1 })
    expect(links.primary.get('1:1')[0].id).toBe(links.secondary.get('1:2')[0].id)
    expect(links.primary.get('1:1')[0].id).not.toBe(links.secondary.get('1:1')[0].id)
    expect(links.primary.get('1:1')[0].label).toContain('Greek 1:2')
    expect(links.primary.get('1:1')[0].label).toContain('LSV 1:1 second')
  })
  it('joins two English renderings through the source reference even when their translated verses differ', () => {
    const links = chapterWordAnchors({ primaryData, secondaryData, primaryBook, secondaryBook, sourceBook, chapter: 1 })
    expect(links.primary.get('1:1')[0].id).toBe(links.secondary.get('1:2')[0].id)
    expect(links.primary.get('1:2')[0].id).toBe(links.secondary.get('1:1')[0].id)
    expect(links.primary.get('1:1')[0].pattern).toBe(links.secondary.get('1:2')[0].pattern)
  })
  it('keeps known Greek lemma lookup when the other translation has no checked counterpart', () => {
    const missing = { ...secondaryData, verses: {} }
    const links = chapterWordAnchors({ primaryData, secondaryData: missing, primaryBook, secondaryBook, sourceBook, chapter: 1 })
    expect(links.primary.has('1:1')).toBe(false)
    const [word] = interactiveWordRanges('second', [], { book: 'Example', chapter: 1, verse: 1, translationId: 'LSV', lookupLinks: links.lookupPrimary.get('1:1') })
    expect(word.paired).toBe(false)
    expect(word.pattern).toBeUndefined()
    const concordance = { books: [{ name: 'Example', verses: { '1:1': [[0, 5, 10]], '1:2': [[0, 5, 20]] } }] }
    expect(greekLemmaIds(concordance, word)).toEqual([20])
    // Clicking Greek itself always studies that exact word, not every word in
    // its many-to-many translated phrase.
    expect(greekLemmaIds(concordance, { ...word, translationId: 'ORIGINAL', chapter: 1, verse: 1, startOffset: 0, endOffset: 5 })).toEqual([10])
  })
  it('requires the actual target and source texts before trusting a foreign reference', () => {
    const source = new Map([['1:1', 'λόγος'], ['1:2', 'λόγος']])
    expect(checkedAnchorGroups(primaryData, '1:1', source, 'changed')).toBeNull()
    const bad = structuredClone(primaryData)
    bad.verses['1:1'].groups[0].sourceAnchors[0].text = 'different source'
    expect(checkedAnchorGroups(bad, '1:1', source, 'second')).toBeNull()
    bad.verses['1:1'].groups[0].sourceAnchors[0].verse = 99
    expect(checkedAnchorGroups(bad, '1:1', source, 'second')).toBeNull()
  })
  it('does not color stale displayed text while retaining other valid verse mappings', () => {
    const links = chapterWordAnchors({ primaryData, secondaryData: null, primaryBook: book({ 1: 'changed', 2: 'first' }), secondaryBook: sourceBook, sourceBook, chapter: 1 })
    expect(links.primary.has('1:1')).toBe(false)
    expect(links.primary.has('1:2')).toBe(true)
    expect(links.invalidReferences).toContain('LSV 1:1')
  })
  it('shows and navigates occurrence context at the actual translated reference', () => {
    const row = { book: 'Example', chapter: 1, verse: 1, text: 'λόγος', ranges: [[0, 5]], count: 1 }
    const result = occurrenceWordAnchors(row, primaryData, primaryBook, sourceBook)
    expect(result.status).toBe('matched')
    expect(result.missingCount).toBe(0)
    expect(result.text).toBe('first')
    expect(result.phrases).toEqual(['first'])
    expect(result.contexts).toMatchObject([{ chapter: 1, verse: 2, text: 'first', ranges: [[0, 5]] }])
  })
  it('retains explicit source-absence notes without inventing links for an extra English verse', () => {
    const extra = structuredClone(primaryData)
    extra.verses['1:3'] = { sourceText: '', sourceAbsent: true, targetText: 'extra words', groups: [], review: {
      targetNotes: [{ startOffset: 0, endOffset: 11, reason: 'This longer reading is absent from this named Greek witness.' }],
    } }
    const target = book({ 1: 'second', 2: 'first', 3: 'extra words' })
    const links = chapterWordAnchors({ primaryData: extra, secondaryData: null, primaryBook: target, secondaryBook: sourceBook, sourceBook, chapter: 1 })
    expect(links.primary.has('1:3')).toBe(false)
    expect(links.primaryNotes.get('1:3')[0].reason).toContain('absent')
    expect(links.invalidReferences).not.toContain('LSV 1:3')
  })
  it('starts an English content-word study at its lexical head while retaining the article choice', () => {
    const data = { lemmas: [{ lemma: 'ὁ', strongs: ['3588'] }, { lemma: 'λόγος', strongs: ['3056'] }], books: [{ name: 'Example', verses: { '1:1': [[0, 1, 0], [2, 7, 1]] } }] }
    const context = { book: 'Example', chapter: 1, verse: 1, translationId: 'LSV', sourceAnchors: [{ chapter: 1, verse: 1, startOffset: 0, endOffset: 7 }] }
    expect(greekLemmaIds(data, { ...context, word: 'Word' })).toEqual([1, 0])
    expect(greekLemmaIds(data, { ...context, word: 'the' })).toEqual([0, 1])
    expect(greekLemmaIds(data, { ...context, translationId: 'ORIGINAL', startOffset: 0, endOffset: 1, word: 'ὁ' })).toEqual([0])
  })
})
