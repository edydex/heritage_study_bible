// Volunteer scheduling: teams with positions, people scheduled into a position
// for one date of a calendar service, and dates people are away. Pure helpers
// shared by the workspace screen, the endpoints and the volunteer page.
import { addDays, canonicalTimeZone, eventOccurrences, validDate } from '../../packages/calendar-core/index.js'
import { parseDateOnly } from './peopleProfiles'

export const ASSIGNMENT_STATUSES = ['pending', 'accepted', 'declined'] as const
export type AssignmentStatus = typeof ASSIGNMENT_STATUSES[number]
export const TEAM_NAME_LIMIT = 80
export const POSITION_NAME_LIMIT = 60
export const NOTE_LIMIT = 300
/** One screen shows eight weeks; the calendar expands at most 63 days at a time. */
export const SCHEDULE_DAYS = 56
/** How far back "served recently" looks. */
export const RECENT_DAYS = 56
export const BLOCKOUT_MAX_DAYS = 366

type Ref = number | string | { id: number | string } | null | undefined

export function refId(value: Ref): number | null {
  const raw = value && typeof value === 'object' ? value.id : value
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export type TeamPosition = { id?: string | null; name: string; needed?: number | null }
export type TeamRecord = {
  id: number; name: string; description?: string | null
  positions?: TeamPosition[] | null; members?: Ref[] | null
}
export type AssignmentRecord = {
  id: number; event: Ref; date: string; team: Ref; positionId: string; position: string; person: Ref
  status: AssignmentStatus; requestedAt?: string | null; respondedAt?: string | null; note?: string | null
}
export type BlockoutRecord = { id: number; person: Ref; startDate: string; endDate: string; reason?: string | null }
export type EventRecord = {
  id: number; title: string; startsAt: string; endsAt?: string | null; timeZone?: string | null; location?: string | null
  recurrence?: string | null; repeatInterval?: number | null; repeatUntil?: string | null; cancelled?: boolean | null
}
export type ServiceOccurrence = {
  key: string; eventId: number; date: string; startsAt: string; timeZone: string; title: string; location: string | null
}

export const serviceKey = (eventId: number, date: string) => `${eventId}:${date}`

export function parseServiceKey(value: unknown): { eventId: number; date: string } | null {
  const match = /^(\d{1,12}):(\d{4}-\d{2}-\d{2})$/.exec(String(value ?? ''))
  if (!match || !parseDateOnly(match[2])) return null
  return { eventId: Number(match[1]), date: match[2] }
}

/** The occurrence of an event on one local date, or null when it does not take place then. */
export function serviceOn(event: EventRecord, date: string): ServiceOccurrence | null {
  if (!validDate(date)) return null
  const found = eventOccurrences(event, date, date).find(item => item.date === date)
  if (!found) return null
  return { key: serviceKey(event.id, date), eventId: event.id, date, startsAt: found.startsAt,
    timeZone: canonicalTimeZone(event.timeZone) || 'UTC', title: event.title, location: event.location || null }
}

/** Every service date in [from, from + days), earliest first. */
export function servicesBetween(events: EventRecord[], from: string, days = SCHEDULE_DAYS): ServiceOccurrence[] {
  const to = addDays(from, Math.max(1, Math.min(days, 63)) - 1)
  const result: ServiceOccurrence[] = []
  for (const event of events) {
    for (const item of eventOccurrences(event, from, to) as Array<{ date: string; startsAt: string }>) {
      if (item.date < from || item.date > to) continue
      result.push({ key: serviceKey(event.id, item.date), eventId: event.id, date: item.date, startsAt: item.startsAt,
        timeZone: canonicalTimeZone(event.timeZone) || 'UTC', title: event.title, location: event.location || null })
    }
  }
  return result.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title) || a.eventId - b.eventId)
}

export function teamPositions(team: TeamRecord) {
  return (team.positions || []).filter(position => position.id && position.name)
    .map(position => ({ id: String(position.id), name: position.name, needed: Math.max(1, Math.min(20, Number(position.needed) || 1)) }))
}

export function teamMemberIds(team: TeamRecord) {
  return (team.members || []).map(refId).filter((id): id is number => id != null)
}

export function assignmentsFor(service: { eventId: number; date: string }, assignments: AssignmentRecord[]) {
  return assignments.filter(row => refId(row.event) === service.eventId && row.date === service.date)
}

/** How full a service is. Declined places count as open. */
export function serviceFill(service: { eventId: number; date: string }, teams: TeamRecord[], assignments: AssignmentRecord[]) {
  const rows = assignmentsFor(service, assignments)
  let needed = 0, filled = 0
  for (const team of teams) {
    for (const position of teamPositions(team)) {
      needed += position.needed
      const taken = rows.filter(row => refId(row.team) === team.id && row.positionId === position.id && row.status !== 'declined').length
      filled += Math.min(position.needed, taken)
    }
  }
  return {
    needed, filled,
    accepted: rows.filter(row => row.status === 'accepted').length,
    declined: rows.filter(row => row.status === 'declined').length,
    unsent: rows.filter(row => row.status === 'pending' && !row.requestedAt).length,
    waiting: rows.filter(row => row.status === 'pending' && row.requestedAt).length,
  }
}

export function awayOn(personId: number, date: string, blockouts: BlockoutRecord[]) {
  return blockouts.find(row => refId(row.person) === personId && row.startDate <= date && date <= row.endDate) || null
}

/** What a scheduler should know before choosing someone for a service. */
export function candidateNotes(personId: number, service: { eventId: number; date: string }, assignments: AssignmentRecord[],
  blockouts: BlockoutRecord[], teamNames: Map<number, string>) {
  const sameDay = assignments.filter(row => refId(row.person) === personId && row.date === service.date && row.status !== 'declined')
    .map(row => `${teamNames.get(refId(row.team) ?? 0) || ''} · ${row.position}`.replace(/^ · /, ''))
  const since = addDays(service.date, -RECENT_DAYS)
  const recent = assignments.filter(row => refId(row.person) === personId && row.status !== 'declined'
    && row.date >= since && row.date < service.date).length
  return { away: awayOn(personId, service.date, blockouts), sameDay, recent }
}

/** Dates someone is away: real dates, end not before start, at most a year at a time. */
export function validateBlockout(startDate: unknown, endDate: unknown): true | string {
  const start = parseDateOnly(startDate)
  const end = parseDateOnly(endDate)
  if (!start || !end) return 'Enter full dates, for example 2026-12-24.'
  if (end.time < start.time) return 'The last day cannot be before the first day.'
  if ((end.time - start.time) / 86_400_000 >= BLOCKOUT_MAX_DAYS) return 'Enter at most one year at a time.'
  return true
}

export function cleanNote(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, NOTE_LIMIT) || null : null
}

/** "Sunday, November 23 at 10:30 AM" in the event's own time zone. */
export function formatServiceTime(startsAt: string, timeZone: string, language: string, withWeekday = true) {
  const locale = language.startsWith('ru') ? 'ru-RU' : 'en-US'
  try {
    return new Date(startsAt).toLocaleString(locale, {
      timeZone, weekday: withWeekday ? 'long' : undefined, month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch {
    return startsAt.slice(0, 16).replace('T', ' ')
  }
}

/** A date without a time: "Sun, Nov 23", or "Sunday, November 23" when long. */
export function formatServiceDay(date: string, language: string, long = false) {
  const locale = language.startsWith('ru') ? 'ru-RU' : 'en-US'
  const style = long ? 'long' : 'short'
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', weekday: style, month: style, day: 'numeric' })
}
