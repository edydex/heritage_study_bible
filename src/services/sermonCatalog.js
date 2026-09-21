import {
  canonicalBibleRangesIntersect,
  compareCanonicalBibleRanges,
  normalizeCanonicalBibleRange,
} from '../utils/canonicalBibleRanges.js'

export const SERMON_PUBLIC_DETAIL_SCHEMA_VERSION = 1
export const SERMON_PUBLIC_DETAIL_KIND = 'heritage-public-sermon'
export const SERMON_PUBLIC_CATALOG_SCHEMA_VERSION = 2
export const SERMON_PUBLIC_CATALOG_CONTENT_TYPE = 'sermons'
export const SERMON_PUBLIC_MEDIA_TYPE = 'application/vnd.heritage.sermon+json'
export const SERMON_PUBLIC_CONTENT_BASE_PATH = '/content/sermons'

export const MAX_PUBLIC_SERMON_DETAIL_BYTES = 2 * 1024 * 1024
export const MAX_PUBLIC_SERMON_CATALOG_BYTES = 16 * 1024 * 1024
export const MAX_PUBLIC_SERMON_CATALOG_ITEMS = 10000

const MAX_PUBLIC_SERMON_REFERENCES = 512
const MAX_PUBLIC_SERMON_BODY_ENTRIES = 256
const MAX_PUBLIC_SERMON_BODY_ENTRY_BYTES = 1024 * 1024
const MAX_PUBLIC_SERMON_BODY_BYTES = 1536 * 1024
const MAX_PUBLIC_SERMON_MEDIA = 256
const MAX_PUBLIC_SERMON_LANGUAGES = 32
const PUBLIC_CATALOG_VALIDATION_BATCH = 64

const SERMON_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const PUBLIC_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,95}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/
const BODY_KINDS = new Set(['manuscript', 'slide-notes', 'transcript', 'other'])
const MEDIA_KINDS = new Set(['audio', 'video', 'transcript', 'document'])
const REFERENCE_ROLES = new Set(['primary', 'mentioned'])
const UTF8_ENCODER = new TextEncoder()
const VERIFIED_PUBLIC_SERMON_DETAILS = new WeakSet()
const VERIFIED_PUBLIC_SERMON_CATALOGS = new WeakSet()

export class PublicSermonContractError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'PublicSermonContractError'
    this.code = code
    this.details = details
  }
}

function fail(code, message, details = {}) {
  throw new PublicSermonContractError(code, message, details)
}

function utf8ByteLength(value) {
  return UTF8_ENCODER.encode(value).byteLength
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertRecord(value, label, code = 'INVALID_PUBLIC_SERMON') {
  if (!isPlainRecord(value)) fail(code, `${label} must be a plain object.`)
}

function assertExactKeys(value, keys, label, code = 'INVALID_PUBLIC_SERMON') {
  assertRecord(value, label, code)
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

function hasUnpairedSurrogate(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0)
    if (codePoint >= 0xd800 && codePoint <= 0xdfff) return true
  }
  return false
}

function boundedText(value, label, maximumBytes, {
  required = false,
  preserveWhitespace = false,
} = {}) {
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
  const sizeBytes = utf8ByteLength(normalized)
  if (sizeBytes > maximumBytes) {
    fail('PUBLIC_TEXT_TOO_LARGE', `${label} is too large.`, {
      field: label,
      maximumBytes,
      sizeBytes,
    })
  }
  return normalized
}

function normalizeSermonId(value, label = 'Public sermon ID') {
  const normalized = boundedText(value, label, 128, { required: true })
  if (!SERMON_ID_PATTERN.test(normalized)) {
    fail('INVALID_PUBLIC_SERMON_ID', `${label} is invalid.`)
  }
  return normalized
}

function normalizePublicId(value, label = 'Public content ID') {
  const normalized = boundedText(value, label, 96, { required: true })
  if (!PUBLIC_ID_PATTERN.test(normalized)) {
    fail('INVALID_PUBLIC_CONTENT_ID', `${label} is invalid.`)
  }
  return normalized
}

function normalizeSha256(value, label) {
  const normalized = boundedText(value, label, 64, { required: true })
  if (!SHA256_PATTERN.test(normalized)) {
    fail('INVALID_PUBLIC_CHECKSUM', `${label} must be a lowercase SHA-256 digest.`)
  }
  return normalized
}

