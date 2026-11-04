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
    const actual = original.find(word => word.startOffset === start && word.endOffset === end)
    expect(actual).toBeDefined()
    expect(greekLemmaIds(concordance, actual)).toEqual([id])
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
