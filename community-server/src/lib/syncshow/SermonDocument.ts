import { createHash } from 'node:crypto'
import {
  normalizeBibleRange,
  type CanonicalBibleRange,
} from './BibleRange.ts'

export const SERMON_SCHEMA_VERSION = 3
export const SERMON_KIND = 'syncshow-sermon'
export const MAX_SERMON_SOURCE_BYTES = 2 * 1024 * 1024
export const MAX_SERMON_REFERENCES = 512
export const MAX_SERMON_BODY_ENTRIES = 256
export const MAX_SERMON_BODY_ENTRY_BYTES = 1024 * 1024
export const MAX_SERMON_BODY_BYTES = 1536 * 1024

const SUPPORTED_SERMON_SCHEMA_VERSIONS = new Set([1, 2, SERMON_SCHEMA_VERSION])
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/
const MAX_SOURCE_LANGUAGES = 8

const OUTLINE_KINDS = new Set(['section', 'point', 'subpoint'])
const SOURCE_KINDS = new Set(['manuscript', 'slide-notes', 'transcript', 'other'])
const BODY_KINDS = new Set(['manuscript', 'slide-notes', 'transcript', 'other'])
const REFERENCE_ROLES = new Set(['primary', 'mentioned'])
const REFERENCE_SOURCES = new Set([
  'pastor',
  'slide-notes',
  'manuscript',
  'transcript-extraction',
  'operator',
])
const REVIEW_STATUSES = new Set(['suggested', 'confirmed'])
const MEDIA_KINDS = new Set(['audio', 'video', 'transcript', 'document'])
const MEDIA_STATUSES = new Set(['pending', 'processing', 'ready', 'failed'])
const PUBLICATION_STATUSES = new Set(['draft', 'ready', 'published', 'archived'])
const VISIBILITIES = new Set(['private', 'members', 'unlisted', 'public'])

type MutableRecord = Record<string, any>

export type CanonicalSermonSource = Readonly<{
  id: string
  kind: 'manuscript' | 'slide-notes' | 'transcript' | 'other'
  fileName: string
  mediaType: string
  sha256: string
  sizeBytes: number
  provenance: Readonly<{
    providedBy: string
    receivedAt: string | null
    sourceSystem: string
    externalId: string
  }>
  language?: string
  languages?: readonly string[]
}>

export type CanonicalSermonBodyEntry = Readonly<{
  id: string
  kind: 'manuscript' | 'slide-notes' | 'transcript' | 'other'
  language: string
  sourceId: string | null
  sectionId: string | null
  text: string
}>

export type CanonicalSermonDocument = Readonly<{
  schemaVersion: 1 | 2 | 3
  kind: typeof SERMON_KIND
  id: string
  titles: Readonly<Record<string, string>>
  defaultLanguage: string
  speaker: Readonly<{ id: string | null; name: string }>
  serviceDate: string
  series: Readonly<{
    id: string | null
    titles: Readonly<Record<string, string>>
  }> | null
  outline: readonly Readonly<{
    id: string
    parentId: string | null
    kind: 'section' | 'point' | 'subpoint'
    titles: Readonly<Record<string, string>>
  }>[]
  sources: readonly CanonicalSermonSource[]
  references: readonly Readonly<{
    id: string
    range: CanonicalBibleRange
    role: 'primary' | 'mentioned'
    source: 'pastor' | 'slide-notes' | 'manuscript' | 'transcript-extraction' | 'operator'
    reviewStatus: 'suggested' | 'confirmed'
    enteredText: string
    sourceId: string | null
    sectionId: string | null
    startOffset: number | null
    endOffset: number | null
  }>[]
  media: readonly Readonly<{
    id: string
    kind: 'audio' | 'video' | 'transcript' | 'document'
    status: 'pending' | 'processing' | 'ready' | 'failed'
    title: string
    language: string
    mediaType: string
    fileName: string | null
    sha256: string | null
    sizeBytes: number | null
    durationSeconds: number | null
    url: string | null
  }>[]
  publication: Readonly<{
    status: 'draft' | 'ready' | 'published' | 'archived'
    visibility: 'private' | 'members' | 'unlisted' | 'public'
    publishedAt: string | null
    canonicalUrl: string | null
  }>
  body?: readonly CanonicalSermonBodyEntry[]
}>

export type SermonRevision = Readonly<{
  id: `sha256:${string}`
  sha256: string
  source: string
  document: CanonicalSermonDocument
}>

export class SermonDocumentError extends Error {
  code: string
  details: Record<string, unknown>

  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'SermonDocumentError'
    this.code = code
    this.details = details
  }
}

