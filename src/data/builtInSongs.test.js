import { describe, expect, it } from 'vitest'
import { HERITAGE_BUILT_IN_SONGS } from './builtInSongs'

describe('Heritage built-in songs', () => {
  it('keeps the seven requested original Heritage listings available offline', () => {
    expect(HERITAGE_BUILT_IN_SONGS.map(song => song.id)).toEqual([
      'amazing-grace',
      'as-the-deer',
      'before-the-throne',
      'how-great-thou-art',
      'it-is-well',
      'just-as-i-am',
      'rock-of-ages',
    ])
  })

  it('does not bundle words for the two copyrighted built-in listings', () => {
    for (const id of ['as-the-deer', 'how-great-thou-art']) {
      const song = HERITAGE_BUILT_IN_SONGS.find(item => item.id === id)
      expect(song.rightsStatus).toBe('metadata-only')
      expect(song.stanzas).toEqual([])
    }
  })
})
