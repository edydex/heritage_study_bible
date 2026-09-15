import type { CollectionBeforeValidateHook } from 'payload'
import { validDate, validTimeZone, safeEventUrl, localDate } from '../../packages/calendar-core/index.js'

export const prepareCalendarEvent: CollectionBeforeValidateHook = async ({ data, originalDoc, req }) => {
  const next = { ...data }
  const value = { ...originalDoc, ...next }
  if (!value.timeZone) {
    const id = typeof value.community === 'object' ? value.community?.id : value.community
    if (id) next.timeZone = (await req.payload.findByID({ collection: 'communities', id, depth: 0, overrideAccess: true, req })).timeZone
  }
  if (!validTimeZone(next.timeZone || value.timeZone)) throw new Error('Choose a valid time zone, such as America/Los_Angeles.')
  if (!Number.isFinite(Date.parse(value.startsAt))) throw new Error('Choose a start date and time.')
  if (value.endsAt && (!Number.isFinite(Date.parse(value.endsAt)) || Date.parse(value.endsAt) <= Date.parse(value.startsAt))) throw new Error('The end must be after the start.')
  if (value.endsAt && Date.parse(value.endsAt) - Date.parse(value.startsAt) > 366 * 86400000) throw new Error('An event may last at most one year.')
  if (value.repeatUntil && !validDate(value.repeatUntil)) throw new Error('Repeat until must be a date in YYYY-MM-DD format.')
  if (value.recurrence && value.recurrence !== 'none') {
    if (!Number.isInteger(Number(value.repeatInterval ?? 1))) throw new Error('Repeat interval must be a whole number.')
    if (value.repeatUntil && value.repeatUntil < localDate(value.startsAt, next.timeZone || value.timeZone)) throw new Error('Repeat until must be on or after the first event.')
  }
  if (value.url && !safeEventUrl(value.url)) throw new Error('Use a full https:// or http:// event link.')
  return next
}
