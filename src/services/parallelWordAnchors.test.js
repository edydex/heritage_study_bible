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

// The last six N1904 Acts 19:40 words are numbered Acts 19:41 in LSV.
// There is no N1904 19:41 text to use as a local range fallback.
const absentBoundaryFixture = () => {
  const greek = 'καὶ γὰρ κινδυνεύομεν ἐγκαλεῖσθαι στάσεως περὶ τῆς σήμερον, μηδενὸς αἰτίου ὑπάρχοντος, περὶ οὗ οὐ δυνησόμεθα ἀποδοῦναι λόγον περὶ τῆς συστροφῆς ταύτης. καὶ ταῦτα εἰπὼν ἀπέλυσεν τὴν ἐκκλησίαν.'
  const english = 'and having said these things, he dismissed the assembly.'
  const words = [...greek.matchAll(/\S+/g)]
  const phrases = ['and', 'these things', 'having said', 'he dismissed', 'the', 'assembly']
  const groups = words.slice(-6).map((word, index) => ({
    id: 1_019_040_000 + words.length - 6 + index,
    source: [word.index, word.index + word[0].length],
    sourceAnchors: [{ chapter: 19, verse: 40, startOffset: word.index, endOffset: word.index + word[0].length, text: word[0] }],
    target: [english.indexOf(phrases[index]), english.indexOf(phrases[index]) + phrases[index].length],
  }))
  const makeBook = (verse, text) => ({ name: 'Acts', chapters: [{ number: 19, verses: [{ number: verse, text }] }] })
  const data = { book: 'Acts', targetId: 'LSV', verses: { '19:41': { sourceText: '', sourceAbsent: true, targetText: english, groups } } }
  return { greek, english, words, data, sourceVerses: new Map([['19:40', greek]]), sourceBook: makeBook(40, greek), targetBook: makeBook(41, english) }
}

