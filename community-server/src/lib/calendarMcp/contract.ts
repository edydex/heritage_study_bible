import { Temporal } from '@js-temporal/polyfill'
import { z } from 'zod'
import { createHash } from 'node:crypto'
import { CalendarMcpError } from './config.ts'
const identity = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/)
export const eventFields = z.object({
  title: z.string().trim().min(1).max(250), description: z.string().max(8000).optional(),
  startsAt: z.string().max(40), endsAt: z.string().max(40).nullable().optional(), timeZone: z.string().max(80),
  location: z.string().max(500).optional(), url: z.string().max(2000).url().regex(/^https:\/\//).or(z.literal('')).optional(),
  visibility: z.enum(['inherit', 'public', 'members']).default('inherit'),
}).strict()
export const createInput = z.object({ requestId: identity, source: identity, sourceId: identity, event: eventFields }).strict()
export const updateInput = z.object({ requestId: identity, eventId: z.number().int().positive(), expectedVersion: z.string().regex(/^[1-9][0-9]{0,18}$/),
  changes: eventFields.partial().omit({ visibility: true }).extend({ visibility: z.enum(['inherit', 'public', 'members']).optional() }).strict()
    .refine(value => Object.keys(value).length > 0, 'Provide a calendar change.') }).strict()
export const readInput = z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict()
export function digest(value: unknown): string {
  function canonical(input: any): any {
    if (Array.isArray(input)) return input.map(canonical)
    if (input && typeof input === 'object') return Object.fromEntries(Object.keys(input).sort().map(key => [key, canonical(input[key])]))
    return input
  }
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}
export function validateRange(from: string, to: string) {
  try {
    const start = Temporal.PlainDate.from(from), end = Temporal.PlainDate.from(to)
    const days = start.until(end).days
    if (days < 0 || days > 62) throw new Error()
  } catch { throw new CalendarMcpError('INVALID_RANGE', 'Choose a valid range of at most 63 days.') }
}
export function normalizeEvent(input: z.input<typeof eventFields>) {
  const event = eventFields.parse(input)
  try {
    if (!event.timeZone.includes('/') && event.timeZone !== 'UTC') throw new Error()
    const convert = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error()
      // Explicit offset + IANA zone rejects nonexistent DST times and wrong offsets.
      // The two offsets at a fall-back overlap identify two different valid instants.
      return Temporal.ZonedDateTime.from(`${value}[${event.timeZone}]`, { offset: 'reject', disambiguation: 'reject' }).toInstant()
    }
    const start = convert(event.startsAt), end = event.endsAt ? convert(event.endsAt) : null
    if (end && (Temporal.Instant.compare(end, start) <= 0 || end.epochMilliseconds - start.epochMilliseconds > 366 * 86400000)) throw new Error()
    return { ...event, startsAt: start.toString(), endsAt: end?.toString() ?? null }
  } catch { throw new CalendarMcpError('INVALID_TIME', 'Use an explicit RFC3339 offset and IANA time zone; confirm DST gaps/overlaps and end after start.') }
}
export function eventProjection(doc: any) {
  return { id: Number(doc.id), version: String(doc.calendarVersion ?? doc.calendar_version), title: doc.title,
    description: doc.description ?? '', startsAt: new Date(doc.startsAt).toISOString(), endsAt: doc.endsAt ? new Date(doc.endsAt).toISOString() : null,
    timeZone: doc.timeZone, location: doc.location ?? '', url: doc.url ?? '', visibility: doc.visibility,
    recurrence: doc.recurrence || 'none', repeatInterval: Number(doc.repeatInterval || 1), repeatUntil: doc.repeatUntil || null,
    cancelled: Boolean(doc.cancelled) }
}
