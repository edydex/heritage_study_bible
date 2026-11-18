import { createHash, randomBytes } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { headersWithCors, type Endpoint, type PayloadRequest } from 'payload'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { communityRequestAccess } from '@/lib/communityMemberRequest'
import { consumePersistentRateLimit } from '@/lib/authRateLimit'
import { publicUrl } from '@/lib/publicConfig'
import { transactionDatabase, withSyncTransaction } from '@/lib/syncDatabase'
import {
  normalizeSubmission, paymentDetails, publicForm, registrationAvailability, registrationReference, registrationsCsv,
  RegistrationError, storedRegistrationSettings, type RegistrationRow, type RegistrationSettings, type RegistrationStatus,
} from '@/lib/eventRegistration'
import { registrationEmailEnabled, sendRegistrationEmail, type RegistrationEmail } from '@/lib/eventRegistrationEmail'
import { canonicalTimeZone, eventIsPublic } from '../../packages/calendar-core/index.js'

const HOUR = 60 * 60 * 1000
const MAX_BODY = 32 * 1024

function json(req: PayloadRequest, body: unknown, status = 200, extra?: Record<string, string>) {
  const headers = headersWithCors({ req, headers: new Headers({ 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie',
    'X-Content-Type-Options': 'nosniff', ...extra }) })
  return Response.json(body, { status, headers })
}

function clientAddress(req: PayloadRequest) {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
}

async function limited(req: PayloadRequest, key: string, maximum: number, windowMs: number) {
  const result = await consumePersistentRateLimit({ payload: req.payload, key: `event-registration:${key}`, maximum, windowMs })
  return result.allowed ? null : json(req, { error: 'Too many attempts. Please wait a little and try again.' }, 429, { 'Retry-After': String(result.retryAfter) })
}

async function readBody(req: PayloadRequest) {
  const raw = await req.text?.()
  if (!raw || raw.length > MAX_BODY) throw new RegistrationError('The form is empty or too large.')
  try { return JSON.parse(raw) } catch { throw new RegistrationError('The form could not be read.') }
}

const tokenHash = (token: string) => createHash('sha256').update(`event-registration:v1:${token}`).digest('hex')
const relationId = (value: unknown) => value && typeof value === 'object' && 'id' in value ? (value as { id: number }).id : value as number

function when(event: any, language: string) {
  const zone = canonicalTimeZone(event.timeZone) || 'UTC'
  const locale = language.startsWith('ru') ? 'ru-RU' : 'en-US'
  const format = (value: string) => new Date(value).toLocaleString(locale, { timeZone: zone, dateStyle: 'full', timeStyle: 'short' })
  return event.endsAt ? `${format(event.startsAt)} – ${format(event.endsAt)}` : format(event.startsAt)
}

/** The configured church, the requester's access, and the event if they may see it. */
async function openEvent(req: PayloadRequest) {
  const communityId = await getConfiguredCommunityId(req.payload)
  if (!communityId) throw new Error('Church settings are unavailable.')
  const eventId = String(req.routeParams?.id || '')
  if (!/^\d+$/.test(eventId)) throw new RegistrationError('Choose a valid event.', 404)
  const [church, access, found] = await Promise.all([
    req.payload.findByID({ collection: 'communities', id: communityId, depth: 0, overrideAccess: true, req }),
    communityRequestAccess(req.payload, req.headers, communityId),
    req.payload.find({ collection: 'events', depth: 0, limit: 1, overrideAccess: true, req,
      where: { and: [{ id: { equals: eventId } }, { community: { equals: communityId } }] } }),
  ])
  const event = found.docs[0] as any
  if (!event || (!access.authenticated && !eventIsPublic(event, church.calendarDefaultVisibility || 'members'))) {
    throw new RegistrationError('This event is unavailable or requires church membership.', 404)
  }
  const settings = storedRegistrationSettings(event.registration)
  if (!settings?.enabled || (event.recurrence && event.recurrence !== 'none')) {
    throw new RegistrationError('This event does not take sign-ups.', 404)
  }
  return { communityId, church, access, event, settings }
}

