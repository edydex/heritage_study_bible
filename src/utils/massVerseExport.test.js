import { describe, expect, it } from 'vitest'
import {
  buildMassExportRows,
  formatMassExportMarkdown,
  formatMassExportPlain,
  parseMassVerseInput,
} from './massVerseExport'
import { sampleBible } from '../test/fixtures/sampleBible'

describe('parseMassVerseInput', () => {
  it('parses a single verse reference', () => {
    const { entries, warnings } = parseMassVerseInput('John 3:16', { bibleData: sampleBible })
    expect(warnings).toEqual([])
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      book: 'John',
      startChapter: 3,
      startVerse: 16,
      endChapter: 3,
      endVerse: 16,
    })
  })

  it('parses comma-separated references', () => {
    const { entries } = parseMassVerseInput('Genesis 1:1, John 3:16', { bibleData: sampleBible })
    expect(entries).toHaveLength(2)
    expect(entries[0].book).toBe('Genesis')
    expect(entries[1].book).toBe('John')
  })

  it('parses a verse range within one chapter', () => {
    const { entries } = parseMassVerseInput('Genesis 1:1-3', { bibleData: sampleBible })
    expect(entries[0].verses).toHaveLength(3)
  })

  it('returns warnings for unknown books', () => {
    const { entries, warnings } = parseMassVerseInput('NotABook 1:1', { bibleData: sampleBible })
    expect(entries).toEqual([])
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('returns empty results for blank input', () => {
    expect(parseMassVerseInput('   ', { bibleData: sampleBible })).toEqual({
      entries: [],
      warnings: [],
    })
  })
})

describe('mass export formatting', () => {
  const parsed = parseMassVerseInput('John 3:16', { bibleData: sampleBible })
  const rows = buildMassExportRows(parsed.entries, ['WEB'], { WEB: sampleBible })

  it('builds rows with translation cells', () => {
    expect(rows).toHaveLength(1)
    expect(rows[0].translationCells.WEB[0]).toContain('For God so loved')
    expect(rows[0].localizedLine).toContain('WEB:')
  })

  it('formats plain text export', () => {
    const plain = formatMassExportPlain(rows, ['WEB'])
    expect(plain).toContain('John 3:16')
    expect(plain).toContain('For God so loved')
  })

  it('formats markdown export', () => {
    const markdown = formatMassExportMarkdown(rows, ['WEB'])
    expect(markdown).toContain('|')
    expect(markdown).toContain('John 3:16')
  })
})
