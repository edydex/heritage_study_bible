import { createHash } from 'node:crypto'
import {
  normalizeBibleRange,
  type CanonicalBibleRange,
} from './BibleRange.ts'

export const COMMUNITY_SERVICE_PLAN_KIND = 'syncshow-community-service-plan'
export const COMMUNITY_SERVICE_PLAN_SCHEMA_VERSION = 2
export const COMMUNITY_SERVICE_PLAN_SCHEMA_VERSIONS = [1, 2] as const
export const MAX_COMMUNITY_SERVICE_PLAN_SOURCE_BYTES = 256 * 1024
export const MAX_COMMUNITY_SERVICE_PLAN_ITEMS = 500
export const MAX_COMMUNITY_SERVICE_PLAN_PAGE_ITEMS = 100
export const MAX_COMMUNITY_SERVICE_PLAN_CURSOR_BYTES = 2048
export const MAX_COMMUNITY_SERVICE_PLAN_LINKED_READING_VERSES = 8
export const COMMUNITY_SERVICE_PLAN_STATUSES = [
  'draft',
  'ready',
  'archived',
  'cancelled',
] as const

const PLAN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const ENTRY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const SYNC_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const REVISION_PATTERN = /^[a-f0-9]{64}$/
const SONG_REVISION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:"/-]{0,255}$/
const SERVICE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const TRANSLATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/
const UPPERCASE_TRANSLATION_ID_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,31}$/
const CANONICAL_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

type MutableRecord = Record<string, any>

export type CommunityServicePlanStatus =
  typeof COMMUNITY_SERVICE_PLAN_STATUSES[number]

export type CommunityServicePlanSermonReading = Readonly<{
  sermonEntryId: string
  referenceId: string
}>

type CommunityServicePlanScriptureEntry = Readonly<{
  id: string
  kind: 'scripture'
  title: string
  range: CanonicalBibleRange
  translationId: string
  sermonReading?: CommunityServicePlanSermonReading | null
}>

export type CommunityServicePlanEntry =
  | Readonly<{ id: string; kind: 'section'; title: string }>
  | Readonly<{
      id: string
      kind: 'song' | 'sermon'
      title: string
      syncId: string
      expectedRevision: string
      expectedSyncVersion: number
    }>
  | CommunityServicePlanScriptureEntry

export type CommunityServicePlan = Readonly<{
  schemaVersion: typeof COMMUNITY_SERVICE_PLAN_SCHEMA_VERSIONS[number]
  kind: typeof COMMUNITY_SERVICE_PLAN_KIND
  id: string
  title: string
  serviceDate: string
  startTime: string
  teamNotes: string
  entries: readonly CommunityServicePlanEntry[]
}>

export type CommunityServicePlanEnvelope = Readonly<{
  syncId: string
  syncVersion: number
  revision: string
  documentSource: string
  plan: CommunityServicePlan
  status: CommunityServicePlanStatus
  changedAt: string
}>

export type CommunityServicePlanSummary = Readonly<{
  syncId: string
  syncVersion: number
  revision: string
  status: CommunityServicePlanStatus
  title: string
  serviceDate: string
  startTime: string
  changedAt: string
}>

export class CommunityServicePlanError extends Error {
  code: string
  details: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'CommunityServicePlanError'
    this.code = code
    this.details = details
  }
}

function fail(
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): never {
  throw new CommunityServicePlanError(code, message, details)
}

function isRecord(value: unknown): value is MutableRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function exactKeys(value: unknown, expected: readonly string[], label: string) {
  if (!isRecord(value)) fail('INVALID_SERVICE_PLAN', `${label} must be an object.`)
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (
    actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])
  ) {
    fail(
      'INVALID_SERVICE_PLAN_FIELDS',
      `${label} has unsupported or missing fields.`,
      { actual, expected: wanted },
    )
  }
}

function hasUnpairedSurrogate(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xD800 && code <= 0xDBFF) {
      if (index + 1 >= value.length) return true
      const next = value.charCodeAt(index + 1)
      if (next < 0xDC00 || next > 0xDFFF) return true
      index += 1
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      return true
    }
  }
  return false
}

function exceedsUtf8Bytes(value: string, maximum: number) {
  return Buffer.byteLength(value, 'utf8') > maximum
}

