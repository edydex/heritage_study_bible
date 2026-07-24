import { describe, expect, it } from 'vitest'
import {
  buildCommunitySongShareUrl,
  communitySongItemFromUrl,
  normalizeCommunitySongContentUrl,
} from './communitySongLinks.js'

describe('unlisted Community song links', () => {
  it('accepts only exact HTTP song-document paths without embedded credentials', () => {
    expect(normalizeCommunitySongContentUrl('https://church.example/content/songs/42')).toBe(
      'https://church.example/content/songs/42',
    )
    expect(normalizeCommunitySongContentUrl('https://user:pass@church.example/content/songs/42')).toBe('')
    expect(normalizeCommunitySongContentUrl('javascript:alert(1)')).toBe('')
    expect(normalizeCommunitySongContentUrl('https://church.example/catalogs/songs')).toBe('')
  })

  it('builds a production Heritage link without exposing a catalog or membership token', () => {
    expect(buildCommunitySongShareUrl('https://church.example/content/songs/song-7')).toBe(
      'https://heritage.faith/#/community-song?url=https%3A%2F%2Fchurch.example%2Fcontent%2Fsongs%2Fsong-7',
    )
  })

  it('creates a minimal non-discoverable viewer item from an exact song URL', () => {
    expect(communitySongItemFromUrl('https://church.example/content/songs/7')).toMatchObject({
      title: 'Community song',
      contentType: 'songs',
      sourceServerName: 'church.example',
      content: { url: 'https://church.example/content/songs/7' },
    })
  })
})
