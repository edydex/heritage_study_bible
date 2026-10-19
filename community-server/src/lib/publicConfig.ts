export const publicUrl = (process.env.COMMUNITY_PUBLIC_URL || 'http://localhost:3000').replace(/\/+$/, '')

export const communityAuthEnabled = !['false', '0', 'no', 'off'].includes(
  (process.env.COMMUNITY_AUTH_ENABLED || 'true').trim().toLowerCase(),
)

const configuredCopyrightContactEmail = (
  process.env.COMMUNITY_COPYRIGHT_CONTACT_EMAIL
  || process.env.SMTP_FROM
  || ''
).trim()
const configuredCcliLicenseNumber = (process.env.COMMUNITY_CCLI_LICENSE_NUMBER || '').trim()

export const communityPublicConfig = {
  id: process.env.COMMUNITY_ID || 'local-church',
  name: process.env.COMMUNITY_NAME || 'Local Church',
  description: process.env.COMMUNITY_DESCRIPTION || 'A Heritage church community.',
  publicUrl,
  ccliLicenseNumber: /^[A-Za-z0-9-]*$/.test(configuredCcliLicenseNumber)
    ? configuredCcliLicenseNumber
    : '',
  copyrightContactEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredCopyrightContactEmail)
    ? configuredCopyrightContactEmail
    : '',
}

export function publicCorsHeaders() {
  return {
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match, If-None-Match',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    'Content-Type': 'application/json; charset=utf-8',
  }
}

export function publicJson(value: unknown, init: ResponseInit = {}) {
  const status = init.status || 200
  const bodyless = status === 204 || status === 205 || status === 304
  const headers = new Headers(publicCorsHeaders())
  new Headers(init.headers).forEach((headerValue, headerName) => {
    headers.set(headerName, headerValue)
  })
  return new Response(bodyless ? null : JSON.stringify(value), {
    ...init,
    headers,
  })
}

export function privateAuthorizationJson(value: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', 'private, no-store')
  const vary = (headers.get('Vary') || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
  if (!vary.some(value => value.toLowerCase() === 'authorization')) vary.push('Authorization')
  headers.set('Vary', vary.join(', '))
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  return publicJson(value, { ...init, headers })
}