function hasSingleLineControl(value: string) {
  return /[\p{Cc}\p{Zl}\p{Zp}]/u.test(value)
}

function boundedSingleLine(
  value: unknown,
  label: string,
  maximum: number,
  pattern: RegExp | null = null,
) {
  if (typeof value !== 'string') {
    fail('INVALID_SERVICE_PLAN_TEXT', `${label} must be text.`)
  }
  if (hasUnpairedSurrogate(value)) {
    fail('INVALID_SERVICE_PLAN_TEXT', `${label} is invalid.`)
  }
  const normalized = value.normalize('NFC').trim()
  if (
    !normalized
    || exceedsUtf8Bytes(normalized, maximum)
    || hasSingleLineControl(normalized)
    || (pattern && !pattern.test(normalized))
  ) {
    fail('INVALID_SERVICE_PLAN_TEXT', `${label} is invalid.`)
  }
  return normalized
}

function boundedMultiline(value: unknown, label: string, maximum: number) {
  if (typeof value !== 'string' || hasUnpairedSurrogate(value)) {
    fail('INVALID_SERVICE_PLAN_TEXT', `${label} is invalid.`)
  }
  const normalized = value.replace(/\r\n?/g, '\n').normalize('NFC')
  if (
    exceedsUtf8Bytes(normalized, maximum)
    || /[\p{Cc}\p{Zl}\p{Zp}]/u.test(normalized.replace(/\n/g, ''))
  ) {
    fail('INVALID_SERVICE_PLAN_TEXT', `${label} is invalid.`)
  }
  return normalized
}

function positiveInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    fail('INVALID_SERVICE_PLAN_VERSION', `${label} must be a positive integer.`)
  }
  return Number(value)
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string' || !SERVICE_DATE_PATTERN.test(value)) {
    fail(
      'INVALID_SERVICE_PLAN_DATE',
      'Community service plan date must use YYYY-MM-DD.',
    )
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (
    Number.isNaN(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== value
  ) {
    fail('INVALID_SERVICE_PLAN_DATE', 'Community service plan date is invalid.')
  }
  return value
}

function normalizeLocalTime(value: unknown) {
  if (typeof value !== 'string' || !LOCAL_TIME_PATTERN.test(value)) {
    fail(
      'INVALID_SERVICE_PLAN_TIME',
      'Community service plan start time must use local venue time as HH:mm.',
    )
  }
  return value
}

function normalizeRevision(value: unknown, label = 'Expected revision') {
  if (typeof value !== 'string' || !REVISION_PATTERN.test(value)) {
    fail(
      'INVALID_SERVICE_PLAN_REVISION',
      `${label} must be a lowercase SHA-256.`,
    )
  }
  return value
}

function normalizeRange(raw: unknown, label: string) {
  exactKeys(raw, ['schemaVersion', 'bookId', 'start', 'end'], `${label} range`)
  const record = raw as MutableRecord
  exactKeys(record.start, ['chapter', 'verse'], `${label} range start`)
  exactKeys(record.end, ['chapter', 'verse'], `${label} range end`)
  let range: CanonicalBibleRange
  try {
    range = normalizeBibleRange(raw)
  } catch (error) {
    fail(
      'INVALID_SERVICE_PLAN_SCRIPTURE',
      `${label} must use one canonical Bible range.`,
      {
        cause: error instanceof Error && 'code' in error
          ? String((error as { code: unknown }).code)
          : error instanceof Error ? error.name : 'Error',
      },
    )
  }
  if (range.start.verse === null || range.end.verse === null) {
    fail(
      'INVALID_SERVICE_PLAN_SCRIPTURE',
      `${label} must identify explicit starting and ending verses.`,
    )
  }
  return range
}

function normalizeSermonReading(
  raw: unknown,
  label: string,
): CommunityServicePlanSermonReading | null {
  if (raw === null) return null
  if (!isRecord(raw)) {
    fail(
      'INVALID_SERVICE_PLAN_SERMON_READING',
      `${label} sermonReading must be null or identify one sermon entry and reference.`,
    )
  }
  exactKeys(
    raw,
    ['sermonEntryId', 'referenceId'],
    `${label} sermonReading`,
  )
  let sermonEntryId: string
  let referenceId: string
  try {
    sermonEntryId = boundedSingleLine(
      raw.sermonEntryId,
      `${label} sermon entry id`,
      128,
      ENTRY_ID_PATTERN,
    )
    referenceId = boundedSingleLine(
      raw.referenceId,
      `${label} sermon reference id`,
      128,
      ENTRY_ID_PATTERN,
    )
  } catch (error) {
    if (!(error instanceof CommunityServicePlanError)) throw error
    fail(
      'INVALID_SERVICE_PLAN_SERMON_READING',
      `${label} sermonReading identifiers are invalid.`,
    )
  }
  return { sermonEntryId, referenceId }
}