async function confirmedPeople(req: PayloadRequest, eventId: number | string) {
  const result = await transactionDatabase(req).execute(sql`
    SELECT COALESCE(SUM("party_size"), 0) AS "people" FROM "event_registrations"
    WHERE "event_id" = ${Number(eventId)} AND "status" = 'confirmed'`)
  return Number(result.rows?.[0]?.people || 0)
}

function emailFor(kind: RegistrationEmail['kind'], church: any, event: any, settings: RegistrationSettings,
  registration: { id: number | string; name: string; partySize: number; language?: string | null }, manageUrl: string | null): RegistrationEmail {
  const reference = registrationReference(registration.id)
  const language = registration.language || 'en'
  return { kind, language, churchName: church.name || 'Church', eventTitle: event.title, when: when(event, language),
    location: event.location, name: registration.name, partySize: registration.partySize, reference,
    payment: paymentDetails(settings, registration.partySize, reference), confirmationMessage: settings.confirmationMessage, manageUrl }
}

function failure(req: PayloadRequest, error: unknown, what: string) {
  if (error instanceof RegistrationError) return json(req, { error: error.message, field: error.field }, error.status)
  req.payload.logger.error({ err: error }, what)
  return json(req, { error: 'Something went wrong. Please try again.' }, 500)
}

/**
 * Move waitlisted sign-ups into open places, oldest first. Must run inside the
 * transaction that holds the event row lock.
 */
async function promoteWaitlist(req: PayloadRequest, eventId: number, settings: RegistrationSettings) {
  if (settings.capacity === null) {
    const waiting = await req.payload.find({ collection: 'event-registrations', overrideAccess: true, req, depth: 0, limit: 1000,
      sort: ['createdAt', 'id'], where: { and: [{ event: { equals: eventId } }, { status: { equals: 'waitlisted' } }] } })
    for (const row of waiting.docs) await req.payload.update({ collection: 'event-registrations', id: row.id, overrideAccess: true, req, data: { status: 'confirmed' } })
    return waiting.docs
  }
  let people = await confirmedPeople(req, eventId)
  const promoted = []
  const waiting = await req.payload.find({ collection: 'event-registrations', overrideAccess: true, req, depth: 0, limit: 1000,
    sort: ['createdAt', 'id'], where: { and: [{ event: { equals: eventId } }, { status: { equals: 'waitlisted' } }] } })
  for (const row of waiting.docs) {
    if (people >= settings.capacity) break
    // A larger party waits; a smaller one behind it may fit now.
    if (people + Number(row.partySize) > settings.capacity) continue
    await req.payload.update({ collection: 'event-registrations', id: row.id, overrideAccess: true, req, data: { status: 'confirmed' } })
    people += Number(row.partySize)
    promoted.push(row)
  }
  return promoted
}

