import { sql } from 'drizzle-orm'
import type { PayloadRequest } from 'payload'
import { eventOccurrences } from '../../../packages/calendar-core/index.js'
import { CalendarMcpError } from './config.ts'
import { createInput, updateInput, readInput, digest, normalizeEvent, eventProjection, validateRange } from './contract.ts'
import { audit, checkAuthority, rows, transaction, type Authority, type Database } from './database.ts'
async function findEvent(req: PayloadRequest, db: Database, authority: Authority, id: number) {
  // The row lock serializes every SQL/Payload writer, including human managers.
  const locked = rows(await db.execute(sql`SELECT calendar_version FROM events WHERE id = ${id} AND community_id = ${authority.communityId} FOR UPDATE`))
  if (!locked.length) throw new CalendarMcpError('NOT_FOUND', 'This church event was not found.', 404)
  const doc = await req.payload.findByID({ collection: 'events', id, depth: 0, overrideAccess: true, showHiddenFields: true, req })
  return { ...doc, calendarVersion: locked[0].calendar_version }
}
async function mutation(req: PayloadRequest, authority: Authority, scope: string, input: any,
  work: (db: Database) => Promise<any>) {
  return transaction(req, async db => {
    await checkAuthority(db, authority, scope, true)
    const inputHash = digest({ scope, input })
    const key = `calendar-mcp:${authority.communityId}:${authority.clientId}`
    // One church/client lock orders idempotency and source identity across all grants.
    await db.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`)
    const prior = rows(await db.execute(sql`SELECT input_hash,result FROM calendar_mcp_mutations
      WHERE community_id = ${authority.communityId} AND client_id = ${authority.clientId} AND request_id = ${input.requestId}`))[0]
    if (prior) {
      if (prior.input_hash !== inputHash) throw new CalendarMcpError('IDEMPOTENCY_CONFLICT', 'This requestId was already used with different data.', 409)
      await audit(db, authority, 'replay', prior.result.event.id, null, prior.result.event.version, input.requestId)
      return { ...prior.result, replayed: true }
    }
    const result = await work(db)
    await db.execute(sql`INSERT INTO calendar_mcp_mutations (community_id,client_id,request_id,input_hash,result)
      VALUES (${authority.communityId},${authority.clientId},${input.requestId},${inputHash},${JSON.stringify(result)}::jsonb)`)
    return result
  })
}
export async function createEvent(req: PayloadRequest, authority: Authority, raw: unknown) {
  const input = createInput.parse(raw), event = normalizeEvent(input.event)
  return mutation(req, authority, 'calendar:create', input, async db => {
    const source = rows(await db.execute(sql`SELECT event_id,input_hash FROM calendar_mcp_sources
      WHERE community_id = ${authority.communityId} AND client_id = ${authority.clientId} AND source = ${input.source} AND source_id = ${input.sourceId}`))[0]
    if (source) {
      if (source.input_hash !== digest(event) || !source.event_id) throw new CalendarMcpError('SOURCE_CONFLICT', 'This source already identifies an event. Read it and use update with its current version.', 409)
      const current = eventProjection(await findEvent(req, db, authority, source.event_id))
      await audit(db, authority, 'source-replay', current.id, null, current.version, input.requestId)
      return { event: current, created: false, source: input.source, sourceId: input.sourceId }
    }
    const doc = await req.payload.create({ collection: 'events', overrideAccess: true, depth: 0, req,
      data: { ...event, community: authority.communityId, recurrence: 'none' } })
    const current = eventProjection(await findEvent(req, db, authority, Number(doc.id)))
    await db.execute(sql`INSERT INTO calendar_mcp_sources (community_id,client_id,source,source_id,event_id,input_hash)
      VALUES (${authority.communityId},${authority.clientId},${input.source},${input.sourceId},${current.id},${digest(event)})`)
    await audit(db, authority, 'create', current.id, null, current.version, input.requestId)
    return { event: current, created: true, source: input.source, sourceId: input.sourceId }
  })
}
export async function updateEvent(req: PayloadRequest, authority: Authority, raw: unknown) {
  const input = updateInput.parse(raw)
  return mutation(req, authority, 'calendar:update', input, async db => {
    const doc = await findEvent(req, db, authority, input.eventId)
    if (String(doc.calendarVersion) !== input.expectedVersion) throw new CalendarMcpError('VERSION_CONFLICT', 'A person or another integration changed this event. Read it again and review the new version before retrying.', 412)
    if (doc.cancelled) throw new CalendarMcpError('CANCELLED', 'A cancelled event requires a church manager to restore it.', 409)
    const merged = normalizeEvent({ title: doc.title, description: doc.description ?? '', startsAt: doc.startsAt,
      endsAt: doc.endsAt ?? null, timeZone: doc.timeZone, location: doc.location ?? '', url: doc.url ?? '', visibility: doc.visibility, ...input.changes })
    const data = Object.fromEntries(Object.keys(input.changes).map(key => [key, merged[key as keyof typeof merged]]))
    await req.payload.update({ collection: 'events', id: input.eventId, overrideAccess: true, req, data, depth: 0 })
    const current = eventProjection(await findEvent(req, db, authority, input.eventId))
    await audit(db, authority, 'update', current.id, input.expectedVersion, current.version, input.requestId)
    return { event: current, updated: true }
  })
}
export async function readEvents(req: PayloadRequest, authority: Authority, raw: unknown) {
  const input = readInput.parse(raw)
  validateRange(input.from, input.to)
  return transaction(req, async db => {
    await checkAuthority(db, authority, 'calendar:read', true)
    const events: any[] = []
    let page = 1, more = true
    while (more) {
      const result = await req.payload.find({ collection: 'events', depth: 0, limit: 250, page, overrideAccess: true,
        showHiddenFields: true, req, sort: ['startsAt','id'], where: { community: { equals: authority.communityId } } })
      for (const doc of result.docs) {
        const event = eventProjection(doc)
        const occurrences = eventOccurrences(event, input.from, input.to)
        if (occurrences.length) events.push({ ...event, occurrences: occurrences.map(occurrence => ({ startsAt: occurrence.startsAt, endsAt: occurrence.endsAt, date: occurrence.date })) })
      }
      if (events.length > 500 || JSON.stringify(events).length > 1024 * 1024) throw new CalendarMcpError('RESULT_TOO_LARGE', 'Choose a smaller calendar range.', 422)
      more = result.hasNextPage; page++
      if (more && page > 40) throw new CalendarMcpError('RANGE_TOO_LARGE', 'Ask a church manager to reduce the calendar archive.', 422)
    }
    const church = await req.payload.findByID({ collection: 'communities', id: authority.communityId, depth: 0, overrideAccess: true, req })
    await audit(db, authority, 'read')
    return { events, timeZone: church.timeZone, defaultVisibility: church.calendarDefaultVisibility || 'members' }
  })
}