function fail(
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): never {
  throw new SermonDocumentError(code, message, details)
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value) as string
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  return Object.freeze(value)
}

function boundedText(
  value: unknown,
  field: string,
  maximum: number,
  { required = false }: { required?: boolean } = {},
): string {
  if (value === undefined || value === null) value = ''
  if (typeof value !== 'string') fail('INVALID_TEXT', `${field} must be text.`, { field })
  const result = value.trim().normalize('NFC')
  if (required && !result) fail('MISSING_TEXT', `${field} is required.`, { field })
  if (result.length > maximum) {
    fail('TEXT_TOO_LONG', `${field} must be ${maximum} characters or fewer.`, {
      field,
      maximum,
    })
  }
  return result
}

function normalizeId(value: unknown, field: string): string {
  const result = boundedText(value, field, 128, { required: true })
  if (!ID_PATTERN.test(result)) {
    fail(
      'INVALID_ID',
      `${field} must start with a letter or number and use only letters, numbers, dot, underscore, colon, or hyphen.`,
      { field, value: result },
    )
  }
  return result
}

function normalizeLanguage(
  value: unknown,
  field: string,
  { required = true }: { required?: boolean } = {},
): string {
  const result = boundedText(value, field, 35, { required }).toLowerCase()
  if (result && !LANGUAGE_PATTERN.test(result)) {
    fail('INVALID_LANGUAGE', `${field} must be a BCP-47-style language tag.`, { field, value })
  }
  return result
}

function normalizeLanguageList(value: unknown, field: string): string[] {
  const rawLanguages = value === undefined || value === null
    ? ['und']
    : Array.isArray(value)
      ? value
      : [value]
  if (rawLanguages.length < 1 || rawLanguages.length > MAX_SOURCE_LANGUAGES) {
    fail(
      'INVALID_LANGUAGES',
      `${field} must include between 1 and ${MAX_SOURCE_LANGUAGES} language tags.`,
      { field },
    )
  }
  const languages = [...new Set(rawLanguages.map((language, index) =>
    normalizeLanguage(language, `${field} ${index + 1}`),
  ))].sort()
  if (languages.length === 0) {
    fail('INVALID_LANGUAGES', `${field} must include at least one language tag.`, { field })
  }
  return languages
}

function normalizeLocalizedTextMap(
  value: unknown,
  field: string,
  { required = false, maximum = 300 }: { required?: boolean; maximum?: number } = {},
): Record<string, string> {
  if (value === undefined || value === null) value = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_LOCALIZED_TEXT', `${field} must map language tags to text.`, { field })
  }
  const normalizedEntries: Array<[string, string]> = []
  for (const [rawLanguage, rawText] of Object.entries(value as Record<string, unknown>)) {
    const language = normalizeLanguage(rawLanguage, `${field} language`)
    const text = boundedText(rawText, `${field}.${language}`, maximum, { required: true })
    normalizedEntries.push([language, text])
  }
  normalizedEntries.sort(([left], [right]) => left.localeCompare(right))
  const result = Object.fromEntries(normalizedEntries)
  if (required && normalizedEntries.length === 0) {
    fail('MISSING_LOCALIZED_TEXT', `${field} must include at least one language.`, { field })
  }
  return result
}

function normalizeDate(
  value: unknown,
  field: string,
  { required = false }: { required?: boolean } = {},
): string | null {
  const result = boundedText(value, field, 10, { required })
  if (!result) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(result)
  if (!match) fail('INVALID_DATE', `${field} must use YYYY-MM-DD.`, { field, value })
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const date = new Date(timestamp)
  if (
    date.getUTCFullYear() !== Number(match[1])
    || date.getUTCMonth() !== Number(match[2]) - 1
    || date.getUTCDate() !== Number(match[3])
  ) {
    fail('INVALID_DATE', `${field} must be a real calendar date.`, { field, value })
  }
  return result
}

