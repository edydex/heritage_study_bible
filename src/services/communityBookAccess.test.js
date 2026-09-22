import { describe, it, expect } from 'vitest'
import { resolveCommunityBookAccess } from './communityBookAccess'
const record = {
  status: 'joined',
  manifest: {
    id: 'wotbc',
    contentServerUrl: 'https://church.example/heritage-content.json',
  },
  contentPreview: { manifest: { id: 'church' } },
}
const request = {
  contentServerId: 'church',
  contentUrl: 'https://church.example/content/books/1',
}
describe('private Community book credential scope', () => {
  it('sends the current member token only to the pinned book origin and exact route', async () => {
    let reads = 0
    const deps = {
      communities: [record],
      getSession: async () => {
        reads++
        return { token: 'test-member-token' }
      },
    }
    expect(await resolveCommunityBookAccess(request, deps)).toEqual({
      status: 'ready',
      authorization: 'Community test-member-token',
      authorizationOrigin: 'https://church.example',
    })
    for (const contentUrl of [
      'https://other.example/content/books/1',
      'https://church.example/content/books/1?redirect=1',
      'https://church.example/other',
      'https://user:pass@church.example/content/books/1',
    ])
      expect(
        (await resolveCommunityBookAccess({ ...request, contentUrl }, deps))
          .status,
      ).toBe('origin-mismatch')
    expect(reads).toBe(1)
  })
  it('requires a current joined session and rejects invalid header values', async () => {
    for (const token of ['', null, 'bad\r\nheader'])
      expect(
        (
          await resolveCommunityBookAccess(request, {
            communities: [record],
            getSession: async () => ({ token }),
          })
        ).status,
      ).toBe('sign-in-required')
    expect(
      (
        await resolveCommunityBookAccess(request, {
          communities: [{ ...record, status: 'left' }],
          getSession: async () => ({ token: 'old' }),
        })
      ).status,
    ).toBe('sign-in-required')
  })
})
