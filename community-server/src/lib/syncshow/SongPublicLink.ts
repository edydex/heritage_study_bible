import { createHash } from 'node:crypto'
import {
  SYNCSHOW_SONG_PUBLIC_LINK_READ_SCOPE,
  SYNCSHOW_SONG_PUBLIC_LINK_WRITE_SCOPE,
} from '../syncShowProtocol.ts'

export const SONG_PUBLIC_LINK_SCHEMA_VERSION = 1
export {
  SYNCSHOW_SONG_PUBLIC_LINK_READ_SCOPE,
  SYNCSHOW_SONG_PUBLIC_LINK_WRITE_SCOPE,
}
export const SYNCSHOW_SONG_PUBLIC_LINK_SCOPES = [
  SYNCSHOW_SONG_PUBLIC_LINK_READ_SCOPE,
  SYNCSHOW_SONG_PUBLIC_LINK_WRITE_SCOPE,
] as const
export const MAX_SONG_PUBLIC_LINK_PAGE_ITEMS = 50
export const MAX_SONG_PUBLIC_LINK_CURSOR_BYTES = 2048
export const MAX_SONG_PUBLIC_LINK_REQUEST_BYTES = 64 * 1024
export const MAX_SONG_PUBLIC_LINK_SNAPSHOT_BYTES = 2 * 1024 * 1024

const MAX_SONG_DOCUMENT_BYTES = 512 * 1024
const MAX_FAMILY_DOCUMENTS = 32
const MAX_FRONT_MATTER_LINES = 100
const MAX_SECTIONS = 200
const MAX_SLIDES = 1000
const MAX_LINES = 10_000
const MAX_LINE_LENGTH = 1000
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const LINK_ID_PATTERN = /^[A-Za-z0-9_-]{32,128}$/
const IDEMPOTENCY_KEY_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/
const CANONICAL_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const REVIEW_BASES = new Set([
  'public-domain',
  'original-work',
  'specific-web-license',
  'direct-permission',
  'other-reviewed',
])

type UnknownRecord = Record<string, unknown>

export type SongPublicLinkReview = Readonly<{
  scope: 'public-link'
  basis:
    | 'public-domain'
    | 'original-work'
    | 'specific-web-license'
    | 'direct-permission'
    | 'other-reviewed'
  evidence: string
  validUntil: string | null
  validThrough: string | null
  reviewedAt: string
  familyRevision: string
}>

export type SongPublicLinkCreateRequest = Readonly<{
  songSyncId: string
  familyRevision: string
  review: SongPublicLinkReview
  reviewRevision: string
  label: string | null
  expiresAt: string | null
}>

export type SongPublicDocumentInput = Readonly<{
  id: string
  source: string
  revision: string
}>

export type PublicSongSlide = Readonly<{
  lines: readonly string[]
}>

export type PublicSongSection = Readonly<{
  marker: string
  label: string
  slides: readonly PublicSongSlide[]
}>

export type PublicSongDocument = Readonly<{
  id: string
  revision: string
  title: string
  language: string
  translationOf: string | null
  license: string | null
  authors: readonly string[]
  translators: readonly string[]
  composers: readonly string[]
  attribution: string | null
  sections: readonly PublicSongSection[]
}>

export type SongPublicLinkSnapshot = Readonly<{
  schemaVersion: 1
  songSyncId: string
  songSyncVersion: number
  familyRevision: string
  documents: readonly PublicSongDocument[]
}>

export type SongPublicLinkRecord = Readonly<{
  schemaVersion: 1
  linkId: string
  linkVersion: number
  songSyncId: string
  songSyncVersion: number
  familyRevision: string
  reviewRevision: string
  label: string | null
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
}>

export class SongPublicLinkError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = 'SongPublicLinkError'
    this.code = code
    this.status = status
  }
}

function fail(code: string, message: string, status = 400): never {
  throw new SongPublicLinkError(code, message, status)
}

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_INPUT', `${label} must be an object.`)
  }
  return value as UnknownRecord
}

function exactKeys(
  value: UnknownRecord,
  keys: readonly string[],
  label: string,
) {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    fail('INVALID_INPUT', `${label} contains unsupported or missing fields.`)
  }
}

function boundedText(
  value: unknown,
  label: string,
  maximum: number,
  {
    required = false,
    controls = false,
  }: { required?: boolean; controls?: boolean } = {},
) {
  if (value === undefined || value === null || value === '') {
    if (required) fail('INVALID_INPUT', `${label} is required.`)
    return ''
  }
  if (typeof value !== 'string') {
    fail('INVALID_INPUT', `${label} must be text.`)
  }
  const normalized = value.trim()
  if (
    (required && !normalized)
    || normalized.length > maximum
    || (!controls && /[\u0000-\u001f\u007f]/u.test(normalized))
  ) {
    fail('INVALID_INPUT', `${label} is invalid.`)
  }
  return normalized
}

function identifier(value: unknown, label = 'Song identity') {
  const id = boundedText(value, label, 128, { required: true })
  if (!ID_PATTERN.test(id)) fail('INVALID_INPUT', `${label} is invalid.`)
  return id
}

