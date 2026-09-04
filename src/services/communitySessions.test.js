import { beforeEach, describe, expect, it } from 'vitest'
import {
  COMMUNITY_SESSIONS_KEY,
  getCommunitySession,
  getCommunitySessions,
  saveCommunitySession,
} from './communitySessions.js'

const originalCommunity = {
  manifest: {
    id: 'shared-community-id',
    apiBaseUrl: 'https://community.example/api',
  },
}

const substitutedCommunity = {
  manifest: {
    id: 'shared-community-id',
    apiBaseUrl: 'https://attacker.example/api',
  },
}

describe('Community session issuer binding', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('keeps browser session secrets out of local storage and exportable state', async () => {
    await saveCommunitySession('shared-community-id', { token: 'session-secret' }, originalCommunity)

    expect(localStorage.getItem(COMMUNITY_SESSIONS_KEY)).toBeNull()
    expect(JSON.parse(sessionStorage.getItem(COMMUNITY_SESSIONS_KEY))).toEqual({
      'shared-community-id': {
        token: 'session-secret',
        issuerOrigin: 'https://community.example',
      },
    })
  })

  it('does not release, overwrite, or remove a token through a same-id manifest from another issuer', async () => {
    await saveCommunitySession('shared-community-id', { token: 'original-secret' }, originalCommunity)

    await expect(getCommunitySession('shared-community-id', substitutedCommunity)).resolves.toBeNull()
    await expect(saveCommunitySession(
      'shared-community-id',
      { token: 'attacker-secret' },
      substitutedCommunity,
    )).rejects.toThrow(/bound to a different server/i)

    await saveCommunitySession('shared-community-id', null, substitutedCommunity)
    await expect(getCommunitySession('shared-community-id', originalCommunity)).resolves.toMatchObject({
      token: 'original-secret',
      issuerOrigin: 'https://community.example',
    })
  })

  it('moves an issuer-bound local fallback into secure browser storage once', async () => {
    localStorage.setItem(COMMUNITY_SESSIONS_KEY, JSON.stringify({
      'shared-community-id': {
        token: 'legacy-secret',
        issuerOrigin: 'https://community.example',
      },
    }))

    await expect(getCommunitySession('shared-community-id', originalCommunity)).resolves.toMatchObject({
      token: 'legacy-secret',
    })
    expect(localStorage.getItem(COMMUNITY_SESSIONS_KEY)).toBeNull()
    expect((await getCommunitySessions())['shared-community-id'].token).toBe('legacy-secret')
  })

  it('does not release an older unbound token to a manifest chosen later', async () => {
    localStorage.setItem(COMMUNITY_SESSIONS_KEY, JSON.stringify({
      'shared-community-id': { token: 'unbound-legacy-secret' },
    }))

    await expect(getCommunitySession('shared-community-id', originalCommunity)).resolves.toBeNull()
    await expect(getCommunitySession('shared-community-id', substitutedCommunity)).resolves.toBeNull()
    expect(localStorage.getItem(COMMUNITY_SESSIONS_KEY)).toBeNull()
  })
})
