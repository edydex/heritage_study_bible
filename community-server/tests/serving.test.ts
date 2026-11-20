import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  candidateNotes, formatServiceDay, parseServiceKey, serviceFill, serviceOn, servicesBetween, teamPositions, validateBlockout,
  type AssignmentRecord,
} from '../src/lib/serving'
import { servingDeclineContent, servingRequestContent } from '../src/lib/servingEmail'
import { migrations } from '../src/migrations'

process.env.PAYLOAD_SECRET ||= 'unit-test-secret-at-least-thirty-two-characters'

const sunday = { id: 7, title: 'Sunday service', startsAt: '2026-10-04T17:30:00.000Z', timeZone: 'America/Los_Angeles',
  recurrence: 'weekly', repeatInterval: 1, location: 'Main hall' }

test('weekly services keep their local time across daylight saving and only real dates count', () => {
  const services = servicesBetween([sunday, { ...sunday, id: 8, title: 'Cancelled', cancelled: true }], '2026-10-25', 14)
  assert.deepEqual(services.map(service => service.date), ['2026-10-25', '2026-11-01'])
  // 10:30 in Los Angeles is 17:30 UTC in October and 18:30 UTC after daylight saving ends.
  assert.deepEqual(services.map(service => service.startsAt), ['2026-10-25T17:30:00.000Z', '2026-11-01T18:30:00.000Z'])
  assert.equal(services[0].key, '7:2026-10-25')
  assert.equal(serviceOn(sunday, '2026-10-26'), null)
  assert.equal(serviceOn(sunday, '2026-09-27'), null, 'before the series starts')
  assert.equal(serviceOn(sunday, '2026-02-30'), null)
  assert.deepEqual(parseServiceKey('7:2026-11-01'), { eventId: 7, date: '2026-11-01' })
  assert.equal(parseServiceKey('7:2026-11-31'), null)
  assert.equal(parseServiceKey('x:2026-11-01'), null)
  assert.equal(formatServiceDay('2026-11-01', 'en', true), 'Sunday, November 1')
  assert.match(formatServiceDay('2026-11-01', 'ru', true), /воскресенье, 1 ноября/)
})

test('fill counts declined places as open, and schedulers see who is away, busy or served often', () => {
  const teams = [{ id: 1, name: 'Worship', positions: [{ id: 'v', name: 'Vocals', needed: 2 }, { id: 'g', name: 'Guitar', needed: 1 }, { id: null, name: 'Draft' }] }]
  assert.deepEqual(teamPositions(teams[0]).map(position => position.id), ['v', 'g'])
  const row = (id: number, person: number, date: string, status: AssignmentRecord['status'] = 'pending', team = 1, positionId = 'v', requestedAt: string | null = null) =>
    ({ id, event: 7, date, team, positionId, position: positionId === 'v' ? 'Vocals' : 'Sound', person, status, requestedAt })
  const assignments: AssignmentRecord[] = [
    row(1, 10, '2026-11-01', 'accepted'), row(2, 11, '2026-11-01', 'declined'), row(3, 12, '2026-11-01', 'pending', 1, 'g', '2026-10-20T00:00:00Z'),
    row(4, 10, '2026-11-01', 'pending', 2, 's'), row(5, 10, '2026-10-25'), row(6, 10, '2026-10-18', 'declined'), row(7, 10, '2026-09-01'),
  ]
  const service = { eventId: 7, date: '2026-11-01' }
  assert.deepEqual(serviceFill(service, teams, assignments), { needed: 3, filled: 2, accepted: 1, declined: 1, unsent: 1, waiting: 1 })
  const notes = candidateNotes(10, service, assignments,
    [{ id: 1, person: 10, startDate: '2026-10-31', endDate: '2026-11-02', reason: 'Trip' }], new Map([[1, 'Worship'], [2, 'Tech']]))
  assert.equal(notes.away?.reason, 'Trip')
  assert.deepEqual(notes.sameDay, ['Worship · Vocals', 'Tech · Sound'])
  assert.equal(notes.recent, 1, 'declined and older dates do not count')
  assert.equal(candidateNotes(11, service, assignments, [], new Map()).sameDay.length, 0, 'a declined place is not busy')
})

