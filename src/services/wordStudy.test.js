import { expect, it } from 'vitest'
import { greekLemmaIds, greekOccurrences, interactiveWordRanges, normalizeWord } from './wordStudy'
import concordance from '../../public/data/original-languages/greek-concordance.json'
import corpus from '../../public/data/original-languages/greek-nt-n1904.json'
import philemonBsb from '../../public/data/original-languages/bsb-word-links/philemon.json'
import colossiansLsv from '../../public/data/original-languages/lsv-word-links/colossians.json'
import johnLsv from '../../public/data/original-languages/lsv-word-links/john.json'
import secondPeterLsv from '../../public/data/original-languages/lsv-word-links/2-peter.json'
import secondJohnBsb from '../../public/data/original-languages/bsb-word-links/2-john.json'
import secondJohnKjv from '../../public/data/original-languages/kjv-word-links/2-john.json'
import firstJohnBsb from '../../public/data/original-languages/bsb-word-links/1-john.json'
import ephesiansBsb from '../../public/data/original-languages/bsb-word-links/ephesians.json'
import hebrewsLsv from '../../public/data/original-languages/lsv-word-links/hebrews.json'
import firstThessaloniansKjv from '../../public/data/original-languages/kjv-word-links/1-thessalonians.json'
import lsv from '../../public/data/translations/LSV.json'
import bsb from '../../public/data/translations/BSB.json'
import kjv from '../../public/data/translations/KJV.json'
import { verseWordLinks } from '../data/originalLanguages'
import { chapterWordAnchors } from './parallelWordAnchors'
it('keeps every lemma range within the corresponding source verse', () => {
  let count = 0
  const errors = []
  for (const book of concordance.books) {
    const source = corpus.books.find(value => value.name === book.name)
    for (const [ref, words] of Object.entries(book.verses)) {
      const [ch, v] = ref.split(':').map(Number)
      const text = source.chapters.find(value => value.number === ch).verses.find(value => value.number === v).text
      let end = -1
      for (const [start, stop, lemma] of words) {
        if (start <= end || stop > text.length || !text.slice(start, stop).trim() || !concordance.lemmas[lemma]?.lemma) errors.push(`${book.name} ${ref}:${start}`)
        end = stop; count++
      }
    }
  }
  expect(errors).toEqual([])
  expect(count).toBe(137779)
})
it('finds inflected Greek occurrences of the actual lemma for an English correspondence', () => {
  const word = { book: 'Romans', chapter: 1, verse: 1, translationId: 'BSB', sourceRange: [7, 13] }
  const [id] = greekLemmaIds(concordance, word)
  expect(concordance.lemmas[id].lemma).toBe('δοῦλος (II)')
  const occurrences = greekOccurrences(concordance, corpus, id)
  expect(occurrences.some(row => row.book === 'Romans' && row.chapter === 6 && row.verse === 17)).toBe(true)
  expect(occurrences.some(row => row.book === 'Matthew')).toBe(true)
})
it('retains exact visible offsets and never invents an unpaired word match', () => {
  const words = interactiveWordRanges('¶<b>For</b> God || loved', [{ id: 'x', pattern: 1, startOffset: 4, endOffset: 7, label: 'God', sourceRange: [0, 4] }])
  expect(words.map(row => [row.word, row.startOffset, row.paired])).toEqual([['For', 0, false], ['God', 4, true], ['loved', 8, false]])
  expect(normalizeWord('θεοῦ')).toBe(normalizeWord('Θεοῦ'))
})
it('distinguishes Assos and the possessive his from lookalike adverbs at their exact occurrences', () => {
  const lemmaAt = (book, ref, token) => concordance.lemmas[concordance.books.find(row => row.name === book).verses[ref][token][2]]
  expect(lemmaAt('Acts', '20:13', 9).strongs).toContain('789')
  expect(lemmaAt('Acts', '20:14', 6).strongs).toContain('789')
  expect(lemmaAt('John', '11:32', 11).strongs).toContain('846')
  const nearer = concordance.books.find(row => row.name === 'Acts').verses['27:13']
  expect(nearer.some(([, , id]) => concordance.lemmas[id].strongs.includes('788'))).toBe(true)
  expect(concordance.metadataCorrections).toHaveLength(3)
  expect(concordance.metadataCorrections.every(row => row.original.lemma && row.corrected.lemma && row.evidence.length)).toBe(true)
  expect(concordance.sourceSha256).toBe(corpus.sources[0].sha256)
})
it('opens the personal lemma for Philemon’s ours while retaining the full in-us construction', () => {
  const entry = philemonBsb.verses['1:6']
  const link = verseWordLinks(philemonBsb, 1, 6, entry.sourceText, entry.targetText).target.find(word => entry.targetText.slice(word.startOffset, word.endOffset) === 'ours')
  expect(link).toBeTruthy()
  const ids = greekLemmaIds(concordance, { ...link, translationId: 'BSB', book: 'Philemon', chapter: 1, verse: 6, word: 'ours' })
  expect(concordance.lemmas[ids[0]].strongs).toContain('1473')
  expect(ids.map(id => concordance.lemmas[id].strongs).flat()).toContain('1722')
})

