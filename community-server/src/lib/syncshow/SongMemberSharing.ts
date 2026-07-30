import { createHash } from 'node:crypto'

export const SONG_MEMBER_SHARING_SCHEMA_VERSION = 1
export const MAX_SONG_MEMBER_SHARING_REQUEST_BYTES = 64 * 1024

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const CANONICAL_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const RECEIPT_ID_PATTERN = /^[A-Za-z0-9_-]{32,128}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const REVIEW_BASES = new Set([
  'public-domain',
  'original-work',
  'church-license',
  'specific-web-license',
  'direct-permission',
  'other-reviewed',
])
const MEMBER_VISIBILITIES = new Set(['public', 'scheduled-public'])
const DATE_FORMAT_LOCALE = 'en-US-u-ca-iso8601-nu-latn'

type UnknownRecord = Record<string, unknown>

export type SongMemberSharingReview = Readonly<{
  scope: 'community-members'
  basis:
    | 'public-domain'
    | 'original-work'
    | 'church-license'
    | 'specific-web-license'
    | 'direct-permission'
    | 'other-reviewed'
  evidence: string
  validUntil: string | null
  reviewedAt: string
  familyRevision: string
}>

export type SongMemberSharingRequest = Readonly<{
  schemaVersion: 1
  familyRevision: string
  review: SongMemberSharingReview
  reviewRevision: string
  visibility: 'public' | 'scheduled-public'
  publishAt: string | null
}>

export type SongMemberSharingReceipt = Readonly<{
  schemaVersion: 1
  receiptId: string
  receiptVersion: number
  songSyncId: string
  previousSongSyncVersion: number
  songSyncVersion: number
  familyRevision: string
  reviewRevision: string
  visibility: 'public' | 'scheduled-public'
  publishAt: string | null
  timeZone: string
  validThrough: string | null
  reviewedAt: string
  confirmedAt: string
  requestRevision: string
  receiptRevision: string
}>

export class SongMemberSharingError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = 'SongMemberSharingError'
    this.code = code
    this.status = status
  }
}

function fail(code: string, message: string, status = 400): never {
  throw new SongMemberSharingError(code, message, status)
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
  { required = false }: { required?: boolean } = {},
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
    || /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    fail('INVALID_INPUT', `${label} is invalid.`)
  }
  return normalized
}

function identifier(value: unknown, label: string) {
  const normalized = boundedText(value, label, 128, { required: true })
  if (!ID_PATTERN.test(normalized)) {
    fail('INVALID_INPUT', `${label} is invalid.`)
  }
  return normalized
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
    fail('INVALID_RECEIPT_STATE', `${label} is missing.`, 500)
  }
  const date = value instanceof Date ? value : new Date(String(value))
  if (!Number.isFinite(date.getTime())) {
    fail('INVALID_RECEIPT_STATE', `${label} is invalid.`, 500)
  }
  return date.toISOString()
}

function calendarDate(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !CALENDAR_DATE_PATTERN.test(value)) {
    fail(
      'INVALID_REVIEW',
      'Member-sharing review validity must use YYYY-MM-DD.',
    )
  }
  const parsed = new Date(`${value}T12:00:00.000Z`)
  if (
    !Number.isFinite(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== value
  ) {
    fail('INVALID_REVIEW', 'Member-sharing review validity date is invalid.')
  }
  return value
}

function validTimeZone(value: unknown, errorCode = 'INVALID_RECEIPT_STATE') {
  if (
    typeof value !== 'string'
    || !value
    || value !== value.trim()
    || value.length > 255
  ) {
    fail(errorCode, 'Community time zone is missing or invalid.',
      errorCode === 'INVALID_RECEIPT_STATE' ? 500 : 400)
  }
  try {
    new Intl.DateTimeFormat(DATE_FORMAT_LOCALE, {
      day: '2-digit',
      month: '2-digit',
      timeZone: value,
      year: 'numeric',
    }).format(new Date(0))
  } catch {
    fail(errorCode, 'Community time zone is missing or invalid.',
      errorCode === 'INVALID_RECEIPT_STATE' ? 500 : 400)
  }
  return value
}

function localCalendarDate(formatter: Intl.DateTimeFormat, instant: number) {
  const values: Record<string, string> = {}
  for (const part of formatter.formatToParts(new Date(instant))) {
    if (part.type !== 'literal') values[part.type] = part.value
  }
  const date = `${values.year}-${values.month}-${values.day}`
  if (!CALENDAR_DATE_PATTERN.test(date)) {
    fail('INVALID_TIME_ZONE', 'Community time zone could not resolve a date.')
  }
  return date
}

