import { ValidationError, type CollectionBeforeValidateHook } from 'payload'
import { validDate, canonicalTimeZone, safeEventUrl, localDate } from '../../packages/calendar-core/index.js'

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
  const starts = Date.parse(value.startsAt), ends = Date.parse(value.endsAt)
  if (!Number.isFinite(starts)) invalid('startsAt', 'Choose a start date and time.')
  if (value.endsAt && (!Number.isFinite(ends) || ends <= starts)) invalid('endsAt', 'The end must be after the start.')
  if (value.endsAt && ends - starts > 366 * 86400000) invalid('endsAt', 'An event may last at most one year.')
  if (value.repeatUntil && !validDate(value.repeatUntil)) invalid('repeatUntil', 'Use a date in YYYY-MM-DD format.')
  if (value.recurrence && value.recurrence !== 'none') {
    if (!Number.isInteger(Number(value.repeatInterval ?? 1))) invalid('repeatInterval', 'Repeat interval must be a whole number.')
    if (zone && Number.isFinite(starts) && value.repeatUntil && value.repeatUntil < localDate(value.startsAt, zone)) invalid('repeatUntil', 'Repeat until must be on or after the first event.')
  }
  if (value.url && !safeEventUrl(value.url)) invalid('url', 'Enter a complete https:// or http:// website address, or leave this optional field blank.')
  if (errors.length) throw new ValidationError({ collection: 'events', errors, req })
  return next
}
