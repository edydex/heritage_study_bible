import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import {
  compareBibleRanges,
  normalizeBibleRange,
  type CanonicalBibleRange,
} from './BibleRange.ts'
import {
  MAX_SERMON_BODY_BYTES,
  MAX_SERMON_BODY_ENTRIES,
  MAX_SERMON_BODY_ENTRY_BYTES,
  MAX_SERMON_REFERENCES,
  MAX_SERMON_SOURCE_BYTES,
  parseSermonDocument,
  serializeSermonDocument,
  type CanonicalSermonDocument,
} from './SermonDocument.ts'

// This module is a pure compatibility and serving contract. It never grants
// publication approval; the separate authenticated manager transaction
// atomically persists its exact canonical source, detail, catalog item, and
// materialized catalog before anonymous routes can observe the new pointer.
export const PUBLIC_SERMON_PUBLICATION_SCHEMA_VERSION = 1
export const PUBLIC_SERMON_PUBLICATION_KIND = 'heritage-public-sermon-publication'
export const PUBLIC_SERMON_DETAIL_SCHEMA_VERSION = 1
export const PUBLIC_SERMON_DETAIL_KIND = 'heritage-public-sermon'
export const PUBLIC_SERMON_CATALOG_SCHEMA_VERSION = 2
export const PUBLIC_SERMON_CATALOG_CONTENT_TYPE = 'sermons'
export const PUBLIC_SERMON_PASSAGE_INDEX_SCHEMA_VERSION = 1
export const PUBLIC_SERMON_PASSAGE_INDEX_KIND = 'heritage-public-sermon-passage-index'
export const PUBLIC_SERMON_CATALOG_PATH = '/publications/sermons/catalog.json'
export const PUBLIC_SERMON_CONTENT_BASE_PATH = '/content/sermons'
export const PUBLIC_SERMON_PASSAGE_INDEX_PATH = '/indexes/sermon-passages'
export const PUBLIC_SERMON_CATALOG_MEDIA_TYPE = 'application/json'
export const PUBLIC_SERMON_DETAIL_MEDIA_TYPE = 'application/vnd.heritage.sermon+json'
export const PUBLIC_SERMON_PASSAGE_INDEX_MEDIA_TYPE = 'application/json'

export const PUBLIC_SERMON_DISCOVERY_DESCRIPTOR = Object.freeze({
  schemaVersion: PUBLIC_SERMON_PUBLICATION_SCHEMA_VERSION,
  kind: PUBLIC_SERMON_PUBLICATION_KIND,
  catalog: Object.freeze({
    url: PUBLIC_SERMON_CATALOG_PATH,
    mediaType: PUBLIC_SERMON_CATALOG_MEDIA_TYPE,
  }),
  detailMediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
  passageIndex: Object.freeze({
    url: PUBLIC_SERMON_PASSAGE_INDEX_PATH,
    mediaType: PUBLIC_SERMON_PASSAGE_INDEX_MEDIA_TYPE,
  }),
})

export const MAX_PUBLIC_SERMON_DETAIL_BYTES = 2 * 1024 * 1024
export const MAX_PUBLIC_SERMON_CATALOG_ITEM_BYTES = 512 * 1024
export const MAX_PUBLIC_SERMON_CATALOG_BYTES = 16 * 1024 * 1024
export const MAX_PUBLIC_SERMON_CATALOG_ITEMS = 10000
export const MAX_PUBLIC_SERMON_PASSAGE_INDEX_BYTES = 32 * 1024 * 1024
export const MAX_PUBLIC_SERMON_INDEX_REFERENCES = 100000
export const MAX_PUBLIC_SERMON_MEDIA = 256

const MAX_PUBLIC_SERMON_LANGUAGES = 32
const SERMON_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const PUBLIC_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,95}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/
const BODY_KINDS = new Set(['manuscript', 'slide-notes', 'transcript', 'other'])
const MEDIA_KINDS = new Set(['audio', 'video', 'transcript', 'document'])
const REFERENCE_ROLES = new Set(['primary', 'mentioned'])
const NONPUBLIC_HOST_SUFFIXES = [
  '.arpa',
  '.example',
  '.home',
  '.internal',
  '.invalid',
  '.lan',
  '.local',
  '.localhost',
  '.onion',
  '.test',
]

type MutableRecord = Record<string, any>

export type PublicSermonDetail = Readonly<{
  schemaVersion: typeof PUBLIC_SERMON_DETAIL_SCHEMA_VERSION
  kind: typeof PUBLIC_SERMON_DETAIL_KIND
  publicId: string
  sermonId: string
  sermonRevision: string
  titles: Readonly<Record<string, string>>
  defaultLanguage: string
  speaker: Readonly<{ name: string }>
  serviceDate: string
  series: Readonly<{ titles: Readonly<Record<string, string>> }> | null
  references: readonly Readonly<{
    role: 'primary' | 'mentioned'
    range: CanonicalBibleRange
  }>[]
  body: readonly Readonly<{
    kind: 'manuscript' | 'slide-notes' | 'transcript' | 'other'
    language: string
    text: string
  }>[]
  media: readonly Readonly<{
    kind: 'audio' | 'video' | 'transcript' | 'document'
    title: string
    language: string
    mediaType: string
    durationSeconds: number | null
    url: string
  }>[]
  canonicalUrl: string | null
}>

export type PublicSermonCatalogItem = Readonly<{
  id: string
  sermonId: string
  sermonRevision: string
  checksum: string
  title: string
  titles: Readonly<Record<string, string>>
  defaultLanguage: string
  speaker: Readonly<{ name: string }>
  serviceDate: string
  series: Readonly<{ titles: Readonly<Record<string, string>> }> | null
  references: PublicSermonDetail['references']
  content: Readonly<{
    url: string
    mediaType: typeof PUBLIC_SERMON_DETAIL_MEDIA_TYPE
  }>
}>

export type PublicSermonPassageIndex = Readonly<{
  schemaVersion: typeof PUBLIC_SERMON_PASSAGE_INDEX_SCHEMA_VERSION
  kind: typeof PUBLIC_SERMON_PASSAGE_INDEX_KIND
  items: readonly Readonly<{
    publicId: string
    sermonId: string
    sermonRevision: string
    checksum: string
    title: string
    speaker: Readonly<{ name: string }>
    serviceDate: string
    contentUrl: string
    references: PublicSermonDetail['references']
  }>[]
}>

