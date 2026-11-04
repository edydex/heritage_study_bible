import { expect, it } from 'vitest'
import { chapterWordAnchors, checkedAnchorGroups } from './parallelWordAnchors'
import { greekLemmaIds, interactiveWordRanges } from './wordStudy'
import peterBsb from '../../public/data/original-languages/bsb-word-links/1-peter.json'
import philippiansLsv from '../../public/data/original-languages/lsv-word-links/philippians.json'
import galatiansBsb from '../../public/data/original-languages/bsb-word-links/galatians.json'
import concordance from '../../public/data/original-languages/greek-concordance.json'
import greek from '../../public/data/original-languages/greek-nt-n1904.json'
import bsb from '../../public/data/translations/BSB.json'
import lsv from '../../public/data/translations/LSV.json'
import kjv from '../../public/data/translations/KJV.json'
import peterKjv from '../../public/data/original-languages/kjv-word-links/1-peter.json'
import philippiansKjv from '../../public/data/original-languages/kjv-word-links/philippians.json'
import galatiansKjv from '../../public/data/original-languages/kjv-word-links/galatians.json'
import synodal from '../../public/data/translations/SYNO-W.json'

// Use shipped, reviewed rows. Removing only head metadata provides the old
// initial-tab control while retaining exactly the same correspondence.
function withoutHeads(data) {
  const result = structuredClone(data)
  for (const entry of Object.values(result.verses)) for (const group of entry.groups) delete group.studyHeads
  return result
}
function fixture(data, reference) {
  const after = { book: data.book, targetId: data.targetId, verses: { [reference]: structuredClone(data.verses[reference]) } }
  return { book: data.book, targetId: data.targetId, reference, before: withoutHeads(after), after }
}
const fixtures = { peter: fixture(peterBsb, '1:2'), philippians: fixture(philippiansLsv, '2:18'), foreign: fixture(galatiansBsb, '2:20') }
// A test-only whole-clause projection exercises multiple headed words from
// the real preceding source verse. The shipped Galatians links stay separate.
{
  const entry = fixtures.foreign.after.verses['2:20'], [predicate, name] = entry.groups
  if (![...predicate.sourceAnchors, ...name.sourceAnchors].every(anchor => anchor.chapter === 2 && anchor.verse === 19)) throw new Error('Foreign fixture lost its actual source reference')
  const anchors = [...predicate.sourceAnchors, ...name.sourceAnchors].sort((a, b) => a.startOffset - b.startOffset)
  const start = entry.targetText.indexOf('crucified'), end = entry.targetText.indexOf('Christ') + 'Christ'.length
  entry.groups = [{ id: Math.min(predicate.id, name.id), source: [anchors[0].startOffset, anchors[0].endOffset],
    sourceRanges: anchors.map(anchor => [anchor.startOffset, anchor.endOffset]), sourceAnchors: anchors, target: [0, end],
    studyHeads: [{ sourceAnchors: structuredClone(predicate.sourceAnchors), targetRanges: [[start, start + 'crucified'.length]], note: 'Test-only projection of the actual source19 predicate.' }],
  }, ...entry.groups.slice(2)]
  fixtures.foreign.before = withoutHeads(fixtures.foreign.after)
}

