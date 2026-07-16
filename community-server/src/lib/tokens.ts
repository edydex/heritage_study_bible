import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export function createOpaqueToken() {
  return randomBytes(32).toString('base64url')
}

export function hashOpaqueToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function tokenHashesMatch(token: string, expectedHash: string) {
  const actual = Buffer.from(hashOpaqueToken(token), 'hex')
  const expected = Buffer.from(String(expectedHash || ''), 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
