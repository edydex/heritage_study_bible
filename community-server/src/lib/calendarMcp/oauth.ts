import { randomBytes, randomUUID } from 'node:crypto'
import OAuth2Server from '@node-oauth/oauth2-server'
import { sql } from 'drizzle-orm'
import type { PayloadRequest } from 'payload'
import { getConfiguredCommunityId } from '../configuredCommunity.ts'
import { communityRequestAccess } from '../communityMemberRequest.ts'
import { calendarMcpConfig, CalendarMcpError, CALENDAR_SCOPES, boundedText, privateJson, selectedScopes } from './config.ts'
import { audit, database, managerExists, rows, transaction } from './database.ts'
import { createOAuth, hashToken } from './oauthModel.ts'
const safeHeaders = { 'Cache-Control': 'private, no-store', 'Content-Type': 'text/html; charset=utf-8', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'", 'X-Content-Type-Options': 'nosniff' }
const html = (title: string, content: string) => new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title><body><main><h1>${title}</h1>${content}</main></body></html>`, { headers: safeHeaders })
const escape = (value: unknown) => String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]!)
export async function form(req: PayloadRequest) {
  if (!(req.headers.get('content-type') || '').startsWith('application/x-www-form-urlencoded')) throw new CalendarMcpError('invalid_request', 'Use a form-encoded request.')
  const raw = await boundedText(req as unknown as Request, 16384)
  if (!raw || raw.length > 16384) throw new CalendarMcpError('invalid_request', 'Invalid request size.')
  const params = new URLSearchParams(raw)
  for (const key of new Set(params.keys())) if (key !== 'scope' && params.getAll(key).length !== 1) throw new CalendarMcpError('invalid_request', 'Duplicate parameters are not supported.')
  return params
}
function requireOrigin(req: PayloadRequest) {
  if (req.headers.get('origin') !== calendarMcpConfig().origin) throw new CalendarMcpError('ORIGIN', 'Open calendar connections from your church website.', 403)
}
async function manager(req: PayloadRequest) {
  const communityId = await getConfiguredCommunityId(req.payload)
  if (!communityId) throw new CalendarMcpError('CHURCH', 'Church setup is incomplete.', 503)
  const access = await communityRequestAccess(req.payload, req.headers, communityId)
  if (!access.user || !await managerExists(database(req), Number(access.user.id), communityId)) throw new CalendarMcpError('MANAGER_REQUIRED', 'Sign in as a manager of this church.', 403)
  return { communityId, userId: Number(access.user.id) }
}
export function validateAuthorization(params: URLSearchParams) {
  const config = calendarMcpConfig()
  for (const key of new Set(params.keys())) if (params.getAll(key).length !== 1) throw new CalendarMcpError('invalid_request', 'Duplicate OAuth parameters are not supported.')
  if (params.get('client_id') !== config.clientId || params.get('redirect_uri') !== config.redirectUri) throw new CalendarMcpError('invalid_client', 'The OAuth client or exact redirect URI is unregistered.')
  if (params.get('resource') !== config.resource) throw new CalendarMcpError('invalid_target', 'The token must target this church calendar.')
  if (params.get('response_type') !== 'code' || params.get('code_challenge_method') !== 'S256'
    || !/^[A-Za-z0-9_-]{43}$/.test(params.get('code_challenge') || '')
    || !/^[\x21-\x7e]{1,512}$/.test(params.get('state') || '')) throw new CalendarMcpError('invalid_request', 'Authorization code, state, and S256 PKCE are required.')
  selectedScopes(params.get('scope'))
  return config
}
function oauthRequest(req: PayloadRequest, body: Record<string,string> = {}, query: Record<string,string> = {}) {
  const headers = Object.fromEntries(req.headers)
  // OAuth's Node request wrapper uses Content-Length to recognize a body. Web
  // Requests (including HTTP/2) may omit it; the form was already validated.
  if (Object.keys(body).length) headers['content-length'] = String(Buffer.byteLength(new URLSearchParams(body).toString()))
  return new OAuth2Server.Request({ headers, method: req.method || 'POST', body, query })
}
function redirect(location: string) {
  const target = new URL(location), config = calendarMcpConfig()
  target.searchParams.set('iss', config.issuer)
  return new Response(null, { status: 302, headers: { Location: target.toString(), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
}
export async function authorize(req: PayloadRequest) {
  const config = calendarMcpConfig()
  if (req.method === 'GET') {
    const params = new URL(req.url!).searchParams
    validateAuthorization(params)
    let actor
    try { actor = await manager(req) } catch (error) {
      if (!(error instanceof CalendarMcpError) || error.code !== 'MANAGER_REQUIRED') throw error
      return html('Connect church calendar', '<p>Sign in to this church as a manager, then return to this connection request.</p><p><a href="/admin/login" target="_blank" rel="noopener noreferrer">Sign in to Heritage Community</a></p>')
    }
    const nonce = randomBytes(32).toString('base64url')
    await database(req).execute(sql`DELETE FROM calendar_mcp_consents WHERE expires_at < now()`)
    await database(req).execute(sql`INSERT INTO calendar_mcp_consents (nonce_hash,community_id,user_id,parameters,expires_at)
      VALUES (${hashToken(nonce)},${actor.communityId},${actor.userId},${JSON.stringify(Object.fromEntries(params))}::jsonb,now() + interval '5 minutes')`)
    const church = await req.payload.findByID({ collection:'communities', id: actor.communityId, depth:0, overrideAccess:true, req })
    const requested = selectedScopes(params.get('scope'))
    const labels = { 'calendar:read':'Read church events, including members-only events', 'calendar:create':'Add church events', 'calendar:update':'Edit church events after checking their version' }
    return html('Connect church calendar', `<p>Allow ${escape(config.clientId)} to access ${escape(church.name)} for up to 30 days.</p><p>Only the permissions selected below will be granted. You can revoke access from Calendar connections. Access ends if you stop being a church manager.</p>
      <form method="post"><input type="hidden" name="nonce" value="${escape(nonce)}">${requested.map(scope => `<p><label><input type="checkbox" name="scope" value="${scope}" ${scope === 'calendar:read' ? 'checked required' : ''}> ${labels[scope]}</label></p>`).join('')}
      <button name="decision" value="approve">Allow selected permissions</button> <button name="decision" value="deny" formnovalidate>Deny</button></form>
      <p><a href="/api/community/calendar/oauth/connections">Calendar connections</a></p>`)
  }
  requireOrigin(req)
  const actor = await manager(req), body = await form(req)
  return transaction(req, async db => {
    const consent = rows(await db.execute(sql`DELETE FROM calendar_mcp_consents WHERE nonce_hash = ${hashToken(body.get('nonce') || '')}
      AND user_id = ${actor.userId} AND community_id = ${actor.communityId} AND expires_at > now() RETURNING parameters`))[0]
    if (!consent) throw new CalendarMcpError('CONSENT_EXPIRED', 'This connection request expired. Restart the connection.', 409)
    const params = new URLSearchParams(consent.parameters)
    validateAuthorization(params)
    if (body.get('decision') === 'deny') {
      const target = new URL(config.redirectUri)
      target.searchParams.set('state',params.get('state')!); target.searchParams.set('error','access_denied')
      return redirect(target.toString())
    }
    if (body.get('decision') !== 'approve') throw new CalendarMcpError('invalid_request', 'Choose Allow or Deny.')
    const scopes = selectedScopes(body.getAll('scope')), requested = selectedScopes(params.get('scope'))
    if (scopes.some(scope => !requested.includes(scope))) throw new CalendarMcpError('invalid_scope', 'Consent cannot add permissions that were not requested.')
    if (!await managerExists(db, actor.userId, actor.communityId, true)) throw new CalendarMcpError('MANAGER_REQUIRED', 'A current church manager must approve access.', 403)
    const grantId = randomUUID()
    await db.execute(sql`INSERT INTO calendar_mcp_grants (id,community_id,user_id,client_id,resource,scopes,expires_at)
      VALUES (${grantId},${actor.communityId},${actor.userId},${config.clientId},${config.resource},ARRAY[${sql.join(scopes.map(scope => sql`${scope}`), sql`, `)}]::text[],now() + interval '30 days')`)
    await audit(db, { ...actor, clientId: config.clientId, grantId }, 'consent')
    params.set('scope', scopes.join(' '))
    const response = new OAuth2Server.Response()
    await createOAuth(req).authorize(oauthRequest(req, {}, Object.fromEntries(params)), response,
      { authenticateHandler: { handle: async () => ({ id: actor.userId, grantId }) } })
    return redirect(response.headers!.location)
  })
}
export async function token(req: PayloadRequest) {
  const body = await form(req), config = calendarMcpConfig()
  if (body.get('resource') !== config.resource) throw new CalendarMcpError('invalid_target','The token must target this church calendar.')
  if (!['authorization_code','refresh_token'].includes(body.get('grant_type') || '')) throw new CalendarMcpError('unsupported_grant_type','Only authorization-code and refresh-token grants are allowed.')
  if (body.get('client_id') !== config.clientId || req.headers.has('authorization') || body.has('client_secret')) throw new CalendarMcpError('invalid_client', 'Use the registered public client with PKCE.')
  if (body.get('grant_type') === 'authorization_code' && !/^[A-Za-z0-9._~-]{43,128}$/.test(body.get('code_verifier') || '')) throw new CalendarMcpError('invalid_grant', 'A PKCE verifier is required.')
  // Refresh cannot silently change scopes. New consent is required to change permissions.
  if (body.has('scope')) throw new CalendarMcpError('invalid_scope','Restart consent to change permissions.')
  const response = new OAuth2Server.Response()
  await createOAuth(req).token(oauthRequest(req, Object.fromEntries(body)), response)
  return privateJson({ ...response.body, resource: config.resource }, response.status || 200)
}
export async function revoke(req: PayloadRequest) {
  const body = await form(req), config = calendarMcpConfig()
  if (body.get('client_id') !== config.clientId) throw new CalendarMcpError('invalid_client','Use the registered OAuth client.')
  const value = body.get('token') || ''
  if (!value || value.length > 512) throw new CalendarMcpError('invalid_request','Supply a token to revoke.')
  await transaction(req, async db => {
    const grant = rows(await db.execute(sql`UPDATE calendar_mcp_grants SET revoked_at = now() WHERE client_id = ${config.clientId}
      AND id IN (SELECT grant_id FROM calendar_mcp_tokens WHERE access_hash = ${hashToken(value)} OR refresh_hash = ${hashToken(value)})
      AND revoked_at IS NULL RETURNING *`))[0]
    if (grant) await audit(db, { grantId:grant.id, communityId:Number(grant.community_id), userId:Number(grant.user_id), clientId:grant.client_id },'revoked')
  })
  return privateJson({}) // RFC7009: unknown tokens produce the same success response.
}
export async function connections(req: PayloadRequest) {
  const actor = await manager(req), config = calendarMcpConfig()
  if (req.method === 'POST') {
    requireOrigin(req)
    const body = await form(req), grantId = body.get('grantId') || ''
    if (!/^[0-9a-f-]{36}$/.test(grantId)) throw new CalendarMcpError('invalid_request','Choose a calendar connection.')
    await transaction(req, async db => {
      const grant = rows(await db.execute(sql`UPDATE calendar_mcp_grants SET revoked_at = now()
        WHERE id = ${grantId} AND community_id = ${actor.communityId} AND user_id = ${actor.userId} AND revoked_at IS NULL RETURNING id`))[0]
      if (grant) await audit(db, { ...actor, grantId, clientId:config.clientId },'manager-revoked')
    })
  }
  const grants = rows(await database(req).execute(sql`SELECT id,client_id,scopes,expires_at FROM calendar_mcp_grants
    WHERE community_id = ${actor.communityId} AND user_id = ${actor.userId} AND revoked_at IS NULL AND expires_at > now() ORDER BY created_at DESC`))
  return html('Calendar connections', grants.length ? grants.map(grant => `<section><h2>${escape(grant.client_id)}</h2><p>${escape(grant.scopes.join(', '))}</p><p>Expires ${escape(new Date(grant.expires_at).toISOString())}</p>
    <form method="post"><input type="hidden" name="grantId" value="${escape(grant.id)}"><button>Revoke calendar access</button></form></section>`).join('') : '<p>No active calendar connections.</p>')
}
export async function oauthHandler(req: PayloadRequest, handler: (req: PayloadRequest) => Promise<Response>) {
  try { calendarMcpConfig(); return await handler(req) } catch (error) {
    if (error instanceof CalendarMcpError) return privateJson({ error: error.code, error_description: error.message },error.status)
    if (error instanceof OAuth2Server.OAuthError) return privateJson({ error:error.name, error_description:error.message },error.code)
    req.payload.logger.error({ err:error },'Calendar OAuth failed')
    return privateJson({ error:'server_error', error_description:'Calendar connection is unavailable.' },503)
  }
}