function normalizeTimestamp(value: unknown, field: string): string | null {
  const result = boundedText(value, field, 40)
  if (!result) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(result)
  if (!match) {
    fail('INVALID_TIMESTAMP', `${field} must be an ISO-8601 UTC timestamp.`, {
      field,
      value,
    })
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const milliseconds = Number((match[7] || '').padEnd(3, '0'))
  const offsetHours = match[8] === 'Z' ? 0 : Number(match[10])
  const offsetMinutes = match[8] === 'Z' ? 0 : Number(match[11])
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ]
  if (
    month < 1
    || month > 12
    || day < 1
    || day > daysInMonth[month - 1]
    || hour > 23
    || minute > 59
    || second > 59
    || offsetHours > 23
    || offsetMinutes > 59
  ) {
    fail('INVALID_TIMESTAMP', `${field} must be an ISO-8601 UTC timestamp.`, {
      field,
      value,
    })
  }

  const wallClock = new Date(0)
  wallClock.setUTCFullYear(year, month - 1, day)
  wallClock.setUTCHours(hour, minute, second, milliseconds)
  const signedOffsetMinutes = match[8] === 'Z'
    ? 0
    : (match[9] === '+' ? 1 : -1) * ((offsetHours * 60) + offsetMinutes)
  const intendedTimestamp = wallClock.getTime() - (signedOffsetMinutes * 60 * 1000)
  const parsedTimestamp = Date.parse(result)
  if (!Number.isFinite(parsedTimestamp) || parsedTimestamp !== intendedTimestamp) {
    fail('INVALID_TIMESTAMP', `${field} must be an ISO-8601 UTC timestamp.`, {
      field,
      value,
    })
  }

  const canonical = new Date(parsedTimestamp).toISOString()
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(canonical)) {
    fail('INVALID_TIMESTAMP', `${field} must resolve to a four-digit UTC year.`, {
      field,
      value,
    })
  }
  return canonical
}

function normalizeSha256(
  value: unknown,
  field: string,
  { required = true }: { required?: boolean } = {},
): string | null {
  const result = boundedText(value, field, 64, { required }).toLowerCase()
  if (result && !SHA256_PATTERN.test(result)) {
    fail('INVALID_SHA256', `${field} must be a lowercase SHA-256 digest.`, { field })
  }
  return result || null
}

function normalizeNonNegativeInteger(
  value: unknown,
  field: string,
  { required = false }: { required?: boolean } = {},
): number | null {
  if ((value === undefined || value === null) && !required) return null
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail('INVALID_NUMBER', `${field} must be a non-negative integer.`, { field, value })
  }
  return value as number
}

function normalizePositiveNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    fail('INVALID_NUMBER', `${field} must be a positive number.`, { field, value })
  }
  return value
}

function normalizeEnum<T extends string>(
  value: unknown,
  field: string,
  options: Set<string>,
  fallback?: string,
): T {
  const result = boundedText(value === undefined ? fallback : value, field, 50, { required: true })
  if (!options.has(result)) {
    fail('INVALID_ENUM', `${field} has an unsupported value.`, {
      field,
      value: result,
      options: [...options],
    })
  }
  return result as T
}

function normalizeOptionalId(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  return normalizeId(value, field)
}

function ensureNoLocalPathFields(raw: unknown, field: string): void {
  for (const key of ['path', 'filePath', 'localPath', 'absolutePath']) {
    if (
      raw
      && typeof raw === 'object'
      && Object.prototype.hasOwnProperty.call(raw, key)
    ) {
      fail(
        'LOCAL_PATH_NOT_ALLOWED',
        `${field} must not persist a machine-local path; use a content hash and file name.`,
        { field, key },
      )
    }
  }
}

function normalizeFileName(
  value: unknown,
  field: string,
  { required = true }: { required?: boolean } = {},
): string | null {
  const result = boundedText(value, field, 255, { required })
  if (!result) return null
  if (
    result === '.'
    || result === '..'
    || result.includes('/')
    || result.includes('\\')
    || /^[A-Za-z]:/.test(result)
  ) {
    fail('INVALID_FILE_NAME', `${field} must be a file name, not a path.`, { field, value })
  }
  return result
}

function normalizeHttpUrl(value: unknown, field: string): string | null {
  const result = boundedText(value, field, 2048)
  if (!result) return null
  let parsed: URL
  try {
    parsed = new URL(result)
  } catch {
    fail('INVALID_URL', `${field} must be an HTTP or HTTPS URL.`, { field })
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    fail('INVALID_URL', `${field} must be an HTTP or HTTPS URL without embedded credentials.`, {
      field,
    })
  }
  return parsed.toString()
}

function normalizeSpeaker(raw: unknown): CanonicalSermonDocument['speaker'] {
  if (typeof raw === 'string') raw = { name: raw }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('INVALID_SPEAKER', 'Sermon speaker must contain a name.')
  }
  const record = raw as MutableRecord
  return {
    id: normalizeOptionalId(record.id, 'Speaker id'),
    name: boundedText(record.name, 'Speaker name', 200, { required: true }),
  }
}

