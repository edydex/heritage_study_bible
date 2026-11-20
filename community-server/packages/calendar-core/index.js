const DAY = 86400000
const formatters = new Map()
export function canonicalTimeZone(zone) {
  if (typeof zone !== 'string' || !zone.trim()) return ''
  const input = /^(PST|PDT)$/i.test(zone.trim()) ? 'America/Los_Angeles' : zone.trim()
  try { return new Intl.DateTimeFormat('en', { timeZone: input }).resolvedOptions().timeZone } catch { return '' }
}
export function validTimeZone(zone) { return Boolean(canonicalTimeZone(zone)) }
export function formatEventTime(value, zone) {
  if (!Number.isFinite(Date.parse(value))) return 'Time not set'
  return new Date(value).toLocaleString(undefined, { timeZone: canonicalTimeZone(zone) || 'UTC', dateStyle: 'full', timeStyle: 'short' })
}
export function eventPagePath(event) {
  const date = event.date || localDate(event.startsAt, event.timeZone)
  return `/events/${encodeURIComponent(event.id)}?date=${encodeURIComponent(date)}`
}
export function zonedParts(value, zone = 'UTC') {
  zone = canonicalTimeZone(zone) || 'UTC'
  if (!formatters.has(zone)) formatters.set(zone, new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }))
  return Object.fromEntries(formatters.get(zone).formatToParts(new Date(value)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]))
}
export function localDate(value, zone = 'UTC') {
  const p = zonedParts(value, zone)
  return `${p.year}-${p.month}-${p.day}`
}
export function localDateTime(value, zone = 'UTC') {
  const p = zonedParts(value, zone)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}