function normalizeLanguage(value, label) {
  const normalized = boundedText(value, label, 35, { required: true }).toLowerCase()
  if (!LANGUAGE_PATTERN.test(normalized)) {
    fail('INVALID_PUBLIC_LANGUAGE', `${label} must be a BCP-47-style language tag.`)
  }
  return normalized
}

function normalizeLocalizedText(value, label, { required = true } = {}) {
  assertRecord(value, label)
  const entries = Object.entries(value)
  if (entries.length > MAX_PUBLIC_SERMON_LANGUAGES) {
    fail(
      'PUBLIC_LOCALIZATIONS_TOO_LARGE',
      `${label} may contain at most ${MAX_PUBLIC_SERMON_LANGUAGES} languages.`,
    )
  }
  const normalized = new Map()
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
  if (required && normalized.size === 0) {
    fail('MISSING_PUBLIC_LOCALIZATION', `${label} needs at least one language.`)
  }
  return Object.fromEntries([...normalized].sort(([left], [right]) => (
    left < right ? -1 : left > right ? 1 : 0
  )))
}

function normalizeDate(value, label) {
  const normalized = boundedText(value, label, 10, { required: true })
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized)
  if (!match) fail('INVALID_PUBLIC_DATE', `${label} must use YYYY-MM-DD.`)
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const date = new Date(timestamp)
  if (
    date.getUTCFullYear() !== Number(match[1])
    || date.getUTCMonth() !== Number(match[2]) - 1
    || date.getUTCDate() !== Number(match[3])
  ) {
    fail('INVALID_PUBLIC_DATE', `${label} must be a real calendar date.`)
  }
  return normalized
}

function normalizePositiveNumber(value, label) {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    fail('INVALID_PUBLIC_NUMBER', `${label} must be a positive finite number or null.`)
  }
  return value
}

function normalizeStrictHttpsUrl(value, label, { nullable = false } = {}) {
  if (value === null && nullable) return null
  const normalized = boundedText(value, label, 8192, { required: true })
  if (normalized.includes('\\')) {
    fail('INVALID_PUBLIC_URL', `${label} must be a normal HTTPS URL.`)
  }
  let parsed
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
    fail(
      'INVALID_PUBLIC_URL',
      `${label} must use HTTPS without credentials or a fragment.`,
    )
  }
  return parsed.toString()
}

export async function sha256Hex(source) {
  if (typeof source !== 'string') {
    fail('INVALID_PUBLIC_SOURCE', 'SHA-256 input must be text.')
  }
  if (!globalThis.crypto?.subtle) {
    fail('CRYPTO_UNAVAILABLE', 'This reader cannot verify sermon checksums.')
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', UTF8_ENCODER.encode(source))
  return [...new Uint8Array(digest)]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')
}

export async function derivePublicSermonId(rawSermonId) {
  const sermonId = normalizeSermonId(rawSermonId)
  return `sermon-${await sha256Hex(sermonId)}`
}

function normalizeStrictBibleRange(raw, label) {
  assertExactKeys(raw, ['schemaVersion', 'bookId', 'start', 'end'], label)
  assertExactKeys(raw.start, ['chapter', 'verse'], `${label}.start`)
  assertExactKeys(raw.end, ['chapter', 'verse'], `${label}.end`)
  let normalized
  try {
    normalized = normalizeCanonicalBibleRange(raw)
  } catch (error) {
    fail('INVALID_PUBLIC_BIBLE_RANGE', `${label} is invalid.`, {
      causeCode: error?.code || null,
    })
  }
  if (canonicalJson(raw) !== canonicalJson(normalized)) {
    fail('NONCANONICAL_PUBLIC_BIBLE_RANGE', `${label} must use the exact canonical range shape.`)
  }
  return normalized
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function compareReferences(left, right) {
  return compareCanonicalBibleRanges(left.range, right.range)
    || (left.role === right.role ? 0 : left.role === 'primary' ? -1 : 1)
}

function normalizePublicReferences(value, label = 'Public sermon references') {
  if (!Array.isArray(value) || value.length > MAX_PUBLIC_SERMON_REFERENCES) {
    fail(
      'PUBLIC_REFERENCES_TOO_LARGE',
      `${label} must contain at most ${MAX_PUBLIC_SERMON_REFERENCES} references.`,
    )
  }
  const seen = new Set()
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
    return { role, range }
  })
  if (!hasPrimary) {
    fail('MISSING_PUBLIC_PRIMARY_REFERENCE', 'A public sermon needs a confirmed primary passage.')
  }
  references.sort(compareReferences)
  return references
}

