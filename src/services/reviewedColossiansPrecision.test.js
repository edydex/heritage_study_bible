import { expect, it } from 'vitest'
import { chapterWordAnchors } from './parallelWordAnchors'
import { greekLemmaIds, interactiveWordRanges } from './wordStudy'
import greek from '../../public/data/original-languages/greek-nt-n1904.json'
import concordance from '../../public/data/original-languages/greek-concordance.json'
import lsv from '../../public/data/translations/LSV.json'
import mapping from '../../public/data/original-languages/lsv-word-links/colossians.json'

const sourceBook = greek.books.find(book => book.name === 'Colossians')
const primaryBook = lsv.books.find(book => book.name === 'Colossians')
const raw = concordance.books.find(book => book.name === 'Colossians').verses
function fixture(chapter) {
  const graph = chapterWordAnchors({ primaryData: mapping, primaryBook, secondaryData: null,
    secondaryBook: sourceBook, sourceBook, chapter })
  expect(graph.invalidReferences).toEqual([])
  return { graph, words: verse => {
    const ref = `${chapter}:${verse}`
    return interactiveWordRanges(mapping.verses[ref].targetText, graph.primary.get(ref), {
      translationId: 'LSV', book: 'Colossians', chapter, verse,
      lookupLinks: graph.lookupPrimary.get(ref), unpairedNotes: graph.primaryNotes.get(ref),
      sourceReferences: graph.primarySourceReferences.get(ref),
    })
  } }
}

// Explicit occurrence counts prevent a later same-spelled word from silently
// replacing the intended article/date, third in, or third of regression.
it.each([
  [1, 1, 'Jesus', 0, 1, 3, [3], '2424'],
  [1, 1, 'Christ', 0, 1, 2, [2], '5547'],
  [1, 6, 'which', 0, 2, 0, [0], '3588'],
  [1, 6, 'day', 0, 1, 20, [20], '2250'],
  [1, 6, 'which', 1, 2, 19, [19], '3739'],
  [1, 9, 'day', 0, 1, 6, [6], '2250'],
  [1, 9, 'which', 0, 1, 5, [5], '3739'],
  [1, 10, 'pleasing', 0, 1, 6, [4, 5, 6], '699'],
  [1, 10, 'in', 0, 3, 4, [4, 5, 6], '1519'],
  [2, 8, 'will', 0, 1, 4, [4, 5, 6], '1510'],
  [2, 16, 'in', 2, 3, 11, [11, 12], '1722'],
  [2, 23, 'of', 2, 3, 14, [14, 15], '1722'],
])('LSV Colossians %i:%i %s retains its real first lemma, alternatives and physical Original words',
  (chapter, verse, text, occurrence, count, head, indices, strong) => {
    const f = fixture(chapter), matches = f.words(verse).filter(word => word.word === text)
    expect(matches).toHaveLength(count)
    const word = matches[occurrence], ref = `${chapter}:${verse}`, rows = raw[ref]
    expect(word.paired).toBe(true)
    const ids = greekLemmaIds(concordance, word)
    expect(ids[0]).toBe(rows[head][2])
    expect(concordance.lemmas[ids[0]].strongs).toEqual([strong])
    const selected = word.studySourceAnchors.flatMap(anchor => {
      expect([anchor.chapter, anchor.verse]).toEqual([chapter, verse])
      return rows.filter(([start, end]) => start < anchor.endOffset && end > anchor.startOffset)
    })
    expect(selected).toEqual(indices.map(index => rows[index]))
    expect(new Set(ids)).toEqual(new Set(selected.map(row => row[2])))
    const sourceText = sourceBook.chapters.find(c => c.number === chapter).verses.find(v => v.number === verse).text
    const original = interactiveWordRanges(sourceText, f.graph.secondary.get(ref), {
      translationId: 'ORIGINAL', book: 'Colossians', chapter, verse,
    })
    for (const [start, end, id] of selected) {
      const physical = original.filter(w => w.startOffset >= start && w.endOffset <= end)
      expect(physical).toHaveLength(1)
      expect(physical[0].word).toBe(sourceText.slice(start, end).replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, ''))
      // English head preferences cannot change an Original word's own lemma.
      expect(greekLemmaIds(concordance, { ...physical[0], studyHeadAnchors: word.studyHeadAnchors })).toEqual([id])
    }
  })

it('pleasing and in change the first dictionary choice without splitting their real source phrase or visual match', () => {
  const words = fixture(1).words(10)
  const pleasing = words.find(word => word.word === 'pleasing')
  const inside = words.filter(word => word.word === 'in')[0]
  for (const key of ['id', 'color', 'texture', 'pattern', 'studySourceAnchors']) expect(pleasing[key]).toEqual(inside[key])
  expect(greekLemmaIds(concordance, pleasing)[0]).not.toBe(greekLemmaIds(concordance, inside)[0])
  expect(new Set(greekLemmaIds(concordance, pleasing))).toEqual(new Set(greekLemmaIds(concordance, inside)))
})