function normalizeSeries(raw: unknown): CanonicalSermonDocument['series'] {
  if (raw === undefined || raw === null) return null
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('INVALID_SERIES', 'Sermon series must be an object.')
  }
  const record = raw as MutableRecord
  return {
    id: normalizeOptionalId(record.id, 'Series id'),
    titles: normalizeLocalizedTextMap(record.titles, 'Series titles', { required: true }),
  }
}

function normalizeOutline(rawOutline: unknown): MutableRecord[] {
  if (rawOutline === undefined || rawOutline === null) rawOutline = []
  if (!Array.isArray(rawOutline)) fail('INVALID_OUTLINE', 'Sermon outline must be a list.')
  if (rawOutline.length > 500) {
    fail('OUTLINE_TOO_LARGE', 'Sermon outline cannot exceed 500 sections.')
  }

  const seen = new Set<string>()
  const outline = rawOutline.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      fail('INVALID_OUTLINE_SECTION', `Outline section ${index + 1} must be an object.`)
    }
    const record = raw as MutableRecord
    const id = normalizeId(record.id, `Outline section ${index + 1} id`)
    if (seen.has(id)) fail('DUPLICATE_ID', `Outline section id “${id}” is repeated.`, { id })
    seen.add(id)
    const parentId = normalizeOptionalId(record.parentId, `Outline section ${id} parentId`)
    return {
      id,
      parentId,
      kind: normalizeEnum(record.kind, `Outline section ${id} kind`, OUTLINE_KINDS, 'point'),
      titles: normalizeLocalizedTextMap(record.titles, `Outline section ${id} titles`, {
        required: true,
        maximum: 500,
      }),
    }
  })

  for (const section of outline) {
    if (section.parentId && !seen.has(section.parentId)) {
      fail('UNKNOWN_OUTLINE_PARENT', `Outline section “${section.id}” has an unknown parent.`, {
        id: section.id,
        parentId: section.parentId,
      })
    }
    const visited = new Set([section.id])
    let parentId = section.parentId
    while (parentId) {
      if (visited.has(parentId)) {
        fail('OUTLINE_CYCLE', `Outline section “${section.id}” is in a parent cycle.`, {
          id: section.id,
        })
      }
      visited.add(parentId)
      parentId = outline.find(candidate => candidate.id === parentId)?.parentId || null
    }
  }
  return outline
}

function normalizeSource(
  raw: unknown,
  index: number,
  schemaVersion: number,
): MutableRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('INVALID_SOURCE', `Sermon source ${index + 1} must be an object.`)
  }
  ensureNoLocalPathFields(raw, `Sermon source ${index + 1}`)
  const record = raw as MutableRecord
  const id = normalizeId(record.id, `Sermon source ${index + 1} id`)
  const provenance = record.provenance === undefined || record.provenance === null
    ? {}
    : record.provenance
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    fail('INVALID_PROVENANCE', `Sermon source “${id}” provenance must be an object.`)
  }
  ensureNoLocalPathFields(provenance, `Sermon source “${id}” provenance`)
  const normalized: MutableRecord = {
    id,
    kind: normalizeEnum(record.kind, `Sermon source “${id}” kind`, SOURCE_KINDS, 'other'),
    fileName: normalizeFileName(record.fileName, `Sermon source “${id}” fileName`),
    mediaType: boundedText(record.mediaType, `Sermon source “${id}” mediaType`, 200, {
      required: true,
    }),
    sha256: normalizeSha256(record.sha256, `Sermon source “${id}” sha256`),
    sizeBytes: normalizeNonNegativeInteger(
      record.sizeBytes,
      `Sermon source “${id}” sizeBytes`,
      { required: true },
    ),
    provenance: {
      providedBy: boundedText(
        provenance.providedBy,
        `Sermon source “${id}” provenance providedBy`,
        200,
      ),
      receivedAt: normalizeTimestamp(
        provenance.receivedAt,
        `Sermon source “${id}” provenance receivedAt`,
      ),
      sourceSystem: boundedText(
        provenance.sourceSystem,
        `Sermon source “${id}” provenance sourceSystem`,
        100,
      ),
      externalId: boundedText(
        provenance.externalId,
        `Sermon source “${id}” provenance externalId`,
        300,
      ),
    },
  }
  if (schemaVersion === 1) {
    normalized.language = normalizeLanguage(
      record.language || 'und',
      `Sermon source “${id}” language`,
    )
  } else {
    normalized.languages = normalizeLanguageList(
      record.languages ?? record.language ?? 'und',
      `Sermon source “${id}” languages`,
    )
  }
  return normalized
}

