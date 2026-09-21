import { expect, it } from 'vitest'
import { greekLemmaIds, greekOccurrences, interactiveWordRanges, normalizeWord } from './wordStudy'
import concordance from '../../public/data/original-languages/greek-concordance.json'
import corpus from '../../public/data/original-languages/greek-nt-n1904.json'
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