it('opens carrying before its supporting be verb, while keeping explicit be and original-word choices', () => {
  const sourceBook = corpus.books.find(book => book.name === 'Colossians')
  const primaryBook = lsv.books.find(book => book.name === 'Colossians')
  const graph = chapterWordAnchors({ primaryData: colossiansLsv, primaryBook, secondaryData: null, secondaryBook: sourceBook, sourceBook, chapter: 2 })
  expect(graph.invalidReferences).toEqual([])
  const entry = colossiansLsv.verses['2:8']
  const words = interactiveWordRanges(entry.targetText, graph.primary.get('2:8'), {
    translationId: 'LSV', book: 'Colossians', chapter: 2, verse: 8, lookupLinks: graph.lookupPrimary.get('2:8'),
  })
  const carrying = words.find(word => word.word === 'carrying'), be = words.find(word => word.word === 'be')
  expect(carrying.paired).toBe(true)
  expect(be.studySourceAnchors).toEqual(carrying.studySourceAnchors)
  const ids = greekLemmaIds(concordance, carrying), beIds = greekLemmaIds(concordance, be)
  expect(concordance.lemmas[ids[0]].strongs).toContain('4812')
  expect(concordance.lemmas[beIds[0]].strongs).toContain('1510')
  expect(new Set(beIds)).toEqual(new Set(ids))
  expect(ids.flatMap(id => concordance.lemmas[id].strongs).sort()).toEqual(['1510', '3588', '4812'])
  for (const anchor of carrying.studySourceAnchors) {
    const original = { ...anchor, translationId: 'ORIGINAL', book: 'Colossians', word: anchor.text }
    const originalIds = greekLemmaIds(concordance, original)
    expect(originalIds).toHaveLength(1)
    expect(ids).toContain(originalIds[0])
  }
})

it('opens the actual negative for Ephesians no while retaining all and exact original choices', () => {
  const source = concordance.books.find(book => book.name === 'Ephesians').verses['4:29']
  const sourceAnchors = [0, 7].map(index => ({ chapter: 4, verse: 29, startOffset: source[index][0], endOffset: source[index][1] }))
  const word = { translationId: 'BSB', book: 'Ephesians', chapter: 4, verse: 29, word: 'no', sourceAnchors }
  const ids = greekLemmaIds(concordance, word)
  expect(ids.flatMap(id => concordance.lemmas[id].strongs)).toEqual(['3361', '3956'])
  const all = greekLemmaIds(concordance, { ...word, word: 'all' })
  expect(concordance.lemmas[all[0]].strongs).toContain('3956')
  expect(new Set(all)).toEqual(new Set(ids))
  for (const [index, anchor] of sourceAnchors.entries()) {
    expect(greekLemmaIds(concordance, { ...word, ...anchor, translationId: 'ORIGINAL' })).toEqual([source[[0, 7][index]][2]])
  }
  expect(greekLemmaIds(concordance, { ...word, sourceAnchors: sourceAnchors.slice(0, 1) })).toEqual([source[0][2]])
})

it('opens the actual pronoun for Ephesians it while retaining the preposition and Original choices', () => {
  const source = concordance.books.find(book => book.name === 'Ephesians').verses['6:20']
  const sourceAnchors = [6, 7].map(index => ({ chapter: 6, verse: 20, startOffset: source[index][0], endOffset: source[index][1] }))
  const word = { translationId: 'BSB', book: 'Ephesians', chapter: 6, verse: 20, word: 'it', sourceAnchors }
  const ids = greekLemmaIds(concordance, word)
  expect(ids.flatMap(id => concordance.lemmas[id].strongs)).toEqual(['846', '1722'])
  for (const [index, anchor] of sourceAnchors.entries()) {
    expect(greekLemmaIds(concordance, { ...word, ...anchor, translationId: 'ORIGINAL' })).toEqual([source[[6, 7][index]][2]])
  }
  expect(greekLemmaIds(concordance, { ...word, sourceAnchors: sourceAnchors.slice(0, 1) })).toEqual([source[6][2]])
})