export type StoredPublicSermonPublication = Readonly<{
  schemaVersion: 1
  active: true
  visibility: 'public'
  publicationVersion: number
  publishedAt: string
  sermonId: string
  publicId: string
  publicRevision: string
  selectedBodyEntryIds: readonly string[]
  selectedMediaIds: readonly string[]
  detailChecksum: string
  detailSource: string
}>

export class PublicSermonPublicationError extends Error {
  code: string
  details: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'PublicSermonPublicationError'
    this.code = code
    this.details = details
  }
}

function fail(
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): never {
  throw new PublicSermonPublicationError(code, message, details)
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  return Object.freeze(value)
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

function sha256(source: string): string {
  return createHash('sha256').update(source, 'utf8').digest('hex')
}

function isPlainRecord(value: unknown): value is MutableRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertExactKeys(
  value: unknown,
  keys: string[],
  label: string,
  code = 'INVALID_PUBLIC_SERMON',
): asserts value is MutableRecord {
  if (!isPlainRecord(value)) fail(code, `${label} must be a plain object.`)
  const expected = new Set(keys)
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail(code, `${label} is missing ${key}.`, { field: key })
    }
  }
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) {
      fail(code, `${label} contains an unsupported field.`, { field: key })
    }
  }
}

function hasUnpairedSurrogate(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0)!
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) return true
  }
  return false
}

function boundedText(
  value: unknown,
  label: string,
  maximumBytes: number,
  {
    required = false,
    preserveWhitespace = false,
  }: {
    required?: boolean
    preserveWhitespace?: boolean
  } = {},
): string {
  if (typeof value !== 'string') {
    fail('INVALID_PUBLIC_TEXT', `${label} must be text.`, { field: label })
  }
  const normalized = (preserveWhitespace
    ? value.replace(/\r\n?/g, '\n')
    : value.trim()).normalize('NFC')
  if (required && !normalized.trim()) {
    fail('MISSING_PUBLIC_TEXT', `${label} is required.`, { field: label })
  }
  const unsafeControls = preserveWhitespace
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u
    : /[\u0000-\u001f\u007f-\u009f]/u
  if (hasUnpairedSurrogate(normalized) || unsafeControls.test(normalized)) {
    fail('UNSAFE_PUBLIC_TEXT', `${label} contains unsupported text characters.`, {
      field: label,
    })
  }
  const sizeBytes = Buffer.byteLength(normalized, 'utf8')
  if (sizeBytes > maximumBytes) {
    fail('PUBLIC_TEXT_TOO_LARGE', `${label} is too large.`, {
      field: label,
      maximumBytes,
      sizeBytes,
    })
  }
  return normalized
}

function normalizeSermonId(value: unknown, label = 'Public sermon ID'): string {
  const normalized = boundedText(value, label, 128, { required: true })
  if (!SERMON_ID_PATTERN.test(normalized)) {
    fail('INVALID_PUBLIC_SERMON_ID', `${label} is invalid.`)
  }
  return normalized
}

function normalizePublicId(value: unknown, label = 'Public content ID'): string {
  const normalized = boundedText(value, label, 96, { required: true })
  if (!PUBLIC_ID_PATTERN.test(normalized)) {
    fail('INVALID_PUBLIC_CONTENT_ID', `${label} is invalid.`)
  }
  return normalized
}

function normalizeSha256(value: unknown, label: string): string {
  const normalized = boundedText(value, label, 64, { required: true })
  if (!SHA256_PATTERN.test(normalized)) {
    fail('INVALID_PUBLIC_CHECKSUM', `${label} must be a lowercase SHA-256 digest.`)
  }
  return normalized
}

function normalizeLanguage(value: unknown, label: string): string {
  const normalized = boundedText(value, label, 35, { required: true }).toLowerCase()
  if (!LANGUAGE_PATTERN.test(normalized)) {
    fail('INVALID_PUBLIC_LANGUAGE', `${label} must be a BCP-47-style language tag.`)
  }
  return normalized
}

function normalizeLocalizedText(
  value: unknown,
  label: string,
): Record<string, string> {
  if (!isPlainRecord(value)) fail('INVALID_PUBLIC_SERMON', `${label} must be a plain object.`)
  const entries = Object.entries(value)
  if (entries.length === 0 || entries.length > MAX_PUBLIC_SERMON_LANGUAGES) {
    fail(
      'INVALID_PUBLIC_LOCALIZATIONS',
      `${label} must contain between 1 and ${MAX_PUBLIC_SERMON_LANGUAGES} languages.`,
    )
  }
  const normalized = new Map<string, string>()
  for (const [rawLanguage, rawText] of entries) {
    const language = normalizeLanguage(rawLanguage, `${label} language`)
    if (normalized.has(language)) {
      fail('DUPLICATE_PUBLIC_LANGUAGE', `${label} repeats language “${language}”.`)
    }
    normalized.set(
      language,
      boundedText(rawText, `${label}.${language}`, 1200, { required: true }),
    )
  }
  return Object.fromEntries([...normalized].sort(([left], [right]) => (
    left < right ? -1 : left > right ? 1 : 0
  )))
}

function normalizeDate(value: unknown, label: string): string {
  const normalized = boundedText(value, label, 10, { required: true })
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized)
  if (!match) fail('INVALID_PUBLIC_DATE', `${label} must use YYYY-MM-DD.`)
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (
    date.getUTCFullYear() !== Number(match[1])
    || date.getUTCMonth() !== Number(match[2]) - 1
    || date.getUTCDate() !== Number(match[3])
  ) {
    fail('INVALID_PUBLIC_DATE', `${label} must be a real calendar date.`)
  }
  return normalized
}

function normalizeCanonicalTimestamp(value: unknown, label: string): string {
  const normalized = boundedText(value, label, 40, { required: true })
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(normalized)) {
    fail('INVALID_PUBLIC_TIMESTAMP', `${label} must be a canonical UTC timestamp.`)
  }
  const parsed = Date.parse(normalized)
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== normalized) {
    fail('INVALID_PUBLIC_TIMESTAMP', `${label} must be a real canonical UTC timestamp.`)
  }
  return normalized
}