export function addDays(date, days) { return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10) }
export function localToInstant(value, zone = 'UTC') {
  if (!validTimeZone(zone) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !validDate(value.slice(0, 10)) || value.slice(11, 13) > '23' || value.slice(14) > '59') throw new Error('Choose a valid local date, time and time zone.')
  const wall = Date.parse(`${value}:00Z`)
  // Check both sides of a possible clock change. An ambiguous time uses its
  // first occurrence; a nonexistent spring-forward time is rejected.
  const candidates = new Set()
  for (const delta of [-2, -1, 0, 1, 2]) {
    const guess = wall + delta * DAY
    const p = zonedParts(guess, zone)
    const offset = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`) - guess
    const instant = wall - offset
    if (localDateTime(instant, zone) === value) candidates.add(instant)
  }
  if (!candidates.size) throw new Error('That local time does not exist because the clocks change. Choose another time.')
  return new Date(Math.min(...candidates)).toISOString()
}
export function shiftMonth(month, amount) {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number - 1 + amount, 1)).toISOString().slice(0, 7)
}
export function monthDays(month) {
  if (!validDate(`${month}-01`)) throw new Error('Invalid calendar month.')
  const first = `${month}-01`
  const start = addDays(first, -new Date(`${first}T00:00:00Z`).getUTCDay())
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}
export function eventDateRange(event, zone = 'UTC') {
  const start = Date.parse(event.startsAt)
  if (!Number.isFinite(start)) return null
  const end = Date.parse(event.endsAt)
  // End times are exclusive: an event ending at midnight does not occupy
  // the following day. Compare instants before converting to church dates.
  return { start: localDate(start, zone), end: localDate(end > start ? end - 1 : start, zone) }
}
export function eventIncludesDate(event, date, zone = 'UTC') {
  const range = eventDateRange(event, zone)
  return Boolean(range && date >= range.start && date <= range.end)
}
export function calendarWeeks(month, events, zone = 'UTC') {
  const days = monthDays(month)
  const ranges = events.map(event => ({ event, range: eventDateRange(event, zone) })).filter(item => item.range)
  return Array.from({ length: 6 }, (_, index) => {
    const dates = days.slice(index * 7, index * 7 + 7)
    const entries = ranges.filter(({ range }) => range.start <= dates[6] && range.end >= dates[0])
      .map(({ event, range }) => ({ event, start: range.start < dates[0] ? 0 : dates.indexOf(range.start), end: range.end > dates[6] ? 6 : dates.indexOf(range.end), continuesBefore: range.start < dates[0], continuesAfter: range.end > dates[6] }))
      .sort((a, b) => a.start - b.start || b.end - a.end || String(a.event.title).localeCompare(String(b.event.title)) || String(a.event.instanceId).localeCompare(String(b.event.instanceId)))
    const laneEnds = []
    for (const entry of entries) {
      let lane = laneEnds.findIndex(end => end < entry.start)
      if (lane < 0) lane = laneEnds.length
      laneEnds[lane] = entry.end
      entry.lane = lane
    }
    return { dates, entries, lanes: laneEnds.length }
  })
}
export function eventIsPublic(event, defaultVisibility = 'members') {
  return (event.visibility && event.visibility !== 'inherit' ? event.visibility : defaultVisibility) === 'public'
}
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/
export function validTimeOfDay(value) { return typeof value === 'string' && TIME_OF_DAY.test(value) }
/** The change saved for one date of a repeating event, if any. */
export function dateException(event, date) {
  return Array.isArray(event?.exceptions) ? event.exceptions.find(row => row && row.date === date) || null : null
}
/** Every date of a repeating event in [from, to]. Dates cancelled on their own are left out unless includeCancelled is set. */
export function eventOccurrences(event, from, to, options = {}) {
  if (!validDate(from) || !validDate(to) || from > to || (Date.parse(to) - Date.parse(from)) / DAY > 62) throw new Error('Choose a calendar range of at most 63 days.')
  if (event.cancelled || !Number.isFinite(Date.parse(event.startsAt))) return []
  const { exceptions: _exceptions, ...base } = event
  const zone = canonicalTimeZone(event.timeZone) || 'UTC'
  const start = localDateTime(event.startsAt, zone)
  const startDate = start.slice(0, 10)
  const recurrence = event.recurrence || 'none'
  const interval = Math.max(1, Math.min(52, Number(event.repeatInterval) || 1))
  const duration = Math.max(0, (Date.parse(event.endsAt || event.startsAt) - Date.parse(event.startsAt)) || 0)
  // All-day events cover whole local dates, whatever the clocks do that day.
  const allDayCount = event.allDay ? Math.max(1, Math.round((Date.parse(event.endsAt ? localDate(Date.parse(event.endsAt) - 1, zone) : startDate) - Date.parse(startDate)) / DAY) + 1) : 0
  const overlapDays = Math.min(366, event.allDay ? allDayCount : Math.ceil(duration / DAY))
  const until = validDate(event.repeatUntil) ? event.repeatUntil : '9999-12-31'
  const result = []
  for (let date = addDays(from, -overlapDays); date <= to; date = addDays(date, 1)) {
    if (date < startDate || date > until) continue
    const days = Math.round((Date.parse(date) - Date.parse(startDate)) / DAY)
    const months = (Number(date.slice(0, 4)) - Number(startDate.slice(0, 4))) * 12 + Number(date.slice(5, 7)) - Number(startDate.slice(5, 7))
    const occurs = recurrence === 'weekly' ? days % (7 * interval) === 0
      : recurrence === 'monthly' ? date.slice(8) === startDate.slice(8) && months % interval === 0 : date === startDate
    if (!occurs) continue
    const change = recurrence === 'none' ? null : dateException(event, date)
    if (change?.cancelled && !options.includeCancelled) continue
    let startsAt, endsAt
    try {
      if (event.allDay) {
        startsAt = localToInstant(`${date}T00:00`, zone)
        endsAt = localToInstant(`${addDays(date, allDayCount)}T00:00`, zone)
      } else {
        startsAt = change && validTimeOfDay(change.startTime) ? localToInstant(`${date}T${change.startTime}`, zone)
          : date === startDate ? new Date(event.startsAt).toISOString() : localToInstant(`${date}T${start.slice(11)}`, zone)
        const changedEnd = change && validTimeOfDay(change.endTime) ? localToInstant(`${date}T${change.endTime}`, zone) : null
        endsAt = changedEnd && changedEnd > startsAt ? changedEnd : event.endsAt ? new Date(Date.parse(startsAt) + duration).toISOString() : null
      }
    } catch { continue }
    if (localDate(endsAt ? Date.parse(endsAt) - 1 : startsAt, zone) < from) continue
    const occurrence = { ...base, startsAt, endsAt, timeZone: zone, date, instanceId: `${event.id}:${startsAt}`, recurring: recurrence !== 'none' }
    if (change) Object.assign(occurrence, { title: change.title || event.title, location: change.location || event.location,
      note: change.note || null, changed: true, cancelled: Boolean(change.cancelled) })
    result.push(occurrence)
  }
  return result
}
export function safeEventUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '' } catch { return '' }
}

/** Common church time zones first; every other zone follows in the picker. */
export const COMMON_TIME_ZONES = ['America/Los_Angeles', 'America/Denver', 'America/Phoenix', 'America/Chicago', 'America/New_York',
  'America/Anchorage', 'Pacific/Honolulu', 'America/Vancouver', 'America/Toronto', 'Europe/London', 'Europe/Berlin', 'Europe/Warsaw',
  'Europe/Kyiv', 'Europe/Moscow', 'Asia/Almaty', 'Asia/Seoul', 'Australia/Sydney', 'UTC']
export function allTimeZones() {
  let zones = []
  try { zones = Intl.supportedValuesOf('timeZone') } catch { /* older engines */ }
  return [...new Set([...COMMON_TIME_ZONES, ...zones])].filter(validTimeZone)
}
/** "Pacific Time — Los Angeles (UTC−8)", in the reader's language. */
export function timeZoneLabel(zone, locale = 'en', at = Date.now()) {
  const id = canonicalTimeZone(zone) || 'UTC'
  if (id === 'UTC') return 'UTC'
  const part = (options, language) => {
    try { return new Intl.DateTimeFormat(language, { timeZone: id, ...options }).formatToParts(at).find(item => item.type === 'timeZoneName')?.value || '' } catch { return '' }
  }
  const offset = part({ timeZoneName: 'shortOffset' }, 'en').replace('GMT', 'UTC').replace('-', '−') || 'UTC'
  const city = id === 'UTC' ? '' : id.split('/').pop().replaceAll('_', ' ')
  const name = part({ timeZoneName: 'longGeneric' }, locale) || id
  return `${name}${city ? ` — ${city}` : ''} (${offset})`
}
export function formatEventDate(value, zone, locale) {
  if (!Number.isFinite(Date.parse(value))) return 'Date not set'
  return new Date(value).toLocaleDateString(locale, { timeZone: canonicalTimeZone(zone) || 'UTC', dateStyle: 'full' })
}

const ICS_TEXT = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
const icsInstant = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
const icsDay = date => date.replaceAll('-', '')
/** Lines longer than 75 octets continue on the next line after one space (RFC 5545). */
function foldIcsLine(line) {
  const encoder = new TextEncoder()
  const out = []
  let current = '', size = 0
  for (const char of line) {
    const bytes = encoder.encode(char).length
    if (size + bytes > (out.length ? 74 : 75)) { out.push(current); current = ''; size = 0 }
    current += char; size += bytes
  }
  out.push(current)
  return out.join('\r\n ')
}
/**
 * A calendar file for phone and desktop calendar apps. Each date is its own
 * event in UTC, so repeating events, single-date changes and daylight saving
 * need no time zone rules inside the file.
 */
export function buildIcs(occurrences, { name = '', timeZone = 'UTC', host = 'heritage.faith', pageUrl, refreshHours, now = Date.now() } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Heritage Community//Church Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  if (name) lines.push(`X-WR-CALNAME:${ICS_TEXT(name)}`)
  lines.push(`X-WR-TIMEZONE:${canonicalTimeZone(timeZone) || 'UTC'}`)
  if (refreshHours) lines.push(`REFRESH-INTERVAL;VALUE=DURATION:PT${refreshHours}H`, `X-PUBLISHED-TTL:PT${refreshHours}H`)
  for (const event of occurrences) {
    if (event.cancelled) continue
    const page = typeof pageUrl === 'function' ? pageUrl(event) : ''
    const details = [event.note, event.description, safeEventUrl(event.url), page].filter(Boolean).join('\n\n')
    lines.push('BEGIN:VEVENT', `UID:church-event-${event.id}-${event.date || localDate(event.startsAt, event.timeZone)}@${host}`, `DTSTAMP:${icsInstant(now)}`)
    if (event.allDay) {
      const first = event.date || localDate(event.startsAt, event.timeZone)
      const last = event.endsAt ? localDate(Date.parse(event.endsAt) - 1, event.timeZone) : first
      lines.push(`DTSTART;VALUE=DATE:${icsDay(first)}`, `DTEND;VALUE=DATE:${icsDay(addDays(last, 1))}`)
    } else {
      lines.push(`DTSTART:${icsInstant(event.startsAt)}`, `DTEND:${icsInstant(event.endsAt || Date.parse(event.startsAt) + 60 * 60000)}`)
    }
    lines.push(`SUMMARY:${ICS_TEXT(event.title)}`)
    if (details) lines.push(`DESCRIPTION:${ICS_TEXT(details)}`)
    if (event.location) lines.push(`LOCATION:${ICS_TEXT(event.location)}`)
    if (page) lines.push(`URL:${page}`)
    const reminder = event.defaultReminderMinutes
    if (reminder !== null && reminder !== undefined && reminder !== '' && Number.isFinite(Number(reminder)) && Number(reminder) >= 0) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${ICS_TEXT(event.title)}`, `TRIGGER:-PT${Math.round(Number(reminder))}M`, 'END:VALARM')
    }
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`
}
