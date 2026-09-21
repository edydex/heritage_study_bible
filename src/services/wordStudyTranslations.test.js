import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { expect, it } from 'vitest'
import { occurrenceTranslation, greekLemmaIds, greekOccurrences } from './wordStudy'
import { verseWordLinks, visibleVerseText } from '../data/originalLanguages'
import concordance from '../../public/data/original-languages/greek-concordance.json'
import corpus from '../../public/data/original-languages/greek-nt-n1904.json'
import bsb from '../../public/data/translations/BSB.json'
import index from '../../public/data/original-languages/bsb-word-links/index.json'

const mappings = Object.fromEntries(Object.entries(index.books).map(([name, entry]) => [name, JSON.parse(readFileSync(resolve('public/data/original-languages/bsb-word-links', entry.file)))]))
const english = (book, chapter, verse) => bsb.books.find(b => b.name === book)?.chapters.find(c => c.number === chapter)?.verses.find(v => v.number === verse)?.text
const [servant] = greekLemmaIds(concordance, { book: 'Romans', chapter: 1, verse: 1, translationId: 'BSB', sourceRange: [7, 13] })
const occurrences = greekOccurrences(concordance, corpus, servant)
const occurrence = (book, chapter, verse) => occurrences.find(row => row.book === book && row.chapter === chapter && row.verse === verse)

it('checks every new word mapping against the installed source and BSB, including provenance and file hashes', () => {
  let linked = 0, unlinked = 0, groups = 0
  const errors = []
  expect(Object.keys(index.books)).toHaveLength(27)
  for (const book of corpus.books) {
    const data = mappings[book.name], manifest = index.books[book.name]
    const bytes = readFileSync(resolve('public/data/original-languages/bsb-word-links', manifest.file))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.sha256)
    expect(data.provenance).toEqual(index.provenance)
    expect(Object.keys(data.verses)).toHaveLength(manifest.linkedVerses)
    expect(Object.keys(data.unavailable)).toHaveLength(manifest.unlinkedVerses)
    for (const chapter of book.chapters) for (const verse of chapter.verses) {
      const ref = `${chapter.number}:${verse.number}`
      const text = english(book.name, chapter.number, verse.number) || ''
      const links = verseWordLinks(data, chapter.number, verse.number, verse.text, text)
      if (data.verses[ref]) {
        if (!links || data.unavailable[ref]) errors.push(`${book.name} ${ref}`)
        linked++; groups += links?.target.length || 0
      } else {
        if (!/edition-differs/.test(data.unavailable[ref])) errors.push(`${book.name} ${ref}: no reason`)
        unlinked++
      }
    }
  }
  expect(errors).toEqual([])
  expect({ linked, unlinked, groups }).toEqual({ linked: 6596, unlinked: 1347, groups: 94788 })
})

it('shows contextual translated phrases across books and preserves repeated instances in one verse', () => {
  for (const [book, chapter, verse, phrases] of [
    ['Matthew', 8, 9, ['servant']], ['Romans', 1, 1, ['a servant']],
    ['Romans', 6, 17, ['slaves']], ['Romans', 6, 19, ['in slavery']],
    ['Revelation', 6, 15, ['slave']],
  ]) {
    const row = occurrence(book, chapter, verse)
    const translation = occurrenceTranslation(row, mappings[book], english(book, chapter, verse))
    expect(translation.status).toBe('matched')
    expect(translation.phrases).toEqual(phrases)
    expect(translation.missingCount).toBe(0)
    if (chapter === 6 && verse === 19) expect(translation.ranges).toHaveLength(2)
  }
})

it('shows full context without inventing a match for a differing edition, omitted source word or changed text', () => {
  for (const [book, chapter, verse] of [['Revelation', 1, 1], ['Matthew', 18, 27]]) {
    const row = occurrence(book, chapter, verse)
    const translation = occurrenceTranslation(row, mappings[book], english(book, chapter, verse))
    expect(translation.text).toBe(visibleVerseText(english(book, chapter, verse)))
    expect(translation.phrases).toEqual([])
    expect(translation.status).toBe('unmapped')
    expect(translation.missingCount).toBe(row.count)
  }
  const row = occurrence('Romans', 1, 1)
  expect(occurrenceTranslation(row, mappings.Romans, english('Romans', 1, 1).replace('servant', 'slave')).ranges).toEqual([])
  expect(occurrenceTranslation({ ...row, text: row.text + ' changed' }, mappings.Romans, english('Romans', 1, 1)).ranges).toEqual([])
  expect(occurrenceTranslation(row, mappings.Matthew, english('Romans', 1, 1)).ranges).toEqual([])
})