function sha256(value: unknown, label: string) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    fail('INVALID_INPUT', `${label} is invalid.`)
  }
  return value
}

function canonicalTimestamp(
  value: unknown,
  label: string,
  { optional = false }: { optional?: boolean } = {},
) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null
    fail('INVALID_INPUT', `${label} is required.`)
  }
  if (
    typeof value !== 'string'
    || !CANONICAL_TIMESTAMP_PATTERN.test(value)
    || Number.isNaN(Date.parse(value))
    || new Date(value).toISOString() !== value
  ) {
    fail('INVALID_INPUT', `${label} is invalid.`)
  }
  return value
}

function storedTimestamp(
  value: unknown,
  label: string,
  { optional = false }: { optional?: boolean } = {},
) {
  if (value === undefined || value === null || value === '') {
    if (optional) return null
    fail('INVALID_LINK_STATE', `${label} is missing.`, 500)
  }
  const date = value instanceof Date ? value : new Date(String(value))
  if (!Number.isFinite(date.getTime())) {
    fail('INVALID_LINK_STATE', `${label} is invalid.`, 500)
  }
  return date.toISOString()
}

function calendarDate(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !CALENDAR_DATE_PATTERN.test(value)) {
    fail(
      'INVALID_INPUT',
      'Public-link review validity date must be a calendar date.',
    )
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (
    !Number.isFinite(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== value
  ) {
    fail('INVALID_INPUT', 'Public-link review validity date is invalid.')
  }
  return value
}

function validDate(value: unknown, label = 'Server clock') {
  const date = value instanceof Date ? value : new Date(String(value))
  if (!Number.isFinite(date.getTime())) throw new TypeError(`${label} is invalid`)
  return date
}

export function normalizeSongPublicLinkId(value: unknown) {
  if (typeof value !== 'string' || !LINK_ID_PATTERN.test(value)) {
    fail('INVALID_LINK_ID', 'Song public-link ID is invalid.')
  }
  const bytes = Buffer.from(value, 'base64url')
  if (bytes.length < 24 || bytes.toString('base64url') !== value) {
    fail('INVALID_LINK_ID', 'Song public-link ID is invalid.')
  }
  return value
}

export function normalizeSongPublicLinkIdempotencyKey(value: unknown) {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    fail('INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key is invalid.')
  }
  return value
}

export function hashSongPublicLinkIdempotencyKey(
  value: string,
  {
    connectionId,
    operation,
  }: {
    connectionId: number
    operation: 'create' | 'revoke'
  },
) {
  if (!Number.isSafeInteger(connectionId) || connectionId < 1) {
    throw new TypeError('Song public-link connection identity is invalid')
  }
  return createHash('sha256')
    .update('heritage-song-public-link-operation-v1\0', 'utf8')
    .update(String(connectionId), 'ascii')
    .update('\0')
    .update(operation, 'ascii')
    .update('\0')
    .update(normalizeSongPublicLinkIdempotencyKey(value), 'utf8')
    .digest('hex')
}

export function songPublicLinkOperationHash(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(value), 'utf8')
    .digest('hex')
}

export function normalizeSongPublicLinkReview(
  raw: unknown,
): SongPublicLinkReview {
  const value = record(raw, 'Song public-link review')
  exactKeys(
    value,
    [
      'scope',
      'basis',
      'evidence',
      'validUntil',
      'validThrough',
      'reviewedAt',
      'familyRevision',
    ],
    'Song public-link review',
  )
  if (value.scope !== 'public-link') {
    fail(
      'INVALID_REVIEW',
      'This review does not cover anonymous access by anyone with the link.',
    )
  }
  const basis = boundedText(
    value.basis,
    'Public-link review basis',
    40,
    { required: true },
  )
  if (!REVIEW_BASES.has(basis)) {
    fail('INVALID_REVIEW', 'Choose a supported public-link permission basis.')
  }
  const validUntil = calendarDate(value.validUntil)
  const validThrough = canonicalTimestamp(
    value.validThrough,
    'Public-link review validity boundary',
    { optional: true },
  )
  if ((validUntil === null) !== (validThrough === null)) {
    fail(
      'INVALID_REVIEW',
      'The public-link review date and exact validity boundary must be recorded together.',
    )
  }
  const review = {
    scope: 'public-link' as const,
    basis: basis as SongPublicLinkReview['basis'],
    evidence: boundedText(
      value.evidence,
      'Public-link review evidence',
      1000,
      { required: true },
    ),
    validUntil,
    validThrough,
    reviewedAt: canonicalTimestamp(
      value.reviewedAt,
      'Public-link review time',
    ) as string,
    familyRevision: sha256(
      value.familyRevision,
      'Reviewed song-family revision',
    ),
  }
  return Object.freeze(review)
}