/**
 * Returns the final millisecond of the reviewed civil calendar day in the
 * Community's locked IANA time zone. Binary-searching the first instant whose
 * local date is greater than the reviewed date handles 23/25-hour days and
 * time zones whose offset transition happens at midnight.
 */
export function memberSharingValidThrough(
  validUntil: string | null,
  timeZoneValue: string,
) {
  if (validUntil === null) return null
  const date = calendarDate(validUntil) as string
  const timeZone = validTimeZone(timeZoneValue, 'INVALID_TIME_ZONE')
  const formatter = new Intl.DateTimeFormat(DATE_FORMAT_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    numberingSystem: 'latn',
    timeZone,
    year: 'numeric',
  })
  const center = Date.parse(`${date}T12:00:00.000Z`)
  let lower = center - 72 * 60 * 60_000
  let upper = center + 72 * 60 * 60_000
  if (
    localCalendarDate(formatter, lower) > date
    || localCalendarDate(formatter, upper) <= date
  ) {
    fail('INVALID_TIME_ZONE', 'Community time zone could not bound the review date.')
  }
  while (upper - lower > 1) {
    const midpoint = lower + Math.floor((upper - lower) / 2)
    if (localCalendarDate(formatter, midpoint) > date) {
      upper = midpoint
    } else {
      lower = midpoint
    }
  }
  return new Date(upper - 1).toISOString()
}

export function normalizeSongMemberSharingReview(
  raw: unknown,
): SongMemberSharingReview {
  const value = record(raw, 'Song member-sharing review')
  exactKeys(
    value,
    [
      'scope',
      'basis',
      'evidence',
      'validUntil',
      'reviewedAt',
      'familyRevision',
    ],
    'Song member-sharing review',
  )
  if (value.scope !== 'community-members') {
    fail(
      'INVALID_REVIEW',
      'This review must specifically cover signed-in Community members.',
    )
  }
  const basis = boundedText(
    value.basis,
    'Member-sharing review basis',
    40,
    { required: true },
  )
  if (!REVIEW_BASES.has(basis)) {
    fail('INVALID_REVIEW', 'Choose a supported member-sharing permission basis.')
  }
  const evidenceRequired = ![
    'public-domain',
    'original-work',
  ].includes(basis)
  return Object.freeze({
    scope: 'community-members' as const,
    basis: basis as SongMemberSharingReview['basis'],
    evidence: boundedText(
      value.evidence,
      'Member-sharing review evidence',
      1000,
      { required: evidenceRequired },
    ),
    validUntil: calendarDate(value.validUntil),
    reviewedAt: canonicalTimestamp(
      value.reviewedAt,
      'Member-sharing review time',
    ) as string,
    familyRevision: sha256(
      value.familyRevision,
      'Reviewed song-family revision',
    ),
  })
}

export function songMemberSharingReviewRevision(raw: unknown) {
  const review = normalizeSongMemberSharingReview(raw)
  return createHash('sha256')
    .update(JSON.stringify([
      review.scope,
      review.basis,
      review.evidence,
      review.validUntil,
      review.reviewedAt,
      review.familyRevision,
    ]), 'utf8')
    .digest('hex')
}

export function normalizeSongMemberSharingRequest(
  raw: unknown,
): SongMemberSharingRequest {
  const value = record(raw, 'Song member-sharing request')
  exactKeys(
    value,
    [
      'schemaVersion',
      'familyRevision',
      'review',
      'reviewRevision',
      'visibility',
      'publishAt',
    ],
    'Song member-sharing request',
  )
  if (value.schemaVersion !== SONG_MEMBER_SHARING_SCHEMA_VERSION) {
    fail('UNSUPPORTED_SCHEMA', 'Song member-sharing schemaVersion must be 1.')
  }
  const familyRevision = sha256(
    value.familyRevision,
    'Song-family revision',
  )
  const review = normalizeSongMemberSharingReview(value.review)
  if (review.familyRevision !== familyRevision) {
    fail(
      'INVALID_REVIEW',
      'The member-sharing review does not cover this exact song family.',
    )
  }
  const reviewRevision = sha256(
    value.reviewRevision,
    'Member-sharing review revision',
  )
  if (songMemberSharingReviewRevision(review) !== reviewRevision) {
    fail('INVALID_REVIEW', 'Member-sharing review revision is invalid.')
  }
  if (
    typeof value.visibility !== 'string'
    || !MEMBER_VISIBILITIES.has(value.visibility)
  ) {
    fail(
      'INVALID_VISIBILITY',
      'Member sharing must choose public or scheduled-public.',
    )
  }
  const visibility =
    value.visibility as SongMemberSharingRequest['visibility']
  const publishAt = canonicalTimestamp(
    value.publishAt,
    'Scheduled member-sharing time',
    { optional: true },
  )
  if (
    (visibility === 'scheduled-public') !== Boolean(publishAt)
  ) {
    fail(
      'INVALID_SCHEDULE',
      visibility === 'scheduled-public'
        ? 'publishAt is required for scheduled member sharing.'
        : 'publishAt must be null for immediate member sharing.',
    )
  }
  return Object.freeze({
    schemaVersion: SONG_MEMBER_SHARING_SCHEMA_VERSION as 1,
    familyRevision,
    review,
    reviewRevision,
    visibility,
    publishAt,
  })
}