function normalizePublicBody(value) {
  if (!Array.isArray(value) || value.length > MAX_PUBLIC_SERMON_BODY_ENTRIES) {
    fail(
      'PUBLIC_BODY_TOO_LARGE',
      `Public sermon body may contain at most ${MAX_PUBLIC_SERMON_BODY_ENTRIES} entries.`,
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
    const text = boundedText(raw.text, `${label}.text`, MAX_PUBLIC_SERMON_BODY_ENTRY_BYTES, {
      required: true,
      preserveWhitespace: true,
    })
    totalBytes += utf8ByteLength(text)
    if (totalBytes > MAX_PUBLIC_SERMON_BODY_BYTES) {
      fail(
        'PUBLIC_BODY_TOO_LARGE',
        `Public sermon body must be ${MAX_PUBLIC_SERMON_BODY_BYTES} UTF-8 bytes or fewer.`,
      )
    }
    return {
      kind,
      language: normalizeLanguage(raw.language, `${label}.language`),
      text,
    }
  })
}

function normalizePublicMedia(value) {
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
      kind,
      title: boundedText(raw.title, `${label}.title`, 1200),
      language: normalizeLanguage(raw.language, `${label}.language`),
      mediaType: boundedText(raw.mediaType, `${label}.mediaType`, 800),
      durationSeconds: normalizePositiveNumber(raw.durationSeconds, `${label}.durationSeconds`),
      url: normalizeStrictHttpsUrl(raw.url, `${label}.url`),
    }
  })
}

function normalizePublicSeries(value) {
  if (value === null) return null
  assertExactKeys(value, ['titles'], 'Public sermon series')
  return {
    titles: normalizeLocalizedText(value.titles, 'Public sermon series titles'),
  }
}

function normalizePublicSpeaker(value) {
  assertExactKeys(value, ['name'], 'Public sermon speaker')
  return {
    name: boundedText(value.name, 'Public sermon speaker name', 800, { required: true }),
  }
}

async function publicDetailValue(raw) {
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
    raw.schemaVersion !== SERMON_PUBLIC_DETAIL_SCHEMA_VERSION
    || raw.kind !== SERMON_PUBLIC_DETAIL_KIND
  ) {
    fail('UNSUPPORTED_PUBLIC_DETAIL', 'Public sermon detail uses an unsupported schema.')
  }

  const sermonId = normalizeSermonId(raw.sermonId)
  const publicId = normalizePublicId(raw.publicId)
  if (publicId !== await derivePublicSermonId(sermonId)) {
    fail(
      'PUBLIC_ID_MISMATCH',
      'Public sermon content ID does not match its stable sermon identity.',
    )
  }
  const titles = normalizeLocalizedText(raw.titles, 'Public sermon titles')
  const defaultLanguage = normalizeLanguage(raw.defaultLanguage, 'Public sermon default language')
  if (!Object.prototype.hasOwnProperty.call(titles, defaultLanguage)) {
    fail(
      'MISSING_PUBLIC_DEFAULT_TITLE',
      'Public sermon titles do not include the default language.',
    )
  }

  return {
    schemaVersion: SERMON_PUBLIC_DETAIL_SCHEMA_VERSION,
    kind: SERMON_PUBLIC_DETAIL_KIND,
    publicId,
    sermonId,
    sermonRevision: normalizeSha256(raw.sermonRevision, 'Public sermon revision'),
    titles,
    defaultLanguage,
    speaker: normalizePublicSpeaker(raw.speaker),
    serviceDate: normalizeDate(raw.serviceDate, 'Public sermon service date'),
    series: normalizePublicSeries(raw.series),
    references: normalizePublicReferences(raw.references),
    body: normalizePublicBody(raw.body),
    media: normalizePublicMedia(raw.media),
    canonicalUrl: normalizeStrictHttpsUrl(
      raw.canonicalUrl,
      'Public sermon canonical URL',
      { nullable: true },
    ),
  }
}