export function songPublicLinkReviewRevision(raw: unknown) {
  const review = normalizeSongPublicLinkReview(raw)
  return createHash('sha256')
    .update(JSON.stringify([
      review.scope,
      review.basis,
      review.evidence,
      review.validUntil,
      review.validThrough,
      review.reviewedAt,
      review.familyRevision,
    ]), 'utf8')
    .digest('hex')
}

export function normalizeSongPublicLinkCreateRequest(
  raw: unknown,
  {
    now = new Date(),
    enforceCurrentTime = true,
  }: {
    now?: Date | string | number
    enforceCurrentTime?: boolean
  } = {},
): SongPublicLinkCreateRequest {
  const current = enforceCurrentTime ? validDate(now) : null
  const value = record(raw, 'Song public-link request')
  exactKeys(
    value,
    [
      'songSyncId',
      'familyRevision',
      'review',
      'reviewRevision',
      'label',
      'expiresAt',
    ],
    'Song public-link request',
  )
  const familyRevision = sha256(
    value.familyRevision,
    'Song-family revision',
  )
  const review = normalizeSongPublicLinkReview(value.review)
  if (review.familyRevision !== familyRevision) {
    fail(
      'INVALID_REVIEW',
      'Song public-link review does not cover this exact song family.',
    )
  }
  const reviewRevision = sha256(
    value.reviewRevision,
    'Song public-link review revision',
  )
  if (songPublicLinkReviewRevision(review) !== reviewRevision) {
    fail('INVALID_REVIEW', 'Song public-link review revision is invalid.')
  }
  const expiresAt = canonicalTimestamp(
    value.expiresAt,
    'Song public-link expiration time',
    { optional: true },
  )
  if (
    current
    && expiresAt
    && Date.parse(expiresAt) <= current.getTime()
  ) {
    fail(
      'INVALID_EXPIRY',
      'Song public-link expiration time must be in the future.',
    )
  }
  if (review.validThrough) {
    const validThrough = Date.parse(review.validThrough)
    if (current && current.getTime() > validThrough) {
      fail('REVIEW_EXPIRED', 'Song public-link rights review has expired.')
    }
    if (!expiresAt || Date.parse(expiresAt) > validThrough) {
      fail(
        'INVALID_EXPIRY',
        'Song public-link expiration cannot outlast its rights review.',
      )
    }
  }
  let label: string | null = null
  if (value.label !== null) {
    label = boundedText(value.label, 'Song public-link label', 120, {
      required: true,
    })
  }
  return Object.freeze({
    songSyncId: identifier(value.songSyncId, 'Song sync ID'),
    familyRevision,
    review,
    reviewRevision,
    label,
    expiresAt,
  })
}

function parseScalar(rawValue: string, field: string): unknown {
  const value = rawValue.trim()
  if (value.length > 2048) {
    fail('INVALID_SONG_DOCUMENT', `${field} is too long.`)
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed !== 'string') throw new Error('not text')
      return parsed
    } catch {
      fail('INVALID_SONG_DOCUMENT', `${field} has invalid quoted text.`)
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'")
  }
  if (value.startsWith('[') && value.endsWith(']')) {
    try {
      const parsed = JSON.parse(value)
      if (
        !Array.isArray(parsed)
        || parsed.some(item => typeof item !== 'string')
      ) {
        throw new Error('not a string list')
      }
      return parsed
    } catch {
      const inner = value.slice(1, -1).trim()
      if (!inner) return []
      return inner
        .split(',')
        .map(item => item.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
    }
  }
  return value
}

function parseFrontMatter(lines: string[]) {
  if (lines[0]?.trim() !== '---') {
    return { metadata: {} as UnknownRecord, bodyStart: 0 }
  }
  const relativeEnd = lines
    .slice(1, MAX_FRONT_MATTER_LINES + 1)
    .findIndex(line => line.trim() === '---')
  if (relativeEnd < 0) {
    fail(
      'INVALID_SONG_DOCUMENT',
      'The song metadata starts with --- but has no closing --- line.',
    )
  }
  const end = relativeEnd + 1
  const metadata: UnknownRecord = {}
  for (let index = 1; index < end; index += 1) {
    const line = lines[index]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = /^([A-Za-z][A-Za-z0-9_-]{0,63})\s*:\s*(.*)$/.exec(line)
    if (!match) {
      fail(
        'INVALID_SONG_DOCUMENT',
        `Song metadata line ${index + 1} must use name: value.`,
      )
    }
    if (Object.prototype.hasOwnProperty.call(metadata, match[1])) {
      fail(
        'INVALID_SONG_DOCUMENT',
        `Song metadata repeats ${match[1]}.`,
      )
    }
    metadata[match[1]] = parseScalar(match[2], match[1])
  }
  return { metadata, bodyStart: end + 1 }
}

function stringList(
  value: unknown,
  label: string,
  maximum = 64,
): readonly string[] {
  if (value === undefined || value === null || value === '') {
    return Object.freeze([])
  }
  const list = Array.isArray(value) ? value : String(value).split(',')
  if (list.length > maximum) {
    fail('INVALID_SONG_DOCUMENT', `${label} has too many values.`)
  }
  const result: string[] = []
  const seen = new Set<string>()
  for (const item of list) {
    const normalized = boundedText(String(item), label, 120)
    const identity = normalized.toLocaleLowerCase()
    if (!normalized || seen.has(identity)) continue
    seen.add(identity)
    result.push(normalized)
  }
  return Object.freeze(result)
}

