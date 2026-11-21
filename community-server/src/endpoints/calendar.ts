import { headersWithCors, type Endpoint, type PayloadRequest, type Where } from 'payload'
import { sql } from 'drizzle-orm'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { communityRequestAccess } from '@/lib/communityMemberRequest'
import { calendarHost, eventPageUrl, feedLinks, memberFeedTokenMatches } from '@/lib/calendarFeeds'
import { transactionDatabase } from '@/lib/syncDatabase'
import {
  addDays, buildIcs, canonicalTimeZone, eventIsPublic, eventOccurrences, localDate, validDate, validTimeOfDay,
} from '../../packages/calendar-core/index.js'

const FEED_PAST_DAYS = 31
const FEED_FUTURE_DAYS = 366

function json(req: PayloadRequest, body: unknown, status = 200) {
  const headers = headersWithCors({ req, headers: new Headers({ 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie', 'X-Content-Type-Options': 'nosniff' }) })
  return Response.json(body, { status, headers })
}
function calendarFile(req: PayloadRequest, body: string, filename: string, shared: boolean) {
  const headers = headersWithCors({ req, headers: new Headers({ 'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `inline; filename="${filename}"`, 'Cache-Control': shared ? 'public, max-age=900' : 'private, max-age=900',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }) })
  return new Response(body, { status: 200, headers })
}
async function context(req: PayloadRequest) {
  const id = await getConfiguredCommunityId(req.payload)
  if (!id) throw new Error('Church settings are unavailable.')
  const church = await req.payload.findByID({ collection: 'communities', id, depth: 0, overrideAccess: true, req })
  const access = await communityRequestAccess(req.payload, req.headers, id)
  return { id, church, access }
}
/** Events that are not cancelled as a whole (older rows may have no value at all). */
const notCancelled: Where = { or: [{ cancelled: { equals: false } }, { cancelled: { exists: false } }] }

function visibleEvent(doc: any, access: { authenticated: boolean; manager: boolean }, communityId: number | string) {
  return { id: doc.id, title: doc.title, description: doc.description, startsAt: doc.startsAt, endsAt: doc.endsAt,
    timeZone: canonicalTimeZone(doc.timeZone) || 'UTC', allDay: Boolean(doc.allDay), location: doc.location, url: doc.url,
    recurrence: doc.recurrence, repeatInterval: doc.repeatInterval, repeatUntil: doc.repeatUntil,
    // Used to work out each date; never returned as a list.
    exceptions: Array.isArray(doc.exceptions) ? doc.exceptions : [],
    ...(access.authenticated ? { community: communityId, rsvpEnabled: doc.rsvpEnabled, defaultReminderMinutes: doc.defaultReminderMinutes ?? null } : {}),
    ...(access.manager ? { visibility: doc.visibility } : {}) }
}
async function churchEvents(req: PayloadRequest, communityId: number, audience: Where | null) {
  const docs: any[] = []
  for (let page = 1; ; page++) {
    const result = await req.payload.find({ collection: 'events', overrideAccess: true, req, depth: 0, limit: 250, page,
      sort: ['startsAt', 'id'], where: { and: [{ community: { equals: communityId } }, notCancelled, ...(audience ? [audience] : [])] } })
    docs.push(...result.docs)
    if (!result.hasNextPage) return docs
    if (page >= 40) throw Object.assign(new Error('The calendar is too large to load.'), { tooLarge: true })
  }
}
function publicAudience(church: any): Where {
  return { or: [{ visibility: { equals: 'public' } }, ...(church.calendarDefaultVisibility === 'public' ? [{ visibility: { equals: 'inherit' } }] : [])] }
}
/** Every date from a month ago to a year ahead, for subscribed calendar apps. */
function feedOccurrences(events: any[], zone: string) {
  const today = localDate(Date.now(), zone)
  const out: any[] = []
  for (const event of events) {
    for (let from = addDays(today, -FEED_PAST_DAYS); from <= addDays(today, FEED_FUTURE_DAYS); from = addDays(from, 61)) {
      const to = addDays(from, 60)
      out.push(...eventOccurrences(event, from, to).filter(item => item.date >= from && item.date <= to))
    }
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}
async function feedVersion(req: PayloadRequest, communityId: number) {
  const result = await transactionDatabase(req).execute(sql`SELECT COALESCE("calendar_feed_version", 1) AS "version" FROM "communities" WHERE "id" = ${communityId}`)
  return Number(result.rows?.[0]?.version ?? 1)
}
function settingsBody(id: number, church: any) {
  return { communityId: id, timeZone: canonicalTimeZone(church.timeZone) || 'UTC', defaultVisibility: church.calendarDefaultVisibility || 'members',
    defaultStartTime: validTimeOfDay(church.calendarDefaultStartTime) ? church.calendarDefaultStartTime : '10:00',
    defaultDurationMinutes: Number(church.calendarDefaultDurationMinutes) || 60,
    defaultReminderMinutes: church.calendarDefaultReminderMinutes ?? null,
    defaultLocation: church.calendarDefaultLocation || '' }
}
const fileName = (title: string) => `${String(title || 'church-event').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'church-event'}.ics`

export const calendarEndpoints: Endpoint[] = [
  { path: '/community/calendar', method: 'get', handler: async req => {
    try {
      const { id, church, access } = await context(req)
      const url = new URL(req.url || '/', 'http://localhost')
      const from = url.searchParams.get('from') || '', to = url.searchParams.get('to') || ''
      if (!validDate(from) || !validDate(to) || from > to || Date.parse(to) - Date.parse(from) > 62 * 86400000) return json(req, { error: 'Choose a calendar range of at most 63 days.' }, 400)
      // Managers also see dates cancelled on their own, so they can restore them.
      const includeCancelled = access.manager && url.searchParams.get('includeCancelled') === '1'
      const docs = await churchEvents(req, Number(id), access.authenticated ? null : publicAudience(church))
      const events = []
      for (const doc of docs) {
        if (!access.authenticated && !eventIsPublic(doc, church.calendarDefaultVisibility || 'members')) continue
        // Public responses deliberately omit relationship, RSVP and audit metadata.
        events.push(...eventOccurrences(visibleEvent(doc, access, id), from, to, { includeCancelled }))
      }
      events.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title) || Number(a.id) - Number(b.id))
      return json(req, { events, timeZone: canonicalTimeZone(church.timeZone) || 'UTC', authenticated: access.authenticated, canManage: access.manager })
    } catch (error: any) {
      if (error?.tooLarge) return json(req, { error: 'The calendar is too large to load. Please contact your church administrator.' }, 422)
      req.payload.logger.error({ err: error }, 'Calendar failed'); return json(req, { error: 'Could not load the church calendar.' }, 500)
    }
  } },
  ...(['', '/event.ics'] as const).map(suffix => ({ path: `/community/calendar/events/:id${suffix}`, method: 'get' as const, handler: async (req: PayloadRequest) => {
    try {
      const { id, church, access } = await context(req)
      const eventId = String(req.routeParams?.id || '')
      const date = new URL(req.url || '/', 'http://localhost').searchParams.get('date')
      if (!/^\d+$/.test(eventId) || (date !== null && !validDate(date))) return json(req, { error: 'Choose a valid event and date.' }, 400)
      const result = await req.payload.find({ collection: 'events', depth: 0, limit: 1, overrideAccess: true, req,
        where: { and: [{ id: { equals: eventId } }, { community: { equals: id } }, notCancelled] } })
      const doc = result.docs[0]
      if (!doc || (!access.authenticated && !eventIsPublic(doc, church.calendarDefaultVisibility || 'members'))) return json(req, { error: 'This event is unavailable or requires church membership.' }, 404)
      const safe = visibleEvent(doc, access, id)
      const occurrenceDate = date || localDate(safe.startsAt, safe.timeZone)
      const event = eventOccurrences(safe, occurrenceDate, occurrenceDate, { includeCancelled: true }).find(item => item.date === occurrenceDate)
      if (!event) return json(req, { error: 'This event does not occur on that date.' }, 404)
      if (suffix) {
        if (event.cancelled) return json(req, { error: 'This date was cancelled.' }, 404)
        // The event's own reminder applies to everyone who adds it, signed in or not.
        const withReminder = { ...event, defaultReminderMinutes: doc.defaultReminderMinutes ?? null }
        return calendarFile(req, buildIcs([withReminder], { timeZone: church.timeZone, host: calendarHost, pageUrl: eventPageUrl }), fileName(event.title), false)
      }
      return json(req, { event, authenticated: access.authenticated, canManage: access.manager })
    } catch (error) { req.payload.logger.error({ err: error }, 'Event details failed'); return json(req, { error: 'Could not load this event. Please try again.' }, 500) }
  } })),
  // Calendar subscriptions: public events for everyone, every event behind the members' private link.
  { path: '/community/calendar/feed.ics', method: 'get', handler: async req => {
    try {
      const id = Number(await getConfiguredCommunityId(req.payload))
      const church = await req.payload.findByID({ collection: 'communities', id, depth: 0, overrideAccess: true, req })
      const docs = (await churchEvents(req, id, publicAudience(church))).filter(doc => eventIsPublic(doc, church.calendarDefaultVisibility || 'members'))
      const zone = canonicalTimeZone(church.timeZone) || 'UTC'
      const occurrences = feedOccurrences(docs.map(doc => ({ ...visibleEvent(doc, { authenticated: false, manager: false }, id),
        defaultReminderMinutes: doc.defaultReminderMinutes ?? null })), zone)
      return calendarFile(req, buildIcs(occurrences, { name: church.name || 'Church calendar', timeZone: zone, host: calendarHost, pageUrl: eventPageUrl, refreshHours: 6 }), 'church-calendar.ics', true)
    } catch (error) { req.payload.logger.error({ err: error }, 'Calendar feed failed'); return json(req, { error: 'Could not load the church calendar.' }, 500) }
  } },
  { path: '/community/calendar/members/:token/feed.ics', method: 'get', handler: async req => {
    try {
      const id = Number(await getConfiguredCommunityId(req.payload))
      if (!memberFeedTokenMatches(req.routeParams?.token, id, await feedVersion(req, id))) {
        return json(req, { error: 'This calendar link was replaced. Get the new link from your church.' }, 404)
      }
      const church = await req.payload.findByID({ collection: 'communities', id, depth: 0, overrideAccess: true, req })
      const zone = canonicalTimeZone(church.timeZone) || 'UTC'
      const occurrences = feedOccurrences((await churchEvents(req, id, null)).map(doc => visibleEvent(doc, { authenticated: true, manager: false }, id)), zone)
      return calendarFile(req, buildIcs(occurrences, { name: `${church.name || 'Church'} — members`, timeZone: zone, host: calendarHost, pageUrl: eventPageUrl, refreshHours: 6 }), 'church-members-calendar.ics', false)
    } catch (error) { req.payload.logger.error({ err: error }, 'Members calendar feed failed'); return json(req, { error: 'Could not load the church calendar.' }, 500) }
  } },
  { path: '/community/calendar/subscribe', method: 'get', handler: async req => {
    try {
      const { id, access } = await context(req)
      return json(req, feedLinks(Number(id), access.authenticated ? await feedVersion(req, Number(id)) : null))
    } catch (error) { req.payload.logger.error({ err: error }, 'Calendar links failed'); return json(req, { error: 'Could not load calendar links.' }, 500) }
  } },
  { path: '/community/calendar/subscribe/reset', method: 'post', handler: async req => {
    try {
      const { id, access } = await context(req)
      if (!access.manager) return json(req, { error: 'Sign in as a church manager to change calendar settings.' }, access.authenticated ? 403 : 401)
      const result = await transactionDatabase(req).execute(sql`UPDATE "communities" SET "calendar_feed_version" = COALESCE("calendar_feed_version", 1) + 1
        WHERE "id" = ${Number(id)} RETURNING "calendar_feed_version" AS "version"`)
      return json(req, feedLinks(Number(id), Number(result.rows?.[0]?.version)))
    } catch (error) { req.payload.logger.error({ err: error }, 'Calendar link reset failed'); return json(req, { error: 'Could not reset the calendar link.' }, 500) }
  } },
  ...(['get', 'put'] as const).map(method => ({ path: '/community/calendar/settings', method, handler: async (req: PayloadRequest) => {
    try {
      const { id, church, access } = await context(req)
      if (!access.manager) return json(req, { error: 'Sign in as a church manager to change calendar settings.' }, access.authenticated ? 403 : 401)
      if (method === 'get') return json(req, settingsBody(Number(id), church))
      const raw = await req.text?.()
      if (!raw || raw.length > 4096) return json(req, { error: 'Invalid settings.' }, 400)
      const body = JSON.parse(raw)
      const timeZone = canonicalTimeZone(body.timeZone)
      if (!timeZone || !['members', 'public'].includes(body.defaultVisibility)) return json(req, { error: 'Choose a valid time zone and calendar visibility.' }, 400)
      const startTime = body.defaultStartTime ?? '10:00'
      if (!validTimeOfDay(startTime)) return json(req, { error: 'Enter a default start time such as 10:30.' }, 400)
      const duration = Number(body.defaultDurationMinutes ?? 60)
      if (!Number.isInteger(duration) || duration < 5 || duration > 1440) return json(req, { error: 'Choose a default length between 5 minutes and 24 hours.' }, 400)
      const reminder = body.defaultReminderMinutes === null || body.defaultReminderMinutes === '' || body.defaultReminderMinutes === undefined ? null : Number(body.defaultReminderMinutes)
      if (reminder !== null && (!Number.isInteger(reminder) || reminder < 0 || reminder > 40320)) return json(req, { error: 'Choose a valid reminder.' }, 400)
      const location = typeof body.defaultLocation === 'string' ? body.defaultLocation.trim().slice(0, 300) : ''
      const updated = await req.payload.update({ collection: 'communities', id, overrideAccess: true, req, data: {
        timeZone, calendarDefaultVisibility: body.defaultVisibility, calendarDefaultStartTime: startTime, calendarDefaultDurationMinutes: duration,
        calendarDefaultReminderMinutes: reminder, calendarDefaultLocation: location || null } })
      return json(req, settingsBody(Number(id), updated))
    } catch (error) { req.payload.logger.error({ err: error }, 'Calendar settings failed'); return json(req, { error: 'Could not save calendar settings.' }, 500) }
  } })),
]