export async function normalizePublicSermonDetail(raw) {
  if (raw && typeof raw === 'object' && VERIFIED_PUBLIC_SERMON_DETAILS.has(raw)) {
    return raw
  }
  const normalized = await publicDetailValue(raw)
  const sizeBytes = utf8ByteLength(`${canonicalJson(normalized)}\n`)
  if (sizeBytes > MAX_PUBLIC_SERMON_DETAIL_BYTES) {
    fail(
      'PUBLIC_DETAIL_TOO_LARGE',
      `Public sermon detail must be ${MAX_PUBLIC_SERMON_DETAIL_BYTES} bytes or fewer.`,
      { maximumBytes: MAX_PUBLIC_SERMON_DETAIL_BYTES, sizeBytes },
    )
  }
  const verified = deepFreeze(normalized)
  VERIFIED_PUBLIC_SERMON_DETAILS.add(verified)
  return verified
}

export async function serializePublicSermonDetail(raw) {
  return `${canonicalJson(await normalizePublicSermonDetail(raw))}\n`
}

async function parseCanonicalSource(source, {
  label,
  maximumBytes,
  parse,
  serialize,
  invalidCode,
  noncanonicalCode,
}) {
  if (typeof source !== 'string' || utf8ByteLength(source) > maximumBytes) {
    fail(invalidCode, `${label} is invalid or too large.`)
  }
  let parsed
  try {
    parsed = JSON.parse(source)
  } catch {
    fail(invalidCode, `${label} is not valid JSON.`)
  }
  let normalized
  try {
    normalized = await parse(parsed)
  } catch (error) {
    if (error instanceof PublicSermonContractError) throw error
    fail(invalidCode, `${label} is invalid.`, { causeCode: error?.code || null })
  }
  if (await serialize(normalized) !== source) {
    fail(
      noncanonicalCode,
      `${label} must be the exact canonical serialization, including its trailing newline.`,
    )
  }
  return normalized
}

export async function parsePublicSermonDetailSource(source) {
  return parseCanonicalSource(source, {
    label: 'Public sermon detail source',
    maximumBytes: MAX_PUBLIC_SERMON_DETAIL_BYTES,
    parse: normalizePublicSermonDetail,
    serialize: serializePublicSermonDetail,
    invalidCode: 'INVALID_PUBLIC_DETAIL_SOURCE',
    noncanonicalCode: 'NONCANONICAL_PUBLIC_DETAIL_SOURCE',
  })
}

function standardContentUrl(publicId) {
  return `${SERMON_PUBLIC_CONTENT_BASE_PATH}/${normalizePublicId(publicId)}`
}

function normalizeCatalogContent(raw, publicId) {
  assertExactKeys(raw, ['url', 'mediaType'], 'Public sermon catalog content')
  const url = boundedText(raw.url, 'Public sermon catalog content URL', 256, {
    required: true,
  })
  if (url !== standardContentUrl(publicId)) {
    fail(
      'PUBLIC_CONTENT_URL_MISMATCH',
      'Public sermon catalog content URL is not deterministic.',
    )
  }
  if (raw.mediaType !== SERMON_PUBLIC_MEDIA_TYPE) {
    fail('INVALID_PUBLIC_MEDIA_TYPE', 'Public sermon catalog media type is unsupported.')
  }
  return { url, mediaType: SERMON_PUBLIC_MEDIA_TYPE }
}

async function normalizeCatalogItem(raw, index) {
  const label = `Public sermon catalog item ${index + 1}`
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
  ], label)
  const sermonId = normalizeSermonId(raw.sermonId, `${label}.sermonId`)
  const id = normalizePublicId(raw.id, `${label}.id`)
  if (id !== await derivePublicSermonId(sermonId)) {
    fail('PUBLIC_ID_MISMATCH', `${label}.id does not match its stable sermon identity.`)
  }
  const titles = normalizeLocalizedText(raw.titles, `${label}.titles`)
  const defaultLanguage = normalizeLanguage(raw.defaultLanguage, `${label}.defaultLanguage`)
  if (!Object.prototype.hasOwnProperty.call(titles, defaultLanguage)) {
    fail('MISSING_PUBLIC_DEFAULT_TITLE', `${label} has no default-language title.`)
  }
  const title = boundedText(raw.title, `${label}.title`, 1200, { required: true })
  if (title !== titles[defaultLanguage]) {
    fail('PUBLIC_TITLE_MISMATCH', `${label}.title does not match its default-language title.`)
  }
  return {
    id,
    sermonId,
    sermonRevision: normalizeSha256(raw.sermonRevision, `${label}.sermonRevision`),
    checksum: normalizeSha256(raw.checksum, `${label}.checksum`),
    title,
    titles,
    defaultLanguage,
    speaker: normalizePublicSpeaker(raw.speaker),
    serviceDate: normalizeDate(raw.serviceDate, `${label}.serviceDate`),
    series: normalizePublicSeries(raw.series),
    references: normalizePublicReferences(raw.references, `${label}.references`),
    content: normalizeCatalogContent(raw.content, id),
  }
}