function markerIdentity(raw: string) {
  const marker = boundedText(raw, 'Section marker', 64, {
    required: true,
    controls: true,
  })
  if (/[\r\n\0]/u.test(marker) || marker.startsWith('^')) {
    fail('INVALID_SONG_DOCUMENT', 'Song section marker is invalid.')
  }
  const numeric = /^(?:v(?:erse)?\s*)?(\d{1,3})$/iu.exec(marker)
  if (numeric) {
    const number = Number.parseInt(numeric[1], 10)
    return { id: `verse-${number}`, marker: String(number), label: `Verse ${number}` }
  }
  const compact = marker.toLowerCase().replace(/[\s_-]+/gu, ' ').trim()
  const known: Record<string, readonly [string, string]> = {
    chorus: ['chorus', 'Chorus'],
    refrain: ['chorus', 'Chorus'],
    bridge: ['bridge', 'Bridge'],
    tag: ['tag', 'Tag'],
    intro: ['intro', 'Intro'],
    outro: ['outro', 'Outro'],
    prechorus: ['pre-chorus', 'Pre-chorus'],
    'pre chorus': ['pre-chorus', 'Pre-chorus'],
  }
  if (known[compact]) {
    return {
      id: known[compact][0],
      marker: known[compact][0],
      label: known[compact][1],
    }
  }
  const ascii = marker
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 96)
  const hash = () => createHash('sha256')
    .update(marker.normalize('NFC'), 'utf8')
    .digest('hex')
    .slice(0, 10)
  const lostNonAsciiWord =
    /[^\x00-\x7F]/u.test(marker) && /[\p{L}\p{N}]/u.test(marker)
  const id = ascii
    ? lostNonAsciiWord
      ? `${ascii.slice(0, 84)}-${hash()}`
      : ascii
    : `section-${hash()}`
  return { id, marker, label: marker }
}

function normalizeLines(lines: string[]) {
  const result: string[] = []
  let previousBlank = false
  for (const raw of lines) {
    if (/[\r\n\0]/u.test(raw) || raw.length > MAX_LINE_LENGTH) {
      fail('INVALID_SONG_DOCUMENT', 'Song lyric line is invalid.')
    }
    const line = raw.replace(/[ \t]+$/gu, '')
    const blank = line.length === 0
    if (blank && previousBlank) continue
    result.push(line)
    previousBlank = blank
  }
  while (result[0] === '') result.shift()
  while (result.at(-1) === '') result.pop()
  return Object.freeze(result)
}

