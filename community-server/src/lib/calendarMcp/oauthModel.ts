import { createHash, randomBytes } from 'node:crypto'
import OAuth2Server from '@node-oauth/oauth2-server'
import { sql } from 'drizzle-orm'
import type { PayloadRequest } from 'payload'
import { getConfiguredCommunityId } from '../configuredCommunity.ts'
import { calendarMcpConfig, CalendarMcpError, selectedScopes } from './config.ts'
import { audit, database, managerExists, rows, transaction, type Authority } from './database.ts'
export function hashToken(value: string) { return createHash('sha256').update(value).digest('hex') }
const secret = (prefix: string) => `${prefix}_${randomBytes(32).toString('base64url')}`
function userFor(grant: any) { return { id: Number(grant.user_id), communityId: Number(grant.community_id), grantId: grant.id, expiresAt: new Date(grant.expires_at) } }
export function createOAuth(req: PayloadRequest) {
  const config = calendarMcpConfig(), db = database(req)
  const client: OAuth2Server.Client = { id: config.clientId, redirectUris: [config.redirectUri], grants: ['authorization_code','refresh_token'] }
  async function grantFor(id: string, lock = false) {
    const churchId = await getConfiguredCommunityId(req.payload)
    const grant = rows(await database(req).execute(sql`SELECT * FROM calendar_mcp_grants
      WHERE id = ${id} AND community_id = ${churchId} AND client_id = ${config.clientId} AND resource = ${config.resource} AND revoked_at IS NULL AND expires_at > now()
      ${lock ? sql`FOR SHARE` : sql``}`))[0]
    if (!grant || !await managerExists(database(req), Number(grant.user_id), Number(grant.community_id), lock)) return null
    return grant
  }
  const model: OAuth2Server.AuthorizationCodeModel & OAuth2Server.RefreshTokenModel = {
    getClient: async (id, clientSecret) => id === config.clientId && !clientSecret ? client : false,
    generateAuthorizationCode: async () => secret('hcc'),
    generateAccessToken: async () => secret('hca'),
    generateRefreshToken: async () => secret('hcr'),
    validateScope: async (_user, _client, scopes) => { try { return selectedScopes(scopes) } catch { return false } },
    verifyScope: async (token, scopes) => scopes.every(scope => token.scope?.includes(scope)),
    saveAuthorizationCode: async (code, _client, user) => {
      const grant = await grantFor(user.grantId)
      if (!grant) throw new CalendarMcpError('invalid_grant', 'Church manager consent is no longer valid.', 401)
      await database(req).execute(sql`INSERT INTO calendar_mcp_codes (code_hash,grant_id,redirect_uri,challenge,expires_at)
        VALUES (${hashToken(code.authorizationCode)},${user.grantId},${code.redirectUri},${code.codeChallenge!},${code.expiresAt})`)
      return { ...code, client, user }
    },
    getAuthorizationCode: async code => {
      const stored = rows(await db.execute(sql`SELECT * FROM calendar_mcp_codes WHERE code_hash = ${hashToken(code)} AND expires_at > now()`))[0]
      if (!stored) return false
      const grant = await grantFor(stored.grant_id)
      if (!grant) return false
      return { authorizationCode: code, expiresAt: new Date(stored.expires_at), redirectUri: stored.redirect_uri,
        codeChallenge: stored.challenge, codeChallengeMethod: 'S256', scope: grant.scopes, client, user: userFor(grant) }
    },
    // DELETE is atomic, independent of the subsequent issue transaction. Bad PKCE consumes a code too.
    revokeAuthorizationCode: async code => rows(await db.execute(sql`DELETE FROM calendar_mcp_codes
      WHERE code_hash = ${hashToken(code.authorizationCode)} AND expires_at > now() RETURNING code_hash`)).length === 1,
    saveToken: async (token, _client, user) => transaction(req, async currentDb => {
      const grant = await grantFor(user.grantId, true)
      if (!grant || token.scope?.some(scope => !grant.scopes.includes(scope))) throw new CalendarMcpError('invalid_grant', 'Church manager consent is no longer valid.', 401)
      const expiresAt = new Date(grant.expires_at)
      const accessExpiresAt = new Date(Math.min(token.accessTokenExpiresAt!.getTime(), expiresAt.getTime()))
      await currentDb.execute(sql`INSERT INTO calendar_mcp_tokens (access_hash,refresh_hash,grant_id,access_expires_at,refresh_expires_at)
        VALUES (${hashToken(token.accessToken)},${hashToken(token.refreshToken!)},${grant.id},${accessExpiresAt},${expiresAt})`)
      await audit(currentDb, { grantId: grant.id, communityId: Number(grant.community_id), userId: Number(grant.user_id), clientId: config.clientId }, 'token-issued')
      return { ...token, accessTokenExpiresAt: accessExpiresAt, refreshTokenExpiresAt: expiresAt, scope: grant.scopes, client, user: userFor(grant) }
    }),
    getAccessToken: async accessToken => {
      const stored = rows(await db.execute(sql`SELECT * FROM calendar_mcp_tokens WHERE access_hash = ${hashToken(accessToken)} AND rotated_at IS NULL AND access_expires_at > now()`))[0]
      if (!stored) return false
      const grant = await grantFor(stored.grant_id)
      if (!grant) return false
      return { accessToken, accessTokenExpiresAt: new Date(stored.access_expires_at), scope: grant.scopes, client, user: userFor(grant),
        authority: { grantId: grant.id, communityId: Number(grant.community_id), userId: Number(grant.user_id), clientId: config.clientId,
          scopes: grant.scopes, resource: grant.resource, tokenHash: hashToken(accessToken) } satisfies Authority }
    },
    getRefreshToken: async refreshToken => {
      const stored = rows(await db.execute(sql`SELECT * FROM calendar_mcp_tokens WHERE refresh_hash = ${hashToken(refreshToken)}`))[0]
      if (!stored) return false
      if (stored.rotated_at) {
        await transaction(req, async currentDb => {
          const grant = rows(await currentDb.execute(sql`UPDATE calendar_mcp_grants SET revoked_at = now()
            WHERE id = ${stored.grant_id} AND revoked_at IS NULL RETURNING *`))[0]
          if (grant) await audit(currentDb, { grantId: grant.id, communityId: Number(grant.community_id), userId: Number(grant.user_id), clientId: grant.client_id }, 'refresh-reuse-revoked')
        })
        return false
      }
      const grant = await grantFor(stored.grant_id)
      if (!grant) return false
      return { refreshToken, refreshTokenExpiresAt: new Date(stored.refresh_expires_at), scope: grant.scopes, client, user: userFor(grant) }
    },
    revokeToken: async token => rows(await db.execute(sql`UPDATE calendar_mcp_tokens SET rotated_at = now()
      WHERE refresh_hash = ${hashToken(token.refreshToken)} AND rotated_at IS NULL AND refresh_expires_at > now() RETURNING access_hash`)).length === 1,
  }
  return new OAuth2Server({ model, accessTokenLifetime: 600, authorizationCodeLifetime: 120, refreshTokenLifetime: 30 * 86400,
    requireClientAuthentication: { authorization_code: false, refresh_token: false }, alwaysIssueNewRefreshToken: true })
}