export function songMemberSharingRequestRevision({
  songSyncId,
  expectedSongSyncVersion,
  request,
}: {
  songSyncId: unknown
  expectedSongSyncVersion: unknown
  request: SongMemberSharingRequest
}) {
  const syncId = identifier(songSyncId, 'Song sync ID')
  const version = Number(expectedSongSyncVersion)
  if (!Number.isSafeInteger(version) || version < 1) {
    fail('VERSION_CONFLICT', 'Expected song version is invalid.', 412)
  }
  return createHash('sha256')
    .update(JSON.stringify([
      SONG_MEMBER_SHARING_SCHEMA_VERSION,
      syncId,
      version,
      request.familyRevision,
      request.reviewRevision,
      request.visibility,
      request.publishAt,
    ]), 'utf8')
    .digest('hex')
}

function normalizeReceiptId(value: unknown) {
  if (typeof value !== 'string' || !RECEIPT_ID_PATTERN.test(value)) {
    fail('INVALID_RECEIPT_STATE', 'Stored member-sharing receipt ID is invalid.', 500)
  }
  const bytes = Buffer.from(value, 'base64url')
  if (bytes.length < 24 || bytes.toString('base64url') !== value) {
    fail('INVALID_RECEIPT_STATE', 'Stored member-sharing receipt ID is invalid.', 500)
  }
  return value
}

function receiptRevisionValues(
  receipt: Omit<SongMemberSharingReceipt, 'receiptRevision'>,
) {
  return [
    receipt.schemaVersion,
    receipt.receiptId,
    receipt.receiptVersion,
    receipt.songSyncId,
    receipt.previousSongSyncVersion,
    receipt.songSyncVersion,
    receipt.familyRevision,
    receipt.reviewRevision,
    receipt.visibility,
    receipt.publishAt,
    receipt.timeZone,
    receipt.validThrough,
    receipt.reviewedAt,
    receipt.confirmedAt,
    receipt.requestRevision,
  ]
}

export function songMemberSharingReceiptRevision(
  receipt: Omit<SongMemberSharingReceipt, 'receiptRevision'>,
) {
  return createHash('sha256')
    .update(JSON.stringify(receiptRevisionValues(receipt)), 'utf8')
    .digest('hex')
}