function compareCatalogItems(left, right) {
  return right.serviceDate.localeCompare(left.serviceDate)
    || compareText(left.id, right.id)
}

export async function normalizePublicSermonCatalog(raw) {
  if (raw && typeof raw === 'object' && VERIFIED_PUBLIC_SERMON_CATALOGS.has(raw)) {
    return raw
  }
  assertExactKeys(
    raw,
    ['schemaVersion', 'contentType', 'items'],
    'Public sermon catalog',
  )
  if (
    raw.schemaVersion !== SERMON_PUBLIC_CATALOG_SCHEMA_VERSION
    || raw.contentType !== SERMON_PUBLIC_CATALOG_CONTENT_TYPE
  ) {
    fail('UNSUPPORTED_PUBLIC_CATALOG', 'Public sermon catalog uses an unsupported schema.')
  }
  if (!Array.isArray(raw.items) || raw.items.length > MAX_PUBLIC_SERMON_CATALOG_ITEMS) {
    fail(
      'PUBLIC_CATALOG_TOO_LARGE',
      `Public sermon catalog may contain at most ${MAX_PUBLIC_SERMON_CATALOG_ITEMS} items.`,
    )
  }

  const publicIds = new Set()
  const sermons = new Map()
  const items = []
  for (
    let offset = 0;
    offset < raw.items.length;
    offset += PUBLIC_CATALOG_VALIDATION_BATCH
  ) {
    const batch = await Promise.all(
      raw.items
        .slice(offset, offset + PUBLIC_CATALOG_VALIDATION_BATCH)
        .map((item, index) => normalizeCatalogItem(item, offset + index)),
    )
    for (const item of batch) {
      const priorRevision = sermons.get(item.sermonId)
      if (priorRevision) {
        if (priorRevision !== item.sermonRevision) {
          fail(
            'MIXED_PUBLIC_SERMON_REVISIONS',
            `Public sermon catalog contains multiple revisions for “${item.sermonId}”.`,
          )
        }
        fail(
          'DUPLICATE_PUBLIC_SERMON',
          `Public sermon catalog repeats sermon “${item.sermonId}”.`,
        )
      }
      if (publicIds.has(item.id)) {
        fail('DUPLICATE_PUBLIC_CONTENT_ID', `Public sermon catalog repeats ID “${item.id}”.`)
      }
      publicIds.add(item.id)
      sermons.set(item.sermonId, item.sermonRevision)
      items.push(item)
    }
  }
  items.sort(compareCatalogItems)
  const normalized = {
    schemaVersion: SERMON_PUBLIC_CATALOG_SCHEMA_VERSION,
    contentType: SERMON_PUBLIC_CATALOG_CONTENT_TYPE,
    items,
  }
  const sizeBytes = utf8ByteLength(`${canonicalJson(normalized)}\n`)
  if (sizeBytes > MAX_PUBLIC_SERMON_CATALOG_BYTES) {
    fail(
      'PUBLIC_CATALOG_TOO_LARGE',
      `Public sermon catalog must be ${MAX_PUBLIC_SERMON_CATALOG_BYTES} bytes or fewer.`,
      { maximumBytes: MAX_PUBLIC_SERMON_CATALOG_BYTES, sizeBytes },
    )
  }
  const verified = deepFreeze(normalized)
  VERIFIED_PUBLIC_SERMON_CATALOGS.add(verified)
  return verified
}

export async function serializePublicSermonCatalog(raw) {
  return `${canonicalJson(await normalizePublicSermonCatalog(raw))}\n`
}

export async function parsePublicSermonCatalogSource(source) {
  return parseCanonicalSource(source, {
    label: 'Public sermon catalog source',
    maximumBytes: MAX_PUBLIC_SERMON_CATALOG_BYTES,
    parse: normalizePublicSermonCatalog,
    serialize: serializePublicSermonCatalog,
    invalidCode: 'INVALID_PUBLIC_CATALOG_SOURCE',
    noncanonicalCode: 'NONCANONICAL_PUBLIC_CATALOG_SOURCE',
  })
}