function normalizeStrictHttpsUrl(
  value: unknown,
  label: string,
  { nullable = false }: { nullable?: boolean } = {},
): string | null {
  if (value === null && nullable) return null
  const normalized = boundedText(value, label, 8192, { required: true })
  if (normalized.includes('\\')) {
    fail('INVALID_PUBLIC_URL', `${label} must be a normal HTTPS URL.`)
  }
  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    fail('INVALID_PUBLIC_URL', `${label} must be a complete HTTPS URL.`)
  }
  if (
    parsed.protocol !== 'https:'
    || !parsed.hostname
    || parsed.username
    || parsed.password
    || parsed.hash
  ) {
    fail('INVALID_PUBLIC_URL', `${label} must use HTTPS without credentials or a fragment.`)
  }
  return parsed.toString()
}

function normalizeStablePublicHttpsUrl(
  value: unknown,
  label: string,
  { maximumCharacters = 8192 }: { maximumCharacters?: number } = {},
): string {
  const normalized = normalizeStrictHttpsUrl(value, label) as string
  const parsed = new URL(normalized)
  const canonical = parsed.toString()
  const hostname = parsed.hostname
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .toLowerCase()
  if (
    parsed.search
    || parsed.port
    || canonical.length > maximumCharacters
    || hostname.endsWith('.')
    || !hostname.includes('.')
    || isIP(hostname) !== 0
    || hostname === 'localhost'
    || NONPUBLIC_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix))
  ) {
    fail(
      'INVALID_PUBLIC_URL',
      `${label} must be a stable public HTTPS URL without credentials, a query string, fragment, private host, or nonstandard port.`,
    )
  }
  return canonical
}

function normalizePositiveNumber(value: unknown, label: string): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    fail('INVALID_PUBLIC_NUMBER', `${label} must be a positive finite number or null.`)
  }
  return value
}

export function derivePublicSermonId(rawSermonId: unknown): string {
  return `sermon-${sha256(normalizeSermonId(rawSermonId))}`
}

function normalizeStrictBibleRange(raw: unknown, label: string): CanonicalBibleRange {
  assertExactKeys(raw, ['schemaVersion', 'bookId', 'start', 'end'], label)
  assertExactKeys(raw.start, ['chapter', 'verse'], `${label}.start`)
  assertExactKeys(raw.end, ['chapter', 'verse'], `${label}.end`)
  let normalized: CanonicalBibleRange
  try {
    normalized = normalizeBibleRange(raw)
  } catch (error) {
    fail('INVALID_PUBLIC_BIBLE_RANGE', `${label} is invalid.`, {
      causeCode: error instanceof Error && 'code' in error
        ? String((error as { code: unknown }).code)
        : null,
    })
  }
  if (canonicalJson(raw) !== canonicalJson(normalized)) {
    fail('NONCANONICAL_PUBLIC_BIBLE_RANGE', `${label} must use the exact canonical range shape.`)
  }
  return normalized
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function normalizePublicReferences(value: unknown, label: string) {
  if (!Array.isArray(value) || value.length > MAX_SERMON_REFERENCES) {
    fail(
      'PUBLIC_REFERENCES_TOO_LARGE',
      `${label} must contain at most ${MAX_SERMON_REFERENCES} references.`,
    )
  }
  const seen = new Set<string>()
  let hasPrimary = false
  const references = value.map((raw, index) => {
    const itemLabel = `${label} ${index + 1}`
    assertExactKeys(raw, ['role', 'range'], itemLabel)
    const role = boundedText(raw.role, `${itemLabel}.role`, 16, { required: true })
    if (!REFERENCE_ROLES.has(role)) {
      fail('INVALID_PUBLIC_REFERENCE_ROLE', `${itemLabel}.role is invalid.`)
    }
    const range = normalizeStrictBibleRange(raw.range, `${itemLabel}.range`)
    const key = `${role}:${canonicalJson(range)}`
    if (seen.has(key)) {
      fail('DUPLICATE_PUBLIC_REFERENCE', `${label} repeats the same role and range.`)
    }
    seen.add(key)
    if (role === 'primary') hasPrimary = true
    return { role: role as 'primary' | 'mentioned', range }
  })
  if (!hasPrimary) {
    fail('MISSING_PUBLIC_PRIMARY_REFERENCE', 'A public sermon needs a confirmed primary passage.')
  }
  references.sort((left, right) => (
    compareBibleRanges(left.range, right.range)
      || (left.role === right.role ? 0 : left.role === 'primary' ? -1 : 1)
  ))
  return references
}

function normalizePublicBody(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_SERMON_BODY_ENTRIES) {
    fail(
      'PUBLIC_BODY_TOO_LARGE',
      `Public sermon body may contain at most ${MAX_SERMON_BODY_ENTRIES} entries.`,
    )
  }
  let totalBytes = 0
  return value.map((raw, index) => {
    const label = `Public sermon body entry ${index + 1}`
    assertExactKeys(raw, ['kind', 'language', 'text'], label)
    const kind = boundedText(raw.kind, `${label}.kind`, 32, { required: true })
    if (!BODY_KINDS.has(kind)) {
      fail('INVALID_PUBLIC_BODY_KIND', `${label}.kind is invalid.`)
    }
    const text = boundedText(raw.text, `${label}.text`, MAX_SERMON_BODY_ENTRY_BYTES, {
      required: true,
      preserveWhitespace: true,
    })
    totalBytes += Buffer.byteLength(text, 'utf8')
    if (totalBytes > MAX_SERMON_BODY_BYTES) {
      fail(
        'PUBLIC_BODY_TOO_LARGE',
        `Public sermon body must be ${MAX_SERMON_BODY_BYTES} UTF-8 bytes or fewer.`,
      )
    }
    return {
      kind: kind as PublicSermonDetail['body'][number]['kind'],
      language: normalizeLanguage(raw.language, `${label}.language`),
      text,
    }
  })
}