function normalizeReference(
  raw: unknown,
  index: number,
  sourceIds: Set<string>,
  outlineIds: Set<string>,
): MutableRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('INVALID_REFERENCE', `Sermon reference ${index + 1} must be an object.`)
  }
  const record = raw as MutableRecord
  const id = normalizeId(record.id, `Sermon reference ${index + 1} id`)
  const sourceId = normalizeOptionalId(record.sourceId, `Sermon reference “${id}” sourceId`)
  const sectionId = normalizeOptionalId(record.sectionId, `Sermon reference “${id}” sectionId`)
  if (sourceId && !sourceIds.has(sourceId)) {
    fail('UNKNOWN_SOURCE', `Sermon reference “${id}” links to an unknown source.`, {
      id,
      sourceId,
    })
  }
  if (sectionId && !outlineIds.has(sectionId)) {
    fail('UNKNOWN_OUTLINE_SECTION', `Sermon reference “${id}” links to an unknown outline section.`, {
      id,
      sectionId,
    })
  }

  const startOffset = normalizeNonNegativeInteger(
    record.startOffset,
    `Sermon reference “${id}” startOffset`,
  )
  const endOffset = normalizeNonNegativeInteger(
    record.endOffset,
    `Sermon reference “${id}” endOffset`,
  )
  if (
    (startOffset === null) !== (endOffset === null)
    || (startOffset !== null && endOffset! < startOffset)
  ) {
    fail(
      'INVALID_SOURCE_OFFSETS',
      `Sermon reference “${id}” offsets must be a complete, ordered pair.`,
      { id, startOffset, endOffset },
    )
  }
  const enteredText = boundedText(
    record.enteredText !== undefined ? record.enteredText : record.displayText,
    `Sermon reference “${id}” enteredText`,
    300,
  )
  if (
    record.enteredText !== undefined
    && record.displayText !== undefined
    && enteredText !== boundedText(
      record.displayText,
      `Sermon reference “${id}” displayText`,
      300,
    )
  ) {
    fail(
      'CONFLICTING_ENTERED_TEXT',
      `Sermon reference “${id}” defines enteredText and displayText differently.`,
      { id },
    )
  }

  return {
    id,
    range: normalizeBibleRange(record.range),
    role: normalizeEnum(record.role, `Sermon reference “${id}” role`, REFERENCE_ROLES, 'mentioned'),
    source: normalizeEnum(
      record.source,
      `Sermon reference “${id}” source`,
      REFERENCE_SOURCES,
      'operator',
    ),
    reviewStatus: normalizeEnum(
      record.reviewStatus,
      `Sermon reference “${id}” reviewStatus`,
      REVIEW_STATUSES,
      'suggested',
    ),
    enteredText,
    sourceId,
    sectionId,
    startOffset,
    endOffset,
  }
}

function normalizeMedia(raw: unknown, index: number): MutableRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('INVALID_MEDIA', `Sermon media ${index + 1} must be an object.`)
  }
  ensureNoLocalPathFields(raw, `Sermon media ${index + 1}`)
  const record = raw as MutableRecord
  const id = normalizeId(record.id, `Sermon media ${index + 1} id`)
  const sha256 = normalizeSha256(record.sha256, `Sermon media “${id}” sha256`, {
    required: false,
  })
  const fileName = normalizeFileName(
    record.fileName,
    `Sermon media “${id}” fileName`,
    { required: false },
  )
  const url = normalizeHttpUrl(record.url, `Sermon media “${id}” url`)
  if (!sha256 && !url) {
    fail('MISSING_MEDIA_LOCATION', `Sermon media “${id}” needs a content hash or URL.`, { id })
  }
  return {
    id,
    kind: normalizeEnum(record.kind, `Sermon media “${id}” kind`, MEDIA_KINDS, 'audio'),
    status: normalizeEnum(record.status, `Sermon media “${id}” status`, MEDIA_STATUSES, 'pending'),
    title: boundedText(record.title, `Sermon media “${id}” title`, 300),
    language: normalizeLanguage(record.language || 'und', `Sermon media “${id}” language`),
    mediaType: boundedText(record.mediaType, `Sermon media “${id}” mediaType`, 200),
    fileName,
    sha256,
    sizeBytes: normalizeNonNegativeInteger(record.sizeBytes, `Sermon media “${id}” sizeBytes`),
    durationSeconds: normalizePositiveNumber(
      record.durationSeconds,
      `Sermon media “${id}” durationSeconds`,
    ),
    url,
  }
}

