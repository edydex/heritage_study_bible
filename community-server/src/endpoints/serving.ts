import { sql } from 'drizzle-orm'
import { APIError, headersWithCors, type Endpoint, type PayloadRequest, type Where } from 'payload'
import { consumePersistentRateLimit } from '@/lib/authRateLimit'
import { communityRequestAccess } from '@/lib/communityMemberRequest'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { publicUrl } from '@/lib/publicConfig'
import {
  cleanNote, formatServiceDay, formatServiceTime, parseServiceKey, refId, serviceOn,
  type AssignmentRecord, type BlockoutRecord, type EventRecord,
} from '@/lib/serving'
import { sendServingEmail, servingDeclineContent, servingEmailEnabled, servingRequestContent } from '@/lib/servingEmail'
import { SERVING_SYSTEM_WRITE } from '@/lib/servingHooks'
import { parseServingLinkToken, servingLinkUrl } from '@/lib/servingLinks'
import { transactionDatabase } from '@/lib/syncDatabase'
import { canonicalTimeZone, localDate } from '../../packages/calendar-core/index.js'

const HOUR = 60 * 60 * 1000
const MAX_BODY = 8 * 1024
const MAX_AWAY = 50
const system = { [SERVING_SYSTEM_WRITE]: true }

class ServingError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

type Person = { id: number; community: unknown; firstName: string; preferredName?: string | null; fullName: string; email?: string | null; user?: unknown }
type Church = { id: number; name?: string | null; timeZone?: string | null }

function json(req: PayloadRequest, body: unknown, status = 200, extra?: Record<string, string>) {
  const headers = headersWithCors({ req, headers: new Headers({ 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie',
    'X-Content-Type-Options': 'nosniff', ...extra }) })
  return Response.json(body, { status, headers })
}

function failure(req: PayloadRequest, error: unknown, what: string) {
  if (error instanceof ServingError) return json(req, { error: error.message }, error.status)
  if (error instanceof APIError && error.status < 500) return json(req, { error: error.message }, error.status)
  req.payload.logger.error({ err: error }, what)
  return json(req, { error: 'Something went wrong. Please try again.' }, 500)
}

function clientAddress(req: PayloadRequest) {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
}

async function limited(req: PayloadRequest, key: string, maximum: number) {
  const result = await consumePersistentRateLimit({ payload: req.payload, key: `serving:${key}`, maximum, windowMs: HOUR })
  return result.allowed ? null : json(req, { error: 'Too many attempts. Please wait a little and try again.' }, 429, { 'Retry-After': String(result.retryAfter) })
}

async function readBody(req: PayloadRequest) {
  const raw = await req.text?.()
  if (!raw || raw.length > MAX_BODY) throw new ServingError('The request is empty or too large.')
  try { return JSON.parse(raw) as Record<string, unknown> } catch { throw new ServingError('The request could not be read.') }
}

const firstName = (person: Person) => person.preferredName || person.firstName || person.fullName

async function linkVersion(req: PayloadRequest, personId: number) {
  const result = await transactionDatabase(req).execute(sql`
    SELECT "community_id", COALESCE("serving_link_version", 1) AS "version" FROM "people" WHERE "id" = ${personId}`)
  const row = result.rows?.[0]
  return row ? { communityId: Number(row.community_id), version: Number(row.version) } : null
}

async function churchOf(req: PayloadRequest, communityId: number) {
  return await req.payload.findByID({ collection: 'communities', id: communityId, depth: 0, overrideAccess: true, req }) as unknown as Church
}

async function findAll<T>(req: PayloadRequest, collection: 'serving-assignments' | 'serving-blockouts' | 'events' | 'teams' | 'people' | 'users',
  where: Where, sort?: string[]) {
  const result = await req.payload.find({ collection, where, sort, depth: 0, limit: 500, overrideAccess: true, req, pagination: false })
  return result.docs as unknown as T[]
}

/** Signed-in owners, administrators and leaders of the configured church. */
async function manager(req: PayloadRequest) {
  const communityId = await getConfiguredCommunityId(req.payload)
  if (!communityId) throw new ServingError('Church settings are unavailable.', 503)
  const access = await communityRequestAccess(req.payload, req.headers, communityId)
  if (!access.manager) throw new ServingError('Sign in as a church owner, administrator or leader.', access.authenticated ? 403 : 401)
  return { communityId, user: access.user as { id: number; preferredLanguage?: string | null } }
}