function validateLinkedScripture(
  entry: CommunityServicePlanScriptureEntry,
  label: string,
) {
  if (entry.sermonReading === null) return
  const { start, end } = entry.range
  if (start.chapter !== end.chapter) {
    fail(
      'INVALID_SERVICE_PLAN_SERMON_READING_RANGE',
      `${label} linked sermon reading must stay within one chapter.`,
      { range: entry.range },
    )
  }
  if (start.verse === null || end.verse === null) return
  const verseCount = end.verse - start.verse + 1
  if (verseCount > MAX_COMMUNITY_SERVICE_PLAN_LINKED_READING_VERSES) {
    fail(
      'INVALID_SERVICE_PLAN_SERMON_READING_RANGE',
      `${label} linked sermon reading must contain at most ${MAX_COMMUNITY_SERVICE_PLAN_LINKED_READING_VERSES} verses.`,
      {
        verseCount,
        maximumVerses: MAX_COMMUNITY_SERVICE_PLAN_LINKED_READING_VERSES,
      },
    )
  }
  if (!UPPERCASE_TRANSLATION_ID_PATTERN.test(entry.translationId)) {
    fail(
      'INVALID_SERVICE_PLAN_SERMON_READING_TRANSLATION',
      `${label} linked sermon reading translation must use an uppercase translation ID.`,
    )
  }
}

function normalizeResourceEntry(
  raw: MutableRecord,
  kind: 'song' | 'sermon',
  index: number,
): CommunityServicePlanEntry {
  const label = `Community service plan ${kind} entry ${index + 1}`
  exactKeys(
    raw,
    ['id', 'kind', 'title', 'syncId', 'expectedRevision', 'expectedSyncVersion'],
    label,
  )
  return {
    id: boundedSingleLine(raw.id, `${label} id`, 128, ENTRY_ID_PATTERN),
    kind,
    title: boundedSingleLine(raw.title, `${label} title`, 200),
    syncId: boundedSingleLine(raw.syncId, `${label} sync ID`, 128, SYNC_ID_PATTERN),
    expectedRevision: kind === 'song'
      ? boundedSingleLine(
          raw.expectedRevision,
          `${label} expected revision`,
          256,
          SONG_REVISION_PATTERN,
        )
      : normalizeRevision(
          raw.expectedRevision,
          `${label} expected revision`,
        ),
    expectedSyncVersion: positiveInteger(
      raw.expectedSyncVersion,
      `${label} expected sync version`,
    ),
  }
}

function normalizeEntry(
  raw: unknown,
  index: number,
  schemaVersion: typeof COMMUNITY_SERVICE_PLAN_SCHEMA_VERSIONS[number],
): CommunityServicePlanEntry {
  if (!isRecord(raw)) {
    fail(
      'INVALID_SERVICE_PLAN_ENTRY',
      `Community service plan entry ${index + 1} must be an object.`,
    )
  }
  const kind = raw.kind
  if (kind === 'section') {
    const label = `Community service plan section entry ${index + 1}`
    exactKeys(raw, ['id', 'kind', 'title'], label)
    return {
      id: boundedSingleLine(raw.id, `${label} id`, 128, ENTRY_ID_PATTERN),
      kind: 'section',
      title: boundedSingleLine(raw.title, `${label} title`, 200),
    }
  }
  if (kind === 'song' || kind === 'sermon') {
    return normalizeResourceEntry(raw, kind, index)
  }
  if (kind === 'scripture') {
    const label = `Community service plan Scripture entry ${index + 1}`
    exactKeys(
      raw,
      schemaVersion === 2
        ? ['id', 'kind', 'title', 'range', 'translationId', 'sermonReading']
        : ['id', 'kind', 'title', 'range', 'translationId'],
      label,
    )
    const entry: CommunityServicePlanScriptureEntry = {
      id: boundedSingleLine(raw.id, `${label} id`, 128, ENTRY_ID_PATTERN),
      kind: 'scripture',
      title: boundedSingleLine(raw.title, `${label} title`, 200),
      range: normalizeRange(raw.range, label),
      translationId: boundedSingleLine(
        raw.translationId,
        `${label} translation`,
        32,
        TRANSLATION_ID_PATTERN,
      ),
      ...(schemaVersion === 2
        ? { sermonReading: normalizeSermonReading(raw.sermonReading, label) }
        : {}),
    }
    if (schemaVersion === 2) validateLinkedScripture(entry, label)
    return entry
  }
  fail(
    'INVALID_SERVICE_PLAN_ENTRY_KIND',
    `Community service plan entry ${index + 1} has an unsupported kind.`,
  )
}