it('opens actual content verbs in negative phrases without losing any source or Original choice', () => {
  const sourceBook = corpus.books.find(book => book.name === 'John')
  const graph = chapterWordAnchors({ primaryData: johnLsv, primaryBook: lsv.books.find(book => book.name === 'John'),
    secondaryData: null, secondaryBook: sourceBook, sourceBook, chapter: 4 })
  expect(graph.invalidReferences).toEqual([])
  const cases = [
    [2, 'immersing', 0, [3, 4], '907'], [9, 'dealing', 0, [18, 20], '4798'],
    [14, 'thirst', 0, [11, 12, 13], '1372'], [15, 'thirst', 0, [12, 13], '1372'],
    [17, 'have', 0, [5, 6], '2192'], [17, 'have', 1, [16, 17], '2192'],
    [22, 'known', 0, [3, 4], '1492'], [32, 'known', 0, [10, 11], '1492'],
    [35, 'say', 0, [0, 2], '3004'], [44, 'have', 0, [11, 12], '2192'],
    [48, 'see', 0, [7, 11], '3708'], [48, 'believe', 0, [12, 13, 14], '4100'],
  ]
  const heads = cases.map(([verse, text, occurrence, indices]) => {
    const ref = `4:${verse}`, entry = johnLsv.verses[ref]
    const word = interactiveWordRanges(entry.targetText, graph.primary.get(ref), {
      translationId: 'LSV', book: 'John', chapter: 4, verse, lookupLinks: graph.lookupPrimary.get(ref),
    }).filter(word => word.word === text)[occurrence]
    expect(word?.paired).toBe(true)
    const ids = greekLemmaIds(concordance, word)
    const source = concordance.books.find(book => book.name === 'John').verses[ref]
    expect(word.studySourceAnchors.map(anchor => [anchor.chapter, anchor.verse, anchor.startOffset]))
      .toEqual(indices.map(index => [4, verse, source[index][0]]))
    expect(new Set(ids)).toEqual(new Set(indices.map(index => source[index][2])))
    for (const anchor of word.studySourceAnchors) {
      const actual = source.find(row => row[0] === anchor.startOffset)
      expect(actual).toBeTruthy()
      expect(greekLemmaIds(concordance, { ...anchor, book: 'John', translationId: 'ORIGINAL', word: anchor.text })).toEqual([actual[2]])
    }
    return concordance.lemmas[ids[0]].strongs
  })
  expect(heads).toEqual(cases.map(row => [row[4]]))
})

function actualCheckedWord(mapping, chapter, verse, text, occurrence = 0, count = 1) {
  const entry = mapping.verses[`${chapter}:${verse}`]
  const sourceBook = corpus.books.find(book => book.name === mapping.book)
  const targetBook = { LSV: lsv, BSB: bsb, KJV: kjv }[mapping.targetId].books.find(book => book.name === mapping.book)
  const graph = chapterWordAnchors({ primaryData: mapping, primaryBook: targetBook,
    secondaryData: null, secondaryBook: sourceBook, sourceBook, chapter })
  expect(graph.invalidReferences).toEqual([])
  const ref = `${chapter}:${verse}`
  const selected = interactiveWordRanges(entry.targetText, graph.primary.get(ref), {
    book: mapping.book, chapter, verse, translationId: mapping.targetId,
    lookupLinks: graph.lookupPrimary.get(ref),
  }).filter(word => normalizeWord(word.word) === text)
  expect(selected).toHaveLength(count)
  expect(selected[occurrence].paired).toBe(true)
  return selected[occurrence]
}

it('keeps actual negative entries for never, neither, nor, none and without across translations', () => {
  const cases = [
    [secondPeterLsv, 1, 10, 'never', '3756'],
    [secondJohnBsb, 1, 9, 'without', '3361'],
    [secondJohnKjv, 1, 10, 'neither', '3361'],
    [firstJohnBsb, 2, 19, 'none', '3756'],
    [firstJohnBsb, 3, 10, 'nor', '3361'],
    [ephesiansBsb, 2, 12, 'without', '3361', 0, 2],
    [ephesiansBsb, 2, 12, 'without', '112', 1, 2],
    [hebrewsLsv, 3, 13, 'none', '3361'],
    [firstThessaloniansKjv, 5, 15, 'none', '3361'],
  ]
  for (const [mapping, chapter, verse, text, strong, occurrence, count] of cases) {
    const ids = greekLemmaIds(concordance, actualCheckedWord(mapping, chapter, verse, text, occurrence, count))
    expect(concordance.lemmas[ids[0]].strongs).toContain(strong)
  }
})

it('keeps no and not on their actual negator in the same checked constructions', () => {
  for (const [chapter, verse, text] of [[2, 3, 'no'], [1, 5, 'not']]) {
    const word = actualCheckedWord(johnLsv, chapter, verse, text)
    const ids = greekLemmaIds(concordance, word)
    expect(concordance.lemmas[ids[0]].strongs).toContain('3756')
    expect(ids).toHaveLength(2)
  }
})