export function parseSongPublicDocument(
  input: SongPublicDocumentInput,
): PublicSongDocument {
  const id = identifier(input.id, 'Song document ID')
  if (
    typeof input.source !== 'string'
    || Buffer.byteLength(input.source, 'utf8') > MAX_SONG_DOCUMENT_BYTES
    || input.source.includes('\0')
  ) {
    fail('INVALID_SONG_DOCUMENT', `Song document ${id} source is invalid.`)
  }
  const revision = sha256(input.revision, `Song document ${id} revision`)
  const calculatedRevision = createHash('sha256')
    .update(input.source, 'utf8')
    .digest('hex')
  if (revision !== calculatedRevision) {
    fail(
      'INVALID_SONG_DOCUMENT',
      `Song document ${id} revision does not match its exact source.`,
    )
  }
  const normalizedSource = input.source
    .replace(/^\uFEFF/u, '')
    .replace(/\r\n?/gu, '\n')
  const lines = normalizedSource.split('\n')
  const { metadata, bodyStart } = parseFrontMatter(lines)
  if (identifier(metadata.id, 'Song front-matter ID') !== id) {
    fail(
      'INVALID_SONG_DOCUMENT',
      `Song document ${id} front-matter ID does not match.`,
    )
  }
  const title = boundedText(metadata.title, 'Song title', 200, {
    required: true,
    controls: true,
  })
  const language = boundedText(metadata.language, 'Song language', 35, {
    required: true,
    controls: true,
  })
  const translationOf = metadata.translationOf
    ? identifier(metadata.translationOf, 'Translation root ID')
    : null

  type MutableSection = {
    id: string
    marker: string
    label: string
    slides: Array<{ lines: string[] }>
  }
  const sections: MutableSection[] = []
  const sectionIds = new Set<string>()
  let current: MutableSection | null = null
  let slideCount = 0
  let lineCount = 0
  const beginSection = (identity: {
    id: string
    marker: string
    label: string
  }) => {
    if (
      sections.length >= MAX_SECTIONS
      || sectionIds.has(identity.id)
    ) {
      fail(
        'INVALID_SONG_DOCUMENT',
        `Song document ${id} has invalid or duplicate sections.`,
      )
    }
    sectionIds.add(identity.id)
    current = {
      ...identity,
      slides: [{ lines: [] }],
    }
    slideCount += 1
    sections.push(current)
  }
  const ensureSection = () => {
    if (!current) {
      beginSection({ id: 'section-1', marker: 'section', label: 'Song' })
    }
    return current as MutableSection
  }

  for (let index = bodyStart; index < lines.length; index += 1) {
    let line = lines[index]
    if (line.startsWith('^^')) {
      line = line.slice(1)
    } else {
      const marker = /^\^([^\s].{0,63})\s*$/u.exec(line)
      if (marker) {
        beginSection(markerIdentity(marker[1]))
        continue
      }
    }
    if (line.trim() === '---') {
      if (slideCount >= MAX_SLIDES) {
        fail('INVALID_SONG_DOCUMENT', `Song document ${id} has too many slides.`)
      }
      ensureSection().slides.push({ lines: [] })
      slideCount += 1
      continue
    }
    if (!current && !line.trim()) continue
    if (line.length > MAX_LINE_LENGTH) {
      fail('INVALID_SONG_DOCUMENT', `Song document ${id} has an overlong lyric line.`)
    }
    lineCount += 1
    if (lineCount > MAX_LINES) {
      fail('INVALID_SONG_DOCUMENT', `Song document ${id} has too many lyric lines.`)
    }
    ensureSection().slides.at(-1)?.lines.push(line)
  }
  const publicSections = sections.map(section => Object.freeze({
    marker: section.marker,
    label: section.label,
    slides: Object.freeze(section.slides.map(slide => Object.freeze({
      lines: normalizeLines(slide.lines),
    }))),
  }))
  if (
    !publicSections.length
    || !publicSections.some(section =>
      section.slides.some(slide => slide.lines.some(Boolean)))
  ) {
    fail('INVALID_SONG_DOCUMENT', `Song document ${id} has no lyric text.`)
  }
  return Object.freeze({
    id,
    revision,
    title,
    language,
    translationOf,
    license: boundedText(metadata.license, 'Song license', 300, {
      controls: true,
    }) || null,
    authors: stringList(metadata.authors, 'Song authors'),
    translators: stringList(metadata.translators, 'Song translators'),
    composers: stringList(
      metadata.composers ?? metadata.music,
      'Song composers',
    ),
    attribution: boundedText(
      metadata.attribution,
      'Song attribution',
      2048,
      { controls: true },
    ) || null,
    sections: Object.freeze(publicSections),
  })
}

function canonicalPublicDocuments(
  inputs: readonly SongPublicDocumentInput[],
) {
  if (
    !Array.isArray(inputs)
    || inputs.length < 1
    || inputs.length > MAX_FAMILY_DOCUMENTS
  ) {
    fail(
      'INVALID_SONG_FAMILY',
      `A song family must contain 1 to ${MAX_FAMILY_DOCUMENTS} exact documents.`,
    )
  }
  const documents = inputs.map(parseSongPublicDocument)
  const ids = new Set(documents.map(document => document.id))
  if (ids.size !== documents.length) {
    fail('INVALID_SONG_FAMILY', 'The song family repeats a document ID.')
  }
  const roots = documents.filter(document => document.translationOf === null)
  if (roots.length !== 1) {
    fail('INVALID_SONG_FAMILY', 'The song family must have exactly one original.')
  }
  const rootId = roots[0].id
  if (documents.some(document =>
    document.id !== rootId && document.translationOf !== rootId)) {
    fail(
      'INVALID_SONG_FAMILY',
      'Every translation must point directly to the exact original.',
    )
  }
  documents.sort((left, right) =>
    Number(Boolean(left.translationOf))
      - Number(Boolean(right.translationOf))
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
  return Object.freeze(documents)
}

function privateAttributionList(
  value: readonly string[],
  label: string,
  maximumLength: number,
) {
  if (!Array.isArray(value) || value.length > 64) {
    fail('INVALID_SONG_STATE', `${label} is invalid.`, 500)
  }
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    const normalized = boundedText(item, label, maximumLength, {
      required: true,
      controls: true,
    })
    if (/[\0]/u.test(normalized)) {
      fail('INVALID_SONG_STATE', `${label} is invalid.`, 500)
    }
    if (!seen.has(normalized)) {
      seen.add(normalized)
      result.push(normalized)
    }
  }
  return Object.freeze(result)
}

export function songPublicLinkFamilyRevision(
  inputs: readonly SongPublicDocumentInput[],
) {
  const documents = canonicalPublicDocuments(inputs)
  return createHash('sha256')
    .update(
      documents
        .map(document => `${document.id}:${document.revision}`)
        .join('\n'),
      'utf8',
    )
    .digest('hex')
}

