import { beforeEach, describe, expect, it } from 'vitest'
import { resolveCommunitySongMemberAccess } from './communitySongAccess.js'

const community = {
  status: 'joined',
  manifest: {
    id: 'church-community', name: 'Example Church',
    apiBaseUrl: 'https://church.example/api',
    contentServerUrl: 'https://church.example/heritage-content.json',
  },
  contentPreview: { manifest: { id: 'church-content' } },
}
const link = { contentServerId: 'church-content', contentUrl: 'https://church.example/content/songs/song-7' }
const sessionKey = 'heritage-community-sessions-v1'
const save = (session) => sessionStorage.setItem(sessionKey, JSON.stringify({ 'church-community': session }))

beforeEach(() => { sessionStorage.clear(); localStorage.clear() })

describe('Community member song access', () => {
  it('loads the asynchronous session bound to the installed Community issuer', async () => {
    save({ token: 'member-secret', issuerOrigin: 'https://church.example' })
    expect(await resolveCommunitySongMemberAccess(link, { communities: [community] })).toEqual({
      status: 'ready', communityName: 'Example Church',
      authorization: 'Community member-secret', authorizationOrigin: 'https://church.example',
    })
  })

  it('never sends a saved token to a different content origin', async () => {
    let reads = 0
    const result = await resolveCommunitySongMemberAccess({ ...link, contentUrl: 'https://other.example/content/songs/song-7' }, {
      communities: [community], getSession: async () => { reads++; return { token: 'member-secret' } },
    })
    expect(result).toEqual({ status: 'origin-mismatch', communityName: 'Example Church' })
    expect(reads).toBe(0)
  })

  it('rejects missing and mismatched session issuers', async () => {
    for (const issuerOrigin of [undefined, 'https://other.example']) {
      save({ token: 'member-secret', issuerOrigin })
      expect(await resolveCommunitySongMemberAccess(link, { communities: [community] })).toEqual({ status: 'sign-in-required', communityName: 'Example Church' })
    }
  })

  it('requires actual membership, not a personal sync account or a saved public church', async () => {
    save({ token: 'member-secret', issuerOrigin: 'https://church.example' })
    for (const status of ['public', 'email-sent', 'sync-only']) {
      expect((await resolveCommunitySongMemberAccess(link, { communities: [{ ...community, status }] })).status).toBe('sign-in-required')
    }
    expect((await resolveCommunitySongMemberAccess(link, { communities: [] })).status).toBe('community-not-installed')
  })

  it('handles an unavailable secure store without releasing a token', async () => {
    expect(await resolveCommunitySongMemberAccess(link, {
      communities: [community], getSession: async () => { throw Error('Locked secure storage') },
    })).toEqual({ status: 'sign-in-required', communityName: 'Example Church' })
  })
})
