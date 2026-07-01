import { describe, expect, it } from 'vitest'
import { extractBookFootnotes, parseBibleRefFromFootnote } from './bookFootnotes'

describe('extractBookFootnotes', () => {
  it('extracts numbered footnote blocks', () => {
    const raw = [
      'Body paragraph.',
      '',
      '[1] First footnote line',
      'continued on next line.',
      '',
      '[2] Second footnote.',
    ].join('\n')

    expect(extractBookFootnotes(raw)).toEqual({
      1: 'First footnote line continued on next line.',
      2: 'Second footnote.',
    })
  })

  it('returns an empty object when no footnotes exist', () => {
    expect(extractBookFootnotes('Plain text only.')).toEqual({})
  })
})

describe('parseBibleRefFromFootnote', () => {
  it('parses Gutenberg-style references with roman numerals', () => {
    expect(parseBibleRefFromFootnote('Luke i. 33.')).toEqual({
      book: 'Luke',
      chapter: 1,
      verse: 33,
    })
  })

  it('parses abbreviated book names with arabic chapter numbers', () => {
    expect(parseBibleRefFromFootnote('1 Cor. xiii. 12.')).toEqual({
      book: '1 Corinthians',
      chapter: 13,
      verse: 12,
    })
  })

  it('returns null for non-reference footnotes', () => {
    expect(parseBibleRefFromFootnote('See also the introduction.')).toBeNull()
  })
})
