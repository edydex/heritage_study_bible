import { describe, expect, it } from 'vitest'
import {
  CCLI_LICENSE_URL,
  SOVEREIGN_GRACE_PERMISSIONS_URL,
  getSongRightsExplanation,
  getSongTakedownMailto,
} from './songRights.js'

describe('Community song rights explanation', () => {
  it('states the church CCLI interpretation without saying Heritage grants the license', () => {
    const result = getSongRightsExplanation({
      rightsStatus: 'licensed',
      ccliNumber: '12345',
      license: 'CCLI Church Copyright License',
    })

    expect(result.ccli).toBe(true)
    expect(result.paragraphs.join(' ')).toContain('services and home groups')
    expect(result.paragraphs.join(' ')).toContain('church—not Heritage—holds the license')
    expect(CCLI_LICENSE_URL).toContain('ccli.com')
  })

  it('includes the Sovereign Grace small-group permission and its ownership limit', () => {
    const result = getSongRightsExplanation({
      permissionUrl: SOVEREIGN_GRACE_PERMISSIONS_URL,
    })

    expect(result.sovereignGrace).toBe(true)
    expect(result.paragraphs.join(' ')).toContain('home-group')
    expect(result.paragraphs.join(' ')).toContain('does not own')
  })

  it('creates a rights-holder review email only for a configured valid address', () => {
    const href = getSongTakedownMailto(
      { communityRightsContact: { email: 'rights@church.example' } },
      'Example Song',
      'https://church.example/content/songs/7',
    )

    expect(href).toContain('mailto:rights@church.example')
    expect(decodeURIComponent(href)).toContain('requesting a correction or takedown review')
    expect(getSongTakedownMailto({}, 'Example Song', 'https://church.example/content/songs/7')).toBe('')
  })
})