function normalizePublicMedia(value: unknown) {
  if (!Array.isArray(value) || value.length > MAX_PUBLIC_SERMON_MEDIA) {
    fail(
      'PUBLIC_MEDIA_TOO_LARGE',
      `Public sermon media may contain at most ${MAX_PUBLIC_SERMON_MEDIA} entries.`,
    )
  }
  return value.map((raw, index) => {
    const label = `Public sermon media ${index + 1}`
    assertExactKeys(
      raw,
      ['kind', 'title', 'language', 'mediaType', 'durationSeconds', 'url'],
      label,
    )
    const kind = boundedText(raw.kind, `${label}.kind`, 32, { required: true })
    if (!MEDIA_KINDS.has(kind)) {
      fail('INVALID_PUBLIC_MEDIA_KIND', `${label}.kind is invalid.`)
    }
    return {
      kind: kind as PublicSermonDetail['media'][number]['kind'],
      title: boundedText(raw.title, `${label}.title`, 1200),
      language: normalizeLanguage(raw.language, `${label}.language`),
      mediaType: boundedText(raw.mediaType, `${label}.mediaType`, 800),
      durationSeconds: normalizePositiveNumber(
        raw.durationSeconds,
        `${label}.durationSeconds`,
      ),
      url: normalizeStablePublicHttpsUrl(raw.url, `${label}.url`),
    }
  })
}

function normalizePublicSeries(value: unknown) {
  if (value === null) return null
  assertExactKeys(value, ['titles'], 'Public sermon series')
  return { titles: normalizeLocalizedText(value.titles, 'Public sermon series titles') }
}

function normalizePublicSpeaker(value: unknown) {
  assertExactKeys(value, ['name'], 'Public sermon speaker')
  return {
    name: boundedText(value.name, 'Public sermon speaker name', 800, { required: true }),
  }
}

export function normalizePublicSermonDetail(raw: unknown): PublicSermonDetail {
  assertExactKeys(raw, [
    'schemaVersion',
    'kind',
    'publicId',
    'sermonId',
    'sermonRevision',
    'titles',
    'defaultLanguage',
    'speaker',
    'serviceDate',
    'series',
    'references',
    'body',
    'media',
    'canonicalUrl',
  ], 'Public sermon detail')
  if (
    raw.schemaVersion !== PUBLIC_SERMON_DETAIL_SCHEMA_VERSION
    || raw.kind !== PUBLIC_SERMON_DETAIL_KIND
  ) {
    fail('UNSUPPORTED_PUBLIC_DETAIL', 'Public sermon detail uses an unsupported schema.')
  }
  const sermonId = normalizeSermonId(raw.sermonId)
  const publicId = normalizePublicId(raw.publicId)
  if (publicId !== derivePublicSermonId(sermonId)) {
    fail('PUBLIC_ID_MISMATCH', 'Public sermon content ID does not match its stable sermon identity.')
  }
  const titles = normalizeLocalizedText(raw.titles, 'Public sermon titles')
  const defaultLanguage = normalizeLanguage(raw.defaultLanguage, 'Public sermon default language')
  if (!Object.prototype.hasOwnProperty.call(titles, defaultLanguage)) {
    fail('MISSING_PUBLIC_DEFAULT_TITLE', 'Public sermon titles omit the default language.')
  }
  return deepFreeze({
    schemaVersion: PUBLIC_SERMON_DETAIL_SCHEMA_VERSION,
    kind: PUBLIC_SERMON_DETAIL_KIND,
    publicId,
    sermonId,
    sermonRevision: normalizeSha256(raw.sermonRevision, 'Public sermon revision'),
    titles,
    defaultLanguage,
    speaker: normalizePublicSpeaker(raw.speaker),
    serviceDate: normalizeDate(raw.serviceDate, 'Public sermon service date'),
    series: normalizePublicSeries(raw.series),
    references: normalizePublicReferences(raw.references, 'Public sermon references'),
    body: normalizePublicBody(raw.body),
    media: normalizePublicMedia(raw.media),
    canonicalUrl: normalizeStrictHttpsUrl(
      raw.canonicalUrl,
      'Public sermon canonical URL',
      { nullable: true },
    ),
  })
}

export function serializePublicSermonDetail(raw: unknown): string {
  const source = `${canonicalJson(normalizePublicSermonDetail(raw))}\n`
  if (Buffer.byteLength(source, 'utf8') > MAX_PUBLIC_SERMON_DETAIL_BYTES) {
    fail(
      'PUBLIC_DETAIL_TOO_LARGE',
      `Public sermon detail must be ${MAX_PUBLIC_SERMON_DETAIL_BYTES} bytes or fewer.`,
    )
  }
  return source
}

export function parsePublicSermonDetailSource(source: unknown): PublicSermonDetail {
  if (
    typeof source !== 'string'
    || Buffer.byteLength(source, 'utf8') > MAX_PUBLIC_SERMON_DETAIL_BYTES
  ) {
    fail('INVALID_PUBLIC_DETAIL_SOURCE', 'Public sermon detail source is invalid or too large.')
  }
  let raw: unknown
  try {
    raw = JSON.parse(source)
  } catch {
    fail('INVALID_PUBLIC_DETAIL_SOURCE', 'Public sermon detail source is not valid JSON.')
  }
  const detail = normalizePublicSermonDetail(raw)
  if (serializePublicSermonDetail(detail) !== source) {
    fail(
      'NONCANONICAL_PUBLIC_DETAIL_SOURCE',
      'Public sermon detail must use exact canonical bytes and one trailing newline.',
    )
  }
  return detail
}

function normalizeSelection(
  value: unknown,
  label: string,
  maximum: number,
): Set<string> {
  if (!Array.isArray(value) || value.length > maximum) {
    fail('INVALID_PUBLIC_SELECTION', `${label} must contain at most ${maximum} IDs.`)
  }
  const result = new Set<string>()
  for (const rawId of value) {
    const id = normalizeSermonId(rawId, `${label} ID`)
    if (result.has(id)) {
      fail('DUPLICATE_PUBLIC_SELECTION', `${label} repeats ID “${id}”.`)
    }
    result.add(id)
  }
  return result
}

function selectedPublicBody(
  document: CanonicalSermonDocument,
  selected: Set<string>,
) {
  const body = document.body || []
  const known = new Set(body.map(entry => entry.id))
  for (const id of selected) {
    if (!known.has(id)) {
      fail('UNKNOWN_PUBLIC_BODY_SELECTION', `Selected public body entry “${id}” does not exist.`)
    }
  }
  return body
    .filter(entry => selected.has(entry.id))
    .map(entry => ({
      kind: entry.kind,
      language: entry.language,
      text: entry.text,
    }))
}

