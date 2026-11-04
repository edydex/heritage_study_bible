import { afterEach, expect, it, vi } from 'vitest'
import { loadOccurrenceTranslations, occurrenceKey } from './wordStudy'
import original from '../../public/data/original-languages/greek-nt-n1904.json'
import synodal from '../../public/data/translations/SYNO-W.json'

afterEach(() => vi.unstubAllGlobals())

it('shows installed Synodal context for Greek forms without inventing Russian word links', async () => {
  const fetch = vi.fn(async url => {
    expect(url).toBe('/data/translations/SYNO-W.json')
    return { ok: true, json: async () => synodal }
  })
  vi.stubGlobal('fetch', fetch)
  const rows = [['Romans', 7, 24, 'ῥύσεται'], ['Colossians', 1, 13, 'ἐρύσατο']].map(([book, chapter, verse, word]) => {
    const text = original.books.find(b => b.name === book).chapters.find(c => c.number === chapter).verses.find(v => v.number === verse).text
    const start = text.indexOf(word)
    expect(start).toBeGreaterThanOrEqual(0)
    return { book, chapter, verse, text, count: 1, ranges: [[start, start + word.length]] }
  })
  const result = await loadOccurrenceTranslations(rows, 'N1904', 'SYNO-W')
  expect(result.failed).toBe(false)
  expect(fetch).toHaveBeenCalledTimes(1)
  for (const row of rows) {
    const text = synodal.books.find(b => b.name === row.book).chapters.find(c => c.number === row.chapter).verses.find(v => v.number === row.verse).text
    expect(result.results[occurrenceKey(row)]).toMatchObject({ text, status: 'unmapped', ranges: [], phrases: [], missingCount: 1 })
  }
})
