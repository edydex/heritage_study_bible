import { describe, expect, it } from 'vitest'
import { resolveCommunitySongMemberAccess } from './communitySongAccess.js'

const community = {
  status: 'joined',
  manifest: {
    id: 'church-community',
    name: 'Example Church',
    contentServerUrl: 'https://church.example/heritage-content.json',
  },
  contentPreview: { manifest: { id: 'church-content' } },
}

describe('Community member song access', () => {
  it('returns a member header only for the installed Community and exact content origin', () => {
    expect(resolveCommunitySongMemberAccess({
      contentServerId: 'church-content',
      contentUrl: 'https://church.example/content/songs/song-7',
    }, {
      communities: [community],
      sessions: { 'church-community': { token: 'member-secret' } },
    })).toEqual({
      status: 'ready',
      communityName: 'Example Church',
      authorization: 'Community member-secret',
      authorizationOrigin: 'https://church.example',
    })
  })

  it('never releases a member header to a different origin', () => {
    const result = resolveCommunitySongMemberAccess({
      contentServerId: 'church-content',
      contentUrl: 'https://attacker.example/content/songs/song-7',
    }, {
      communities: [community],
      sessions: { 'church-community': { token: 'member-secret' } },
    })
    expect(result).toEqual({ status: 'origin-mismatch', communityName: 'Example Church' })
    expect(JSON.stringify(result)).not.toContain('member-secret')
  })

  it('distinguishes a missing Community from a Community that needs sign-in', () => {
    const link = {
      contentServerId: 'church-content',
      contentUrl: 'https://church.example/content/songs/song-7',
    }
    expect(resolveCommunitySongMemberAccess(link, {
      communities: [],
      sessions: {},
    }).status).toBe('community-not-installed')
    expect(resolveCommunitySongMemberAccess(link, {
      communities: [community],
      sessions: {},
    })).toEqual({ status: 'sign-in-required', communityName: 'Example Church' })
    expect(resolveCommunitySongMemberAccess(link, {
      communities: [{ ...community, status: 'email-sent' }],
      sessions: { 'church-community': { token: 'member-secret' } },
    })).toEqual({ status: 'sign-in-required', communityName: 'Example Church' })
  })
})