test('away dates are real, ordered and at most a year long', () => {
  assert.equal(validateBlockout('2026-12-24', '2026-12-24'), true)
  assert.equal(validateBlockout('2026-12-24', '2027-01-02'), true)
  assert.match(String(validateBlockout('2026-12-24', '2026-12-23')), /before the first/)
  assert.equal(validateBlockout('2026-12-24', '2027-12-24'), true, 'a full year, both ends included')
  assert.match(String(validateBlockout('2026-12-24', '2027-12-25')), /one year/)
  assert.match(String(validateBlockout('24.12.2026', '2026-12-24')), /full dates/)
})

test('private links are stable, cannot be forged and are replaced by a new version', async () => {
  const { parseServingLinkToken, servingLinkToken, servingLinkUrl } = await import('../src/lib/servingLinks')
  const token = servingLinkToken(42, 1)
  assert.equal(token, servingLinkToken(42, 1), 'every email repeats the same link')
  assert.deepEqual(parseServingLinkToken(token), { personId: 42, version: 1 })
  assert.notEqual(servingLinkToken(42, 2), token)
  const [, , mac] = token.split('.')
  assert.equal(parseServingLinkToken(`43.1.${mac}`), null, 'another person')
  assert.equal(parseServingLinkToken(`42.2.${mac}`), null, 'another version')
  assert.equal(parseServingLinkToken(`${token}x`), null)
  assert.equal(parseServingLinkToken(null), null)
  assert.match(servingLinkUrl(42, 1), /\/serving#42\.1\.[A-Za-z0-9_-]{43}$/)
})

test('request and decline emails are escaped and follow the reader’s language', () => {
  const request = servingRequestContent({ language: 'ru', churchName: 'Church <b>', name: 'Анна', dateLabel: 'воскресенье, 1 ноября',
    url: 'https://example.invalid/serving#1.1.x', services: [{ title: 'Sunday <script>', when: '1 ноября, 10:30', location: null, roles: ['Worship — Vocals'] }] })
  assert.equal(request.subject, 'Сможете послужить воскресенье, 1 ноября?')
  assert.match(request.text, /Worship — Vocals/)
  assert.match(request.text, /https:\/\/example\.invalid\/serving#1\.1\.x/)
  assert.doesNotMatch(request.html, /<script>|<b>/)
  assert.match(request.html, /Sunday &lt;script&gt;/)
  const decline = servingDeclineContent({ language: 'en', churchName: 'Church', name: 'Anna Late', role: 'Worship — Vocals',
    service: 'Sunday service, Sunday, November 1 at 10:30 AM', dateLabel: 'Sunday, November 1', note: 'Away <then>', url: 'https://example.invalid/admin/serving' })
  assert.equal(decline.subject, 'Anna Late cannot serve on Sunday, November 1')
  assert.match(decline.text, /Their note: Away <then>/)
  assert.match(decline.html, /Away &lt;then&gt;/)
})

test('the migration is registered after the people directory and every schedule row goes with its church, service, team and person', () => {
  const names = migrations.map(migration => migration.name)
  assert.ok(names.indexOf('20261120_120000_serving_teams') > names.indexOf('20261119_120000_people_households'))
  const migration = readFileSync(new URL('../src/migrations/20261120_120000_serving_teams.ts', import.meta.url), 'utf8')
  for (const target of ['communities', 'events', 'teams', 'people']) {
    assert.match(migration, new RegExp(`REFERENCES "${target}"\\("id"\\) ON DELETE CASCADE`), target)
  }
  assert.match(migration, /CREATE UNIQUE INDEX "serving_assignments_event_date_team_position_id_person_idx"/)
  assert.match(migration, /"scheduled_by_id" integer REFERENCES "users"\("id"\) ON DELETE SET NULL/)
  const people = readFileSync(new URL('../src/collections/People.ts', import.meta.url), 'utf8')
  assert.match(people, /name: 'servingLinkVersion'[^\n]*hidden: true/)
})