const sourceBook = name => greek.books.find(book => book.name === name)
const englishBook = (corpus, name) => corpus.books.find(book => book.name === name)
const reference = ref => { const [chapter, verse] = ref.split(':').map(Number); return { chapter, verse } }
const opposite = { peter: peterKjv, philippians: philippiansKjv, foreign: galatiansKjv }
const rows = (name, version) => {
  const f = fixtures[name], ref = reference(f.reference), primaryBook = englishBook(f.targetId === 'BSB' ? bsb : lsv, f.book)
  const graph = chapterWordAnchors({ primaryData: f[version], secondaryData: opposite[name], primaryBook,
    secondaryBook: englishBook(kjv, f.book), sourceBook: sourceBook(f.book), chapter: ref.chapter })
  expect(graph.invalidReferences).toEqual([])
  const context = { translationId: f.targetId, book: f.book, ...ref, lookupLinks: graph.lookupPrimary.get(f.reference) }
  const words = interactiveWordRanges(f[version].verses[f.reference].targetText, graph.primary.get(f.reference), context)
  return { graph, words, word: text => words.find(word => word.word === text) }
}
const strongs = word => greekLemmaIds(concordance, word).map(id => concordance.lemmas[id].strongs[0])
const original = (book, chapter, verse, index) => {
  const row = concordance.books.find(b => b.name === book).verses[`${chapter}:${verse}`][index]
  return { translationId: 'ORIGINAL', book, chapter, verse, startOffset: row[0], endOffset: row[1] }
}

it('opens the selected actual name while preserving the joint owner phrase and every dictionary alternative', () => {
  const before = rows('peter', 'before'), after = rows('peter', 'after')
  expect(strongs(before.word('Christ'))[0]).toBe('2424')
  expect(strongs(after.word('Christ'))).toEqual(['5547', '2424'])
  expect(strongs(after.word('Jesus'))).toEqual(['2424', '5547'])
  expect(strongs(after.word('His'))).toEqual(strongs(before.word('His')))
  expect(after.word('Christ').color).toMatchObject({ index: expect.any(Number), hue: expect.any(Number) })
  expect(Number.isInteger(after.word('Christ').texture)).toBe(true)
  for (const word of ['Christ', 'Jesus', 'His']) {
    expect(after.word(word).studySourceAnchors).toEqual(before.word(word).studySourceAnchors)
    for (const key of ['id', 'color', 'texture', 'pattern', 'label', 'sourceAnchors']) expect(after.word(word)[key]).toEqual(before.word(word)[key])
    expect(new Set(greekLemmaIds(concordance, after.word(word)))).toEqual(new Set(greekLemmaIds(concordance, before.word(word))))
  }
  const text = englishBook(kjv, '1 Peter').chapters[0].verses.find(v => v.number === 2).text
  const secondary = interactiveWordRanges(text, after.graph.secondary.get('1:2'), { translationId: 'KJV', book: '1 Peter', chapter: 1, verse: 2 })
  expect(secondary.filter(word => ['Jesus', 'Christ'].includes(word.word)).every(word => !word.studyHeadAnchors)).toBe(true)
  expect(strongs(original('1 Peter', 1, 2, 12))).toEqual(['2424'])
  expect(strongs(original('1 Peter', 1, 2, 13))).toEqual(['5547'])
  expect(strongs({ ...after.word('Christ'), ...original('1 Peter', 1, 2, 12) })).toEqual(['2424'])
  expect(strongs({ ...after.word('Jesus'), ...original('1 Peter', 1, 2, 13) })).toEqual(['5547'])
})

it('prioritizes both adjacent selected heads while preserving an unselected third lemma', () => {
  const text = 'λόγος Θεός καί', target = 'shared'
  const book = text => ({ name: 'Example', chapters: [{ number: 1, verses: [{ number: 1, text }] }] })
  const anchors = [{ chapter: 1, verse: 1, startOffset: 6, endOffset: 10, text: 'Θεός' }, { chapter: 1, verse: 1, startOffset: 11, endOffset: 14, text: 'καί' }]
  const data = { book: 'Example', targetId: 'LSV', verses: { '1:1': { sourceText: text, targetText: target, groups: [{
    id: 0, source: [0, text.length], target: [0, target.length],
    studyHeads: [{ sourceAnchors: anchors, targetRanges: [[0, target.length]], note: 'Synthetic adjacent-head contract, not a Bible mapping.' }],
  }] } } }
  const graph = chapterWordAnchors({ primaryData: data, secondaryData: null, primaryBook: book(target), secondaryBook: book(text), sourceBook: book(text), chapter: 1 })
  expect(graph.invalidReferences).toEqual([])
  const [word] = interactiveWordRanges(target, graph.primary.get('1:1'), { translationId: 'LSV', book: 'Example', chapter: 1, verse: 1 })
  const dictionary = { books: [{ name: 'Example', verses: { '1:1': [[0, 5, 10], [6, 10, 20], [11, 14, 30]] } }] }
  expect(greekLemmaIds(dictionary, { ...word, studyHeadAnchors: [] })).toEqual([10, 20, 30])
  expect(greekLemmaIds(dictionary, word)).toEqual([20, 30, 10])
})

