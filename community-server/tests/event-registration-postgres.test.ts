import assert from 'node:assert/strict'
import test from 'node:test'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { createLocalReq, getPayload, type PayloadRequest } from 'payload'
import config from '../src/payload.config.ts'
import { migrations } from '../src/migrations/index.ts'
import { eventRegistrationEndpoints } from '../src/endpoints/eventRegistration.ts'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase.ts'

const url = process.env.EVENT_REGISTRATION_TEST_DATABASE_URL

function endpoint(path: string, method: string) {
  const found = eventRegistrationEndpoints.find(item => item.path === path && item.method === method)
  assert.ok(found, `${method} ${path}`)
  return found.handler
}

test('event sign-up: migration, capacity under concurrency, waitlist promotion, private links and organizer export',
  { skip: !url, timeout: 180_000 }, async () => {
    assertDisposableLiveDatabase({ databaseUrl: url, expectedDatabase: 'heritage_event_registration_test',
      expectedMarker: 'heritage-event-registration-test-v1', variableName: 'EVENT_REGISTRATION_TEST_DATABASE_URL' })
    const pool = new Pool({ connectionString: url })
    const db = drizzle(pool)
    let payload: any
    try {
      await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
      for (const migration of migrations) await migration.up({ db } as never)
      const resolved = await config
      resolved.db = postgresAdapter({ pool: { connectionString: url }, push: false }) as typeof resolved.db
      resolved.typescript.autoGenerate = false
      payload = await getPayload({ config })

      const church = await payload.create({ collection: 'communities', overrideAccess: true, data: { name: 'Disposable church', slug: 'local-church',
        timeZone: 'America/Los_Angeles', joinPolicy: 'invite', calendarDefaultVisibility: 'public' } })
      const password = 'disposable-local-test-password'
      const user = async (email: string, role: string) => {
        const created = await payload.create({ collection: 'users', overrideAccess: true, data: { displayName: email, email, password,
          systemRole: 'member', accountProtection: 'email', syncGeneration: 1 } })
        await payload.create({ collection: 'memberships', overrideAccess: true, data: { community: church.id, user: created.id, role, joinedAt: new Date().toISOString() } })
        return created
      }
      const manager = await user('manager@example.invalid', 'leader')
      const member = await user('member@example.invalid', 'member')
      const startsAt = new Date(Date.now() + 7 * 86400000).toISOString()
      const registration = { enabled: true, capacity: 3, waitlist: true, maxPartySize: 3, phone: 'off', priceCents: 1500, currency: 'USD',
        paymentMethods: [{ kind: 'cashapp', handle: '$Disposable' }],
        questions: [{ id: 'size', label: 'T-shirt size', type: 'choice', required: true, options: ['S', 'M'] }] }
      const event = await payload.create({ collection: 'events', overrideAccess: true, data: { community: church.id, title: 'Youth retreat',
        startsAt, timeZone: 'America/Los_Angeles', visibility: 'public', recurrence: 'none', registration } })
      // Recurring events cannot take sign-ups.
      await assert.rejects(payload.update({ collection: 'events', id: event.id, overrideAccess: true, data: { recurrence: 'weekly' } }),
        (error: any) => /do not repeat/.test(JSON.stringify(error.data?.errors ?? [])))

      let ip = 0
      const request = async (body: unknown, headers: Record<string, string> = {}, routeId = event.id) => {
        const req: any = await createLocalReq({}, payload)
        req.headers = new Headers({ 'cf-connecting-ip': `203.0.113.${++ip % 250}`, ...headers })
        req.routeParams = { id: String(routeId) }
        req.url = 'http://localhost/api/test'
        req.user = null
        req.text = async () => typeof body === 'string' ? body : JSON.stringify(body)
        return req as PayloadRequest
      }
      const signUp = endpoint('/community/calendar/events/:id/registration', 'post')
      const form = endpoint('/community/calendar/events/:id/registration', 'get')

      const loaded = await (await form(await request(null))).json()
      assert.equal(loaded.availability.state, 'open')
      assert.equal(loaded.availability.spotsLeft, 3)
      assert.equal(loaded.form.price.amount, '$15.00')
      assert.equal(loaded.form.paymentMethods, undefined)

      const invalid = await signUp(await request({ name: 'No size', email: 'x@example.invalid', answers: {} }))
      assert.equal(invalid.status, 400)
      assert.equal((await invalid.json()).field, 'size')
      const spam = await signUp(await request({ name: 'Bot', email: 'bot@example.invalid', answers: { size: 'S' }, website: 'http://spam' }))
      assert.equal(spam.status, 400)

      // Five people race for three places: exactly three are confirmed.
      const responses = await Promise.all(Array.from({ length: 5 }, async (_, index) =>
        (await signUp(await request({ name: `Racer ${index}`, email: `racer${index}@example.invalid`, partySize: 1, answers: { size: 'M' } }))).json()))
      assert.deepEqual(responses.map(item => item.status).sort(), ['confirmed', 'confirmed', 'confirmed', 'waitlisted', 'waitlisted'])
      const confirmed = responses.find(item => item.status === 'confirmed')
      assert.equal(confirmed.payment.amount, '$15.00')
      assert.equal(confirmed.payment.options[0].url, 'https://cash.app/$Disposable/15.00')
      assert.equal(responses.find(item => item.status === 'waitlisted').payment, null)
      const stored = await pool.query("SELECT status, manage_token_hash FROM event_registrations WHERE event_id = $1", [event.id])
      assert.equal(stored.rowCount, 5)
      assert.ok(stored.rows.every(row => /^[0-9a-f]{64}$/.test(row.manage_token_hash)), 'only token hashes are stored')

      // The private link: look up, then cancel; the oldest waitlisted person moves up.
      const token = new URL(confirmed.manageUrl).hash.slice(1)
      const lookup = endpoint('/community/registrations/lookup', 'post')
      const cancel = endpoint('/community/registrations/cancel', 'post')
      assert.equal((await lookup(await request({ token: 'x'.repeat(43) }))).status, 404)
      const summary = await (await lookup(await request({ token }))).json()
      assert.equal(summary.status, 'confirmed')
      assert.equal(summary.event.title, 'Youth retreat')
      assert.equal((await (await cancel(await request({ token }))).json()).status, 'cancelled')
      const after = await pool.query("SELECT status, count(*)::int AS n FROM event_registrations WHERE event_id = $1 GROUP BY status ORDER BY status", [event.id])
      assert.deepEqual(Object.fromEntries(after.rows.map(row => [row.status, row.n])), { cancelled: 1, confirmed: 3, waitlisted: 1 })
      // Cancelling twice is harmless.
      assert.equal((await (await cancel(await request({ token }))).json()).status, 'cancelled')

      // Members cannot read other people's sign-ups through the REST collection; managers can.
      await assert.rejects(payload.find({ collection: 'event-registrations', overrideAccess: false, user: member }), /not allowed/)
      assert.equal((await payload.find({ collection: 'event-registrations', overrideAccess: false, user: manager })).totalDocs, 5)
      await assert.rejects(payload.create({ collection: 'event-registrations', overrideAccess: false, user: manager,
        data: { community: church.id, event: event.id, name: 'x', email: 'x@example.invalid', partySize: 1 } }))

      // Organizer export requires a manager.
      const csv = endpoint('/community/calendar/events/:id/registrations.csv', 'get')
      assert.equal((await csv(await request(null))).status, 401)
      const memberLogin = await payload.login({ collection: 'users', data: { email: 'member@example.invalid', password } })
      assert.equal((await csv(await request(null, { Authorization: `JWT ${memberLogin.token}` }))).status, 403)
      const login = await payload.login({ collection: 'users', data: { email: 'manager@example.invalid', password } })
      const exported = await csv(await request(null, { Authorization: `JWT ${login.token}` }))
      assert.equal(exported.status, 200)
      const text = await exported.text()
      assert.match(text, /"T-shirt size"/)
      assert.equal(text.trim().split('\r\n').length, 6)

      // Members-only events are hidden from anonymous visitors.
      const privateEvent = await payload.create({ collection: 'events', overrideAccess: true, data: { community: church.id, title: 'Leaders dinner',
        startsAt, timeZone: 'America/Los_Angeles', visibility: 'members', recurrence: 'none', registration: { enabled: true } } })
      assert.equal((await form(await request(null, {}, privateEvent.id))).status, 404)
      assert.equal((await form(await request(null, { Authorization: `JWT ${memberLogin.token}` }, privateEvent.id))).status, 200)
    } finally {
      if (payload) await payload.destroy()
      await pool.end()
    }
  })
