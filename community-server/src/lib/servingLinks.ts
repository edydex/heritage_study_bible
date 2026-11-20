import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { publicUrl } from './publicConfig'

// Each volunteer has one private link to their serving schedule. The link is
// derived from the person and a version number, so every email can repeat the
// same link without storing it; bumping the version replaces every older link.
function linkKey() {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET is required for volunteer links.')
  return createHash('sha256').update(`heritage-serving-link:v1:${secret}`).digest()
}

export function servingLinkToken(personId: number, version: number) {
  const mac = createHmac('sha256', linkKey()).update(`${personId}:${version}`).digest('base64url')
  return `${personId}.${version}.${mac}`
}

export function parseServingLinkToken(token: unknown): { personId: number; version: number } | null {
  const match = typeof token === 'string' ? /^(\d{1,12})\.(\d{1,9})\.[A-Za-z0-9_-]{43}$/.exec(token) : null
  if (!match) return null
  const personId = Number(match[1]), version = Number(match[2])
  const expected = Buffer.from(servingLinkToken(personId, version))
  const actual = Buffer.from(token as string)
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? { personId, version } : null
}

/** The token travels in the URL fragment, which browsers never send to servers or in Referer headers. */
export function servingLinkUrl(personId: number, version: number) {
  return `${publicUrl}/serving#${servingLinkToken(personId, version)}`
}