export function buildSongPublicLinkSnapshot({
  songSyncId,
  songSyncVersion,
  documents: inputDocuments,
  privateAttributionExactValues = [],
  privateAttributionFragments = [],
}: {
  songSyncId: unknown
  songSyncVersion: unknown
  documents: readonly SongPublicDocumentInput[]
  privateAttributionExactValues?: readonly string[]
  privateAttributionFragments?: readonly string[]
}): {
  snapshot: SongPublicLinkSnapshot
  source: string
  checksum: string
} {
  const syncId = identifier(songSyncId, 'Song sync ID')
  const syncVersion = Number(songSyncVersion)
  if (!Number.isSafeInteger(syncVersion) || syncVersion < 1) {
    fail('INVALID_SONG_STATE', 'Stored song sync version is invalid.', 500)
  }
  const exactDocuments = canonicalPublicDocuments(inputDocuments)
  const familyRevision = createHash('sha256')
    .update(
      exactDocuments
        .map(document => `${document.id}:${document.revision}`)
        .join('\n'),
      'utf8',
    )
    .digest('hex')
  const privateFragments = privateAttributionList(
    privateAttributionFragments,
    'Private song attribution fragment',
    10_000,
  )
  const privateExactValues = privateAttributionList(
    privateAttributionExactValues,
    'Private exact song attribution',
    2048,
  )
  const documents = Object.freeze(exactDocuments.map(document => {
    const attribution = document.attribution
    const redact = attribution && (
      privateFragments.some(fragment => attribution.includes(fragment))
      || privateExactValues.includes(attribution)
    )
    return redact
      ? Object.freeze({ ...document, attribution: null })
      : document
  }))
  const snapshot = Object.freeze({
    schemaVersion: SONG_PUBLIC_LINK_SCHEMA_VERSION as 1,
    songSyncId: syncId,
    songSyncVersion: syncVersion,
    familyRevision,
    documents,
  })
  const source = `${JSON.stringify(snapshot)}\n`
  if (Buffer.byteLength(source, 'utf8') > MAX_SONG_PUBLIC_LINK_SNAPSHOT_BYTES) {
    fail(
      'SNAPSHOT_TOO_LARGE',
      'The public song-family snapshot exceeds the safe size limit.',
      413,
    )
  }
  return {
    snapshot,
    source,
    checksum: createHash('sha256').update(source, 'utf8').digest('hex'),
  }
}

function snapshotDocument(raw: unknown): SongPublicDocumentInput {
  const value = record(raw, 'Public song document')
  exactKeys(
    value,
    [
      'id',
      'revision',
      'title',
      'language',
      'translationOf',
      'license',
      'authors',
      'translators',
      'composers',
      'attribution',
      'sections',
    ],
    'Public song document',
  )
  // Stored snapshots are parsed directly below rather than converted back to
  // Markdown. This source-shaped return is never used as a family input.
  return value as unknown as SongPublicDocumentInput
}

function normalizeStoredSnapshotDocument(raw: unknown): PublicSongDocument {
  const value = snapshotDocument(raw) as unknown as UnknownRecord
  const id = identifier(value.id, 'Public song document ID')
  const revision = sha256(value.revision, 'Public song document revision')
  const title = boundedText(value.title, 'Public song title', 200, {
    required: true,
    controls: true,
  })
  const language = boundedText(value.language, 'Public song language', 35, {
    required: true,
    controls: true,
  })
  const translationOf = value.translationOf === null
    ? null
    : identifier(value.translationOf, 'Public translation root ID')
  const nullableText = (
    candidate: unknown,
    label: string,
    maximum: number,
  ) => candidate === null
    ? null
    : boundedText(candidate, label, maximum, {
        required: true,
        controls: true,
      })
  const list = (candidate: unknown, label: string) => {
    if (!Array.isArray(candidate)) {
      fail('INVALID_LINK_STATE', `${label} is invalid.`, 500)
    }
    return stringList(candidate, label)
  }
  if (!Array.isArray(value.sections)) {
    fail('INVALID_LINK_STATE', 'Stored public song sections are invalid.', 500)
  }
  let slideCount = 0
  let lineCount = 0
  const sections = value.sections.map((rawSection, sectionIndex) => {
    const section = record(rawSection, `Public song section ${sectionIndex + 1}`)
    exactKeys(section, ['marker', 'label', 'slides'], 'Public song section')
    if (!Array.isArray(section.slides) || !section.slides.length) {
      fail('INVALID_LINK_STATE', 'Stored public song slides are invalid.', 500)
    }
    const slides = section.slides.map(rawSlide => {
      const slide = record(rawSlide, 'Public song slide')
      exactKeys(slide, ['lines'], 'Public song slide')
      if (!Array.isArray(slide.lines)) {
        fail('INVALID_LINK_STATE', 'Stored public song lines are invalid.', 500)
      }
      slideCount += 1
      lineCount += slide.lines.length
      if (
        slideCount > MAX_SLIDES
        || lineCount > MAX_LINES
        || slide.lines.some(line =>
          typeof line !== 'string'
          || line.length > MAX_LINE_LENGTH
          || /[\r\n\0]/u.test(line))
      ) {
        fail('INVALID_LINK_STATE', 'Stored public song lyrics are invalid.', 500)
      }
      return Object.freeze({ lines: Object.freeze([...slide.lines]) as string[] })
    })
    return Object.freeze({
      marker: boundedText(section.marker, 'Public section marker', 64, {
        required: true,
        controls: true,
      }),
      label: boundedText(section.label, 'Public section label', 100, {
        required: true,
        controls: true,
      }),
      slides: Object.freeze(slides),
    })
  })
  if (
    !sections.length
    || sections.length > MAX_SECTIONS
    || !sections.some(section =>
      section.slides.some(slide => slide.lines.some(Boolean)))
  ) {
    fail('INVALID_LINK_STATE', 'Stored public song lyrics are invalid.', 500)
  }
  return Object.freeze({
    id,
    revision,
    title,
    language,
    translationOf,
    license: nullableText(value.license, 'Public song license', 300),
    authors: list(value.authors, 'Public song authors'),
    translators: list(value.translators, 'Public song translators'),
    composers: list(value.composers, 'Public song composers'),
    attribution: nullableText(
      value.attribution,
      'Public song attribution',
      2048,
    ),
    sections: Object.freeze(sections),
  })
}