function validateSermonReadingRelationships(
  entries: readonly CommunityServicePlanEntry[],
) {
  const entryById = new Map(entries.map((entry, index) => [
    entry.id,
    { entry, index },
  ]))
  const readingBySermonId = new Map<string, string>()
  for (const [index, entry] of entries.entries()) {
    const reading = entry.kind === 'scripture'
      ? entry.sermonReading
      : null
    if (!reading) continue
    const target = entryById.get(reading.sermonEntryId)
    if (!target) {
      fail(
        'SERVICE_PLAN_SERMON_READING_TARGET_MISSING',
        `Community service plan Scripture entry ${entry.id} targets an unknown sermon entry.`,
        {
          entryId: entry.id,
          sermonEntryId: reading.sermonEntryId,
        },
      )
    }
    if (target.entry.kind !== 'sermon') {
      fail(
        'SERVICE_PLAN_SERMON_READING_TARGET_KIND',
        `Community service plan Scripture entry ${entry.id} must target a sermon entry.`,
        {
          entryId: entry.id,
          sermonEntryId: reading.sermonEntryId,
          actualKind: target.entry.kind,
        },
      )
    }
    if (target.index <= index) {
      fail(
        'SERVICE_PLAN_SERMON_READING_ORDER',
        `Community service plan Scripture entry ${entry.id} must precede its sermon entry.`,
        {
          entryId: entry.id,
          sermonEntryId: reading.sermonEntryId,
        },
      )
    }
    if (readingBySermonId.has(reading.sermonEntryId)) {
      fail(
        'DUPLICATE_SERVICE_PLAN_SERMON_READING',
        `Community service plan sermon entry ${reading.sermonEntryId} has more than one linked reading.`,
        {
          sermonEntryId: reading.sermonEntryId,
          entryIds: [
            readingBySermonId.get(reading.sermonEntryId),
            entry.id,
          ],
        },
      )
    }
    readingBySermonId.set(reading.sermonEntryId, entry.id)
  }
}

export function normalizeCommunityServicePlan(
  raw: unknown,
): CommunityServicePlan {
  exactKeys(
    raw,
    [
      'schemaVersion',
      'kind',
      'id',
      'title',
      'serviceDate',
      'startTime',
      'teamNotes',
      'entries',
    ],
    'Community service plan',
  )
  const record = raw as MutableRecord
  const schemaVersion = record.schemaVersion
  if (
    !COMMUNITY_SERVICE_PLAN_SCHEMA_VERSIONS.includes(schemaVersion)
    || record.kind !== COMMUNITY_SERVICE_PLAN_KIND
  ) {
    fail(
      'UNSUPPORTED_SERVICE_PLAN',
      `Community service plans must use ${COMMUNITY_SERVICE_PLAN_KIND} schema v1 or v${COMMUNITY_SERVICE_PLAN_SCHEMA_VERSION}.`,
    )
  }
  if (
    !Array.isArray(record.entries)
    || record.entries.length < 1
    || record.entries.length > MAX_COMMUNITY_SERVICE_PLAN_ITEMS
  ) {
    fail(
      'INVALID_SERVICE_PLAN_ENTRIES',
      `A Community service plan must contain 1-${MAX_COMMUNITY_SERVICE_PLAN_ITEMS} ordered entries.`,
    )
  }
  const entries = record.entries.map((entry: unknown, index: number) => (
    normalizeEntry(entry, index, schemaVersion)
  ))
  const ids = new Set<string>()
  for (const entry of entries) {
    if (ids.has(entry.id)) {
      fail(
        'DUPLICATE_SERVICE_PLAN_ENTRY',
        `Community service plan entry ${entry.id} is duplicated.`,
      )
    }
    ids.add(entry.id)
  }
  if (schemaVersion === 2) validateSermonReadingRelationships(entries)
  return {
    schemaVersion,
    kind: COMMUNITY_SERVICE_PLAN_KIND,
    id: boundedSingleLine(
      record.id,
      'Community service plan id',
      128,
      PLAN_ID_PATTERN,
    ),
    title: boundedSingleLine(record.title, 'Community service plan title', 200),
    serviceDate: normalizeDate(record.serviceDate),
    startTime: normalizeLocalTime(record.startTime),
    teamNotes: boundedMultiline(
      record.teamNotes,
      'Community service plan team notes',
      4000,
    ),
    entries,
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, stableValue(value[key])]),
  )
}