function catalogItemFromDetail(detail, checksum) {
  return {
    id: detail.publicId,
    sermonId: detail.sermonId,
    sermonRevision: detail.sermonRevision,
    checksum,
    title: detail.titles[detail.defaultLanguage],
    titles: detail.titles,
    defaultLanguage: detail.defaultLanguage,
    speaker: detail.speaker,
    serviceDate: detail.serviceDate,
    series: detail.series,
    references: detail.references,
    content: {
      url: standardContentUrl(detail.publicId),
      mediaType: SERMON_PUBLIC_MEDIA_TYPE,
    },
  }
}

export function publicSermonCacheIdentity(raw) {
  assertExactKeys(
    raw,
    ['publicId', 'sermonRevision', 'checksum'],
    'Public sermon cache identity',
    'INVALID_PUBLIC_CACHE_IDENTITY',
  )
  const publicId = normalizePublicId(raw.publicId)
  const sermonRevision = normalizeSha256(raw.sermonRevision, 'Public sermon cache revision')
  const checksum = normalizeSha256(raw.checksum, 'Public sermon cache checksum')
  return `public-sermon:v1:${publicId}:${sermonRevision}:${checksum}`
}

export async function verifyPublicSermonCatalogDetail(options = {}) {
  assertExactKeys(
    options,
    ['catalog', 'detailSource'],
    'Public sermon catalog/detail verification request',
    'INVALID_PUBLIC_VERIFICATION_REQUEST',
  )
  const catalog = await normalizePublicSermonCatalog(options.catalog)
  const detail = await parsePublicSermonDetailSource(options.detailSource)
  const checksum = await sha256Hex(options.detailSource)
  const item = catalog.items.find(candidate => candidate.id === detail.publicId)
  if (!item) {
    fail(
      'PUBLIC_CATALOG_ITEM_MISSING',
      'Public sermon catalog omits the requested sermon detail.',
    )
  }
  const expected = catalogItemFromDetail(detail, checksum)
  if (canonicalJson(item) !== canonicalJson(expected)) {
    fail(
      'PUBLIC_CATALOG_DETAIL_MISMATCH',
      'Public sermon catalog and detail do not describe the same exact revision.',
    )
  }
  return deepFreeze({
    catalog,
    item,
    detail,
    checksum,
    cacheIdentity: publicSermonCacheIdentity({
      publicId: item.id,
      sermonRevision: item.sermonRevision,
      checksum: item.checksum,
    }),
  })
}

export async function parseAndVerifyPublicSermon(options = {}) {
  assertExactKeys(
    options,
    ['catalogSource', 'detailSource'],
    'Public sermon source verification request',
    'INVALID_PUBLIC_VERIFICATION_REQUEST',
  )
  const catalog = await parsePublicSermonCatalogSource(options.catalogSource)
  return verifyPublicSermonCatalogDetail({
    catalog,
    detailSource: options.detailSource,
  })
}

export async function queryPublicSermonsForRange(rawCatalog, rawRange) {
  const catalog = await normalizePublicSermonCatalog(rawCatalog)
  let range
  try {
    range = normalizeCanonicalBibleRange(rawRange)
  } catch (error) {
    fail('INVALID_PUBLIC_PASSAGE_QUERY', 'Public sermon passage query is invalid.', {
      causeCode: error?.code || null,
    })
  }

  const primary = []
  const mentioned = []
  for (const item of catalog.items) {
    const primaryMatches = []
    const mentionedMatches = []
    for (const reference of item.references) {
      if (!canonicalBibleRangesIntersect(reference.range, range)) continue
      if (reference.role === 'primary') primaryMatches.push(reference.range)
      else mentionedMatches.push(reference.range)
    }
    const matches = primaryMatches.length > 0 ? primaryMatches : mentionedMatches
    if (matches.length === 0) continue
    const result = {
      publicId: item.id,
      sermonId: item.sermonId,
      sermonRevision: item.sermonRevision,
      checksum: item.checksum,
      title: item.title,
      speaker: item.speaker,
      serviceDate: item.serviceDate,
      contentUrl: item.content.url,
      matches,
    }
    if (primaryMatches.length > 0) primary.push(result)
    else mentioned.push(result)
  }
  const resultSort = (left, right) => (
    right.serviceDate.localeCompare(left.serviceDate)
      || compareText(left.publicId, right.publicId)
  )
  primary.sort(resultSort)
  mentioned.sort(resultSort)
  return deepFreeze({ primary, mentioned })
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}
