import assert from 'node:assert/strict'
import test from 'node:test'
import { eventOccurrences, eventIsPublic, localToInstant, localDateTime, monthDays } from '../packages/calendar-core/index.js'
const zone = 'America/Los_Angeles'
const event = { id: 1, title: 'Worship', startsAt: localToInstant('2026-10-25T10:00', zone), endsAt: localToInstant('2026-10-25T11:00', zone), timeZone: zone, recurrence: 'weekly', repeatInterval: 1 }
test('weekly services keep their Pacific wall time across daylight saving changes', () => {
  const events = eventOccurrences(event, '2026-10-25', '2026-11-08')
  assert.deepEqual(events.map(item => item.startsAt), ['2026-10-25T17:00:00.000Z', '2026-11-01T18:00:00.000Z', '2026-11-08T18:00:00.000Z'])
  assert.ok(events.every(item => localDateTime(item.startsAt, zone).endsWith('10:00')))
  assert.equal(eventOccurrences({ ...event, repeatUntil: '2026-11-01' }, '2026-10-25', '2026-11-08').length, 2)
})
test('monthly services skip missing dates and queries bound recurring series', () => {
  const source = { ...event, startsAt: localToInstant('2026-01-31T10:00', zone), endsAt: null, recurrence: 'monthly' }
  assert.deepEqual(eventOccurrences(source, '2026-02-01', '2026-03-31').map(event => event.date), ['2026-03-31'])
  assert.throws(() => eventOccurrences(event, '2026-01-01', '2026-12-31'), /63 days/)
  assert.equal(monthDays('2026-09').length, 42)
  assert.equal(eventOccurrences({ ...event, cancelled: true }, '2026-10-01', '2026-10-31').length, 0)
})
test('nonexistent local times are rejected and ambiguous times choose their first occurrence', () => {
  assert.throws(() => localToInstant('2026-03-08T02:30', zone), /does not exist/)
  assert.equal(localToInstant('2026-11-01T01:30', zone), '2026-11-01T08:30:00.000Z')
  assert.throws(() => localToInstant('2026-02-30T10:00', zone))
})
test('church defaults and explicit public/member overrides remain independent', () => {
  assert.equal(eventIsPublic({ visibility: 'inherit' }), false)
  assert.equal(eventIsPublic({ visibility: 'inherit' }, 'public'), true)
  assert.equal(eventIsPublic({ visibility: 'members' }, 'public'), false)
  assert.equal(eventIsPublic({ visibility: 'public' }, 'members'), true)
})