export const eventRegistrationEndpoints: Endpoint[] = [
  // The public form for one event.
  { path: '/community/calendar/events/:id/registration', method: 'get', handler: async req => {
    try {
      const { access, event, settings } = await openEvent(req)
      const availability = registrationAvailability(settings, event, await confirmedPeople(req, event.id))
      const user = access.user as any
      return json(req, { form: publicForm(settings), availability, emailEnabled: registrationEmailEnabled(),
        prefill: user ? { name: user.displayName && user.displayName !== 'Reader' ? user.displayName : '', email: user.email || '' } : null })
    } catch (error) { return failure(req, error, 'Registration form failed') }
  } },

  // A visitor signs up.
  { path: '/community/calendar/events/:id/registration', method: 'post', handler: async req => {
    try {
      const blocked = await limited(req, `ip:${clientAddress(req)}`, 20, HOUR)
      if (blocked) return blocked
      const body = await readBody(req)
      // Hidden field that people never see; automated spam fills it in.
      if (typeof body?.website === 'string' && body.website.trim()) throw new RegistrationError('The form could not be submitted.')
      const { communityId, church, access, event, settings } = await openEvent(req)
      const submission = normalizeSubmission(settings, body)
      const blockedEmail = await limited(req, `email:${event.id}:${submission.email}`, 5, 24 * HOUR)
      if (blockedEmail) return blockedEmail
      const token = randomBytes(32).toString('base64url')
      const created = await withSyncTransaction(req, async () => {
        // The event row lock makes concurrent sign-ups see each other's places.
        await transactionDatabase(req).execute(sql`SELECT "id" FROM "events" WHERE "id" = ${Number(event.id)} FOR UPDATE`)
        const people = await confirmedPeople(req, event.id)
        const availability = registrationAvailability(settings, event, people, Date.now(), submission.partySize)
        if (availability.state === 'not-open-yet') throw new RegistrationError('Sign-up has not opened yet.', 409)
        if (availability.state === 'closed') throw new RegistrationError('Sign-up for this event has closed.', 409)
        if (availability.state === 'cancelled') throw new RegistrationError('This event has been cancelled.', 409)
        if (availability.state === 'full') {
          throw new RegistrationError(availability.spotsLeft
            ? `Only ${availability.spotsLeft} ${availability.spotsLeft === 1 ? 'place is' : 'places are'} left.`
            : 'This event is full.', 409, 'partySize')
        }
        const status: RegistrationStatus = availability.state === 'waitlist' ? 'waitlisted' : 'confirmed'
        const row = await req.payload.create({ collection: 'event-registrations', overrideAccess: true, req, data: {
          community: communityId, event: event.id, status, name: submission.name, email: submission.email,
          phone: submission.phone || null, partySize: submission.partySize, answers: submission.answers,
          amountDueCents: settings.priceCents ? settings.priceCents * submission.partySize : null, paid: false,
          user: access.authenticated && access.user ? access.user.id : null, language: submission.language,
        } as any })
        // Hidden from every API; written directly so only its hash is ever stored.
        await transactionDatabase(req).execute(sql`UPDATE "event_registrations" SET "manage_token_hash" = ${tokenHash(token)} WHERE "id" = ${Number(row.id)}`)
        return row
      })
      const manageUrl = `${publicUrl}/registrations/manage#${token}`
      const status = created.status as RegistrationStatus
      const reference = registrationReference(created.id)
      const emailSent = await sendRegistrationEmail(req.payload, submission.email,
        emailFor(status === 'waitlisted' ? 'waitlisted' : 'confirmed', church, event, settings, { ...created, language: submission.language } as any, manageUrl))
      if (emailSent) await req.payload.update({ collection: 'event-registrations', id: created.id, overrideAccess: true, req,
        data: { confirmationSentAt: new Date().toISOString() } })
      return json(req, { status, reference, name: submission.name, partySize: submission.partySize, emailSent,
        payment: status === 'confirmed' ? paymentDetails(settings, submission.partySize, reference) : null,
        confirmationMessage: settings.confirmationMessage, manageUrl }, 201)
    } catch (error) { return failure(req, error, 'Registration failed') }
  } },

  // The private "manage my registration" link (the token stays in the URL fragment).
  ...(['lookup', 'cancel'] as const).map(action => ({ path: `/community/registrations/${action}`, method: 'post' as const,
    handler: async (req: PayloadRequest) => {
      try {
        const blocked = await limited(req, `manage:${clientAddress(req)}`, 30, HOUR)
        if (blocked) return blocked
        const body = await readBody(req)
        const token = typeof body?.token === 'string' ? body.token : ''
        if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new RegistrationError('This link is not valid.', 404)
        const match = await transactionDatabase(req).execute(sql`SELECT "id" FROM "event_registrations" WHERE "manage_token_hash" = ${tokenHash(token)} LIMIT 1`)
        const matchId = match.rows?.[0]?.id
        if (matchId === undefined) throw new RegistrationError('This link is not valid or the sign-up was removed.', 404)
        const row = await req.payload.findByID({ collection: 'event-registrations', id: Number(matchId), overrideAccess: true, req, depth: 0 }) as any
        const event = await req.payload.findByID({ collection: 'events', id: relationId(row.event), depth: 0, overrideAccess: true, req }) as any
        const settings = storedRegistrationSettings(event.registration)
        const summary = (status: string) => ({ status, reference: registrationReference(row.id), name: row.name, partySize: row.partySize,
          event: { title: event.title, when: when(event, row.language || 'en'), location: event.location || null },
          canCancel: status !== 'cancelled' && Date.now() < Date.parse(event.endsAt || event.startsAt),
          payment: status === 'confirmed' && settings ? paymentDetails(settings, row.partySize, registrationReference(row.id)) : null,
          paid: Boolean(row.paid) })
        if (action === 'lookup') return json(req, summary(row.status))
        if (row.status === 'cancelled') return json(req, summary('cancelled'))
        if (!summary(row.status).canCancel) throw new RegistrationError('This event has already taken place.', 409)
        const promoted = await withSyncTransaction(req, async () => {
          await transactionDatabase(req).execute(sql`SELECT "id" FROM "events" WHERE "id" = ${Number(event.id)} FOR UPDATE`)
          await req.payload.update({ collection: 'event-registrations', id: row.id, overrideAccess: true, req,
            data: { status: 'cancelled', cancelledAt: new Date().toISOString() } })
          return settings && row.status === 'confirmed' ? promoteWaitlist(req, Number(event.id), settings) : []
        })
        const church = await req.payload.findByID({ collection: 'communities', id: relationId(row.community), depth: 0, overrideAccess: true, req })
        if (settings) {
          await sendRegistrationEmail(req.payload, row.email, emailFor('cancelled', church, event, settings, row, null))
          // Promoted people keep their original private link from their first email.
          for (const person of promoted as any[]) {
            await sendRegistrationEmail(req.payload, person.email, emailFor('promoted', church, event, settings, person, null))
          }
        }
        return json(req, summary('cancelled'))
      } catch (error) { return failure(req, error, `Registration ${action} failed`) }
    } })),

  // Organizer export.
  { path: '/community/calendar/events/:id/registrations.csv', method: 'get', handler: async req => {
    try {
      const communityId = await getConfiguredCommunityId(req.payload)
      if (!communityId) throw new Error('Church settings are unavailable.')
      const access = await communityRequestAccess(req.payload, req.headers, communityId)
      if (!access.manager) return json(req, { error: 'Sign in as a church manager to download sign-ups.' }, access.authenticated ? 403 : 401)
      const eventId = String(req.routeParams?.id || '')
      if (!/^\d+$/.test(eventId)) return json(req, { error: 'Choose a valid event.' }, 404)
      const event = (await req.payload.find({ collection: 'events', depth: 0, limit: 1, overrideAccess: true, req,
        where: { and: [{ id: { equals: eventId } }, { community: { equals: communityId } }] } })).docs[0] as any
      if (!event) return json(req, { error: 'This event was not found.' }, 404)
      const settings = storedRegistrationSettings(event.registration)
      const rows: RegistrationRow[] = []
      let page = 1, more = true
      while (more && page <= 50) {
        const result = await req.payload.find({ collection: 'event-registrations', overrideAccess: true, req, depth: 0, limit: 500, page,
          sort: ['createdAt', 'id'], where: { event: { equals: eventId } } })
        rows.push(...result.docs as unknown as RegistrationRow[])
        more = result.hasNextPage; page++
      }
      const name = `${String(event.title).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'event'}-sign-ups.csv`
      const headers = headersWithCors({ req, headers: new Headers({ 'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="sign-ups.csv"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }) })
      return new Response(registrationsCsv(settings, rows, settings?.currency || 'USD'), { status: 200, headers })
    } catch (error) { return failure(req, error, 'Registration export failed') }
  } },
]
