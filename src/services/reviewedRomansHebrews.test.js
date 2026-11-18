import { expect, it } from 'vitest'
import { chapterWordAnchors } from './parallelWordAnchors'
import { greekLemmaIds, interactiveWordRanges } from './wordStudy'
import greek from '../../public/data/original-languages/greek-nt-n1904.json'
import concordance from '../../public/data/original-languages/greek-concordance.json'
import synodal from '../../public/data/translations/SYNO-W.json'
import bsb from '../../public/data/translations/BSB.json'
import lsv from '../../public/data/translations/LSV.json'
import romans from '../../public/data/original-languages/syno-w-word-links/romans.json'
import hebrews from '../../public/data/original-languages/bsb-word-links/hebrews.json'
import philippians from '../../public/data/original-languages/lsv-word-links/philippians.json'
import kjv from '../../public/data/translations/KJV.json'
import kjvHebrews from '../../public/data/original-languages/kjv-word-links/hebrews.json'
import lsvJohn from '../../public/data/original-languages/lsv-word-links/john.json'

const strongs = word => greekLemmaIds(concordance, word).flatMap(id => concordance.lemmas[id].strongs)
function chapter(mapping, corpus, number) {
  const sourceBook = greek.books.find(book => book.name === mapping.book)
  const primaryBook = corpus.books.find(book => book.name === mapping.book)
  const graph = chapterWordAnchors({ primaryData: mapping, primaryBook, secondaryData: null,
    secondaryBook: sourceBook, sourceBook, chapter: number })
  expect(graph.invalidReferences).toEqual([])
  const words = verse => {
    const ref = `${number}:${verse}`, entry = mapping.verses[ref]
    return interactiveWordRanges(entry.targetText, graph.primary.get(ref), {
      translationId: mapping.targetId, book: mapping.book, chapter: number, verse,
      lookupLinks: graph.lookupPrimary.get(ref), unpairedNotes: graph.primaryNotes.get(ref),
    })
  }
  const word = (verse, text, occurrence = 0, count = 1) => {
    const matches = words(verse).filter(word => word.word === text)
    expect(matches).toHaveLength(count)
    return matches[occurrence]
  }
  return { graph, sourceBook, word }
}

// Compare actual physical source occurrences, then exercise Original through
// the same chapter graph: translated head preferences must never retag it.
function exactSources(fixture, word, book, sourceChapter, sourceVerse, indices) {
  expect(word.paired).toBe(true)
  const ref = `${sourceChapter}:${sourceVerse}`
  const rows = concordance.books.find(row => row.name === book).verses[ref]
  const selected = word.studySourceAnchors.flatMap(anchor => {
    expect([anchor.chapter, anchor.verse]).toEqual([sourceChapter, sourceVerse])
    return rows.filter(([start, end]) => start < anchor.endOffset && end > anchor.startOffset)
  })
  expect(selected).toEqual(indices.map(index => rows[index]))
  expect(new Set(greekLemmaIds(concordance, word))).toEqual(new Set(selected.map(row => row[2])))
  const text = fixture.sourceBook.chapters.find(c => c.number === sourceChapter).verses.find(v => v.number === sourceVerse).text
  const original = interactiveWordRanges(text, fixture.graph.secondary.get(ref), {
    translationId: 'ORIGINAL', book, chapter: sourceChapter, verse: sourceVerse,
  })
  for (const [start, end, id] of selected) {
    // Source index spans retain surrounding punctuation; clickable words omit it.
    const matches = original.filter(word => word.startOffset >= start && word.endOffset <= end)
    expect(matches).toHaveLength(1)
    expect(matches[0].word).toBe(text.slice(start, end).replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, ''))
    expect(greekLemmaIds(concordance, matches[0])).toEqual([id])
  }
}

it.each([
  [2, 22, 'Проповедуя', 21, [8], ['2784']],
  [3, 26, 'явится', 26, [15, 16, 17], ['1510', '1519', '3588']],
  [4, 21, 'обещанное', 21, [3, 4], ['1861', '3739']],
])('Russian Romans %i:%i %s keeps its actual head, alternatives and Original occurrences', (ch, verse, text, sourceVerse, indices, expected) => {
  const fixture = chapter(romans, synodal, ch), selected = fixture.word(verse, text)
  expect(strongs(selected)).toEqual(expected)
  exactSources(fixture, selected, 'Romans', ch, sourceVerse, indices)
  if (sourceVerse !== verse) expect(selected.counterparts).toContainEqual({ translationId: 'ORIGINAL', chapter: ch, verse: sourceVerse })
})

