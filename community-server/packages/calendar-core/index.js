const DAY = 86400000
const formatters = new Map()
export function validTimeZone(zone) {
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(0); return typeof zone === 'string' && zone.length > 0 } catch { return false }
}
export function zonedParts(value, zone = 'UTC') {
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
export function eventIsPublic(event, defaultVisibility = 'members') {
  return (event.visibility && event.visibility !== 'inherit' ? event.visibility : defaultVisibility) === 'public'
}
export function eventOccurrences(event, from, to) {
  if (!validDate(from) || !validDate(to) || from > to || (Date.parse(to) - Date.parse(from)) / DAY > 62) throw new Error('Choose a calendar range of at most 63 days.')
  if (event.cancelled || !Number.isFinite(Date.parse(event.startsAt))) return []
  const zone = validTimeZone(event.timeZone) ? event.timeZone : 'UTC'
  const start = localDateTime(event.startsAt, zone)
  const startDate = start.slice(0, 10)
  const recurrence = event.recurrence || 'none'
  const interval = Math.max(1, Math.min(52, Number(event.repeatInterval) || 1))
  const duration = Math.max(0, (Date.parse(event.endsAt || event.startsAt) - Date.parse(event.startsAt)) || 0)
  const overlapDays = Math.min(366, Math.ceil(duration / DAY))
  const until = validDate(event.repeatUntil) ? event.repeatUntil : '9999-12-31'
  const result = []
  for (let date = addDays(from, -overlapDays); date <= to; date = addDays(date, 1)) {
    if (date < startDate || date > until) continue
    const days = Math.round((Date.parse(date) - Date.parse(startDate)) / DAY)
    const months = (Number(date.slice(0, 4)) - Number(startDate.slice(0, 4))) * 12 + Number(date.slice(5, 7)) - Number(startDate.slice(5, 7))
    const occurs = recurrence === 'weekly' ? days % (7 * interval) === 0
      : recurrence === 'monthly' ? date.slice(8) === startDate.slice(8) && months % interval === 0 : date === startDate
    if (!occurs) continue
    let startsAt
    try { startsAt = date === startDate ? new Date(event.startsAt).toISOString() : localToInstant(`${date}T${start.slice(11)}`, zone) } catch { continue }
    const endsAt = event.endsAt ? new Date(Date.parse(startsAt) + duration).toISOString() : null
    if (localDate(endsAt || startsAt, zone) < from) continue
    result.push({ ...event, startsAt, endsAt, timeZone: zone, date, instanceId: `${event.id}:${startsAt}`, recurring: recurrence !== 'none' })
  }
  return result
}
export function safeEventUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '' } catch { return '' }
}
