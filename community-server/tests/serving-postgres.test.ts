import assert from 'node:assert/strict'
import test from 'node:test'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { createLocalReq, getPayload, type PayloadRequest } from 'payload'
import config from '../src/payload.config.ts'
import { migrations } from '../src/migrations/index.ts'
import { servingEndpoints } from '../src/endpoints/serving.ts'
import { servicesBetween } from '../src/lib/serving.ts'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase.ts'
import { addDays, localDate } from '../packages/calendar-core/index.js'

const url = process.env.SERVING_TEST_DATABASE_URL

function endpoint(path: string) {
  const found = servingEndpoints.find(item => item.path === `/community/serving/${path}` && item.method === 'post')
  assert.ok(found, path)
  return found.handler
}

test('serving: teams, scheduling rules, requests by email or link, volunteer answers and away dates',
  { skip: !url, timeout: 180_000 }, async () => {
    assertDisposableLiveDatabase({ databaseUrl: url, expectedDatabase: 'heritage_serving_test',
      expectedMarker: 'heritage-serving-test-v1', variableName: 'SERVING_TEST_DATABASE_URL' })
    const pool = new Pool({ connectionString: url })
    const db = drizzle(pool)
    let payload: any
    const smtpHost = process.env.SMTP_HOST
    try {
      await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public')
      for (const migration of migrations) await migration.up({ db } as never)
      const resolved = await config
      resolved.db = postgresAdapter({ pool: { connectionString: url }, push: false }) as typeof resolved.db
      resolved.typescript.autoGenerate = false
      payload = await getPayload({ config })
      // Turn email on after the transport was chosen, and keep every message here instead of sending it.
      process.env.SMTP_HOST = 'smtp.example.invalid'
      const emails: Array<{ to: string; subject: string; text: string; html: string }> = []
      payload.sendEmail = async (message: any) => { emails.push(message) }

      const church = await payload.create({ collection: 'communities', overrideAccess: true, data: { name: 'Disposable church', slug: 'local-church',
        timeZone: 'America/Los_Angeles', joinPolicy: 'invite', calendarDefaultVisibility: 'members' } })
      const other = await payload.create({ collection: 'communities', overrideAccess: true, data: { name: 'Other church', slug: 'other-church',
        timeZone: 'UTC', joinPolicy: 'invite', calendarDefaultVisibility: 'members' } })
      const password = 'disposable-local-test-password'
      const account = async (email: string, role: string, community = church.id, preferredLanguage = 'en') => {
        const user = await payload.create({ collection: 'users', overrideAccess: true, data: { displayName: email.split('@')[0], email, password,
          systemRole: 'member', accountProtection: 'email', syncGeneration: 1, preferredLanguage } })
        await payload.create({ collection: 'memberships', overrideAccess: true, data: { community, user: user.id, role, joinedAt: new Date().toISOString() } })
        return user
      }
      const owner = await account('owner@example.invalid', 'owner')
      const leader = await account('leader@example.invalid', 'leader', church.id, 'ru')
      const member = await account('member@example.invalid', 'member')
      const outsider = await account('outsider@example.invalid', 'leader', other.id)
      const person = (data: Record<string, unknown>) => payload.create({ collection: 'people', overrideAccess: false, user: owner, data })
      const anna = await person({ firstName: 'Anna', lastName: 'Late', email: 'anna@example.invalid' })
      const boris = await person({ firstName: 'Boris', lastName: '<Ivanov>' })
      const elsewhere = await payload.create({ collection: 'people', overrideAccess: true, data: { community: other.id, firstName: 'Far', lastName: 'Away' } })

      // A weekly service that started last week.
      const today = localDate(new Date(), 'America/Los_Angeles')
      const event = await payload.create({ collection: 'events', overrideAccess: true, data: { community: church.id, title: 'Sunday service',
        startsAt: new Date(`${addDays(today, -7)}T17:30:00Z`).toISOString(), timeZone: 'America/Los_Angeles', recurrence: 'weekly', repeatInterval: 1 } })
      const [first, second] = servicesBetween([event], today, 14)
      assert.ok(first && second)

      // Teams: leaders manage them for their own church; members cannot see them.
      await assert.rejects(payload.create({ collection: 'teams', overrideAccess: false, user: leader,
        data: { name: 'Twice', positions: [{ name: 'Vocals', needed: 1 }, { name: ' vocals ', needed: 1 }] } }), /listed twice/)
      const team = await payload.create({ collection: 'teams', overrideAccess: false, user: leader, data: { name: ' Worship ',
        positions: [{ name: 'Vocals', needed: 2 }, { name: 'Guitar', needed: 1 }], members: [anna.id, boris.id] } })
      assert.equal(team.name, 'Worship')
      assert.equal(team.community?.id ?? team.community, church.id, 'the configured church is the default')
      const [vocals, guitar] = team.positions
      await assert.rejects(payload.update({ collection: 'teams', id: team.id, overrideAccess: false, user: leader,
        data: { members: [anna.id, elsewhere.id] } }), /this church’s directory/)
      await assert.rejects(payload.find({ collection: 'teams', overrideAccess: false, user: member }), /not allowed/)
      await assert.rejects(payload.create({ collection: 'teams', overrideAccess: false, user: outsider,
        data: { name: 'Intruders', positions: [{ name: 'X', needed: 1 }] } }), /own church/)

      // Scheduling rules.
      const schedule = (data: Record<string, unknown>, user: unknown = leader) =>
        payload.create({ collection: 'serving-assignments', overrideAccess: false, user, data })
      const annaVocals = await schedule({ event: event.id, date: first.date, team: team.id, positionId: vocals.id, person: anna.id,
        requestedAt: '2020-01-01T00:00:00.000Z', scheduledBy: owner.id })
      assert.equal(annaVocals.position, 'Vocals')
      assert.equal(annaVocals.status, 'pending')
      assert.equal(annaVocals.requestedAt ?? null, null, 'only sending a request marks it as asked')
      assert.equal(annaVocals.scheduledBy?.id ?? annaVocals.scheduledBy, leader.id)
      await assert.rejects(schedule({ event: event.id, date: first.date, team: team.id, positionId: vocals.id, person: anna.id }), /already scheduled/)
      await assert.rejects(schedule({ event: event.id, date: addDays(first.date, 1), team: team.id, positionId: vocals.id, person: anna.id }), /does not take place/)
      await assert.rejects(schedule({ event: event.id, date: first.date, team: team.id, positionId: 'missing', person: anna.id }), /team’s positions/)
      await assert.rejects(schedule({ event: event.id, date: first.date, team: team.id, positionId: vocals.id, person: elsewhere.id }), /this church’s directory/)
      await assert.rejects(schedule({ event: event.id, date: first.date, team: team.id, positionId: vocals.id, person: boris.id }, outsider), /own church/)
      await assert.rejects(schedule({ event: event.id, date: first.date, team: team.id, positionId: vocals.id, person: boris.id }, member), /not allowed/)
      const borisGuitar = await schedule({ event: event.id, date: first.date, team: team.id, positionId: guitar.id, person: boris.id })
      const annaLater = await schedule({ event: event.id, date: second.date, team: team.id, positionId: guitar.id, person: anna.id })

      // Who, when and where are fixed; managers can record an answer they heard in person.
      const changed = await payload.update({ collection: 'serving-assignments', id: annaLater.id, overrideAccess: false, user: owner,
        data: { person: boris.id, date: first.date, status: 'accepted' } })
      assert.equal(changed.person?.id ?? changed.person, anna.id)
      assert.equal(changed.date, second.date)
      assert.equal(changed.status, 'accepted')
      assert.ok(changed.respondedAt)
      const reset = await payload.update({ collection: 'serving-assignments', id: annaLater.id, overrideAccess: false, user: owner, data: { status: 'pending' } })
      assert.equal(reset.respondedAt ?? null, null)

      // Requests: sign-in is required; people with email get one; the rest get a link to share.
      let ip = 0
      const request = async (body: unknown, headers: Record<string, string> = {}) => {
        const req: any = await createLocalReq({}, payload)
        req.headers = new Headers({ 'cf-connecting-ip': `203.0.113.${++ip % 250}`, ...headers })
        req.url = 'http://localhost/api/test'
        req.user = null
        req.text = async () => JSON.stringify(body)
        return req as PayloadRequest
      }
      const login = async (email: string) => ({ Authorization: `JWT ${(await payload.login({ collection: 'users', data: { email, password } })).token}` })
      const send = endpoint('send')
      assert.equal((await send(await request({ service: first.key }))).status, 401)
      assert.equal((await send(await request({ service: first.key }, await login('member@example.invalid')))).status, 403)
      const leaderAuth = await login('leader@example.invalid')
      const sent = await (await send(await request({ service: first.key }, leaderAuth))).json()
      assert.deepEqual(sent, { emailEnabled: true, sent: ['Anna Late'], withoutEmail: [{ personId: boris.id, name: 'Boris <Ivanov>' }], failed: [] })
      assert.equal(emails.length, 1)
      assert.equal(emails[0].to, 'anna@example.invalid')
      assert.match(emails[0].subject, /^Сможете послужить /, 'without an account, the sender’s language is used')
      assert.match(emails[0].text, /Worship — Vocals/)
      const link = /http:\/\/127\.0\.0\.1:3000\/serving#(\S+)/.exec(emails[0].text)
      assert.ok(link, emails[0].text)
      const token = link[1]
      const asked = await pool.query('SELECT id, requested_at FROM serving_assignments ORDER BY id')
      assert.deepEqual(asked.rows.map(row => Boolean(row.requested_at)), [true, false, false])
      assert.equal((await (await send(await request({ service: first.key }, leaderAuth))).json()).sent.length, 0, 'nobody is asked twice')
      const shared = await (await endpoint('link')(await request({ personId: boris.id, service: first.key }, leaderAuth))).json()
      assert.match(shared.url, /\/serving#\d+\.1\./)
      assert.ok((await pool.query('SELECT requested_at FROM serving_assignments WHERE id = $1', [borisGuitar.id])).rows[0].requested_at)
      assert.equal((await endpoint('link')(await request({ personId: elsewhere.id }, leaderAuth))).status, 404)

      // The volunteer's private page.
      const volunteer = async (path: string, body: Record<string, unknown> = {}) => endpoint(path)(await request({ token, ...body }))
      const page = await (await volunteer('me')).json()
      assert.equal(page.name, 'Anna')
      assert.deepEqual(page.assignments.map((row: any) => [row.date, row.position, row.team, row.status]),
        [[first.date, 'Vocals', 'Worship', 'pending'], [second.date, 'Guitar', 'Worship', 'pending']])
      assert.equal(page.assignments[0].startsAt, first.startsAt)
      assert.equal((await endpoint('me')(await request({ token: `${token.slice(0, -1)}A` }))).status, 404)

      const declined = await (await volunteer('respond', { assignmentId: annaVocals.id, answer: 'declined', note: '  Visiting   family ' })).json()
      assert.equal(declined.assignments[0].status, 'declined')
      assert.equal(declined.assignments[0].note, 'Visiting family')
      assert.equal(emails.length, 2, 'the person who scheduled them hears about it')
      assert.equal(emails[1].to, 'leader@example.invalid')
      assert.match(emails[1].subject, /^Anna Late не сможет послужить/)
      assert.match(emails[1].text, /Visiting family/)
      assert.match(emails[1].text, new RegExp(`/admin/serving\\?service=${event.id}%3A${first.date}`))
      await volunteer('respond', { assignmentId: annaVocals.id, answer: 'accepted' })
      assert.equal(emails.length, 2, 'accepting sends nothing')
      assert.equal((await volunteer('respond', { assignmentId: borisGuitar.id, answer: 'accepted' })).status, 404, 'only their own dates')
      assert.equal((await volunteer('respond', { assignmentId: annaVocals.id, answer: 'maybe' })).status, 400)

      // Away dates from the private link.
      const away = await (await volunteer('away', { startDate: second.date, endDate: second.date, reason: 'Trip' })).json()
      assert.deepEqual(away.away.map((row: any) => [row.startDate, row.endDate, row.reason]), [[second.date, second.date, 'Trip']])
      assert.equal((await volunteer('away', { startDate: addDays(today, -3), endDate: addDays(today, -2) })).status, 400)
      assert.equal((await volunteer('away', { startDate: second.date, endDate: first.date })).status, 400)
      const borisAway = await payload.create({ collection: 'serving-blockouts', overrideAccess: false, user: owner,
        data: { person: boris.id, startDate: second.date, endDate: second.date } })
      await volunteer('away/remove', { id: borisAway.id })
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM serving_blockouts')).rows[0].n, 2, 'only their own away dates')
      assert.equal((await (await volunteer('away/remove', { id: away.away[0].id })).json()).away.length, 0)

      // A new link replaces the old one.
      const renewed = await (await endpoint('reset-link')(await request({ personId: anna.id }, leaderAuth))).json()
      assert.equal((await volunteer('me')).status, 404)
      const fresh = renewed.url.split('#')[1]
      assert.equal((await endpoint('me')(await request({ token: fresh }))).status, 200)

      // Schedules go with the people, teams and services they belong to.
      await payload.delete({ collection: 'people', id: boris.id, overrideAccess: false, user: owner })
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM serving_assignments WHERE person_id = $1', [boris.id])).rows[0].n, 0)
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM teams_rels WHERE people_id = $1', [boris.id])).rows[0].n, 0)
      await payload.delete({ collection: 'teams', id: team.id, overrideAccess: false, user: leader })
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM serving_assignments')).rows[0].n, 0)
    } finally {
      if (smtpHost === undefined) delete process.env.SMTP_HOST
      else process.env.SMTP_HOST = smtpHost
      if (payload) await payload.destroy()
      await pool.end()
    }
  })