function selectedPublicMedia(
  document: CanonicalSermonDocument,
  selected: Set<string>,
) {
  const known = new Map(document.media.map(media => [media.id, media]))
  for (const id of selected) {
    const media = known.get(id)
    if (!media) {
      fail('UNKNOWN_PUBLIC_MEDIA_SELECTION', `Selected public media “${id}” does not exist.`)
    }
    if (media.status !== 'ready' || !media.url) {
      fail('PUBLIC_MEDIA_NOT_READY', `Selected public media “${id}” is not ready at a public URL.`)
    }
    try {
      normalizeStablePublicHttpsUrl(
        media.url,
        `Selected public media “${id}” URL`,
        { maximumCharacters: 2048 },
      )
    } catch (error) {
      if (error instanceof PublicSermonPublicationError) {
        fail(
          'PUBLIC_MEDIA_NOT_READY',
          `Selected public media “${id}” is not ready at a safe HTTPS URL.`,
          { causeCode: error.code },
        )
      }
      throw error
    }
  }
  return document.media
    .filter(media => selected.has(media.id))
    .map(media => ({
      kind: media.kind,
      title: media.title,
      language: media.language,
      mediaType: media.mediaType,
      durationSeconds: media.durationSeconds,
      url: media.url!,
    }))
}

function contentUrl(publicId: string): string {
  return `${PUBLIC_SERMON_CONTENT_BASE_PATH}/${normalizePublicId(publicId)}`
}

function catalogItemFromDetail(
  detail: PublicSermonDetail,
  checksum: string,
): PublicSermonCatalogItem {
  return deepFreeze({
    id: detail.publicId,
    sermonId: detail.sermonId,
    sermonRevision: detail.sermonRevision,
    checksum: normalizeSha256(checksum, 'Public sermon detail checksum'),
    title: detail.titles[detail.defaultLanguage],
    titles: detail.titles,
    defaultLanguage: detail.defaultLanguage,
    speaker: detail.speaker,
    serviceDate: detail.serviceDate,
    series: detail.series,
    references: detail.references,
    content: {
      url: contentUrl(detail.publicId),
      mediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
    },
  })
}

export function normalizePublicSermonCatalogItem(
  raw: unknown,
): PublicSermonCatalogItem {
  assertExactKeys(raw, [
    'id',
    'sermonId',
    'sermonRevision',
    'checksum',
    'title',
    'titles',
    'defaultLanguage',
    'speaker',
    'serviceDate',
    'series',
    'references',
    'content',
  ], 'Public sermon catalog item')
  const sermonId = normalizeSermonId(raw.sermonId, 'Catalog sermon ID')
  const id = normalizePublicId(raw.id, 'Catalog public ID')
  if (id !== derivePublicSermonId(sermonId)) {
    fail('PUBLIC_ID_MISMATCH', 'Catalog public ID does not match its sermon identity.')
  }
  const titles = normalizeLocalizedText(raw.titles, 'Catalog sermon titles')
  const defaultLanguage = normalizeLanguage(
    raw.defaultLanguage,
    'Catalog sermon default language',
  )
  if (
    !Object.prototype.hasOwnProperty.call(titles, defaultLanguage)
    || raw.title !== titles[defaultLanguage]
  ) {
    fail('MISSING_PUBLIC_DEFAULT_TITLE', 'Catalog title does not match the default language.')
  }
  assertExactKeys(raw.content, ['url', 'mediaType'], 'Catalog sermon content')
  const expectedUrl = contentUrl(id)
  if (
    raw.content.url !== expectedUrl
    || raw.content.mediaType !== PUBLIC_SERMON_DETAIL_MEDIA_TYPE
  ) {
    fail('INVALID_PUBLIC_CONTENT_POINTER', 'Catalog sermon content pointer is invalid.')
  }
  return deepFreeze({
    id,
    sermonId,
    sermonRevision: normalizeSha256(raw.sermonRevision, 'Catalog sermon revision'),
    checksum: normalizeSha256(raw.checksum, 'Catalog sermon detail checksum'),
    title: titles[defaultLanguage],
    titles,
    defaultLanguage,
    speaker: normalizePublicSpeaker(raw.speaker),
    serviceDate: normalizeDate(raw.serviceDate, 'Catalog sermon service date'),
    series: normalizePublicSeries(raw.series),
    references: normalizePublicReferences(raw.references, 'Catalog sermon references'),
    content: {
      url: expectedUrl,
      mediaType: PUBLIC_SERMON_DETAIL_MEDIA_TYPE,
    },
  })
}

export function serializePublicSermonCatalogItem(raw: unknown): string {
  const source = `${canonicalJson(normalizePublicSermonCatalogItem(raw))}\n`
  if (Buffer.byteLength(source, 'utf8') > MAX_PUBLIC_SERMON_CATALOG_ITEM_BYTES) {
    fail(
      'PUBLIC_CATALOG_ITEM_TOO_LARGE',
      `Public sermon catalog item must be ${MAX_PUBLIC_SERMON_CATALOG_ITEM_BYTES} bytes or fewer.`,
    )
  }
  return source
}

export function parsePublicSermonCatalogItemSource(
  source: unknown,
): PublicSermonCatalogItem {
  if (
    typeof source !== 'string'
    || Buffer.byteLength(source, 'utf8') > MAX_PUBLIC_SERMON_CATALOG_ITEM_BYTES
  ) {
    fail('INVALID_PUBLIC_CATALOG_ITEM_SOURCE', 'Public catalog item source is invalid.')
  }
  let raw: unknown
  try {
    raw = JSON.parse(source)
  } catch {
    fail('INVALID_PUBLIC_CATALOG_ITEM_SOURCE', 'Public catalog item source is not JSON.')
  }
  const item = normalizePublicSermonCatalogItem(raw)
  if (serializePublicSermonCatalogItem(item) !== source) {
    fail(
      'NONCANONICAL_PUBLIC_CATALOG_ITEM_SOURCE',
      'Public catalog item must use exact canonical bytes.',
    )
  }
  return item
}

