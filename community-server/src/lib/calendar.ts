import { ValidationError, type CollectionBeforeValidateHook } from 'payload'
import {
  addDays, canonicalTimeZone, eventOccurrences, localDate, localDateTime, localToInstant, safeEventUrl, validDate, validTimeOfDay,
} from '../../packages/calendar-core/index.js'

type DateChange = { id?: string; date?: string; cancelled?: boolean; startTime?: string | null; endTime?: string | null
  title?: string | null; location?: string | null; note?: string | null }

const repeats = (value: Record<string, any>) => Boolean(value.recurrence && value.recurrence !== 'none')
const clean = (value: unknown) => typeof value === 'string' ? value.trim() || null : null

/** True when the series' dates themselves move, so old single-date changes may no longer line up. */
function scheduleMoved(before: Record<string, any> | undefined, after: Record<string, any>, zone: string) {
  if (!before) return false
  const at = (value: unknown) => Number.isFinite(Date.parse(String(value))) ? localDateTime(String(value), zone) : ''
  return at(before.startsAt) !== at(after.startsAt) || (before.recurrence || 'none') !== (after.recurrence || 'none')
    || Number(before.repeatInterval || 1) !== Number(after.repeatInterval || 1)
}

export const prepareCalendarEvent: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const next = { ...data }
  const value = { ...originalDoc, ...next }
  if (!value.timeZone) {
    const id = typeof value.community === 'object' ? value.community?.id : value.community
    if (id) next.timeZone = (await req.payload.findByID({ collection: 'communities', id, depth: 0, overrideAccess: true, req })).timeZone
  }
  const errors: { path: string; message: string }[] = []
  const invalid = (path: string, message: string) => errors.push({ path, message })
  const zone = canonicalTimeZone(next.timeZone || value.timeZone)
  if (!zone) invalid('timeZone', 'Choose a valid time zone, such as America/Los_Angeles (Pacific).')
  else next.timeZone = zone

  // An all-day event covers whole dates in its own time zone; its end is the midnight after the last day.
  if (zone && value.allDay && Number.isFinite(Date.parse(value.startsAt))) {
    const first = localDate(value.startsAt, zone)
    const endInstant = Date.parse(value.endsAt)
    let after = addDays(first, 1)
    if (Number.isFinite(endInstant)) {
      const endLocal = localDateTime(endInstant, zone)
      after = endLocal.endsWith('T00:00') ? endLocal.slice(0, 10) : addDays(endLocal.slice(0, 10), 1)
      if (after <= first) after = addDays(first, 1)
    }
    try {
      next.startsAt = value.startsAt = localToInstant(`${first}T00:00`, zone)
      next.endsAt = value.endsAt = localToInstant(`${after}T00:00`, zone)
    } catch { invalid('startsAt', 'Choose a valid date.') }
  }

  const starts = Date.parse(value.startsAt), ends = Date.parse(value.endsAt)
  if (!Number.isFinite(starts)) invalid('startsAt', 'Choose a start date and time.')
  if (value.endsAt && (!Number.isFinite(ends) || ends <= starts)) invalid('endsAt', 'The end must be after the start.')
  if (value.endsAt && ends - starts > 366 * 86400000) invalid('endsAt', 'An event may last at most one year.')
  if (value.repeatUntil && !validDate(value.repeatUntil)) invalid('repeatUntil', 'Use a date in YYYY-MM-DD format.')
  if (repeats(value)) {
    if (!Number.isInteger(Number(value.repeatInterval ?? 1))) invalid('repeatInterval', 'Repeat interval must be a whole number.')
    if (zone && Number.isFinite(starts) && value.repeatUntil && value.repeatUntil < localDate(value.startsAt, zone)) invalid('repeatUntil', 'Repeat until must be on or after the first event.')
  }
  if (value.url && !safeEventUrl(value.url)) invalid('url', 'Enter a complete https:// or http:// website address, or leave this optional field blank.')

  // Changes to single dates of a repeating event.
  if (!repeats(value)) {
    if (Array.isArray(value.exceptions) && value.exceptions.length) next.exceptions = []
  } else if (Array.isArray(value.exceptions) && zone && Number.isFinite(starts)) {
    const moved = scheduleMoved(originalDoc as Record<string, any> | undefined, value, zone)
    const series = { ...value, timeZone: zone, exceptions: [], cancelled: false }
    const seen = new Set<string>()
    const kept: DateChange[] = []
    ;(value.exceptions as DateChange[]).forEach((row, index) => {
      const date = String(row?.date || '')
      if (!validDate(date)) return invalid(`exceptions.${index}.date`, 'Choose a date.')
      if (seen.has(date)) return invalid(`exceptions.${index}.date`, `${date} is listed twice.`)
      seen.add(date)
      if (!eventOccurrences(series, date, date).some(item => item.date === date)) {
        // Moving the whole series retires the old date changes instead of blocking the save.
        if (moved) return
        return invalid(`exceptions.${index}.date`, `${date} is not one of this event’s dates. Pick a date the event repeats on.`)
      }
      const startTime = clean(row.startTime), endTime = clean(row.endTime)
      if (startTime && !validTimeOfDay(startTime)) return invalid(`exceptions.${index}.startTime`, 'Enter a time such as 10:30.')
      if (endTime && !validTimeOfDay(endTime)) return invalid(`exceptions.${index}.endTime`, 'Enter a time such as 12:00.')
      if (startTime && endTime && endTime <= startTime) return invalid(`exceptions.${index}.endTime`, 'The end must be after the start.')
      const cancelled = Boolean(row.cancelled)
      kept.push({ ...(row.id ? { id: row.id } : {}), date, cancelled, startTime: cancelled ? null : startTime, endTime: cancelled ? null : endTime,
        title: cancelled ? null : clean(row.title), location: cancelled ? null : clean(row.location), note: clean(row.note) })
    })
    next.exceptions = kept.sort((a, b) => String(a.date).localeCompare(String(b.date)))
  }
  if (errors.length) throw new ValidationError({ collection: 'events', errors, req })
  return next
}
