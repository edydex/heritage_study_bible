import { withPsalmSuperscriptionVerse } from '../utils/psalmSuperscriptions'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { hebrewOriginalBooks, originalSourceForBook, originalVerseLanguage } from './originalLanguages'
const index = JSON.parse(readFileSync('public/data/original-languages/hebrew/index.json', 'utf8'))
const book = name => JSON.parse(readFileSync(`public/data/original-languages/hebrew/${hebrewOriginalBooks[name]}`, 'utf8')).books[0]
const verse = (name, chapter, number) => book(name).chapters.find(c => c.number === chapter).verses.find(v => v.number === number)
describe('named Hebrew and Aramaic witness', () => {
  it('contains all 39 source books with verified hashes and canonical BSB reference coverage', () => {
    expect(index.books).toHaveLength(39)
    expect(index.counts.sourceWords).toBe(305507)
    expect(index.missing).toEqual(['Neh.7.68'])
    let verses = 0
    for (const entry of index.books) {
      const bytes = readFileSync(`public/data/original-languages/hebrew/${entry.file}`)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256)
      const data = JSON.parse(bytes).books[0]
      const bsb = JSON.parse(readFileSync(`public/data/translations/BSB/${entry.file}`, 'utf8'))
      expect(data.name).toBe(entry.name)
      expect(data.chapters).toHaveLength(bsb.chapters.length)
      for (const chapter of data.chapters) {
        const expected = bsb.chapters.find(c => c.number === chapter.number).verses.map(v => v.number)
        const actual = chapter.verses.map(v => v.number)
        expect(actual).toEqual(entry.name === 'Nehemiah' && chapter.number === 7 ? expected.filter(n => n !== 68) : expected)
        for (const row of chapter.verses) {
          expect(row.direction).toBe('rtl'); expect(row.text).toMatch(/[\u05d0-\u05ea]/)
          expect(row.text).not.toContain('/'); expect(row.sourceRefs.length).toBeGreaterThan(0)
          expect(row.languages.every(code => ['he', 'arc'].includes(code))).toBe(true)
          verses++
        }
      }
    }
    expect(verses).toBe(23144)
  })
  it('keeps Hebrew/Aramaic boundaries and the written/read traditions separate', () => {
    expect(originalVerseLanguage(verse('Daniel', 2, 3))).toBe('Hebrew')
    expect(verse('Daniel', 2, 4).languages).toEqual(['arc', 'he'])
    expect(originalVerseLanguage(verse('Daniel', 2, 5))).toBe('Aramaic')
    expect(originalVerseLanguage(verse('Jeremiah', 10, 11))).toBe('Aramaic')
    expect(verse('Genesis', 31, 47).languages).toEqual(['arc', 'he'])
    const written = verse('Daniel', 1, 4)
    expect(written.text).toContain('מאום')
    expect(written.variants.some(item => item.written.includes('מאום') && item.reading.includes('מוּם'))).toBe(true)
    expect(written.text).not.toContain('מוּם֩')
  })
  it('maps reviewed verse boundaries without dropping titles or borrowing a missing witness verse', () => {
    expect(verse('Genesis', 31, 55).sourceRefs).toEqual(['Gen.32.1'])
    expect(verse('1 Kings', 18, 33).sourceRefs).toEqual(['1Kgs.18.33'])
    expect(verse('1 Kings', 18, 34).sourceRefs).toEqual(['1Kgs.18.34'])
    expect(verse('1 Kings', 22, 43).sourceRefs).toEqual(['1Kgs.22.43', '1Kgs.22.44'])
    expect(verse('Isaiah', 63, 19).text).toContain('עֲלֵיהֶ֑ם')
    expect(verse('Isaiah', 64, 1).text.startsWith('לוּא־')).toBe(true)
    expect(verse('Psalms', 13, 5).sourceRefs).toEqual(['Ps.13.6a'])
    expect(verse('Psalms', 13, 6).sourceRefs).toEqual(['Ps.13.6b'])
    expect(withPsalmSuperscriptionVerse(book('Psalms').chapters[50], 'Psalms', 'ORIGINAL')).toBeDefined()
    expect(withPsalmSuperscriptionVerse(book('Psalms').chapters[50], 'Psalms', 'ORIGINAL').verses[0].number).toBe(1)
    expect(book('Psalms').chapters[50].superscription.sourceRefs).toEqual(['Ps.51.1', 'Ps.51.2'])
    expect(verse('Psalms', 51, 1).sourceRefs).toEqual(['Ps.51.3'])
    expect(verse('Nehemiah', 7, 68)).toBeUndefined()
    expect(originalSourceForBook('Romans').id).toBe('N1904')
    expect(originalSourceForBook('Daniel').id).toBe('WLC-OSHB')
    expect(originalVerseLanguage(undefined)).toBe('Hebrew / Aramaic')
  })
})