describe('explicit foreign anchors when the local Greek verse number is absent', () => {
  it('colors the real prior-verse words and opens their exact lemma and translated occurrence context', () => {
    const { greek, english, words, data, sourceVerses, sourceBook: original, targetBook: translated } = absentBoundaryFixture()
    expect(checkedAnchorGroups(data, '19:41', sourceVerses, english)).toHaveLength(6)
    const links = chapterWordAnchors({ primaryData: data, secondaryData: null, primaryBook: translated, secondaryBook: original, sourceBook: original, chapter: 19 })
    expect(links.invalidReferences).toEqual([])
    expect(links.primary.get('19:41')).toHaveLength(6)
    expect(links.primarySourceReferences.get('19:41')).toEqual([{ chapter: 19, verse: 40 }])
    expect(links.primary.get('19:41').map(link => link.id)).toEqual(links.secondary.get('19:40').map(link => link.id))
    const dismissed = interactiveWordRanges(english, links.primary.get('19:41'), { book: 'Acts', chapter: 19, verse: 41, translationId: 'LSV' })
      .find(word => word.word === 'dismissed')
    const originalWord = words.at(-3), range = [originalWord.index, originalWord.index + originalWord[0].length]
    expect(dismissed.studySourceAnchors).toEqual([{ chapter: 19, verse: 40, startOffset: range[0], endOffset: range[1], text: originalWord[0] }])
    const concordance = { books: [{ name: 'Acts', verses: { '19:40': words.map((word, index) => [word.index, word.index + word[0].length, index]) } }] }
    expect(greekLemmaIds(concordance, dismissed)).toEqual([words.length - 3])
    const occurrence = occurrenceWordAnchors({ book: 'Acts', chapter: 19, verse: 40, text: greek, ranges: [range], count: 1 }, data, translated, original)
    expect(occurrence.status).toBe('matched')
    expect(occurrence.missingCount).toBe(0)
    expect(occurrence.contexts).toMatchObject([{ chapter: 19, verse: 41, text: english, phrases: ['he dismissed'] }])
  })

  it.each([
    ['local source text', ({ data }) => { data.verses['19:41'].sourceText = 'invented' }],
    ['existing local source', ({ sourceVerses }) => { sourceVerses.set('19:41', 'invented') }],
    ['missing explicit foreign anchors', ({ data }) => { delete data.verses['19:41'].groups[0].sourceAnchors }],
    ['empty explicit foreign anchors', ({ data }) => { data.verses['19:41'].groups[0].sourceAnchors = [] }],
    ['a local anchor', ({ data }) => { data.verses['19:41'].groups[0].sourceAnchors[0].verse = 41 }],
    ['an unknown source', ({ data }) => { data.verses['19:41'].groups[0].sourceAnchors[0].verse = 99 }],
    ['an invalid offset', ({ data, greek }) => { data.verses['19:41'].groups[0].sourceAnchors[0].endOffset = greek.length + 1 }],
    ['a wrong source text', ({ data }) => { data.verses['19:41'].groups[0].sourceAnchors[0].text = 'different' }],
    ['a duplicate group id', ({ data }) => { data.verses['19:41'].groups[1].id = data.verses['19:41'].groups[0].id }],
    ['a repeated source within one group', ({ data }) => { const group = data.verses['19:41'].groups[0]; group.sourceAnchors.push({ ...group.sourceAnchors[0] }) }],
    ['the same source owned by two groups', ({ data }) => { data.verses['19:41'].groups[1].sourceAnchors = structuredClone(data.verses['19:41'].groups[0].sourceAnchors) }],
    ['stale translated text', ({ data }) => { data.verses['19:41'].targetText = 'different' }],
  ])('rejects %s without inventing a local mapping', (_, mutate) => {
    const fixture = absentBoundaryFixture()
    mutate(fixture)
    expect(checkedAnchorGroups(fixture.data, '19:41', fixture.sourceVerses, fixture.english)).toBeNull()
  })
})

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
  it('keeps an English auxiliary and verb head in different verses connected to their one original verb', () => {
    const original = book({ 1: 'νῦν', 2: 'παρακαλέσαι' })
    const english = book({ 1: 'may', 2: 'comfort' })
    const anchor = { chapter: 1, verse: 2, startOffset: 0, endOffset: 11, text: 'παρακαλέσαι' }
    const data = { book: 'Example', targetId: 'LSV', verses: {
      '1:1': { sourceText: 'νῦν', targetText: 'may', groups: [{ id: 0, source: [0, 11], target: [0, 3], sourceAnchors: [anchor] }] },
      '1:2': { sourceText: 'παρακαλέσαι', targetText: 'comfort', groups: [{ id: 0, source: [0, 11], target: [0, 7], sourceAnchors: [anchor] }] },
    } }
    const links = chapterWordAnchors({ primaryData: data, secondaryData: null, primaryBook: english, secondaryBook: original, sourceBook: original, chapter: 1 })
    expect(links.primary.get('1:1')[0].id).toBe(links.primary.get('1:2')[0].id)
    expect(links.primary.get('1:2')[0].id).toBe(links.secondary.get('1:2')[0].id)
    expect(links.secondary.has('1:1')).toBe(false)
    const occurrence = occurrenceWordAnchors({ book: 'Example', chapter: 1, verse: 2, text: 'παρακαλέσαι', ranges: [[0, 11]], count: 1 }, data, english, original)
    expect(occurrence.missingCount).toBe(0)
    expect(occurrence.contexts.map(row => [row.verse, row.text])).toEqual([[1, 'may'], [2, 'comfort']])
  })
  it('retains each translated word’s own lemma when the other translation combines them into one phrase', () => {
    const original = book({ 1: 'λόγος Θεός' })
    const primary = book({ 1: 'Word God' }), secondary = book({ 1: 'Word and God' })
    const fine = { book: 'Example', targetId: 'LSV', verses: { '1:1': {
      sourceText: 'λόγος Θεός', targetText: 'Word God', groups: [
        { id: 0, source: [0, 5], target: [0, 4] }, { id: 1, source: [6, 10], target: [5, 8] },
      ],
    } } }
    const broad = { book: 'Example', targetId: 'BSB', verses: { '1:1': {
      sourceText: 'λόγος Θεός', targetText: 'Word and God', groups: [{ id: 0, source: [0, 10], target: [0, 12] }],
    } } }
    const links = chapterWordAnchors({ primaryData: fine, secondaryData: broad, primaryBook: primary, secondaryBook: secondary, sourceBook: original, chapter: 1 })
    const [word, god] = interactiveWordRanges('Word God', links.primary.get('1:1'), { book: 'Example', chapter: 1, verse: 1, translationId: 'LSV' })
    expect(word.id).toBe(god.id)
    expect(god.sourceAnchors).toHaveLength(2)
    expect(god.studySourceAnchors).toMatchObject([{ startOffset: 6, endOffset: 10 }])
    const concordance = { books: [{ name: 'Example', verses: { '1:1': [[0, 5, 10], [6, 10, 20]] } }] }
    expect(greekLemmaIds(concordance, word)).toEqual([10])
    expect(greekLemmaIds(concordance, god)).toEqual([20])
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