it('prefers the actual nominal head of a whole phrase without removing the article or assigning separate causal words', () => {
  const before = rows('philippians', 'before'), after = rows('philippians', 'after')
  for (const text of ['because', 'of', 'this']) {
    expect(strongs(before.word(text))).toEqual(['3588', '846'])
    expect(strongs(after.word(text))).toEqual(['846', '3588'])
    expect(after.word(text).sourceAnchors).toEqual(before.word(text).sourceAnchors)
    expect(after.word(text).id).toEqual(before.word(text).id)
  }
  expect(strongs(after.word('you'))).toEqual(strongs(before.word('you')))
  expect(strongs(original('Philippians', 2, 18, 0))).toEqual(['3588'])
  expect(strongs(original('Philippians', 2, 18, 2))).toEqual(['846'])
})

it('retains the reviewed head and all alternatives when the other column has no checked counterpart', () => {
  const f = fixtures.peter, ref = reference(f.reference)
  const graph = chapterWordAnchors({ primaryData: f.after, secondaryData: { ...peterKjv, verses: {} }, primaryBook: englishBook(bsb, f.book),
    secondaryBook: englishBook(kjv, f.book), sourceBook: sourceBook(f.book), chapter: 1 })
  const words = interactiveWordRanges(f.after.verses[f.reference].targetText, [], {
    translationId: 'BSB', book: f.book, ...ref, lookupLinks: graph.lookupPrimary.get(f.reference),
  })
  const christ = words.find(word => word.word === 'Christ')
  expect(christ.paired).toBe(false)
  expect(strongs(christ)).toEqual(['5547', '2424'])
})

it('keeps the actual Synodal numeral selectable without claiming an unreviewed Greek match', () => {
  const text = englishBook(synodal, 'John').chapters.find(chapter => chapter.number === 21).verses.find(verse => verse.number === 11).text
  const words = interactiveWordRanges(text, [], { translationId: 'SYNO-W', book: 'John', chapter: 21, verse: 11 })
  const number = words.find(word => word.word === '153')
  expect(number).toBeDefined()
  expect(text.slice(number.startOffset, number.endOffset)).toBe('153')
  expect(number.paired).toBe(false)
  expect(greekLemmaIds(concordance, number)).toEqual([])
})

it('joins numeric target overlaps through all three actual Greek numeral occurrences', () => {
  const originalBook = sourceBook('John'), translated = englishBook(synodal, 'John')
  const sourceText = originalBook.chapters.find(c => c.number === 21).verses.find(v => v.number === 11).text
  const targetText = translated.chapters.find(c => c.number === 21).verses.find(v => v.number === 11).text
  const start = targetText.indexOf('153'), target = [start, start + 3]
  const numbers = concordance.books.find(b => b.name === 'John').verses['21:11']
    .filter(row => ['1540', '4004', '5140'].includes(concordance.lemmas[row[2]].strongs[0]))
  expect(numbers).toHaveLength(3)
  // Test-only publisher-style overlapping numeric groups; this does not
  // publish an unreviewed Synodal verse or infer any other Russian links.
  const groups = numbers.map(([a, b], id) => ({ id, source: [a, b], target }))
  const data = { book: 'John', targetId: 'SYNO-W', verses: { '21:11': { sourceText, targetText, groups } } }
  const graph = chapterWordAnchors({ primaryData: data, secondaryData: null, primaryBook: translated, secondaryBook: originalBook, sourceBook: originalBook, chapter: 21 })
  expect(graph.invalidReferences).toEqual([])
  const number = interactiveWordRanges(targetText, graph.primary.get('21:11'), { translationId: 'SYNO-W', book: 'John', chapter: 21, verse: 11 })
    .find(word => word.word === '153')
  expect(number.paired).toBe(true)
  expect(greekLemmaIds(concordance, number)).toEqual(numbers.map(row => row[2]))
  expect(number.studySourceAnchors.map(anchor => anchor.startOffset)).toEqual(numbers.map(row => row[0]))
})