export function parseSongPublicLinkSnapshotSource(
  source: unknown,
  checksum: unknown,
): SongPublicLinkSnapshot {
  if (
    typeof source !== 'string'
    || Buffer.byteLength(source, 'utf8') > MAX_SONG_PUBLIC_LINK_SNAPSHOT_BYTES
    || !source.endsWith('\n')
  ) {
    fail('INVALID_LINK_STATE', 'Stored song public-link snapshot is invalid.', 500)
  }
  const expectedChecksum = sha256(checksum, 'Snapshot checksum')
  if (
    createHash('sha256').update(source, 'utf8').digest('hex')
      !== expectedChecksum
  ) {
    fail('INVALID_LINK_STATE', 'Stored song public-link snapshot is invalid.', 500)
  }
  let raw: UnknownRecord
  try {
    raw = record(JSON.parse(source), 'Stored song public-link snapshot')
  } catch (error) {
    if (error instanceof SongPublicLinkError) throw error
    fail('INVALID_LINK_STATE', 'Stored song public-link snapshot is invalid.', 500)
  }
  exactKeys(
    raw,
    [
      'schemaVersion',
      'songSyncId',
      'songSyncVersion',
      'familyRevision',
      'documents',
    ],
    'Stored song public-link snapshot',
  )
  if (
    raw.schemaVersion !== SONG_PUBLIC_LINK_SCHEMA_VERSION
    || !Number.isSafeInteger(raw.songSyncVersion)
    || Number(raw.songSyncVersion) < 1
    || !Array.isArray(raw.documents)
    || raw.documents.length < 1
    || raw.documents.length > MAX_FAMILY_DOCUMENTS
  ) {
    fail('INVALID_LINK_STATE', 'Stored song public-link snapshot is invalid.', 500)
  }
  const documents = raw.documents.map(normalizeStoredSnapshotDocument)
  const roots = documents.filter(document => document.translationOf === null)
  if (
    new Set(documents.map(document => document.id)).size !== documents.length
    || roots.length !== 1
    || documents.some(document =>
      document.id !== roots[0].id
      && document.translationOf !== roots[0].id)
  ) {
    fail('INVALID_LINK_STATE', 'Stored song public-link family is invalid.', 500)
  }
  documents.sort((left, right) =>
    Number(Boolean(left.translationOf))
      - Number(Boolean(right.translationOf))
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
  const familyRevision = createHash('sha256')
    .update(
      documents
        .map(document => `${document.id}:${document.revision}`)
        .join('\n'),
      'utf8',
    )
    .digest('hex')
  if (familyRevision !== sha256(raw.familyRevision, 'Snapshot family revision')) {
    fail('INVALID_LINK_STATE', 'Stored song public-link family is invalid.', 500)
  }
  const normalized = Object.freeze({
    schemaVersion: SONG_PUBLIC_LINK_SCHEMA_VERSION as 1,
    songSyncId: identifier(raw.songSyncId, 'Snapshot song sync ID'),
    songSyncVersion: Number(raw.songSyncVersion),
    familyRevision,
    documents: Object.freeze(documents),
  })
  if (`${JSON.stringify(normalized)}\n` !== source) {
    fail(
      'INVALID_LINK_STATE',
      'Stored song public-link snapshot is not canonical.',
      500,
    )
  }
  return normalized
}

function storedLabel(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  const label = boundedText(value, 'Stored song public-link label', 120, {
    required: true,
  })
  if (label !== value) {
    fail('INVALID_LINK_STATE', 'Stored song public-link label is invalid.', 500)
  }
  return label
}

export function serializeSongPublicLinkRecord(
  raw: UnknownRecord,
): SongPublicLinkRecord {
  let linkId: string
  try {
    linkId = normalizeSongPublicLinkId(raw.linkId)
  } catch {
    fail('INVALID_LINK_STATE', 'Stored song public-link ID is invalid.', 500)
  }
  const linkVersion = Number(raw.linkVersion)
  const songSyncVersion = Number(raw.songSyncVersion)
  if (
    Number(raw.schemaVersion) !== SONG_PUBLIC_LINK_SCHEMA_VERSION
    || !Number.isSafeInteger(linkVersion)
    || linkVersion < 1
    || !Number.isSafeInteger(songSyncVersion)
    || songSyncVersion < 1
  ) {
    fail('INVALID_LINK_STATE', 'Stored song public-link state is invalid.', 500)
  }
  const createdAt = storedTimestamp(
    raw.issuedAt,
    'Link creation time',
  ) as string
  const expiresAt = storedTimestamp(
    raw.expiresAt,
    'Link expiration time',
    { optional: true },
  )
  const revokedAt = storedTimestamp(
    raw.revokedAt,
    'Link revocation time',
    { optional: true },
  )
  if (
    (expiresAt && Date.parse(expiresAt) <= Date.parse(createdAt))
    || (revokedAt && Date.parse(revokedAt) < Date.parse(createdAt))
  ) {
    fail('INVALID_LINK_STATE', 'Stored song public-link lifetime is invalid.', 500)
  }
  return Object.freeze({
    schemaVersion: SONG_PUBLIC_LINK_SCHEMA_VERSION as 1,
    linkId,
    linkVersion,
    songSyncId: identifier(raw.songSyncId, 'Stored song sync ID'),
    songSyncVersion,
    familyRevision: sha256(
      raw.familyRevision,
      'Stored song-family revision',
    ),
    reviewRevision: sha256(
      raw.reviewRevision,
      'Stored public-link review revision',
    ),
    label: storedLabel(raw.label),
    createdAt,
    expiresAt,
    revokedAt,
  })
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;')
}

function creditList(label: string, values: readonly string[]) {
  if (!values.length) return ''
  return `<dt>${escapeHtml(label)}</dt><dd>${values
    .map(escapeHtml)
    .join(', ')}</dd>`
}

export function renderSongPublicLinkHtml(snapshot: SongPublicLinkSnapshot) {
  const title = snapshot.documents[0]?.title || 'Shared song'
  const documents = snapshot.documents.map((document, documentIndex) => {
    const headingLevel = documentIndex === 0 ? 'h1' : 'h2'
    const sectionHeadingLevel = documentIndex === 0 ? 'h2' : 'h3'
    const credits = [
      creditList('Authors', document.authors),
      creditList('Translators', document.translators),
      creditList('Composers', document.composers),
      document.license
        ? `<dt>License</dt><dd>${escapeHtml(document.license)}</dd>`
        : '',
      document.attribution
        ? `<dt>Credit</dt><dd>${escapeHtml(document.attribution)}</dd>`
        : '',
    ].join('')
    const sections = document.sections.map(section => (
      `<section><${sectionHeadingLevel}>${escapeHtml(section.label)}</${sectionHeadingLevel}>`
      + section.slides.map(slide => (
        `<p>${slide.lines.length
          ? slide.lines.map(line => escapeHtml(line) || '&nbsp;').join('<br>')
          : '&nbsp;'}</p>`
      )).join('')
      + '</section>'
    )).join('')
    return `<article lang="${escapeHtml(document.language)}">`
      + `<${headingLevel}>${escapeHtml(document.title)}</${headingLevel}>`
      + (credits ? `<dl>${credits}</dl>` : '')
      + sections
      + '</article>'
  }).join('')
  return '<!doctype html>'
    + `<html lang="${escapeHtml(snapshot.documents[0]?.language || 'en')}">`
    + '<head>'
    + '<meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<meta name="robots" content="noindex,nofollow,noarchive">'
    + `<title>${escapeHtml(title)} — Heritage Community</title>`
    + '<style>'
    + ':root{color-scheme:light dark;font-family:system-ui,sans-serif;line-height:1.5}'
    + 'body{margin:0 auto;max-width:48rem;padding:1.25rem}'
    + 'article+article{border-top:1px solid currentColor;margin-top:3rem;padding-top:2rem}'
    + 'p{font-size:1.1rem;white-space:normal;margin:1rem 0 1.75rem}'
    + 'dt{font-weight:700}dd{margin:0 0 .5rem}'
    + '@media print{body{max-width:none;padding:0}article{break-before:page}article:first-child{break-before:auto}}'
    + '</style>'
    + '</head>'
    + `<body><main>${documents}</main></body></html>`
}

export function songPublicLinkResponseHeaders(contentType: string) {
  return new Headers({
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy':
      "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    'Content-Type': contentType,
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  })
}

export function unavailableSongPublicLinkResponse() {
  const body = '<!doctype html><html lang="en"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<meta name="robots" content="noindex,nofollow,noarchive">'
    + '<title>Shared song unavailable</title></head>'
    + '<body><main><h1>Shared song unavailable</h1>'
    + '<p>This link is unavailable.</p></main></body></html>'
  return new Response(body, {
    status: 404,
    headers: songPublicLinkResponseHeaders('text/html; charset=utf-8'),
  })
}