export function serializeCommunityServicePlan(raw: unknown) {
  const plan = normalizeCommunityServicePlan(raw)
  return `${JSON.stringify(stableValue(plan))}\n`
}

function decodeSource(source: unknown) {
  if (typeof source === 'string' && hasUnpairedSurrogate(source)) {
    fail(
      'INVALID_SERVICE_PLAN_UTF8',
      'Community service plan source must be UTF-8.',
    )
  }
  const bytes = Buffer.isBuffer(source)
    ? source
    : Buffer.from(typeof source === 'string' ? source : '')
  if (
    bytes.length < 2
    || bytes.length > MAX_COMMUNITY_SERVICE_PLAN_SOURCE_BYTES
  ) {
    fail(
      'INVALID_SERVICE_PLAN_SOURCE_SIZE',
      `Community service plan source must be at most ${MAX_COMMUNITY_SERVICE_PLAN_SOURCE_BYTES} bytes.`,
    )
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    fail(
      'INVALID_SERVICE_PLAN_UTF8',
      'Community service plan source must be UTF-8.',
    )
  }
}

export function parseCommunityServicePlanSource(
  source: unknown,
  { requireCanonical = true } = {},
) {
  const text = decodeSource(source)
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    fail(
      'INVALID_SERVICE_PLAN_JSON',
      'Community service plan source is not valid JSON.',
    )
  }
  const plan = normalizeCommunityServicePlan(raw)
  const documentSource = serializeCommunityServicePlan(plan)
  if (requireCanonical && text !== documentSource) {
    fail(
      'NONCANONICAL_SERVICE_PLAN_SOURCE',
      'Community service plan source is not in canonical form.',
    )
  }
  return plan
}

export function validateCommunityServicePlanSource(
  source: unknown,
  options = {},
) {
  const plan = parseCommunityServicePlanSource(source, options)
  const documentSource = serializeCommunityServicePlan(plan)
  return {
    plan,
    documentSource,
    revision: createHash('sha256').update(documentSource).digest('hex'),
  }
}

export function communityServicePlanRevision(value: unknown) {
  const source = typeof value === 'string' || Buffer.isBuffer(value)
    ? validateCommunityServicePlanSource(value).documentSource
    : serializeCommunityServicePlan(value)
  return createHash('sha256').update(source).digest('hex')
}

export function canonicalServicePlanTimestamp(value: unknown, label: string) {
  if (
    typeof value !== 'string'
    || !CANONICAL_TIMESTAMP_PATTERN.test(value)
    || Number.isNaN(Date.parse(value))
    || new Date(value).toISOString() !== value
  ) {
    fail('INVALID_SERVICE_PLAN_TIMESTAMP', `${label} is invalid.`)
  }
  return value
}

export function normalizeCommunityServicePlanStatus(
  value: unknown,
): CommunityServicePlanStatus {
  if (
    typeof value !== 'string'
    || !COMMUNITY_SERVICE_PLAN_STATUSES.includes(
      value as CommunityServicePlanStatus,
    )
  ) {
    fail(
      'INVALID_SERVICE_PLAN_STATUS',
      `Community service plan status must be one of ${COMMUNITY_SERVICE_PLAN_STATUSES.join(', ')}.`,
    )
  }
  return value as CommunityServicePlanStatus
}

