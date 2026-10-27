import { sql, type SQL } from 'drizzle-orm'
import type { PayloadRequest } from 'payload'
import { CalendarMcpError } from './config.ts'
export type Database = { execute(query: SQL): Promise<any> }
export function rows(result: any): any[] { return Array.isArray(result) ? result : result.rows || [] }
export function database(req: PayloadRequest): Database {
  const adapter = req.payload.db as any
  const db = req.transactionID ? adapter.sessions[String(req.transactionID)]?.db : adapter.drizzle
  if (!db) throw new CalendarMcpError('UNAVAILABLE', 'Calendar database is unavailable.', 503)
  return db
}
export async function transaction<T>(req: PayloadRequest, operation: (db: Database) => Promise<T>): Promise<T> {
  if (req.transactionID != null) throw new CalendarMcpError('TRANSACTION', 'An independent calendar transaction is required.', 503)
  const adapter = req.payload.db
  const id = await adapter.beginTransaction()
  if (id == null) throw new CalendarMcpError('TRANSACTION', 'Atomic calendar operations are unavailable.', 503)
  req.transactionID = id
  try {
    const result = await operation(database(req))
    await adapter.commitTransaction(id)
    return result
  } catch (error) {
    await adapter.rollbackTransaction(id)
    throw error
  } finally { req.transactionID = undefined }
}
export async function managerExists(db: Database, userId: number, communityId: number, lock = false) {
  const result = rows(await db.execute(sql`
    SELECT m.id FROM memberships m JOIN users u ON u.id = m.user_id
    WHERE m.user_id = ${userId} AND m.community_id = ${communityId} AND m.role IN ('owner','admin','leader')
    ${lock ? sql`FOR SHARE OF m, u` : sql``}`))
  return result.length > 0
}
export type Authority = { grantId: string; tokenHash: string; communityId: number; userId: number; clientId: string; scopes: string[]; resource: string }
export async function checkAuthority(db: Database, authority: Authority, scope: string, lock = false) {
  const grants = rows(await db.execute(sql`
    SELECT g.id FROM calendar_mcp_grants g JOIN calendar_mcp_tokens t ON t.grant_id = g.id
    WHERE g.id = ${authority.grantId} AND g.community_id = ${authority.communityId} AND g.user_id = ${authority.userId}
      AND g.client_id = ${authority.clientId} AND g.resource = ${authority.resource}
      AND g.revoked_at IS NULL AND g.expires_at > now() AND ${scope} = ANY(g.scopes)
      AND t.access_hash = ${authority.tokenHash} AND t.access_expires_at > now() AND t.rotated_at IS NULL
    ${lock ? sql`FOR SHARE OF g, t` : sql``}`))
  if (!grants.length || !await managerExists(db, authority.userId, authority.communityId, lock)) {
    throw new CalendarMcpError('UNAUTHORIZED', 'This calendar grant has expired, was revoked, or lacks permission.', 401)
  }
}
export async function audit(db: Database, authority: Pick<Authority, 'grantId' | 'communityId' | 'userId' | 'clientId'>,
  action: string, eventId: number | null = null, before: string | null = null, after: string | null = null, requestId: string | null = null) {
  await db.execute(sql`INSERT INTO calendar_mcp_audit (community_id,user_id,client_id,grant_id,action,event_id,before_version,after_version,request_id)
    VALUES (${authority.communityId},${authority.userId},${authority.clientId},${authority.grantId},${action},${eventId},${before},${after},${requestId})`)
}