export function buildPublicSermonProjection(options: unknown) {
  assertExactKeys(options, [
    'documentSource',
    'publicRevision',
    'selectedBodyEntryIds',
    'selectedMediaIds',
  ], 'Public sermon projection request', 'INVALID_PUBLIC_PROJECTION_REQUEST')
  if (
    typeof options.documentSource !== 'string'
    || Buffer.byteLength(options.documentSource, 'utf8') > MAX_SERMON_SOURCE_BYTES
  ) {
    fail('INVALID_PUBLIC_SERMON_SOURCE', 'Public sermon input is invalid or too large.')
  }
  let document: CanonicalSermonDocument
  try {
    document = parseSermonDocument(options.documentSource)
  } catch (error) {
    fail('INVALID_PUBLIC_SERMON_SOURCE', 'Public sermon input is not a canonical sermon.', {
      causeCode: error instanceof Error && 'code' in error
        ? String((error as { code: unknown }).code)
        : null,
    })
  }
  if (serializeSermonDocument(document) !== options.documentSource) {
    fail('NONCANONICAL_PUBLIC_SERMON_SOURCE', 'Public sermon input must use canonical bytes.')
  }
  const revision = sha256(options.documentSource)
  if (revision !== normalizeSha256(options.publicRevision, 'Public revision')) {
    fail('PUBLIC_REVISION_MISMATCH', 'Public revision does not match the exact sermon source.')
  }
  if (
    document.publication.status !== 'published'
    || document.publication.visibility !== 'public'
  ) {
    fail(
      'SERMON_NOT_PUBLICLY_ELIGIBLE',
      'Only an exact published, public sermon revision can produce an anonymous projection.',
    )
  }
  const selectedBodyEntryIds = normalizeSelection(
    options.selectedBodyEntryIds,
    'Selected public body entries',
    MAX_SERMON_BODY_ENTRIES,
  )
  const selectedMediaIds = normalizeSelection(
    options.selectedMediaIds,
    'Selected public media',
    MAX_PUBLIC_SERMON_MEDIA,
  )
  const detail = normalizePublicSermonDetail({
    schemaVersion: PUBLIC_SERMON_DETAIL_SCHEMA_VERSION,
    kind: PUBLIC_SERMON_DETAIL_KIND,
    publicId: derivePublicSermonId(document.id),
    sermonId: document.id,
    sermonRevision: revision,
    titles: document.titles,
    defaultLanguage: document.defaultLanguage,
    speaker: { name: document.speaker.name },
    serviceDate: document.serviceDate,
    series: document.series ? { titles: document.series.titles } : null,
    references: document.references
      .filter(reference => reference.reviewStatus === 'confirmed')
      .map(reference => ({ role: reference.role, range: reference.range })),
    body: selectedPublicBody(document, selectedBodyEntryIds),
    media: selectedPublicMedia(document, selectedMediaIds),
    canonicalUrl: document.publication.canonicalUrl
      ? normalizeStrictHttpsUrl(
          document.publication.canonicalUrl,
          'Public sermon canonical URL',
        )
      : null,
  })
  const detailSource = serializePublicSermonDetail(detail)
  const detailChecksum = sha256(detailSource)
  return deepFreeze({
    detail,
    detailSource,
    detailChecksum,
    catalogItem: catalogItemFromDetail(detail, detailChecksum),
  })
}

export function normalizeStoredPublicSermonPublication(
  raw: unknown,
): StoredPublicSermonPublication & {
  detail: PublicSermonDetail
  catalogItem: PublicSermonCatalogItem
} {
  assertExactKeys(raw, [
    'schemaVersion',
    'active',
    'visibility',
    'publicationVersion',
    'publishedAt',
    'sermonId',
    'publicId',
    'publicRevision',
    'selectedBodyEntryIds',
    'selectedMediaIds',
    'detailChecksum',
    'detailSource',
  ], 'Stored public sermon publication', 'INVALID_STORED_PUBLICATION')
  if (
    raw.schemaVersion !== 1
    || raw.active !== true
    || raw.visibility !== 'public'
  ) {
    fail(
      'PUBLICATION_NOT_ACTIVE',
      'Anonymous sermon serving requires an active explicit public publication.',
    )
  }
  if (!Number.isSafeInteger(raw.publicationVersion) || raw.publicationVersion < 1) {
    fail('INVALID_STORED_PUBLICATION', 'Publication version must be a positive safe integer.')
  }
  const publishedAt = normalizeCanonicalTimestamp(raw.publishedAt, 'Publication publishedAt')
  const detail = parsePublicSermonDetailSource(raw.detailSource)
  const sermonId = normalizeSermonId(raw.sermonId, 'Stored publication sermon ID')
  const publicId = normalizePublicId(raw.publicId, 'Stored publication public ID')
  const publicRevision = normalizeSha256(
    raw.publicRevision,
    'Stored publication revision',
  )
  if (
    sermonId !== detail.sermonId
    || publicId !== detail.publicId
    || publicRevision !== detail.sermonRevision
  ) {
    fail(
      'STORED_PUBLICATION_IDENTITY_MISMATCH',
      'Stored publication identity does not match its exact public detail bytes.',
    )
  }
  const selectedBodyEntryIds = [...normalizeSelection(
    raw.selectedBodyEntryIds,
    'Stored selected public body entries',
    MAX_SERMON_BODY_ENTRIES,
  )]
  const selectedMediaIds = [...normalizeSelection(
    raw.selectedMediaIds,
    'Stored selected public media',
    MAX_PUBLIC_SERMON_MEDIA,
  )]
  const detailChecksum = normalizeSha256(raw.detailChecksum, 'Stored detail checksum')
  if (sha256(raw.detailSource) !== detailChecksum) {
    fail(
      'PUBLIC_DETAIL_CHECKSUM_MISMATCH',
      'Stored sermon checksum does not match its exact public detail bytes.',
    )
  }
  return deepFreeze({
    schemaVersion: 1,
    active: true,
    visibility: 'public',
    publicationVersion: raw.publicationVersion,
    publishedAt,
    sermonId,
    publicId,
    publicRevision,
    selectedBodyEntryIds,
    selectedMediaIds,
    detailChecksum,
    detailSource: raw.detailSource,
    detail,
    catalogItem: catalogItemFromDetail(detail, detailChecksum),
  })
}