function normalizePublication(raw: unknown): CanonicalSermonDocument['publication'] {
  if (raw === undefined || raw === null) raw = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('INVALID_PUBLICATION', 'Sermon publication metadata must be an object.')
  }
  const record = raw as MutableRecord
  const status = normalizeEnum<
    CanonicalSermonDocument['publication']['status']
  >(record.status, 'Publication status', PUBLICATION_STATUSES, 'draft')
  const visibility = normalizeEnum<
    CanonicalSermonDocument['publication']['visibility']
  >(record.visibility, 'Publication visibility', VISIBILITIES, 'private')
  const publishedAt = normalizeTimestamp(record.publishedAt, 'Publication publishedAt')
  if (status === 'published' && !publishedAt) {
    fail('MISSING_PUBLICATION_TIMESTAMP', 'Published sermons need an explicit publishedAt timestamp.')
  }
  return {
    status,
    visibility,
    publishedAt,
    canonicalUrl: normalizeHttpUrl(record.canonicalUrl, 'Publication canonicalUrl'),
  }
}

function normalizeBodyText(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    fail('INVALID_BODY_TEXT', `${field} must be text.`, { field })
  }
  const result = value.replace(/\r\n?/g, '\n').normalize('NFC')
  if (!result.trim()) {
    fail('MISSING_BODY_TEXT', `${field} is required.`, { field })
  }
  let hasUnpairedSurrogate = false
  for (const character of result) {
    const codePoint = character.codePointAt(0)!
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      hasUnpairedSurrogate = true
      break
    }
  }
  if (
    hasUnpairedSurrogate
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(result)
  ) {
    fail(
      'UNSAFE_BODY_TEXT',
      `${field} contains an unsupported Unicode code unit or control character.`,
      { field },
    )
  }
  const sizeBytes = Buffer.byteLength(result, 'utf8')
  if (sizeBytes > MAX_SERMON_BODY_ENTRY_BYTES) {
    fail(
      'BODY_ENTRY_TOO_LARGE',
      `${field} must be ${MAX_SERMON_BODY_ENTRY_BYTES} UTF-8 bytes or fewer.`,
      { field, maximumBytes: MAX_SERMON_BODY_ENTRY_BYTES, sizeBytes },
    )
  }
  return result
}

function normalizeSermonBody(
  rawBody: unknown,
  sourcesById: Map<string, MutableRecord>,
  outlineIds: Set<string>,
): MutableRecord[] {
  if (rawBody === undefined || rawBody === null) rawBody = []
  if (!Array.isArray(rawBody)) {
    fail('INVALID_BODY', 'Sermon body must be an ordered list.')
  }
  if (rawBody.length > MAX_SERMON_BODY_ENTRIES) {
    fail(
      'BODY_TOO_LARGE',
      `Sermon body cannot exceed ${MAX_SERMON_BODY_ENTRIES} entries.`,
      { maximum: MAX_SERMON_BODY_ENTRIES },
    )
  }

  const seen = new Set<string>()
  let totalBytes = 0
  return rawBody.map((raw, index) => {
    const field = `Sermon body entry ${index + 1}`
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      fail('INVALID_BODY_ENTRY', `${field} must be an object.`, { field })
    }
    const expectedKeys = new Set([
      'id',
      'kind',
      'language',
      'sourceId',
      'sectionId',
      'text',
    ])
    const actualKeys = Object.keys(raw)
    if (
      actualKeys.length !== expectedKeys.size
      || actualKeys.some(key => !expectedKeys.has(key))
    ) {
      fail(
        'INVALID_BODY_ENTRY',
        `${field} has unsupported or missing fields.`,
        { field },
      )
    }

    const record = raw as MutableRecord
    const id = normalizeId(record.id, `${field} id`)
    if (seen.has(id)) {
      fail('DUPLICATE_ID', `Sermon body entry id “${id}” is repeated.`, { id })
    }
    seen.add(id)
    const sourceId = normalizeOptionalId(record.sourceId, `Sermon body entry “${id}” sourceId`)
    const sectionId = normalizeOptionalId(
      record.sectionId,
      `Sermon body entry “${id}” sectionId`,
    )
    const source = sourceId ? sourcesById.get(sourceId) : null
    if (sourceId && !source) {
      fail('UNKNOWN_SOURCE', `Sermon body entry “${id}” links to an unknown source.`, {
        id,
        sourceId,
      })
    }
    if (sectionId && !outlineIds.has(sectionId)) {
      fail(
        'UNKNOWN_OUTLINE_SECTION',
        `Sermon body entry “${id}” links to an unknown outline section.`,
        { id, sectionId },
      )
    }
    const kind = normalizeEnum<string>(
      record.kind,
      `Sermon body entry “${id}” kind`,
      BODY_KINDS,
      'other',
    )
    if (source && kind !== source.kind) {
      fail(
        'BODY_SOURCE_KIND_MISMATCH',
        `Sermon body entry “${id}” kind must match its linked sermon source.`,
        {
          id,
          sourceId,
          bodyKind: kind,
          sourceKind: source.kind,
        },
      )
    }
    const text = normalizeBodyText(record.text, `Sermon body entry “${id}” text`)
    totalBytes += Buffer.byteLength(text, 'utf8')
    if (totalBytes > MAX_SERMON_BODY_BYTES) {
      fail(
        'BODY_TOO_LARGE',
        `Sermon body must be ${MAX_SERMON_BODY_BYTES} UTF-8 bytes or fewer.`,
        { maximumBytes: MAX_SERMON_BODY_BYTES, sizeBytes: totalBytes },
      )
    }
    return {
      id,
      kind,
      language: normalizeLanguage(record.language, `Sermon body entry “${id}” language`),
      sourceId,
      sectionId,
      text,
    }
  })
}

