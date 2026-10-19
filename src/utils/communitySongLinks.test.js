import { describe, expect, it } from 'vitest'
import {
  buildCommunitySongMemberShareUrl,
  communitySongMemberItemFromRoute,
  normalizeCommunitySongMemberContentUrl,
  normalizeCommunitySongPublicBearerUrl,
  parseCommunitySongMemberRoute,
} from './communitySongLinks.js'

describe('Community member song links', () => {
  it('accepts only secure exact song-document paths without URL-carried credentials', () => {
    expect(normalizeCommunitySongMemberContentUrl('https://church.example/content/songs/42')).toBe(
      'https://church.example/content/songs/42',
    )
    expect(normalizeCommunitySongMemberContentUrl('http://127.0.0.1:3410/content/songs/42')).toBe(
      'http://127.0.0.1:3410/content/songs/42',
    )
    expect(normalizeCommunitySongMemberContentUrl('https://user:pass@church.example/content/songs/42')).toBe('')
    expect(normalizeCommunitySongMemberContentUrl('https://church.example/content/songs/42?token=secret')).toBe('')
    expect(normalizeCommunitySongMemberContentUrl('https://church.example/content/songs/42#secret')).toBe('')
    expect(normalizeCommunitySongMemberContentUrl('http://church.example/content/songs/42')).toBe('')
    expect(normalizeCommunitySongMemberContentUrl('javascript:alert(1)')).toBe('')
    expect(normalizeCommunitySongMemberContentUrl('https://church.example/catalogs/songs')).toBe('')
  })

  it('builds an explicitly member-only Heritage route without a membership token', () => {
    expect(buildCommunitySongMemberShareUrl(
      'https://church.example/content/songs/song-7',
      'church-content',
    )).toBe(
      'https://heritage.faith/#/community-song?access=member&server=church-content&url=https%3A%2F%2Fchurch.example%2Fcontent%2Fsongs%2Fsong-7',
    )
    expect(buildCommunitySongMemberShareUrl(
      'https://church.example/content/songs/song-7',
      'church-content',
      'not a URL',
    )).toBe('')
  })

  it('accepts only the exact member route shape and creates a member viewer item', () => {
    const query = 'access=member&server=church-content&url=https%3A%2F%2Fchurch.example%2Fcontent%2Fsongs%2F7'
    expect(parseCommunitySongMemberRoute(query)).toEqual({
      contentServerId: 'church-content',
      contentUrl: 'https://church.example/content/songs/7',
    })
    expect(communitySongMemberItemFromRoute(query)).toMatchObject({
      title: 'Community song',
      contentType: 'songs',
      memberAccessRequired: true,
      sourceServerId: 'church-content',
      sourceServerName: 'church.example',
      content: { url: 'https://church.example/content/songs/7' },
    })
    expect(parseCommunitySongMemberRoute(`${query}&token=secret`)).toBeNull()
    expect(parseCommunitySongMemberRoute(query.replace('access=member', 'access=public'))).toBeNull()
    expect(parseCommunitySongMemberRoute(query.replace('server=church-content', 'server=church-content&server=other'))).toBeNull()
  })

  it('keeps reviewed public bearer links distinct from mutable member documents', () => {
    const bearerId = 'a'.repeat(43)
    const publicUrl = `https://church.example/community/songs/shared/${bearerId}`
    expect(normalizeCommunitySongPublicBearerUrl(publicUrl)).toBe(publicUrl)
    expect(normalizeCommunitySongMemberContentUrl(publicUrl)).toBe('')
    expect(buildCommunitySongMemberShareUrl(publicUrl, 'church-content')).toBe('')
    expect(normalizeCommunitySongPublicBearerUrl(`${publicUrl}?memberToken=secret`)).toBe('')
  })
})