it('Nothing opens the real negative while creation and both exact Original choices remain available', () => {
  const fixture = chapter(hebrews, bsb, 4), nothing = fixture.word(13, 'Nothing'), creation = fixture.word(13, 'creation')
  expect(strongs(nothing)).toEqual(['3756', '2937'])
  expect(strongs(creation)).toEqual(['2937', '3756'])
  for (const key of ['id', 'color', 'texture', 'pattern', 'studySourceAnchors']) expect(nothing[key]).toEqual(creation[key])
  exactSources(fixture, nothing, 'Hebrews', 4, 13, [1, 3])
})

it('the second did and the since/share frame have no invented Greek head while the first did stays paired', () => {
  const fixture = chapter(hebrews, bsb, 4)
  expect(fixture.word(2, 'did', 0, 2).paired).toBe(true)
  for (const selected of [fixture.word(2, 'since'), fixture.word(2, 'did', 1, 2), fixture.word(2, 'share')]) {
    expect(selected.paired).toBe(false)
    expect(strongs(selected)).toEqual([])
    expect(selected.studySourceAnchors).toBeUndefined()
    expect(selected.unpairedReason).toContain('singular nominative passive')
  }
})

it('Philippians same and the retain distinct pronoun/article occurrences rather than a shared guessed head', () => {
  const fixture = chapter(philippians, lsv, 4), same = fixture.word(2, 'same'), article = fixture.word(2, 'the', 0, 2)
  expect(strongs(same)).toEqual(['846'])
  expect(strongs(article)).toEqual(['3588'])
  expect(same.id).not.toEqual(article.id)
  exactSources(fixture, same, 'Philippians', 4, 2, [6])
  exactSources(fixture, article, 'Philippians', 4, 2, [5])
})

it.each([
  ['KJV', 11, 'therefore', 11, [1, 2], ['3767', '3303']],
  ['BSB', 18, 'So', 18, [1, 2], ['1063', '3303']],
  ['BSB', 20, 'others', 20, [6, 7], ['3588', '3303']],
  ['KJV', 21, 'those', 20, [6, 7], ['3588', '3303']],
])('%s Hebrews 7:%i %s prefers its actual connective or personal class and preserves Original', (target, verse, text, sourceVerse, indices, expected) => {
  const fixture = chapter(target === 'BSB' ? hebrews : kjvHebrews, target === 'BSB' ? bsb : kjv, 7)
  const selected = fixture.word(verse, text)
  expect(strongs(selected)).toEqual(expected)
  exactSources(fixture, selected, 'Hebrews', 7, sourceVerse, indices)
})

it.each([[9, [0, 2]], [10, [13, 14]], [15, [18, 19]], [17, [12, 13]]])('Russian Romans 5:%i comparative retains both actual degree words with the comparative first', (verse, indices) => {
  const fixture = chapter(romans, synodal, 5), selected = fixture.word(verse, 'более')
  expect(strongs(selected)).toEqual(['3123', '4183'])
  exactSources(fixture, selected, 'Romans', 5, verse, indices)
})

it('Russian rejection keeps the two actual next-verse occurrences and prefers the negative', () => {
  const fixture = chapter(romans, synodal, 6), selected = fixture.word(1, 'Никак')
  expect(strongs(selected)).toEqual(['3361', '1096'])
  exactSources(fixture, selected, 'Romans', 6, 2, [0, 1])
  expect(selected.counterparts).toContainEqual({ translationId: 'ORIGINAL', chapter: 6, verse: 2 })
})

it.each([[24, 17, 16, 2], [39, 9, 8, 1]])('John 5:%i continuous and life retain separate actual adjective and noun choices', (verse, adjective, noun, lifeCount) => {
  const fixture = chapter(lsvJohn, lsv, 5), continuous = fixture.word(verse, 'continuous'), life = fixture.word(verse, 'life', 0, lifeCount)
  expect(strongs(continuous)).toEqual(['166'])
  expect(strongs(life)).toEqual(['2222'])
  expect(continuous.id).not.toEqual(life.id)
  exactSources(fixture, continuous, 'John', 5, verse, [adjective])
  exactSources(fixture, life, 'John', 5, verse, [noun])
})