function uniqueById(items: MutableRecord[], kind: string): Set<string> {
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.id)) {
      fail('DUPLICATE_ID', `${kind} id “${item.id}” is repeated.`, { id: item.id })
    }
    seen.add(item.id)
  }
  return seen
}

export function normalizeSermonDocument(raw: unknown): CanonicalSermonDocument {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('INVALID_SERMON', 'Sermon document must be an object.')
  }
  const record = raw as MutableRecord
  if (!SUPPORTED_SERMON_SCHEMA_VERSIONS.has(record.schemaVersion)) {
    fail(
      'UNSUPPORTED_SERMON_SCHEMA',
      `Sermon schema version ${record.schemaVersion} is not supported.`,
      { actual: record.schemaVersion, supported: [...SUPPORTED_SERMON_SCHEMA_VERSIONS] },
    )
  }
  if (record.kind !== undefined && record.kind !== SERMON_KIND) {
    fail('INVALID_SERMON_KIND', `Sermon kind must be “${SERMON_KIND}”.`, {
      actual: record.kind,
    })
  }

  const titles = normalizeLocalizedTextMap(record.titles, 'Sermon titles', { required: true })
  const defaultLanguage = normalizeLanguage(
    record.defaultLanguage || Object.keys(titles)[0],
    'Sermon defaultLanguage',
  )
  if (!Object.prototype.hasOwnProperty.call(titles, defaultLanguage)) {
    fail(
      'MISSING_DEFAULT_TITLE',
      `Sermon titles must include the default language “${defaultLanguage}”.`,
      { defaultLanguage },
    )
  }

  const outline = normalizeOutline(record.outline)
  const outlineIds = uniqueById(outline, 'Outline section')
  const rawSources = record.sources === undefined || record.sources === null ? [] : record.sources
  if (!Array.isArray(rawSources)) fail('INVALID_SOURCES', 'Sermon sources must be a list.')
  const sources = rawSources.map((source, index) => normalizeSource(
    source,
    index,
    record.schemaVersion,
  ))
  const sourceIds = uniqueById(sources, 'Sermon source')
  const sourcesById = new Map(sources.map(source => [source.id, source]))
  const rawReferences = record.references === undefined || record.references === null
    ? []
    : record.references
  if (!Array.isArray(rawReferences)) {
    fail('INVALID_REFERENCES', 'Sermon references must be a list.')
  }
  const references = rawReferences.map((reference, index) => (
    normalizeReference(reference, index, sourceIds, outlineIds)
  ))
  uniqueById(references, 'Sermon reference')
  const rawMedia = record.media === undefined || record.media === null ? [] : record.media
  if (!Array.isArray(rawMedia)) fail('INVALID_MEDIA', 'Sermon media must be a list.')
  const media = rawMedia.map(normalizeMedia)
  uniqueById(media, 'Sermon media')
  const publication = normalizePublication(record.publication)
  if (record.schemaVersion < 3 && record.body !== undefined) {
    fail(
      'BODY_REQUIRES_SCHEMA_V3',
      'Sermon body entries require sermon schema version 3.',
      { schemaVersion: record.schemaVersion },
    )
  }
  const body = record.schemaVersion === 3
    ? normalizeSermonBody(record.body, sourcesById, outlineIds)
    : null

  if (
    ['ready', 'published'].includes(publication.status)
    && !references.some(reference =>
      reference.role === 'primary' && reference.reviewStatus === 'confirmed')
  ) {
    fail(
      'MISSING_CONFIRMED_PRIMARY_REFERENCE',
      'Ready and published sermons need at least one confirmed primary passage.',
    )
  }

  const normalized: MutableRecord = {
    schemaVersion: record.schemaVersion,
    kind: SERMON_KIND,
    id: normalizeId(record.id, 'Sermon id'),
    titles,
    defaultLanguage,
    speaker: normalizeSpeaker(record.speaker),
    serviceDate: normalizeDate(record.serviceDate, 'Sermon serviceDate', { required: true }),
    series: normalizeSeries(record.series),
    outline,
    sources,
    references,
    media,
    publication,
  }
  if (record.schemaVersion === 3) normalized.body = body
  const serializedBytes = Buffer.byteLength(`${canonicalJson(normalized)}\n`, 'utf8')
  if (serializedBytes > MAX_SERMON_SOURCE_BYTES) {
    fail(
      'SERMON_SOURCE_TOO_LARGE',
      `Sermon documents must be ${MAX_SERMON_SOURCE_BYTES / 1024} KB or smaller.`,
      { maximumBytes: MAX_SERMON_SOURCE_BYTES, sizeBytes: serializedBytes },
    )
  }
  return deepFreeze(normalized) as CanonicalSermonDocument
}

