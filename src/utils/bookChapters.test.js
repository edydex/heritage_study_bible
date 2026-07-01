import { describe, expect, it } from 'vitest'
import { parseBookChapters, extractChapterNumber } from './bookChapters'

describe('parseBookChapters', () => {
  it('parses chapter markers into grouped paragraphs', () => {
    const raw = [
      'Chapter 1',
      '',
      'First paragraph in chapter one.',
      '',
      'Chapter 2',
      '',
      'Second chapter content.',
    ].join('\n')

    const chapters = parseBookChapters(raw)
    expect(chapters).toHaveLength(2)
    expect(chapters[0].title).toBe('Chapter 1')
    expect(chapters[0].paragraphs).toEqual(['First paragraph in chapter one.'])
    expect(chapters[1].paragraphs).toEqual(['Second chapter content.'])
  })

  it('strips Project Gutenberg boilerplate before parsing', () => {
    const raw = [
      '*** START OF THE PROJECT GUTENBERG EBOOK SAMPLE ***',
      '',
      'Chapter 1',
      '',
      'Body text after boilerplate.',
      '',
      '*** END OF THE PROJECT GUTENBERG EBOOK SAMPLE ***',
    ].join('\n')

    const chapters = parseBookChapters(raw)
    expect(chapters).toHaveLength(1)
    expect(chapters[0].paragraphs[0]).toBe('Body text after boilerplate.')
  })

  it('returns an empty array for blank input', () => {
    expect(parseBookChapters('')).toEqual([])
    expect(parseBookChapters(null)).toEqual([])
  })
})

describe('extractChapterNumber', () => {
  it('extracts chapter numbers from chapter headings', () => {
    expect(extractChapterNumber('BOOK I - Chapter 12')).toBe(12)
  })

  it('extracts numbered section titles', () => {
    expect(extractChapterNumber('BOOK II - 3. On Faith')).toBe(3)
  })

  it('returns null when no chapter number is present', () => {
    expect(extractChapterNumber('Introduction')).toBeNull()
  })
})