function buildPublicSermonCatalogFromItems(
  rawItems: unknown,
): {
  catalog: Readonly<{
    schemaVersion: 2
    contentType: 'sermons'
    items: readonly PublicSermonCatalogItem[]
  }>
  source: string
  checksum: string
} {
  if (!Array.isArray(rawItems) || rawItems.length > MAX_PUBLIC_SERMON_CATALOG_ITEMS) {
    fail(
      'PUBLIC_CATALOG_TOO_LARGE',
      `Public sermon catalog may contain at most ${MAX_PUBLIC_SERMON_CATALOG_ITEMS} items.`,
    )
  }
  const publicIds = new Set<string>()
  const sermonIds = new Set<string>()
  const normalizedItems = rawItems.map(normalizePublicSermonCatalogItem)
  for (const item of normalizedItems) {
    if (publicIds.has(item.id)) {
      fail('DUPLICATE_PUBLIC_CONTENT_ID', 'Public sermon catalog repeats a public ID.')
    }
    if (sermonIds.has(item.sermonId)) {
      fail('DUPLICATE_PUBLIC_SERMON', 'Public sermon catalog repeats a sermon identity.')
    }
    publicIds.add(item.id)
    sermonIds.add(item.sermonId)
  }
  const items = normalizedItems
    .sort((left, right) => (
      right.serviceDate.localeCompare(left.serviceDate)
        || compareText(left.id, right.id)
    ))
  const catalog = deepFreeze({
    schemaVersion: PUBLIC_SERMON_CATALOG_SCHEMA_VERSION,
    contentType: PUBLIC_SERMON_CATALOG_CONTENT_TYPE,
    items,
  } as const)
  const source = `${canonicalJson(catalog)}\n`
  if (Buffer.byteLength(source, 'utf8') > MAX_PUBLIC_SERMON_CATALOG_BYTES) {
    fail(
      'PUBLIC_CATALOG_TOO_LARGE',
      `Public sermon catalog must be ${MAX_PUBLIC_SERMON_CATALOG_BYTES} bytes or fewer.`,
    )
  }
  return deepFreeze({ catalog, source, checksum: sha256(source) })
}

function normalizePublicSermonCatalog(raw: unknown) {
  assertExactKeys(raw, ['schemaVersion', 'contentType', 'items'], 'Public sermon catalog')
  if (
    raw.schemaVersion !== PUBLIC_SERMON_CATALOG_SCHEMA_VERSION
    || raw.contentType !== PUBLIC_SERMON_CATALOG_CONTENT_TYPE
  ) {
    fail('INVALID_PUBLIC_CATALOG_SOURCE', 'Public sermon catalog schema is unsupported.')
  }
  return buildPublicSermonCatalogFromItems(raw.items).catalog
}

export function buildPublicSermonCatalog(
  rawPublications: unknown,
) {
  if (!Array.isArray(rawPublications)) {
    fail('INVALID_STORED_PUBLICATION', 'Stored public sermons must be a list.')
  }
  return buildPublicSermonCatalogFromItems(
    rawPublications.map(publication =>
      normalizeStoredPublicSermonPublication(publication).catalogItem),
  )
}

export function buildPublicSermonCatalogFromItemSources(
  rawSources: unknown,
) {
  if (!Array.isArray(rawSources) || rawSources.length > MAX_PUBLIC_SERMON_CATALOG_ITEMS) {
    fail(
      'PUBLIC_CATALOG_TOO_LARGE',
      `Public sermon catalog may contain at most ${MAX_PUBLIC_SERMON_CATALOG_ITEMS} items.`,
    )
  }
  return buildPublicSermonCatalogFromItems(
    rawSources.map(parsePublicSermonCatalogItemSource),
  )
}

export function parsePublicSermonCatalogSource(source: unknown) {
  if (
    typeof source !== 'string'
    || Buffer.byteLength(source, 'utf8') > MAX_PUBLIC_SERMON_CATALOG_BYTES
  ) {
    fail('INVALID_PUBLIC_CATALOG_SOURCE', 'Public sermon catalog source is invalid.')
  }
  let raw: MutableRecord
  try {
    raw = JSON.parse(source)
  } catch {
    fail('INVALID_PUBLIC_CATALOG_SOURCE', 'Public sermon catalog source is not JSON.')
  }
  const catalog = normalizePublicSermonCatalog(raw)
  if (`${canonicalJson(catalog)}\n` !== source) {
    fail(
      'NONCANONICAL_PUBLIC_CATALOG_SOURCE',
      'Public sermon catalog must use exact canonical sorted bytes.',
    )
  }
  return catalog
}

function normalizePublicSermonPassageIndexItem(
  raw: unknown,
  index: number,
) {
  const label = `Public sermon passage-index item ${index + 1}`
  assertExactKeys(raw, [
    'publicId',
    'sermonId',
    'sermonRevision',
    'checksum',
    'title',
    'speaker',
    'serviceDate',
    'contentUrl',
    'references',
  ], label)
  const sermonId = normalizeSermonId(raw.sermonId, `${label}.sermonId`)
  const publicId = normalizePublicId(raw.publicId, `${label}.publicId`)
  if (publicId !== derivePublicSermonId(sermonId)) {
    fail('PUBLIC_ID_MISMATCH', `${label}.publicId does not match its sermon identity.`)
  }
  const expectedContentUrl = contentUrl(publicId)
  const contentUrlValue = boundedText(
    raw.contentUrl,
    `${label}.contentUrl`,
    256,
    { required: true },
  )
  if (contentUrlValue !== expectedContentUrl) {
    fail('PUBLIC_CONTENT_URL_MISMATCH', `${label}.contentUrl is not deterministic.`)
  }
  return {
    publicId,
    sermonId,
    sermonRevision: normalizeSha256(raw.sermonRevision, `${label}.sermonRevision`),
    checksum: normalizeSha256(raw.checksum, `${label}.checksum`),
    title: boundedText(raw.title, `${label}.title`, 1200, { required: true }),
    speaker: normalizePublicSpeaker(raw.speaker),
    serviceDate: normalizeDate(raw.serviceDate, `${label}.serviceDate`),
    contentUrl: contentUrlValue,
    references: normalizePublicReferences(raw.references, `${label}.references`),
  }
}

