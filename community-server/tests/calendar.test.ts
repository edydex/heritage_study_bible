import assert from 'node:assert/strict'
import test from 'node:test'
import { allTimeZones, buildIcs, canonicalTimeZone, COMMON_TIME_ZONES, dateException, formatEventDate, formatEventTime, eventOccurrences, eventIsPublic, localToInstant, localDateTime, monthDays, timeZoneLabel, validTimeOfDay } from '../packages/calendar-core/index.js'
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

test('legacy Pacific abbreviations are converted to a browser-compatible IANA zone', () => {
  assert.equal(canonicalTimeZone('PST'), zone)
  assert.equal(canonicalTimeZone('PDT'), zone)
  assert.equal(canonicalTimeZone('not a zone'), '')
  assert.equal(eventOccurrences({ ...event, timeZone: 'PST' }, '2026-10-25', '2026-11-08')[0].timeZone, zone)
  assert.doesNotThrow(() => formatEventTime(event.startsAt, 'PST'))
  assert.doesNotThrow(() => formatEventTime(event.startsAt, 'not a zone'))
})

const sunday = { id: 7, title: 'Sunday service', startsAt: localToInstant('2026-11-01T10:30', zone), endsAt: localToInstant('2026-11-01T12:00', zone),
  timeZone: zone, recurrence: 'weekly', repeatInterval: 1, location: 'Main hall', defaultReminderMinutes: null,
  exceptions: [{ id: 'a', date: '2026-11-08', cancelled: true }, { id: 'b', date: '2026-11-15', startTime: '18:00', endTime: '19:30', title: 'Evening service', location: 'Chapel', note: 'Joint service' },
    { date: '2026-11-16', cancelled: true }] }

test('one date of a repeating event can be cancelled or changed without touching the others', () => {
  const dates = eventOccurrences(sunday, '2026-11-01', '2026-11-22')
  assert.deepEqual(dates.map(item => item.date), ['2026-11-01', '2026-11-15', '2026-11-22'])
  const changed = dates[1]
  assert.deepEqual([localDateTime(changed.startsAt, zone), localDateTime(changed.endsAt, zone)], ['2026-11-15T18:00', '2026-11-15T19:30'])
  assert.deepEqual([changed.title, changed.location, changed.note, changed.changed], ['Evening service', 'Chapel', 'Joint service', true])
  assert.equal(dates[2].title, 'Sunday service')
  assert.ok(dates.every(item => !('exceptions' in item)), 'the list of changes is never sent with each date')
  const withCancelled = eventOccurrences(sunday, '2026-11-01', '2026-11-22', { includeCancelled: true })
  assert.deepEqual(withCancelled.filter(item => item.cancelled).map(item => item.date), ['2026-11-08'])
  // A one-time event ignores date changes.
  assert.equal(eventOccurrences({ ...sunday, recurrence: 'none' }, '2026-11-01', '2026-11-01').length, 1)
  assert.equal(dateException(sunday, '2026-11-15')?.title, 'Evening service')
})

test('all-day events cover whole dates even on the day the clocks change', () => {
  const retreat = { id: 3, title: 'Retreat', allDay: true, timeZone: zone, recurrence: 'weekly',
    startsAt: localToInstant('2026-03-01T00:00', zone), endsAt: localToInstant('2026-03-03T00:00', zone) }
  for (const item of eventOccurrences(retreat, '2026-03-01', '2026-03-15')) {
    assert.ok(localDateTime(item.startsAt, zone).endsWith('T00:00'))
    assert.ok(localDateTime(item.endsAt, zone).endsWith('T00:00'), `${item.date} ends at midnight`)
    assert.equal(Math.round((Date.parse(item.endsAt) - Date.parse(item.startsAt)) / 3600000) >= 47, true)
  }
  assert.ok(formatEventDate(retreat.startsAt, zone, 'en-US').includes('March 1'))
})

test('the time zone picker lists the usual church zones first with readable names', () => {
  const zones = allTimeZones()
  assert.deepEqual(zones.slice(0, COMMON_TIME_ZONES.length), COMMON_TIME_ZONES)
  assert.ok(zones.length > 300)
  assert.equal(new Set(zones).size, zones.length)
  assert.match(timeZoneLabel('PST', 'en', Date.parse('2026-01-15T12:00:00Z')), /^Pacific Time — Los Angeles \(UTC−8\)$/)
  assert.match(timeZoneLabel(zone, 'en', Date.parse('2026-07-15T12:00:00Z')), /UTC−7/)
  assert.match(timeZoneLabel(zone, 'ru'), /Тихоокеанское/)
  assert.equal(timeZoneLabel('UTC'), 'UTC')
  assert.equal(validTimeOfDay('18:30'), true)
  assert.equal(validTimeOfDay('24:00'), false)
})

test('calendar files: one event per date, reminders only when set, safe text and short lines', () => {
  const dates = eventOccurrences({ ...sunday, title: 'Service; with, commas', description: 'Line one\nLine two \\ done' }, '2026-11-01', '2026-11-22', { includeCancelled: true })
  const file = buildIcs(dates, { name: 'Church', timeZone: zone, host: 'church.test', pageUrl: event => `https://church.test/events/${event.id}?date=${event.date}`, now: Date.parse('2026-11-01T00:00:00Z') })
  assert.ok(file.startsWith('BEGIN:VCALENDAR\r\n') && file.endsWith('END:VCALENDAR\r\n'))
  assert.equal(file.match(/BEGIN:VEVENT/g)?.length, 3, 'the cancelled date is left out')
  assert.match(file, /UID:church-event-7-2026-11-15@church\.test/)
  assert.match(file, /DTSTART:20261116T020000Z/)
  assert.match(file, /SUMMARY:Evening service/)
  assert.match(file, /SUMMARY:Service\\; with\\, commas/)
  assert.match(file.replace(/\r\n /g, ''), /DESCRIPTION:Line one\\nLine two \\\\ done/)
  assert.doesNotMatch(file, /VALARM/, 'no reminder when it is turned off')
  for (const line of file.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line)
  const reminders = buildIcs([{ ...dates[0], defaultReminderMinutes: 0 }, { ...dates[2], defaultReminderMinutes: 30 }])
  assert.deepEqual(reminders.match(/TRIGGER:[^\r]+/g), ['TRIGGER:-PT0M', 'TRIGGER:-PT30M'])
  const allDay = buildIcs([{ id: 3, title: 'Retreat', allDay: true, timeZone: zone, date: '2026-03-01',
    startsAt: localToInstant('2026-03-01T00:00', zone), endsAt: localToInstant('2026-03-03T00:00', zone) }])
  assert.match(allDay, /DTSTART;VALUE=DATE:20260301\r\nDTEND;VALUE=DATE:20260303/)
})

test('the members calendar link cannot be guessed and a new version replaces it', async () => {
  process.env.PAYLOAD_SECRET ||= 'unit-test-secret-at-least-thirty-two-characters'
  const { memberFeedToken, memberFeedTokenMatches } = await import('../src/lib/calendarFeeds.ts')
  const token = memberFeedToken(1, 1)
  assert.equal(memberFeedTokenMatches(token, 1, 1), true)
  assert.equal(memberFeedTokenMatches(token, 1, 2), false)
  assert.equal(memberFeedTokenMatches(token, 2, 1), false)
  assert.equal(memberFeedTokenMatches(`${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`, 1, 1), false)
  assert.equal(memberFeedTokenMatches('short', 1, 1), false)
})