it('uses the true foreign occurrence for a moved clause and cannot prefer the same-numbered local word', () => {
  const { word } = rows('foreign', 'after')
  expect(strongs(word('crucified'))).toEqual(['4957', '5547'])
  expect(word('crucified').studyHeadAnchors).toMatchObject([{ chapter: 2, verse: 19 }])
  const before = strongs(rows('foreign', 'before').word('crucified'))
  expect(new Set(strongs(word('crucified')))).toEqual(new Set(before))
  const foreign = original('Galatians', 2, 19, 10), local = original('Galatians', 2, 20, 10)
  expect(strongs(foreign)).toEqual(['4957'])
  expect(strongs(local)).toEqual(['1161'])
  expect(greekLemmaIds(concordance, { ...word('crucified'), studyHeadAnchors: [{ ...local, text: 'δὲ' }] })).toEqual(greekLemmaIds(concordance, { ...word('crucified'), studyHeadAnchors: [] }))
})

const sourceVerses = new Map(sourceBook('1 Peter').chapters.flatMap(c => c.verses.map(v => [`${c.number}:${v.number}`, v.text])))
it.each([
  ['empty list', group => { group.studyHeads = [] }],
  ['non-array', group => { group.studyHeads = {} }],
  ['missing review note', group => { delete group.studyHeads[0].note }],
  ['unknown source', group => { group.studyHeads[0].sourceAnchors[0].verse = 99 }],
  ['another real source word', group => { group.studyHeads[0].sourceAnchors[0] = group.sourceAnchors[0]; group.studyHeads[0].sourceAnchors[0] = { ...group.studyHeads[0].sourceAnchors[0], startOffset: 0, endOffset: 4, text: 'κατὰ' } }],
  ['wrong source spelling', group => { group.studyHeads[0].sourceAnchors[0].text = 'different' }],
  ['partial source word', group => { const h = group.studyHeads[0].sourceAnchors[0]; h.endOffset--; h.text = h.text.slice(0, -1) }],
  ['null source word', group => { group.studyHeads[0].sourceAnchors = [null] }],
  ['repeated source word', group => { const h = group.studyHeads[0]; h.sourceAnchors.push({ ...h.sourceAnchors[0] }) }],
  ['merged multiword head anchor', group => {
    const first = group.studyHeads[0].sourceAnchors[0], last = group.studyHeads[1].sourceAnchors[0]
    group.studyHeads[0].sourceAnchors = [{ ...first, endOffset: last.endOffset, text: sourceVerses.get('1:2').slice(first.startOffset, last.endOffset) }]
  }],
  ['target outside its group', group => { group.studyHeads[0].targetRanges = [[0, 9]] }],
  ['overlapping target choices', group => { group.studyHeads[1].targetRanges = structuredClone(group.studyHeads[0].targetRanges) }],
])('rejects %s head metadata while never manufacturing another source identity', (_, change) => {
  const f = structuredClone(fixtures.peter.after), entry = f.verses['1:2'], group = entry.groups.find(group => group.studyHeads)
  change(group)
  expect(checkedAnchorGroups(f, '1:2', sourceVerses, entry.targetText)).toBeNull()
})