export function serializeSongMemberSharingReceipt(
  raw: UnknownRecord,
): SongMemberSharingReceipt {
  const receiptVersion = Number(raw.receiptVersion)
  const previousSongSyncVersion = Number(raw.previousSongSyncVersion)
  const songSyncVersion = Number(raw.songSyncVersion)
  if (
    Number(raw.schemaVersion) !== SONG_MEMBER_SHARING_SCHEMA_VERSION
    || !Number.isSafeInteger(receiptVersion)
    || receiptVersion < 1
    || !Number.isSafeInteger(previousSongSyncVersion)
    || previousSongSyncVersion < 1
    || songSyncVersion !== previousSongSyncVersion + 1
  ) {
    fail('INVALID_RECEIPT_STATE', 'Stored member-sharing receipt is invalid.', 500)
  }
  if (
    typeof raw.visibility !== 'string'
    || !MEMBER_VISIBILITIES.has(raw.visibility)
  ) {
    fail('INVALID_RECEIPT_STATE', 'Stored member-sharing visibility is invalid.', 500)
  }
  const visibility =
    raw.visibility as SongMemberSharingReceipt['visibility']
  const publishAt = storedTimestamp(
    raw.publishAt,
    'Member-sharing schedule',
    { optional: true },
  )
  if ((visibility === 'scheduled-public') !== Boolean(publishAt)) {
    fail('INVALID_RECEIPT_STATE', 'Stored member-sharing schedule is invalid.', 500)
  }
  const receipt = Object.freeze({
    schemaVersion: SONG_MEMBER_SHARING_SCHEMA_VERSION as 1,
    receiptId: normalizeReceiptId(raw.receiptId),
    receiptVersion,
    songSyncId: identifier(raw.songSyncId, 'Stored song sync ID'),
    previousSongSyncVersion,
    songSyncVersion,
    familyRevision: sha256(
      raw.familyRevision,
      'Stored song-family revision',
    ),
    reviewRevision: sha256(
      raw.reviewRevision,
      'Stored member-sharing review revision',
    ),
    visibility,
    publishAt,
    timeZone: validTimeZone(raw.timeZone),
    validThrough: storedTimestamp(
      raw.validThrough,
      'Member-sharing validity boundary',
      { optional: true },
    ),
    reviewedAt: storedTimestamp(
      raw.reviewedAt,
      'Member-sharing review time',
    ) as string,
    confirmedAt: storedTimestamp(
      raw.confirmedAt,
      'Member-sharing confirmation time',
    ) as string,
    requestRevision: sha256(
      raw.requestRevision,
      'Stored member-sharing request revision',
    ),
  })
  const receiptRevision = sha256(
    raw.receiptRevision,
    'Stored member-sharing receipt revision',
  )
  if (songMemberSharingReceiptRevision(receipt) !== receiptRevision) {
    fail('INVALID_RECEIPT_STATE', 'Stored member-sharing receipt digest is invalid.', 500)
  }
  if (
    Date.parse(receipt.reviewedAt) > Date.parse(receipt.confirmedAt)
    || (receipt.validThrough
      && Date.parse(receipt.validThrough) < Date.parse(receipt.confirmedAt))
    || (receipt.publishAt
      && receipt.validThrough
      && Date.parse(receipt.publishAt) > Date.parse(receipt.validThrough))
  ) {
    fail('INVALID_RECEIPT_STATE', 'Stored member-sharing receipt lifetime is invalid.', 500)
  }
  return Object.freeze({ ...receipt, receiptRevision })
}

export function songMemberSharingSummaryFromSong(
  song: UnknownRecord,
): SongMemberSharingReceipt | null {
  if (!song.memberShareReceiptId) return null
  const receipt = serializeSongMemberSharingReceipt({
    schemaVersion: SONG_MEMBER_SHARING_SCHEMA_VERSION,
    receiptId: song.memberShareReceiptId,
    receiptVersion: song.memberShareReceiptVersion,
    songSyncId: song.syncId,
    previousSongSyncVersion: song.memberSharePreviousSongSyncVersion,
    songSyncVersion: song.memberShareSongSyncVersion,
    familyRevision: song.memberShareFamilyRevision,
    reviewRevision: song.memberShareReviewRevision,
    visibility: song.memberShareVisibility,
    publishAt: song.memberSharePublishAt,
    timeZone: song.memberShareTimeZone,
    validThrough: song.memberShareValidThrough,
    reviewedAt: song.memberShareReviewedAt,
    confirmedAt: song.memberShareConfirmedAt,
    requestRevision: song.memberShareRequestRevision,
    receiptRevision: song.memberShareReceiptRevision,
  })
  if (
    receipt.songSyncId !== song.syncId
    || receipt.songSyncVersion !== Number(song.syncVersion)
    || receipt.visibility !== song.visibility
    || (receipt.publishAt || null) !== (
      song.publishAt
        ? new Date(String(song.publishAt)).toISOString()
        : null
    )
  ) {
    return null
  }
  return receipt
}

export function isSongMemberShareCurrent(
  song: UnknownRecord,
  now = new Date(),
) {
  if (!Number.isFinite(now.getTime()) || song.status !== 'published') {
    return false
  }
  let receipt: SongMemberSharingReceipt | null
  try {
    receipt = songMemberSharingSummaryFromSong(song)
  } catch {
    return false
  }
  if (!receipt) return false
  if (
    receipt.validThrough
    && now.getTime() > Date.parse(receipt.validThrough)
  ) {
    return false
  }
  if (receipt.visibility === 'public') return true
  return Boolean(
    receipt.publishAt
    && Date.parse(receipt.publishAt) <= now.getTime(),
  )
}