async function churchPerson(req: PayloadRequest, communityId: number, value: unknown) {
  const id = refId(value as number)
  const person = id ? (await findAll<Person>(req, 'people', { and: [{ id: { equals: id } }, { community: { equals: communityId } }] }))[0] : null
  if (!person) throw new ServingError('This person is not in the church directory.', 404)
  return person
}

async function markRequested(req: PayloadRequest, where: Where[]) {
  await req.payload.update({ collection: 'serving-assignments', overrideAccess: true, req, context: system, depth: 0,
    where: { and: [...where, { status: { equals: 'pending' } }, { requestedAt: { exists: false } }] },
    data: { requestedAt: new Date().toISOString() } })
}

/** The volunteer behind a private link, if the link is genuine and current. */
async function openLink(req: PayloadRequest, token: unknown) {
  const parsed = parseServingLinkToken(token)
  if (!parsed) throw new ServingError('This link is not valid. Ask your team leader for a new one.', 404)
  const communityId = await getConfiguredCommunityId(req.payload)
  const current = await linkVersion(req, parsed.personId)
  if (!communityId || !current || current.communityId !== communityId || current.version !== parsed.version) {
    throw new ServingError('This link has been replaced or removed. Ask your team leader for a new one.', 404)
  }
  const person = await req.payload.findByID({ collection: 'people', id: parsed.personId, depth: 0, overrideAccess: true, req }) as unknown as Person
  return { communityId, church: await churchOf(req, communityId), person }
}

function today(church: Church) {
  return localDate(new Date(), canonicalTimeZone(church.timeZone) || 'UTC')
}

/** Everything the volunteer page shows: upcoming dates (with answers) and away dates. */
async function volunteerSummary(req: PayloadRequest, church: Church, person: Person) {
  const from = today(church)
  const rows = await findAll<AssignmentRecord>(req, 'serving-assignments',
    { and: [{ person: { equals: person.id } }, { date: { greater_than_equal: from } }] }, ['date', 'id'])
  const eventIds = [...new Set(rows.map(row => refId(row.event)).filter(Boolean))] as number[]
  const teamIds = [...new Set(rows.map(row => refId(row.team)).filter(Boolean))] as number[]
  const [events, teams, away] = await Promise.all([
    eventIds.length ? findAll<EventRecord>(req, 'events', { id: { in: eventIds } }) : [],
    teamIds.length ? findAll<{ id: number; name: string }>(req, 'teams', { id: { in: teamIds } }) : [],
    findAll<BlockoutRecord>(req, 'serving-blockouts', { and: [{ person: { equals: person.id } }, { endDate: { greater_than_equal: from } }] },
      ['startDate', 'id']),
  ])
  const eventById = new Map(events.map(event => [event.id, event]))
  const teamById = new Map(teams.map(team => [team.id, team.name]))
  return {
    churchName: church.name || 'Church',
    name: firstName(person),
    assignments: rows.map(row => {
      const event = eventById.get(refId(row.event) ?? 0)
      const service = event ? serviceOn(event, row.date) : null
      return { id: row.id, date: row.date, startsAt: service?.startsAt ?? null, timeZone: service?.timeZone ?? (canonicalTimeZone(church.timeZone) || 'UTC'),
        title: event?.title || '', location: event?.location || null, cancelled: !service,
        team: teamById.get(refId(row.team) ?? 0) || '', position: row.position, status: row.status, note: row.note || null }
    }),
    away: away.map(row => ({ id: row.id, startDate: row.startDate, endDate: row.endDate, reason: row.reason || null })),
  }
}

