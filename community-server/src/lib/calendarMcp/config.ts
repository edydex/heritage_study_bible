export const CALENDAR_SCOPES = ['calendar:read', 'calendar:create', 'calendar:update'] as const
export type CalendarScope = typeof CALENDAR_SCOPES[number]
export class CalendarMcpError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message) }
}
export function calendarMcpEnabled() { return process.env.COMMUNITY_CALENDAR_MCP_ENABLED === 'true' }
export function calendarMcpConfig() {
  if (!calendarMcpEnabled()) throw new CalendarMcpError('DISABLED', 'Calendar integration is disabled.', 404)
  const origin = new URL(process.env.COMMUNITY_PUBLIC_URL || 'http://localhost:3000').origin
  const clientId = process.env.COMMUNITY_CALENDAR_MCP_CLIENT_ID || ''
  const redirectUri = process.env.COMMUNITY_CALENDAR_MCP_REDIRECT_URI || ''
  const redirect = new URL(redirectUri)
  const loopback = (url: URL) => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if ((!origin.startsWith('https://') && !loopback(new URL(origin)))
    || (redirect.protocol !== 'https:' && !loopback(redirect)) || redirect.hash || redirect.username || redirect.password
    || !/^[A-Za-z0-9._:-]{1,128}$/.test(clientId)) {
    throw new CalendarMcpError('CONFIGURATION', 'Configure an HTTPS origin and exact OAuth client/redirect URI.', 503)
  }
  return { origin, clientId, redirectUri, issuer: origin, resource: `${origin}/api/community/calendar/mcp` }
}
export function selectedScopes(raw: unknown): CalendarScope[] {
  const scopes = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(' ') : []
  if (!scopes.length || scopes.some(scope => !CALENDAR_SCOPES.includes(scope as CalendarScope))
    || new Set(scopes).size !== scopes.length || !scopes.includes('calendar:read')) {
    throw new CalendarMcpError('invalid_scope', 'Choose calendar:read and optional calendar:create/calendar:update.')
  }
  return CALENDAR_SCOPES.filter(scope => scopes.includes(scope))
}
export function privateJson(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...extra } })
}
export function resourceMetadata() {
  const config = calendarMcpConfig()
  return { resource: config.resource, authorization_servers: [config.issuer], scopes_supported: CALENDAR_SCOPES, bearer_methods_supported: ['header'] }
}
export function authorizationMetadata() {
  const config = calendarMcpConfig()
  return { issuer: config.issuer, authorization_endpoint: `${config.origin}/api/community/calendar/oauth/authorize`,
    token_endpoint: `${config.origin}/api/community/calendar/oauth/token`, revocation_endpoint: `${config.origin}/api/community/calendar/oauth/revoke`,
    response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'], revocation_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'], scopes_supported: CALENDAR_SCOPES, authorization_response_iss_parameter_supported: true }
}
export async function boundedText(req: Request, maximum: number): Promise<string> {
  if (Number(req.headers.get('content-length') || 0) > maximum) throw new CalendarMcpError('invalid_request','Request is too large.',413)
  if (!req.body) return ''
  const reader = req.body.getReader(), decoder = new TextDecoder('utf-8', { fatal:true })
  let bytes = 0, value = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > maximum) { await reader.cancel(); throw new CalendarMcpError('invalid_request','Request is too large.',413) }
      value += decoder.decode(chunk.value, { stream:true })
    }
    return value + decoder.decode()
  } catch (error) {
    if (error instanceof CalendarMcpError) throw error
    throw new CalendarMcpError('invalid_request','Use a valid UTF-8 request body.')
  } finally { reader.releaseLock() }
}