export function upgradeSermonDocumentV1ToV3(raw: unknown): CanonicalSermonDocument {
  const document = normalizeSermonDocument(raw)
  if (document.schemaVersion !== 1) {
    fail(
      'INVALID_UPGRADE_SOURCE',
      'The v1-to-v3 upgrade requires a schema version 1 sermon.',
      { actual: document.schemaVersion },
    )
  }
  return normalizeSermonDocument({
    ...document,
    schemaVersion: SERMON_SCHEMA_VERSION,
    sources: document.sources.map(source => {
      const { language, ...rest } = source
      return {
        ...rest,
        languages: [language || 'und'],
      }
    }),
    body: [],
  })
}

export function upgradeSermonDocumentV2ToV3(raw: unknown): CanonicalSermonDocument {
  const document = normalizeSermonDocument(raw)
  if (document.schemaVersion !== 2) {
    fail(
      'INVALID_UPGRADE_SOURCE',
      'The v2-to-v3 upgrade requires a schema version 2 sermon.',
      { actual: document.schemaVersion },
    )
  }
  return normalizeSermonDocument({
    ...document,
    schemaVersion: SERMON_SCHEMA_VERSION,
    body: [],
  })
}

export function upgradeSermonDocument(raw: unknown): CanonicalSermonDocument {
  const document = normalizeSermonDocument(raw)
  if (document.schemaVersion === SERMON_SCHEMA_VERSION) return document
  if (document.schemaVersion === 1) return upgradeSermonDocumentV1ToV3(document)
  return upgradeSermonDocumentV2ToV3(document)
}

export function serializeSermonDocument(raw: unknown): string {
  const serialized = `${canonicalJson(normalizeSermonDocument(raw))}\n`
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SERMON_SOURCE_BYTES) {
    fail(
      'SERMON_SOURCE_TOO_LARGE',
      `Sermon documents must be ${MAX_SERMON_SOURCE_BYTES / 1024} KB or smaller.`,
    )
  }
  return serialized
}

export function parseSermonDocument(source: string | Buffer): CanonicalSermonDocument {
  if (typeof source !== 'string' && !Buffer.isBuffer(source)) {
    fail('INVALID_SERMON_SOURCE', 'Sermon source must be JSON text.')
  }
  if (Buffer.byteLength(source) > MAX_SERMON_SOURCE_BYTES) {
    fail('SERMON_SOURCE_TOO_LARGE', 'Sermon source is too large.')
  }
  let raw: unknown
  try {
    raw = JSON.parse(source.toString('utf8'))
  } catch {
    fail('INVALID_SERMON_JSON', 'Sermon source is not valid JSON.')
  }
  return normalizeSermonDocument(raw)
}

export function sermonDocumentSha256(raw: unknown): string {
  return createHash('sha256').update(serializeSermonDocument(raw)).digest('hex')
}

export function createSermonRevision(raw: unknown): SermonRevision {
  const document = normalizeSermonDocument(raw)
  const source = serializeSermonDocument(document)
  const sha256 = createHash('sha256').update(source).digest('hex')
  return deepFreeze({
    id: `sha256:${sha256}` as const,
    sha256,
    source,
    document,
  })
}
