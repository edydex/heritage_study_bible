import { describe, expect, it } from 'vitest'
import { HERITAGE_BUILT_IN_SONGS } from './builtInSongs'
import { PUBLIC_DOMAIN_HYMN_TEXTS } from './publicDomainHymns.generated'

describe('Heritage built-in songs', () => {
  it('keeps the complete requested song list available offline', () => {
    expect(HERITAGE_BUILT_IN_SONGS).toHaveLength(32)
    expect(HERITAGE_BUILT_IN_SONGS.map(song => song.id)).toEqual(expect.arrayContaining([
      'all-i-have-is-christ',
      'amazing-grace',
      'before-the-throne',
      'come-thou-fount',
      'grace-alone',
      'he-will-hold-me-fast',
      'how-great-thou-art',
      'it-is-well',
      'nothing-but-the-blood',
      'o-come-o-come-emmanuel',
      'ten-thousand-reasons',
    ]))
  })

  it('keeps modern copyrighted songs as metadata while allowing communities to supply a version', () => {
    const song = HERITAGE_BUILT_IN_SONGS.find(item => item.id === 'how-great-thou-art')
    expect(song.rightsStatus).toBe('metadata-only')
    expect(song.sections).toEqual([])
    expect(song.russianRightsLabel).toContain('Community may publish')
  })

  it('separates the public-domain Before the Throne text from its modern tune', () => {
    const song = HERITAGE_BUILT_IN_SONGS.find(item => item.id === 'before-the-throne')
    expect(song.rightsStatus).toBe('public-domain-text')
    expect(song.rightsLabel).toContain('1863 English words: public domain')
    expect(song.rightsLabel).toContain('Vikki Cook tune')
    expect(song.russianStanzas.length).toBeGreaterThan(0)
  })

  it('keeps mechanically imported public-domain text split into clean sections', () => {
    expect(Object.keys(PUBLIC_DOMAIN_HYMN_TEXTS)).toEqual([
      'fairest-lord-jesus',
      'i-surrender-all',
      'nothing-but-the-blood',
      'rock-of-ages',
      'what-a-friend',
      'give-me-jesus',
      'he-will-hold-me-fast',
      'i-know-my-redeemer-lives',
      'just-as-i-am',
      'o-come-all-ye-faithful',
      'o-come-o-come-emmanuel',
      'o-my-soul-arise',
      'turn-your-eyes',
    ])
    expect(PUBLIC_DOMAIN_HYMN_TEXTS['i-surrender-all'].sections.at(-1).label).toBe('Chorus')
    expect(PUBLIC_DOMAIN_HYMN_TEXTS['nothing-but-the-blood'].sections.at(-1).label).toBe('Refrain')
    expect(PUBLIC_DOMAIN_HYMN_TEXTS['rock-of-ages'].sections).toHaveLength(3)
    expect(
      Object.values(PUBLIC_DOMAIN_HYMN_TEXTS)
        .flatMap(song => song.sections)
        .flatMap(songSection => songSection.lines)
        .every(line => line === line.trim() && line.length > 0),
    ).toBe(true)
  })

  it('provides a reviewed source path and a Heritage Russian draft for every public-domain record', () => {
    const publicDomainSongs = HERITAGE_BUILT_IN_SONGS
      .filter(song => song.rightsStatus === 'public-domain-text')
    const englishFallbackIds = publicDomainSongs
      .filter(song => !(song.sections?.length || song.stanzas?.length))
      .map(song => song.id)

    expect(publicDomainSongs).toHaveLength(19)
    expect(englishFallbackIds).toEqual([
      'before-the-throne',
      'come-thou-fount',
      'it-is-well',
    ])
    expect(publicDomainSongs.every(song => (
      song.russianSections?.length || song.russianStanzas?.length
    ))).toBe(true)
    expect(publicDomainSongs.every(song => song.sourceUrl)).toBe(true)
  })
})