export function normalizeCommunityServicePlanEnvelope(
  raw: unknown,
): CommunityServicePlanEnvelope {
  exactKeys(
    raw,
    ['syncId', 'syncVersion', 'revision', 'documentSource', 'status', 'changedAt'],
    'Community service plan envelope',
  )
  const record = raw as MutableRecord
  const syncId = boundedSingleLine(
    record.syncId,
    'Community service plan sync ID',
    128,
    SYNC_ID_PATTERN,
  )
  const validated = validateCommunityServicePlanSource(record.documentSource)
  if (validated.plan.id !== syncId) {
    fail(
      'SERVICE_PLAN_ID_MISMATCH',
      'Community service plan source does not match its sync identity.',
    )
  }
  const revision = normalizeRevision(
    record.revision,
    'Community service plan envelope revision',
  )
  if (revision !== validated.revision) {
    fail(
      'SERVICE_PLAN_REVISION_MISMATCH',
      'Community service plan source does not match its revision.',
    )
  }
  return {
    syncId,
    syncVersion: positiveInteger(
      record.syncVersion,
      'Community service plan sync version',
    ),
    revision,
    documentSource: validated.documentSource,
    plan: validated.plan,
    status: normalizeCommunityServicePlanStatus(record.status),
    changedAt: canonicalServicePlanTimestamp(
      record.changedAt,
      'Community service plan change time',
    ),
  }
}

export function normalizeCommunityServicePlanSummary(
  raw: unknown,
): CommunityServicePlanSummary {
  exactKeys(
    raw,
    [
      'syncId',
      'syncVersion',
      'revision',
      'status',
      'title',
      'serviceDate',
      'startTime',
      'changedAt',
    ],
    'Community service plan summary',
  )
  const record = raw as MutableRecord
  return {
    syncId: boundedSingleLine(
      record.syncId,
      'Community service plan summary sync ID',
      128,
      SYNC_ID_PATTERN,
    ),
    syncVersion: positiveInteger(
      record.syncVersion,
      'Community service plan summary sync version',
    ),
    revision: normalizeRevision(
      record.revision,
      'Community service plan summary revision',
    ),
    status: normalizeCommunityServicePlanStatus(record.status),
    title: boundedSingleLine(
      record.title,
      'Community service plan summary title',
      200,
    ),
    serviceDate: normalizeDate(record.serviceDate),
    startTime: normalizeLocalTime(record.startTime),
    changedAt: canonicalServicePlanTimestamp(
      record.changedAt,
      'Community service plan summary change time',
    ),
  }
}

function normalizeCursor(value: unknown) {
  if (value === null) return null
  if (
    typeof value !== 'string'
    || value.length < 1
    || hasUnpairedSurrogate(value)
    || Buffer.byteLength(value, 'utf8') > MAX_COMMUNITY_SERVICE_PLAN_CURSOR_BYTES
    || hasSingleLineControl(value)
  ) {
    fail(
      'INVALID_SERVICE_PLAN_CURSOR',
      'Community service plan cursor is invalid.',
    )
  }
  return value
}

export function normalizeCommunityServicePlanPage(
  raw: unknown,
  { maximumItems = MAX_COMMUNITY_SERVICE_PLAN_PAGE_ITEMS } = {},
) {
  exactKeys(raw, ['items', 'nextCursor', 'hasMore'], 'Community service plan page')
  const record = raw as MutableRecord
  if (
    !Number.isSafeInteger(maximumItems)
    || maximumItems < 1
    || maximumItems > MAX_COMMUNITY_SERVICE_PLAN_PAGE_ITEMS
    || !Array.isArray(record.items)
    || record.items.length > maximumItems
    || typeof record.hasMore !== 'boolean'
  ) {
    fail(
      'INVALID_SERVICE_PLAN_PAGE',
      'Community service plan page is invalid.',
    )
  }
  const nextCursor = normalizeCursor(record.nextCursor)
  if (record.hasMore !== (nextCursor !== null)) {
    fail(
      'INVALID_SERVICE_PLAN_PAGE',
      'Community service plan page cursor state is inconsistent.',
    )
  }
  const items = record.items.map(normalizeCommunityServicePlanSummary)
  const ids = new Set<string>()
  for (const item of items) {
    if (ids.has(item.syncId)) {
      fail(
        'INVALID_SERVICE_PLAN_PAGE',
        'Community service plan page contains a duplicate plan.',
      )
    }
    ids.add(item.syncId)
  }
  return { items, nextCursor, hasMore: record.hasMore }
}
