import { headersWithCors, type Endpoint, type PayloadRequest, type Where } from 'payload'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { communityRequestAccess } from '@/lib/communityMemberRequest'
import { eventIsPublic, eventOccurrences, validDate, validTimeZone } from '../../packages/calendar-core/index.js'

function json(req: PayloadRequest, body: unknown, status = 200) {
  const headers = headersWithCors({ req, headers: new Headers({ 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie', 'X-Content-Type-Options': 'nosniff' }) })
  return Response.json(body, { status, headers })
}
async function context(req: PayloadRequest) {
  const id = await getConfiguredCommunityId(req.payload)
  if (!id) throw new Error('Church settings are unavailable.')
  const church = await req.payload.findByID({ collection: 'communities', id, depth: 0, overrideAccess: true, req })
  const access = await communityRequestAccess(req.payload, req.headers, id)
  return { id, church, access }
}
export const calendarEndpoints: Endpoint[] = [
  { path: '/community/calendar', method: 'get', handler: async req => {
    try {
      const { id, church, access } = await context(req)
      const url = new URL(req.url || '/', 'http://localhost')
      const from = url.searchParams.get('from') || '', to = url.searchParams.get('to') || ''
      if (!validDate(from) || !validDate(to) || from > to || Date.parse(to) - Date.parse(from) > 62 * 86400000) return json(req, { error: 'Choose a calendar range of at most 63 days.' }, 400)
      const audience: Where = access.authenticated ? {} : { or: [
        { visibility: { equals: 'public' } },
        ...(church.calendarDefaultVisibility === 'public' ? [{ visibility: { equals: 'inherit' } }] : []),
      ] }
      const events = []
      let page = 1, more = true
      while (more) {
        const result = await req.payload.find({ collection: 'events', overrideAccess: true, req, depth: 0, limit: 250, page,
          sort: ['startsAt', 'id'], where: { and: [{ community: { equals: id } }, { cancelled: { not_equals: true } }, audience] } })
        for (const doc of result.docs) {
          if (!access.authenticated && !eventIsPublic(doc, church.calendarDefaultVisibility || 'members')) continue
          // Public responses deliberately omit relationship, RSVP and audit metadata.
          const event = { id: doc.id, title: doc.title, description: doc.description, startsAt: doc.startsAt, endsAt: doc.endsAt,
            timeZone: doc.timeZone, location: doc.location, url: doc.url, recurrence: doc.recurrence,
            repeatInterval: doc.repeatInterval, repeatUntil: doc.repeatUntil,
            ...(access.authenticated ? { rsvpEnabled: doc.rsvpEnabled, defaultReminderMinutes: doc.defaultReminderMinutes } : {}),
            ...(access.manager ? { visibility: doc.visibility } : {}) }
          events.push(...eventOccurrences(event, from, to))
        }
        more = result.hasNextPage; page++
        if (page > 40 && more) return json(req, { error: 'The calendar is too large to load. Please contact your church administrator.' }, 422)
      }
      events.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title) || Number(a.id) - Number(b.id))
      return json(req, { events, timeZone: church.timeZone, authenticated: access.authenticated, canManage: access.manager })
    } catch (error) { req.payload.logger.error({ err: error }, 'Calendar failed'); return json(req, { error: 'Could not load the church calendar.' }, 500) }
  } },
  ...(['get', 'put'] as const).map(method => ({ path: '/community/calendar/settings', method, handler: async (req: PayloadRequest) => {
    try {
      const { id, church, access } = await context(req)
      if (!access.manager) return json(req, { error: 'Sign in as a church manager to change calendar settings.' }, access.authenticated ? 403 : 401)
      if (method === 'get') return json(req, { communityId: id, timeZone: church.timeZone, defaultVisibility: church.calendarDefaultVisibility || 'members' })
      const raw = await req.text?.()
      if (!raw || raw.length > 2048) return json(req, { error: 'Invalid settings.' }, 400)
      const body = JSON.parse(raw)
      if (!validTimeZone(body.timeZone) || !['members', 'public'].includes(body.defaultVisibility)) return json(req, { error: 'Choose a valid time zone and calendar visibility.' }, 400)
      await req.payload.update({ collection: 'communities', id, overrideAccess: true, req, data: { timeZone: body.timeZone, calendarDefaultVisibility: body.defaultVisibility } })
      return json(req, { communityId: id, timeZone: body.timeZone, defaultVisibility: body.defaultVisibility })
    } catch (error) { req.payload.logger.error({ err: error }, 'Calendar settings failed'); return json(req, { error: 'Could not save calendar settings.' }, 500) }
  } })),
]