async function notifyDecline(req: PayloadRequest, church: Church, person: Person, row: AssignmentRecord, note: string | null) {
  const schedulerId = refId((row as { scheduledBy?: unknown }).scheduledBy as number)
  if (!schedulerId) return
  const scheduler = (await findAll<{ email?: string; preferredLanguage?: string | null }>(req, 'users', { id: { equals: schedulerId } }))[0]
  if (!scheduler?.email) return
  const [event, team] = await Promise.all([
    findAll<EventRecord>(req, 'events', { id: { equals: refId(row.event) } }).then(docs => docs[0]),
    findAll<{ name: string }>(req, 'teams', { id: { equals: refId(row.team) } }).then(docs => docs[0]),
  ])
  const language = scheduler.preferredLanguage || 'en'
  const service = event ? serviceOn(event, row.date) : null
  const url = `${publicUrl}/admin/serving?service=${encodeURIComponent(`${refId(row.event)}:${row.date}`)}`
  await sendServingEmail(req.payload, scheduler.email, servingDeclineContent({
    language, churchName: church.name || 'Church', name: person.fullName, role: [team?.name, row.position].filter(Boolean).join(' — '),
    service: `${event?.title || ''}, ${service ? formatServiceTime(service.startsAt, service.timeZone, language) : formatServiceDay(row.date, language, true)}`,
    dateLabel: formatServiceDay(row.date, language, true), note, url,
  }))
}

const volunteer = (path: string, handler: (req: PayloadRequest, body: Record<string, unknown>,
  link: Awaited<ReturnType<typeof openLink>>) => Promise<unknown>): Endpoint => ({
  path: `/community/serving/${path}`, method: 'post', handler: async req => {
    try {
      const blocked = await limited(req, `link:${clientAddress(req)}`, 120)
      if (blocked) return blocked
      const body = await readBody(req)
      const link = await openLink(req, body.token)
      await handler(req, body, link)
      return json(req, await volunteerSummary(req, link.church, link.person))
    } catch (error) { return failure(req, error, `Serving ${path} failed`) }
  },
})

