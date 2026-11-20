import assert from 'node:assert/strict'
import test from 'node:test'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { createLocalReq, getPayload, type PayloadRequest } from 'payload'
import config from '../src/payload.config.ts'
import { migrations } from '../src/migrations/index.ts'
import { calendarEndpoints } from '../src/endpoints/calendar.ts'
import { servicesBetween } from '../src/lib/serving.ts'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase.ts'
import { addDays, localDate, localDateTime, localToInstant } from '../packages/calendar-core/index.js'

const url = process.env.CALENDAR_TEST_DATABASE_URL
const zone = 'America/Los_Angeles'

function endpoint(path: string, method = 'get') {
  const found = calendarEndpoints.find(item => item.path === path && item.method === method)
  assert.ok(found, `${method} ${path}`)
  return found.handler
}

test('calendar: defaults, all-day events, single-date changes, calendar files and subscriptions',
  { skip: !url, timeout: 180_000 }, async () => {
    assertDisposableLiveDatabase({ databaseUrl: url, expectedDatabase: 'heritage_calendar_test',
      expectedMarker: 'heritage-calendar-test-v1', variableName: 'CALENDAR_TEST_DATABASE_URL' })
    const pool = new Pool({ connectionString: url })
    const db = drizzle(pool)
    let payload: any
    try {
      await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
      // Older rows: a "PST" time zone and an event saved before "cancelled" had a value.
      for (const migration of migrations.slice(0, -1)) await migration.up({ db } as never)
      const legacyChurch = (await pool.query(`INSERT INTO communities (name, slug, time_zone, join_policy, calendar_default_visibility)
        VALUES ('Disposable church', 'local-church', 'PST', 'invite', 'members') RETURNING id`)).rows[0].id
      const legacy = (await pool.query(`INSERT INTO events (community_id, title, starts_at, time_zone, visibility, recurrence)
        VALUES ($1, 'Prayer Retreat', '2026-09-24T12:00:00Z', 'PST', 'public', 'none') RETURNING id`, [legacyChurch])).rows[0].id
      await pool.query('UPDATE events SET cancelled = NULL WHERE id = $1', [legacy])
      await migrations.at(-1)!.up({ db } as never)
      assert.deepEqual((await pool.query('SELECT time_zone FROM events UNION ALL SELECT time_zone FROM communities')).rows.map(row => row.time_zone), [zone, zone])

      const resolved = await config
      resolved.db = postgresAdapter({ pool: { connectionString: url }, push: false }) as typeof resolved.db
      resolved.typescript.autoGenerate = false
      payload = await getPayload({ config })
      const church = await payload.findByID({ collection: 'communities', id: legacyChurch, overrideAccess: true })
      const password = 'disposable-local-test-password'
      const account = async (email: string, role: string) => {
        const user = await payload.create({ collection: 'users', overrideAccess: true, data: { displayName: email, email, password,
          systemRole: 'member', accountProtection: 'email', syncGeneration: 1 } })
        await payload.create({ collection: 'memberships', overrideAccess: true, data: { community: church.id, user: user.id, role, joinedAt: new Date().toISOString() } })
        return user
      }
      const manager = await account('manager@example.invalid', 'leader')
      await account('member@example.invalid', 'member')
      const login = async (email: string) => ({ Authorization: `JWT ${(await payload.login({ collection: 'users', data: { email, password } })).token}` })
      const managerAuth = await login('manager@example.invalid')
      const memberAuth = await login('member@example.invalid')
      let ip = 0
      const request = async (path: string, { headers = {}, body, params = {} }: { headers?: Record<string, string>; body?: unknown; params?: Record<string, string> } = {}) => {
        const req: any = await createLocalReq({}, payload)
        req.headers = new Headers({ 'cf-connecting-ip': `203.0.113.${++ip % 250}`, ...headers })
        req.url = `http://localhost/api${path}`
        req.routeParams = params
        req.user = null
        req.text = async () => body === undefined ? '' : JSON.stringify(body)
        return req as PayloadRequest
      }

      // Church defaults for new events.
      const settings = endpoint('/community/calendar/settings', 'put')
      assert.equal((await settings(await request('/community/calendar/settings', { headers: memberAuth, body: { timeZone: zone, defaultVisibility: 'public' } }))).status, 403)
      assert.equal((await settings(await request('/community/calendar/settings', { headers: managerAuth,
        body: { timeZone: zone, defaultVisibility: 'members', defaultStartTime: '25:00' } }))).status, 400)
      const saved = await (await settings(await request('/community/calendar/settings', { headers: managerAuth, body: { timeZone: 'PST', defaultVisibility: 'members',
        defaultStartTime: '10:30', defaultDurationMinutes: 90, defaultReminderMinutes: null, defaultLocation: 'Main hall' } }))).json()
      assert.deepEqual(saved, { communityId: church.id, timeZone: zone, defaultVisibility: 'members', defaultStartTime: '10:30',
        defaultDurationMinutes: 90, defaultReminderMinutes: null, defaultLocation: 'Main hall' })

      const create = (data: Record<string, unknown>) => payload.create({ collection: 'events', overrideAccess: false, user: manager, data })
      const today = localDate(Date.now(), zone)
      const sundayDate = addDays(today, 7 - new Date(`${today}T12:00:00Z`).getUTCDay())
      const sunday = await create({ title: 'Sunday service', startsAt: localToInstant(`${sundayDate}T10:30`, zone),
        endsAt: localToInstant(`${sundayDate}T12:00`, zone), recurrence: 'weekly', repeatInterval: 1, visibility: 'public' })
      assert.equal(sunday.timeZone, zone, 'the church time zone is the default')
      assert.equal(sunday.location, 'Main hall')
      assert.equal(sunday.defaultReminderMinutes ?? null, null, 'the church default reminder is none')
      assert.equal(sunday.community?.id ?? sunday.community, church.id)

      // Single-date changes must be real dates of the series.
      const [second, third, fourth] = [7, 14, 21].map(days => addDays(sundayDate, days))
      const change = (exceptions: unknown[]) => payload.update({ collection: 'events', id: sunday.id, overrideAccess: false, user: manager, data: { exceptions } })
      const problems = async (work: Promise<unknown>) => { try { await work; return '' } catch (error: any) { return JSON.stringify(error.data?.errors ?? error.message) } }
      assert.match(await problems(change([{ date: addDays(second, 1), cancelled: true }])), /not one of this event’s dates/)
      assert.match(await problems(change([{ date: second, cancelled: true }, { date: second, title: 'Twice' }])), /listed twice/)
      assert.match(await problems(change([{ date: second, startTime: '12:00', endTime: '11:00' }])), /end must be after/)
      const changed = await change([{ date: third, startTime: ' 18:00', endTime: '19:30', title: 'Evening service', note: ' Joint service ' },
        { date: second, cancelled: true, title: 'ignored', startTime: '09:00' }])
      assert.deepEqual(changed.exceptions.map((row: any) => [row.date, row.cancelled, row.startTime ?? null, row.title ?? null, row.note ?? null]),
        [[second, true, null, null, null], [third, false, '18:00', 'Evening service', 'Joint service']], 'sorted, trimmed, and a cancelled date keeps no times')

      // Serving schedules follow the calendar.
      assert.deepEqual(servicesBetween([changed], sundayDate, 28).map(service => service.date), [sundayDate, third, fourth])

      // The public calendar leaves cancelled dates out; managers can see them to restore them.
      const calendar = endpoint('/community/calendar')
      const month = async (headers: Record<string, string> = {}, extra = '') =>
        (await (await calendar(await request(`/community/calendar?from=${sundayDate}&to=${addDays(sundayDate, 27)}${extra}`, { headers }))).json()).events
      const visitor = await month({}, '&includeCancelled=1')
      assert.deepEqual(visitor.map((event: any) => event.date), [sundayDate, third, fourth])
      assert.ok(visitor.every((event: any) => !('exceptions' in event) && !('defaultReminderMinutes' in event)))
      const evening = visitor.find((event: any) => event.date === third)
      assert.deepEqual([localDateTime(evening.startsAt, zone).slice(11), evening.title, evening.note], ['18:00', 'Evening service', 'Joint service'])
      assert.deepEqual((await month(managerAuth, '&includeCancelled=1')).filter((event: any) => event.cancelled).map((event: any) => event.date), [second])

      // All-day events become whole dates; an event saved before "cancelled" had a value still shows.
      const retreat = await create({ title: 'Members retreat', allDay: true, visibility: 'members',
        startsAt: localToInstant(`${addDays(sundayDate, 5)}T15:00`, zone), endsAt: localToInstant(`${addDays(sundayDate, 6)}T09:00`, zone) })
      assert.deepEqual([localDateTime(retreat.startsAt, zone), localDateTime(retreat.endsAt, zone)], [`${addDays(sundayDate, 5)}T00:00`, `${addDays(sundayDate, 7)}T00:00`])
      assert.ok((await month(memberAuth)).some((event: any) => event.title === 'Members retreat' && event.allDay))
      assert.ok(!(await month()).some((event: any) => event.title === 'Members retreat'), 'members-only events stay private')
      const legacyRange = await (await calendar(await request('/community/calendar?from=2026-09-20&to=2026-09-30'))).json()
      assert.deepEqual(legacyRange.events.map((event: any) => event.title), ['Prayer Retreat'])

      // Moving the whole series retires date changes that no longer line up.
      const moved = await payload.update({ collection: 'events', id: sunday.id, overrideAccess: false, user: manager,
        data: { startsAt: localToInstant(`${addDays(sundayDate, 1)}T10:30`, zone), endsAt: localToInstant(`${addDays(sundayDate, 1)}T12:00`, zone) } })
      assert.equal(moved.exceptions.length, 0)
      await payload.update({ collection: 'events', id: sunday.id, overrideAccess: false, user: manager, data: {
        startsAt: sunday.startsAt, endsAt: sunday.endsAt, defaultReminderMinutes: 30,
        exceptions: [{ date: second, cancelled: true }, { date: third, startTime: '18:00', title: 'Evening service' }] } })

      // "Add to my calendar" for one date.
      const file = endpoint('/community/calendar/events/:id/event.ics')
      const download = async (id: number, date: string, headers: Record<string, string> = {}) =>
        file(await request(`/community/calendar/events/${id}/event.ics?date=${date}`, { headers, params: { id: String(id) } }))
      const one = await download(sunday.id, third)
      assert.equal(one.headers.get('content-type'), 'text/calendar; charset=utf-8')
      const oneText = await one.text()
      assert.match(oneText, /SUMMARY:Evening service/)
      assert.match(oneText, /TRIGGER:-PT30M/)
      assert.equal((await download(sunday.id, second)).status, 404, 'a cancelled date cannot be added')
      assert.equal((await download(retreat.id, addDays(sundayDate, 5))).status, 404, 'members-only events need a sign-in')
      assert.equal((await download(retreat.id, addDays(sundayDate, 5), memberAuth)).status, 200)
      const details = await (await endpoint('/community/calendar/events/:id')(await request(`/community/calendar/events/${sunday.id}?date=${second}`, { params: { id: String(sunday.id) } }))).json()
      assert.equal(details.event.cancelled, true)

      // Subscriptions: public events for everyone; the members' link has every event and can be replaced.
      const feed = await (await endpoint('/community/calendar/feed.ics')(await request('/community/calendar/feed.ics'))).text()
      assert.match(feed, new RegExp(`UID:church-event-${sunday.id}-${sundayDate}@`))
      assert.doesNotMatch(feed, new RegExp(`UID:church-event-${sunday.id}-${second}@`))
      assert.doesNotMatch(feed, /Members retreat/)
      assert.match(feed, /X-WR-CALNAME:Disposable church/)
      const links = endpoint('/community/calendar/subscribe')
      assert.equal((await (await links(await request('/community/calendar/subscribe'))).json()).members, undefined)
      const memberLinks = await (await links(await request('/community/calendar/subscribe', { headers: memberAuth }))).json()
      assert.match(memberLinks.members.webcal, /^webcal:\/\//)
      const token = /members\/([^/]+)\/feed\.ics$/.exec(memberLinks.members.url)![1]
      const membersFeed = endpoint('/community/calendar/members/:token/feed.ics')
      const privateFeed = async (value: string) => membersFeed(await request(`/community/calendar/members/${value}/feed.ics`, { params: { token: value } }))
      assert.match(await (await privateFeed(token)).text(), /Members retreat/)
      assert.equal((await privateFeed(`${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`)).status, 404)
      const reset = endpoint('/community/calendar/subscribe/reset', 'post')
      assert.equal((await reset(await request('/community/calendar/subscribe/reset', { headers: memberAuth }))).status, 403)
      const renewed = await (await reset(await request('/community/calendar/subscribe/reset', { headers: managerAuth }))).json()
      assert.equal((await privateFeed(token)).status, 404, 'the old link stops working')
      const newToken = /members\/([^/]+)\/feed\.ics$/.exec(renewed.members.url)![1]
      assert.equal((await privateFeed(newToken)).status, 200)
    } finally {
      if (payload) await payload.destroy()
      await pool.end()
    }
  })