function normalizePublicSermonPassageIndex(
  raw: unknown,
): PublicSermonPassageIndex {
  assertExactKeys(raw, ['schemaVersion', 'kind', 'items'], 'Public sermon passage index')
  if (
    raw.schemaVersion !== PUBLIC_SERMON_PASSAGE_INDEX_SCHEMA_VERSION
    || raw.kind !== PUBLIC_SERMON_PASSAGE_INDEX_KIND
  ) {
    fail(
      'UNSUPPORTED_PUBLIC_PASSAGE_INDEX',
      'Public sermon passage index uses an unsupported schema.',
    )
  }
  if (!Array.isArray(raw.items) || raw.items.length > MAX_PUBLIC_SERMON_CATALOG_ITEMS) {
    fail(
      'PUBLIC_PASSAGE_INDEX_TOO_LARGE',
      `Public sermon passage index may contain at most ${MAX_PUBLIC_SERMON_CATALOG_ITEMS} sermons.`,
    )
  }
  const publicIds = new Set<string>()
  const sermonIds = new Set<string>()
  let referenceCount = 0
  const items = raw.items.map(normalizePublicSermonPassageIndexItem)
  for (const item of items) {
    if (publicIds.has(item.publicId)) {
      fail('DUPLICATE_PUBLIC_CONTENT_ID', 'Public sermon passage index repeats a public ID.')
    }
    if (sermonIds.has(item.sermonId)) {
      fail('DUPLICATE_PUBLIC_SERMON', 'Public sermon passage index repeats a sermon identity.')
    }
    publicIds.add(item.publicId)
    sermonIds.add(item.sermonId)
    referenceCount += item.references.length
    if (referenceCount > MAX_PUBLIC_SERMON_INDEX_REFERENCES) {
      fail(
        'PUBLIC_PASSAGE_INDEX_TOO_LARGE',
        `Public sermon passage index may contain at most ${MAX_PUBLIC_SERMON_INDEX_REFERENCES} references.`,
      )
    }
  }
  items.sort((left, right) => (
    right.serviceDate.localeCompare(left.serviceDate)
      || compareText(left.publicId, right.publicId)
  ))
  const passageIndex = deepFreeze({
    schemaVersion: PUBLIC_SERMON_PASSAGE_INDEX_SCHEMA_VERSION,
    kind: PUBLIC_SERMON_PASSAGE_INDEX_KIND,
    items,
  } as const)
  const sizeBytes = Buffer.byteLength(`${canonicalJson(passageIndex)}\n`, 'utf8')
  if (sizeBytes > MAX_PUBLIC_SERMON_PASSAGE_INDEX_BYTES) {
    fail(
      'PUBLIC_PASSAGE_INDEX_TOO_LARGE',
      `Public sermon passage index must be ${MAX_PUBLIC_SERMON_PASSAGE_INDEX_BYTES} bytes or fewer.`,
      { maximumBytes: MAX_PUBLIC_SERMON_PASSAGE_INDEX_BYTES, sizeBytes },
    )
  }
  return passageIndex
}

export function buildPublicSermonPassageIndex(rawCatalog: unknown) {
  const catalog = normalizePublicSermonCatalog(rawCatalog)
  const passageIndex = normalizePublicSermonPassageIndex({
    schemaVersion: PUBLIC_SERMON_PASSAGE_INDEX_SCHEMA_VERSION,
    kind: PUBLIC_SERMON_PASSAGE_INDEX_KIND,
    items: catalog.items.map(item => ({
      publicId: item.id,
      sermonId: item.sermonId,
      sermonRevision: item.sermonRevision,
      checksum: item.checksum,
      title: item.title,
      speaker: item.speaker,
      serviceDate: item.serviceDate,
      contentUrl: item.content.url,
      references: item.references,
    })),
  })
  const source = `${canonicalJson(passageIndex)}\n`
  return deepFreeze({ passageIndex, source, checksum: sha256(source) })
}

export function parsePublicSermonPassageIndexSource(source: unknown) {
  if (
    typeof source !== 'string'
    || Buffer.byteLength(source, 'utf8') > MAX_PUBLIC_SERMON_PASSAGE_INDEX_BYTES
  ) {
    fail(
      'INVALID_PUBLIC_PASSAGE_INDEX_SOURCE',
      'Public sermon passage-index source is invalid.',
    )
  }
  let raw: MutableRecord
  try {
    raw = JSON.parse(source)
  } catch {
    fail(
      'INVALID_PUBLIC_PASSAGE_INDEX_SOURCE',
      'Public sermon passage-index source is not JSON.',
    )
  }
  const passageIndex = normalizePublicSermonPassageIndex(raw)
  if (`${canonicalJson(passageIndex)}\n` !== source) {
    fail(
      'NONCANONICAL_PUBLIC_PASSAGE_INDEX_SOURCE',
      'Public sermon passage index must use exact canonical sorted bytes.',
    )
  }
  return passageIndex
}

export function publicSermonDetailFromPublications(
  rawPublications: unknown,
  rawPublicId: unknown,
) {
  if (!Array.isArray(rawPublications)) {
    fail('INVALID_STORED_PUBLICATION', 'Stored public sermons must be a list.')
  }
  const publicId = normalizePublicId(rawPublicId)
  const matches = rawPublications
    .map(normalizeStoredPublicSermonPublication)
    .filter(publication => publication.detail.publicId === publicId)
  if (matches.length === 0) return null
  if (matches.length !== 1) {
    fail('DUPLICATE_PUBLIC_CONTENT_ID', 'Stored publications repeat a public sermon ID.')
  }
  return matches[0]
}

export function publicSermonSourceResponse(
  source: string,
  mediaType: string,
  checksum: string,
): Response {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    // The stable publicId path may move to a newer explicitly published
    // revision. Its immutable identity is the validated
    // publicId+sermonRevision+checksum tuple, so the URL itself must revalidate.
    'Cache-Control': 'public, max-age=60, must-revalidate',
    'Content-Type': `${mediaType}; charset=utf-8`,
    ETag: `"sha256:${normalizeSha256(checksum, 'Publication response checksum')}"`,
    'X-Content-Type-Options': 'nosniff',
  })
  return new Response(source, { status: 200, headers })
}

export function unavailablePublicSermonResponse(): Response {
  return new Response('{"error":"Not found."}\n', {
    status: 404,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export function publicSermonOptionsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