export const servingEndpoints: Endpoint[] = [
  // The volunteer's private page.
  volunteer('me', async () => undefined),

  volunteer('respond', async (req, body, { church, person }) => {
    const answer = body.answer
    if (answer !== 'accepted' && answer !== 'declined') throw new ServingError('Choose accept or decline.')
    const id = refId(body.assignmentId as number)
    const row = id ? (await findAll<AssignmentRecord & { scheduledBy?: unknown }>(req, 'serving-assignments',
      { and: [{ id: { equals: id } }, { person: { equals: person.id } }] }))[0] : null
    if (!row) throw new ServingError('This serving date was removed from the schedule.', 404)
    if (row.date < today(church)) throw new ServingError('This date has already passed.', 409)
    const note = cleanNote(body.note)
    await req.payload.update({ collection: 'serving-assignments', id: row.id, overrideAccess: true, req, context: system, depth: 0,
      data: { status: answer, respondedAt: new Date().toISOString(), note, requestedAt: row.requestedAt || new Date().toISOString() } })
    if (answer === 'declined' && row.status !== 'declined') await notifyDecline(req, church, person, row, note)
  }),

  volunteer('away', async (req, body, { church, communityId, person }) => {
    if (String(body.endDate || body.startDate || '') < today(church)) throw new ServingError('Choose dates from today onward.')
    const upcoming = await req.payload.count({ collection: 'serving-blockouts', overrideAccess: true, req,
      where: { and: [{ person: { equals: person.id } }, { endDate: { greater_than_equal: today(church) } }] } })
    if (upcoming.totalDocs >= MAX_AWAY) throw new ServingError('Remove some older away dates first.', 409)
    await req.payload.create({ collection: 'serving-blockouts', overrideAccess: true, req, context: system, depth: 0,
      data: { community: communityId, person: person.id, startDate: String(body.startDate || ''),
        endDate: String(body.endDate || body.startDate || ''), reason: cleanNote(body.reason) } })
  }),

  volunteer('away/remove', async (req, body, { person }) => {
    const id = refId(body.id as number)
    if (!id) return
    await req.payload.delete({ collection: 'serving-blockouts', overrideAccess: true, req, context: system,
      where: { and: [{ id: { equals: id } }, { person: { equals: person.id } }] } })
  }),

  // Managers: email everyone on one service who has not been asked yet.
  { path: '/community/serving/send', method: 'post', handler: async req => {
    try {
      const { communityId, user } = await manager(req)
      const body = await readBody(req)
      const key = parseServiceKey(body.service)
      const event = key ? (await findAll<EventRecord>(req, 'events', { and: [{ id: { equals: key.eventId } }, { community: { equals: communityId } }] }))[0] : null
      const service = event && key ? serviceOn(event, key.date) : null
      if (!event || !service) throw new ServingError('This service is not on the calendar.', 404)
      const rows = await findAll<AssignmentRecord>(req, 'serving-assignments', { and: [{ event: { equals: event.id } },
        { date: { equals: service.date } }, { status: { equals: 'pending' } }, { requestedAt: { exists: false } }] }, ['id'])
      const personIds = [...new Set(rows.map(row => refId(row.person)))] as number[]
      const teamIds = [...new Set(rows.map(row => refId(row.team)))] as number[]
      const [people, teams, church] = await Promise.all([
        personIds.length ? findAll<Person>(req, 'people', { id: { in: personIds } }) : [],
        teamIds.length ? findAll<{ id: number; name: string }>(req, 'teams', { id: { in: teamIds } }) : [],
        churchOf(req, communityId),
      ])
      const userIds = people.map(person => refId(person.user as number)).filter(Boolean) as number[]
      const accounts = userIds.length ? await findAll<{ id: number; preferredLanguage?: string | null }>(req, 'users', { id: { in: userIds } }) : []
      const languageOf = new Map(accounts.map(account => [account.id, account.preferredLanguage]))
      const teamName = new Map(teams.map(team => [team.id, team.name]))
      const emailOn = servingEmailEnabled()
      const sent: string[] = [], withoutEmail: Array<{ personId: number; name: string }> = [], failed: Array<{ personId: number; name: string }> = []
      for (const person of people.sort((a, b) => a.fullName.localeCompare(b.fullName))) {
        if (!emailOn || !person.email) { withoutEmail.push({ personId: person.id, name: person.fullName }); continue }
        const version = (await linkVersion(req, person.id))?.version ?? 1
        const language = languageOf.get(refId(person.user as number) ?? 0) || user.preferredLanguage || 'en'
        const roles = rows.filter(row => refId(row.person) === person.id).map(row => `${teamName.get(refId(row.team) ?? 0) || ''} — ${row.position}`)
        const ok = await sendServingEmail(req.payload, person.email, servingRequestContent({
          language, churchName: church.name || 'Church', name: firstName(person), dateLabel: formatServiceDay(service.date, language, true),
          url: servingLinkUrl(person.id, version),
          services: [{ title: event.title, when: formatServiceTime(service.startsAt, service.timeZone, language), location: event.location, roles }],
        }))
        if (!ok) { failed.push({ personId: person.id, name: person.fullName }); continue }
        await markRequested(req, [{ person: { equals: person.id } }, { event: { equals: event.id } }, { date: { equals: service.date } }])
        sent.push(person.fullName)
      }
      return json(req, { emailEnabled: emailOn, sent, withoutEmail, failed })
    } catch (error) { return failure(req, error, 'Serving requests failed') }
  } },

  // Managers: a person's private link to share by text message. Sharing it for
  // a service counts as asking them.
  { path: '/community/serving/link', method: 'post', handler: async req => {
    try {
      const { communityId } = await manager(req)
      const body = await readBody(req)
      const person = await churchPerson(req, communityId, body.personId)
      const version = (await linkVersion(req, person.id))?.version ?? 1
      const key = parseServiceKey(body.service)
      if (key) await markRequested(req, [{ person: { equals: person.id } }, { event: { equals: key.eventId } }, { date: { equals: key.date } }])
      return json(req, { name: person.fullName, url: servingLinkUrl(person.id, version) })
    } catch (error) { return failure(req, error, 'Serving link failed') }
  } },

  // Managers: stop every older link for one person (for example, after it was forwarded).
  { path: '/community/serving/reset-link', method: 'post', handler: async req => {
    try {
      const { communityId } = await manager(req)
      const body = await readBody(req)
      const person = await churchPerson(req, communityId, body.personId)
      const result = await transactionDatabase(req).execute(sql`
        UPDATE "people" SET "serving_link_version" = COALESCE("serving_link_version", 1) + 1
        WHERE "id" = ${person.id} AND "community_id" = ${communityId} RETURNING "serving_link_version" AS "version"`)
      return json(req, { name: person.fullName, url: servingLinkUrl(person.id, Number(result.rows?.[0]?.version)) })
    } catch (error) { return failure(req, error, 'Serving link reset failed') }
  } },
]