it.each([
  [13, 'плотские', 13, [13], '4983'],
  [15, 'Которым', 15, [12, 13], '3739'],
  [19, 'надеждою', 19, [2], '603'],
  [35, 'написано', 36, [1], '1125'],
])('Russian Romans 8:%i %s keeps the actual noun, relative or moved source occurrence', (verse, text, sourceVerse, indices, firstStrong) => {
  const f = chapter(romans, synodal, 8), w = f.word(verse, text)
  expect(strongs(w)[0]).toBe(firstStrong)
  exactSources(f, w, 'Romans', 8, sourceVerse, indices)
})

it('the two Russian seeing frames preserve the honest voice gap and the actual second active occurrence', () => {
  const f = chapter(romans, synodal, 8), first = f.word(24, 'видит', 0, 2), second = f.word(24, 'видит', 1, 2)
  expect(first.paired).toBe(false)
  expect(first.unpairedReason).toContain('active seeing')
  expect(greekLemmaIds(concordance, first)).toEqual([])
  exactSources(f, second, 'Romans', 8, 24, [12])
})

it('the formed object immediately resumes its real noun while the differently qualified righteousness phrase stays unlinked', () => {
  const nine = chapter(romans, synodal, 9)
  for (const text of ['Изделие', 'его']) exactSources(nine, nine.word(20, text), 'Romans', 9, 20, [13])
  const ten = chapter(romans, synodal, 10)
  const supplied = ten.word(3, 'праведность')
  expect(supplied.paired).toBe(false)
  expect(greekLemmaIds(concordance, supplied)).toEqual([])
  exactSources(ten, ten.word(3, 'праведности', 0, 2), 'Romans', 10, 3, [5])
  exactSources(ten, ten.word(3, 'праведности', 1, 2), 'Romans', 10, 3, [12])
  expect(ten.word(3, 'праведности', 0, 2).id).not.toBe(ten.word(3, 'праведности', 1, 2).id)
})

it.each([
  [5, 'во', 17, '1519'], [9, 'в', 5, '2596'], [17, 'для', 7, '1519'],
  [26, 'на', 2, '1722'], [26, 'том', 3, '3588'],
])('Russian Romans 9:%i %s opens its actual grammatical word inside the unchanged phrase', (verse, text, index, firstStrong) => {
  const f = chapter(romans, synodal, 9), w = f.word(verse, text)
  expect(strongs(w)[0]).toBe(firstStrong)
  const actual = concordance.books.find(b => b.name === 'Romans').verses[`9:${verse}`][index]
  expect(w.studySourceAnchors.some(a => a.startOffset <= actual[0] && a.endOffset >= actual[1])).toBe(true)
})

it('KJV neighbour retains actual polites while BSB hope uses the correct article occurrence', () => {
  const f = chapter(kjvHebrews, kjv, 8), neighbour = f.word(11, 'neighbour')
  expect(strongs(neighbour)[0]).toBe('4177')
  exactSources(f, neighbour, 'Hebrews', 8, 11, [5, 6])
  const g = chapter(hebrews, bsb, 10)
  exactSources(g, g.word(23, 'hope'), 'Hebrews', 10, 23, [3, 4])
  const need = g.word(36, 'need')
  expect(strongs(need)[0]).toBe('5532')
  exactSources(g, need, 'Hebrews', 10, 36, [2, 3])
})

it('the Hebrews architect and builder remain distinct physical source nouns', () => {
  const f = chapter(hebrews, bsb, 11)
  exactSources(f, f.word(10, 'architect'), 'Hebrews', 11, 10, [8])
  exactSources(f, f.word(10, 'builder'), 'Hebrews', 11, 10, [10])
  expect(strongs(f.word(10, 'architect'))).toEqual(['5079'])
  expect(strongs(f.word(10, 'builder'))).toEqual(['1217'])
  expect(f.word(10, 'architect').id).not.toBe(f.word(10, 'builder').id)
})
