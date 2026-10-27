import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { hebrewLemmaIds, hebrewOccurrences, interactiveWordRanges } from './wordStudy'
import concordance from '../../public/data/original-languages/hebrew-concordance.json'
import sourceIndex from '../../public/data/original-languages/hebrew/index.json'

it('indexes every written OT word against the exact installed source, including Psalm headings and mapped boundaries', () => {
  expect(concordance.revision).toBe(sourceIndex.source.revision)
  expect(concordance.sourceFiles).toEqual(sourceIndex.source.files)
  let words = 0, verses = 0, headings = 0
  const errors = []
  for (const meta of sourceIndex.books) {
    const source = JSON.parse(readFileSync(`public/data/original-languages/hebrew/${meta.file}`, 'utf8')).books[0]
    const entries = concordance.books.find(book => book.name === meta.name).verses
    for (const chapter of source.chapters) {
      const rows = [...chapter.verses, ...(chapter.superscription ? [{ number: 0, ...chapter.superscription }] : [])]
      for (const verse of rows) {
        const ref = `${chapter.number}:${verse.number}`, entry = entries[ref]
        if (entry?.text !== verse.text || JSON.stringify(entry?.sourceRefs) !== JSON.stringify(verse.sourceRefs)) errors.push(`${meta.name} ${ref}: source text`)
        if (verse.number === 0) headings++; else verses++
        let previous = 0
        for (const [start, end, ids] of entry.words) {
          if (start < previous || end <= start || end > entry.text.length || !ids.length || ids.some(id => !concordance.lemmas[id]?.sourceLemma)) errors.push(`${meta.name} ${ref}: ${start}`)
          previous = end; words++
        }
        for (const word of interactiveWordRanges(verse.text, [], { book: meta.name, chapter: chapter.number, verse: verse.number, translationId: 'ORIGINAL' })) {
          if (!hebrewLemmaIds(concordance, word).length) errors.push(`${meta.name} ${ref}: unindexed ${word.word}`)
        }
      }
    }
  }
  expect(errors).toEqual([])
  expect({ words, verses, headings }).toEqual({ words: 305507, verses: 23144, headings: 63 })
  expect(concordance.lemmas).toHaveLength(9521)
  expect(concordance.books.find(book => book.name === 'Nehemiah').verses['7:68']).toBeUndefined()
})

it('finds inflected and prefixed forms across OT books without conflating source homographs or reading alternatives', () => {
  const entry = concordance.books[0].verses['1:1']
  const word = interactiveWordRanges(entry.text, [], { book: 'Genesis', chapter: 1, verse: 1, translationId: 'ORIGINAL' })[1]
  const [id] = hebrewLemmaIds(concordance, word)
  expect(concordance.lemmas[id]).toMatchObject({ sourceLemma: '1254 a', language: 'he', strongs: ['1254'] })
  const rows = hebrewOccurrences(concordance, id)
  expect(rows.some(row => row.book === 'Isaiah')).toBe(true)
  expect(rows.some(row => row.book === 'Psalms')).toBe(true)
  expect(rows.flatMap(row => row.ranges.map(([start, end]) => row.text.slice(start, end))).some(text => text.startsWith('וּ'))).toBe(true)
  expect(hebrewLemmaIds(concordance, { ...word, word: 'changed source text' })).toEqual([])
  expect(hebrewLemmaIds(concordance, { ...word, translationId: 'LSV' })).toEqual([])
  const written = concordance.books.find(book => book.name === 'Daniel').verses['1:4']
  expect(written.text).toContain('מאום')
  expect(written.text).not.toContain('מוּם֩')
})

it('retains Hebrew and Aramaic language identity within a mixed verse', () => {
  const entry = concordance.books.find(book => book.name === 'Daniel').verses['2:4']
  const words = interactiveWordRanges(entry.text, [], { book: 'Daniel', chapter: 2, verse: 4, translationId: 'ORIGINAL' })
  const king = words.filter(word => /מ.*ל.*[כך]/.test(word.word))
  const identities = king.map(word => hebrewLemmaIds(concordance, word).map(id => concordance.lemmas[id]))
  expect(identities.flat().map(item => [item.language, item.sourceLemma])).toEqual([['he', '4428'], ['arc', '4430']])
})
