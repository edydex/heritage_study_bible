import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { publicUrl } from './publicConfig'

// One private subscription link for the church's members' calendar. It is
// derived from the server secret and a version number, so nothing is stored;
// raising the version (Reset link) stops every older copy.
function feedKey() {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET is required for calendar links.')
  return createHash('sha256').update(`heritage-calendar-feed:v1:${secret}`).digest()
}

export function memberFeedToken(communityId: number, version: number) {
  return createHmac('sha256', feedKey()).update(`${communityId}:${version}`).digest('base64url')
}

export function memberFeedTokenMatches(token: unknown, communityId: number, version: number) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false
  const expected = Buffer.from(memberFeedToken(communityId, version))
  const actual = Buffer.from(token)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

const webcal = (url: string) => url.replace(/^https?:\/\//, 'webcal://')

export function feedLinks(communityId: number, version: number | null) {
  const publicFeed = `${publicUrl}/api/community/calendar/feed.ics`
  const links: { public: { url: string; webcal: string }; members?: { url: string; webcal: string } } = {
    public: { url: publicFeed, webcal: webcal(publicFeed) },
  }
  if (version != null) {
    const members = `${publicUrl}/api/community/calendar/members/${memberFeedToken(communityId, version)}/feed.ics`
    links.members = { url: members, webcal: webcal(members) }
  }
  return links
}

export function eventPageUrl(event: Record<string, any>) {
  return `${publicUrl}/events/${encodeURIComponent(String(event.id))}${event.date ? `?date=${encodeURIComponent(event.date)}` : ''}`
}

export const calendarHost = (() => { try { return new URL(publicUrl).host } catch { return 'heritage.faith' } })()
