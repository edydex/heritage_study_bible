import { sql } from '@payloadcms/db-postgres'

const CANONICAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const WALL_CLOCK_LOCALE = 'en-US-u-ca-iso8601-nu-latn'

type DateParts = Readonly<{
  day: number
  hour: number
  minute: number
  month: number
  second: number
  year: number
}>

export type SermonDateProjectionDatabase = {
  execute: (query: unknown) => Promise<
    | { rows?: Record<string, unknown>[] }
    | Record<string, unknown>[]
  >
}

export class SermonDateProjectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SermonDateProjectionError'
  }
}

function fail(message: string): never {
  throw new SermonDateProjectionError(message)
}

function canonicalDateParts(serviceDate: string): DateParts {
  const match = CANONICAL_DATE_PATTERN.exec(serviceDate)
  if (!match) fail('Canonical sermon serviceDate must use YYYY-MM-DD.')

  const projected = `${serviceDate}T12:00:00.000Z`
  const date = new Date(projected)
  if (
    !Number.isFinite(date.getTime())
    || date.toISOString() !== projected
  ) {
    fail('Canonical sermon serviceDate must be a real calendar date.')
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: 12,
    minute: 0,
    second: 0,
  }
}

function wallClockFormatter(timeZone: string): Intl.DateTimeFormat {
  if (
    typeof timeZone !== 'string'
    || !timeZone
    || timeZone !== timeZone.trim()
    || timeZone.length > 255
  ) {
    fail('Canonical sermon Community time zone is missing or invalid.')
  }
  try {
    return new Intl.DateTimeFormat(WALL_CLOCK_LOCALE, {
      calendar: 'iso8601',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
      month: '2-digit',
      numberingSystem: 'latn',
      second: '2-digit',
      timeZone,
      year: 'numeric',
    })
  } catch {
    fail('Canonical sermon Community time zone is missing or invalid.')
  }
}

function wallClockParts(
  formatter: Intl.DateTimeFormat,
  instant: Date,
): DateParts {
  const values: Record<string, string> = {}
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== 'literal') values[part.type] = part.value
  }
  const result = {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
  if (
    !Number.isSafeInteger(result.year)
    || !Number.isSafeInteger(result.month)
    || !Number.isSafeInteger(result.day)
    || !Number.isSafeInteger(result.hour)
    || !Number.isSafeInteger(result.minute)
    || !Number.isSafeInteger(result.second)
  ) {
    fail('Canonical sermon Community time zone could not resolve a civil date.')
  }
  return result
}

function wallClockValue(parts: DateParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
}

function sameParts(left: DateParts, right: DateParts): boolean {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute
    && left.second === right.second
}

/**
 * Projects the canonical civil service date to noon in the Community's
 * configured IANA time zone. Noon avoids ordinary DST gaps/overlaps, while the
 * final round-trip check fails closed for any zone/date the runtime cannot map
 * exactly.
 */
export function payloadPreachedAtForServiceDate(
  serviceDate: string,
  timeZone: string,
): string {
  const desired = canonicalDateParts(serviceDate)
  const formatter = wallClockFormatter(timeZone)
  const desiredWallClock = wallClockValue(desired)
  let candidate = desiredWallClock

  // Converting a wall clock through Intl needs the zone offset at the eventual
  // instant. Iterating the civil-time delta converges across offset changes
  // without guessing the Community's DST rules.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = wallClockParts(formatter, new Date(candidate))
    const delta = desiredWallClock - wallClockValue(actual)
    if (delta === 0) break
    candidate += delta
  }

  const projected = new Date(candidate)
  if (
    !Number.isFinite(projected.getTime())
    || !sameParts(wallClockParts(formatter, projected), desired)
  ) {
    fail('Canonical sermon serviceDate cannot be represented in its Community time zone.')
  }
  return projected.toISOString()
}

export function serviceDateForProjectedPreachedAt(
  preachedAt: Date | string,
  timeZone: string,
): string {
  const formatter = wallClockFormatter(timeZone)
  const instant = preachedAt instanceof Date ? preachedAt : new Date(preachedAt)
  if (!Number.isFinite(instant.getTime())) {
    fail('Stored canonical sermon date projection is invalid.')
  }
  const parts = wallClockParts(formatter, instant)
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-')
}

function resultRows(
  result: Awaited<ReturnType<SermonDateProjectionDatabase['execute']>>,
): Record<string, unknown>[] {
  if (Array.isArray(result)) return result
  return Array.isArray(result.rows) ? result.rows : []
}

export async function lockedCommunityTimeZone(
  database: SermonDateProjectionDatabase,
  communityId: number,
): Promise<string> {
  if (!Number.isSafeInteger(communityId) || communityId < 1) {
    fail('Canonical sermon Community identity is invalid.')
  }
  const rows = resultRows(await database.execute(sql`
    SELECT "time_zone" AS "timeZone"
    FROM "communities"
    WHERE "id" = ${communityId}
    FOR SHARE;
  `))
  if (rows.length !== 1 || typeof rows[0].timeZone !== 'string') {
    fail('Canonical sermon Community time zone is missing or invalid.')
  }
  // Constructing the formatter validates the configured IANA identifier now,
  // before a caller can mutate any sermon projection.
  wallClockFormatter(rows[0].timeZone)
  return rows[0].timeZone
}
