import { describe, expect, it } from 'vitest'
import { HERITAGE_BUILT_IN_SONGS } from './builtInSongs'
import { PUBLIC_DOMAIN_HYMN_TEXTS } from './publicDomainHymns.generated'

describe('Heritage built-in songs', () => {
  it('keeps only verified public-domain hymn texts in the universal offline library', () => {
    expect(HERITAGE_BUILT_IN_SONGS.map(song => song.id)).toEqual([
      'amazing-grace',
      'jesus-paid-it-all',
      'be-thou-my-vision',
      'before-the-throne',
      'come-thou-fount',
      'fairest-lord-jesus',
      'give-me-jesus',
      'he-will-hold-me-fast',
      'i-know-my-redeemer-lives',
      'i-surrender-all',
      'it-is-well',
      'just-as-i-am',
      'nothing-but-the-blood',
      'o-come-all-ye-faithful',
      'o-come-o-come-emmanuel',
      'o-my-soul-arise',
      'rock-of-ages',
      'turn-your-eyes',
      'what-a-friend',
    ])
    expect(HERITAGE_BUILT_IN_SONGS.every(song => song.rightsStatus === 'public-domain-text')).toBe(true)
    expect(HERITAGE_BUILT_IN_SONGS.every(song => song.sections.length > 0)).toBe(true)
  })

  it('separates the public-domain Before the Throne text from its modern tune', () => {
    const song = HERITAGE_BUILT_IN_SONGS.find(item => item.id === 'before-the-throne')
    expect(song.rightsStatus).toBe('public-domain-text')
    expect(song.rightsLabel).toContain('1863 English words: public domain')
    expect(song.rightsLabel).toContain('Vikki Cook tune')
    expect(song.sections).toHaveLength(3)
    expect(song.russianSections).toEqual([])
  })

  it('keeps mechanically imported public-domain text split into clean sections', () => {
    expect(Object.keys(PUBLIC_DOMAIN_HYMN_TEXTS)).toEqual([
      'fairest-lord-jesus',
      'i-surrender-all',
      'nothing-but-the-blood',
      'rock-of-ages',
      'what-a-friend',
      'before-the-throne',
      'come-thou-fount',
      'give-me-jesus',
      'he-will-hold-me-fast',
      'i-know-my-redeemer-lives',
      'it-is-well',
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

  it('exposes only established Russian texts with provenance', () => {
    const publicDomainSongs = HERITAGE_BUILT_IN_SONGS
      .filter(song => song.rightsStatus === 'public-domain-text')
    const englishFallbackIds = publicDomainSongs
      .filter(song => !(song.sections?.length || song.stanzas?.length))
      .map(song => song.id)
    const russianSongIds = publicDomainSongs
      .filter(song => song.russianSections?.length || song.russianStanzas?.length)
      .map(song => song.id)

    expect(publicDomainSongs).toHaveLength(19)
    expect(englishFallbackIds).toEqual([])
    expect(russianSongIds).toEqual([
      'amazing-grace',
      'jesus-paid-it-all',
      'come-thou-fount',
      'i-surrender-all',
      'it-is-well',
      'just-as-i-am',
      'nothing-but-the-blood',
      'o-come-o-come-emmanuel',
      'rock-of-ages',
      'turn-your-eyes',
      'what-a-friend',
    ])
    expect(publicDomainSongs
      .filter(song => song.russianSections.length)
      .every(song => song.russianSourceLabel && song.russianRightsLabel)).toBe(true)
    expect(publicDomainSongs
      .flatMap(song => [song.russianRightsLabel, song.russianSourceLabel])
      .join(' ')
      .toLowerCase()).not.toContain('heritage translation')
    expect(publicDomainSongs
      .flatMap(song => [song.russianRightsLabel, song.russianSourceLabel])
      .join(' ')
      .toLowerCase()).not.toContain('draft')
    expect(publicDomainSongs.every(song => song.sourceUrl)).toBe(true)
  })
})
