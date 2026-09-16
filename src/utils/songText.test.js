import { describe, expect, it } from 'vitest'
import { normalizeSongSections, parseSongLyrics } from '../../community-server/packages/song-text/index.js'

describe('song presentation marks in the reading view', () => {
  it('turns numbered cues into verses and slide dividers into paragraph breaks', () => {
    const raw = '^1\r\nFirst line\r\nSecond line\r\n----\r\nNext paragraph\r\n\r\n^2\r\nSecond verse'
    expect(parseSongLyrics(raw)).toEqual([
      { label: 'Verse 1', lines: ['First line', 'Second line', '', 'Next paragraph'] },
      { label: 'Verse 2', lines: ['Second verse'] },
    ])
    expect(raw).toContain('----')
  })
  it('preserves real lyric punctuation and words, while hiding standalone cues', () => {
    expect(parseSongLyrics('^x\nKeep ^this and a---b\n\n^c\nRefrain')).toEqual([
      { label: 'Verse 1', lines: ['Keep ^this and a---b'] },
      { label: 'Chorus', lines: ['Refrain'] },
    ])
    expect(parseSongLyrics('^2\nРусский текст\n---\nЕщё строка', { language: 'ru' })[0]).toEqual({ label: 'Куплет 2', lines: ['Русский текст', '', 'Ещё строка'] })
  })
  it('cleans cached structured sections without changing their source document', () => {
    const input = [{ label: 'Section 1', lines: ['^1', 'Words', '---', 'More'] }, { label: 'Section 2', lines: [{ text: 'Another verse' }] }]
    expect(normalizeSongSections(input)).toEqual([{ label: 'Verse 1', lines: ['Words', '', 'More'] }, { label: 'Verse 2', lines: ['Another verse'] }])
    expect(input[0].lines[0]).toBe('^1')
    expect(parseSongLyrics('^1\n---\n\n^2')).toEqual([])
  })
})
