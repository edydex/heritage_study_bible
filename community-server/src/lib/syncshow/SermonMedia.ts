import { createHash } from 'node:crypto'
import {
  normalizeSermonDocument,
  type CanonicalSermonDocument,
} from './SermonDocument.ts'

export const SERMON_MEDIA_SCHEMA_VERSION = 1
export const SERMON_MEDIA_CHUNK_SIZE_BYTES = 8 * 1024 * 1024
export const SERMON_MEDIA_MAXIMUM_BYTES = 1024 * 1024 * 1024
export const SERMON_MEDIA_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60
export const SERMON_MEDIA_ACCEPTED_MEDIA_TYPES = [
  'audio/mpeg',
  'audio/mp4',
] as const
export const SERMON_MEDIA_READ_SCOPE = 'syncshow:sermon-media:read'
export const SERMON_MEDIA_WRITE_SCOPE = 'syncshow:sermon-media:write'

export type SermonMediaCapacityLimits = Readonly<{
  maximumActiveGlobal: number
  maximumActivePerCommunity: number
  maximumActivePerConnection: number
  maximumFinalizingGlobal: number
  maximumRetainedBytesPerCommunity: number
  maximumRetainedObjectsPerCommunity: number
  storageReserveBytes: number
}>

function configuredPositiveInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  if (!/^[1-9]\d*$/.test(raw)) {
    throw new SermonMediaError(
      'INVALID_SERVER_CONFIGURATION',
      `${name} must be a positive integer.`,
      503,
    )
  }
  const value = Number(raw)
  if (
    !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    throw new SermonMediaError(
      'INVALID_SERVER_CONFIGURATION',
      `${name} is outside its supported range.`,
      503,
    )
  }
  return value
}

export function sermonMediaCapacityLimits(): SermonMediaCapacityLimits {
  const maximumActiveGlobal = configuredPositiveInteger(
    'HERITAGE_SERMON_MEDIA_MAX_ACTIVE_GLOBAL',
    8,
    1,
    1024,
  )
  const maximumActivePerCommunity = configuredPositiveInteger(
    'HERITAGE_SERMON_MEDIA_MAX_ACTIVE_PER_COMMUNITY',
    4,
    1,
    maximumActiveGlobal,
  )
  const maximumFinalizingGlobal = configuredPositiveInteger(
    'HERITAGE_SERMON_MEDIA_MAX_FINALIZING_GLOBAL',
    1,
    1,
    maximumActiveGlobal,
  )
  return Object.freeze({
    maximumActiveGlobal,
    maximumActivePerCommunity,
    maximumActivePerConnection: configuredPositiveInteger(
      'HERITAGE_SERMON_MEDIA_MAX_ACTIVE_PER_CONNECTION',
      2,
      1,
      maximumActivePerCommunity,
    ),
    maximumFinalizingGlobal,
    maximumRetainedBytesPerCommunity: configuredPositiveInteger(
      'HERITAGE_SERMON_MEDIA_MAX_RETAINED_BYTES_PER_COMMUNITY',
      50 * 1024 * 1024 * 1024,
      1024 * 1024 * 1024,
      10 * 1024 * 1024 * 1024 * 1024,
    ),
    maximumRetainedObjectsPerCommunity: configuredPositiveInteger(
      'HERITAGE_SERMON_MEDIA_MAX_RETAINED_OBJECTS_PER_COMMUNITY',
      2_000,
      1,
      1_000_000,
    ),
    storageReserveBytes: configuredPositiveInteger(
      'HERITAGE_SERMON_MEDIA_STORAGE_RESERVE_BYTES',
      5 * 1024 * 1024 * 1024,
      256 * 1024 * 1024,
      10 * 1024 * 1024 * 1024 * 1024,
    ),
  })
}

export function sermonMediaRequiredAvailableBytes({
  configuredReserveBytes,
  filesystemTotalBytes,
  remainingActiveBytes,
  additionalReservationBytes = 0,
  largestAssemblyBytes,
}: {
  configuredReserveBytes: number
  filesystemTotalBytes: number
  remainingActiveBytes: number
  additionalReservationBytes?: number
  largestAssemblyBytes: number
}) {
  const values = [
    configuredReserveBytes,
    filesystemTotalBytes,
    remainingActiveBytes,
    additionalReservationBytes,
    largestAssemblyBytes,
  ]
  if (values.some(value =>
    !Number.isSafeInteger(value) || value < 0
  )) {
    throw new SermonMediaError(
      'CAPACITY_UNAVAILABLE',
      'Recording storage capacity arithmetic is invalid.',
      503,
      true,
    )
  }
  const reserveFloor = Math.max(
    configuredReserveBytes,
    Math.ceil(filesystemTotalBytes * 0.15),
  )
  const required =
    reserveFloor
    + remainingActiveBytes
    + additionalReservationBytes
    + largestAssemblyBytes
  if (!Number.isSafeInteger(required)) {
    throw new SermonMediaError(
      'CAPACITY_UNAVAILABLE',
      'Recording storage capacity arithmetic overflowed.',
      503,
      true,
    )
  }
  return required
}

export function sermonMediaEnabled() {
  return process.env.HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED === 'true'
}

export function requireSermonMediaEnabled() {
  if (!sermonMediaEnabled()) {
    throw new SermonMediaError(
      'FEATURE_DISABLED',
      'Managed sermon recording uploads are not enabled on this Community server.',
      404,
    )
  }
}

export const SERMON_MEDIA_UPLOAD_STATES = [
  'uploading',
  'finalizing',
  'internal',
  'complete',
  'cancelled',
  'superseded',
  'expired',
] as const

export type SermonMediaUploadState =
  typeof SERMON_MEDIA_UPLOAD_STATES[number]

const EXACT_INIT_KEYS = ['recording', 'schemaVersion', 'sermon']
const EXACT_SERMON_KEYS = [
  'expectedCurrentRevision',
  'expectedSyncVersion',
  'syncId',
]
const EXACT_RECORDING_KEYS = [
  'durationSeconds',
  'fileName',
  'id',
  'kind',
  'language',
  'mediaType',
  'sha256',
  'sizeBytes',
]
const EXACT_COMPLETE_KEYS = ['schemaVersion']
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const IDEMPOTENCY_KEY_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/

type UnknownRecord = Record<string, unknown>

export type SermonMediaRecording = Readonly<{
  id: string
  kind: 'audio'
  language: string
  mediaType: typeof SERMON_MEDIA_ACCEPTED_MEDIA_TYPES[number]
  fileName: string
  sha256: string
  sizeBytes: number
  durationSeconds: number | null
}>

export type SermonMediaBinding = Readonly<{
  syncId: string
  expectedSyncVersion: number
  expectedCurrentRevision: string
}>

export type SermonMediaInitRequest = Readonly<{
  schemaVersion: 1
  sermon: SermonMediaBinding
  recording: SermonMediaRecording
}>

export type SermonMediaChunkHeaders = Readonly<{
  index: number
  startByte: number
  endByte: number
  totalBytes: number
  sizeBytes: number
  sha256: string
}>

export type SermonMediaUploadView = Readonly<{
  id: string
  state: SermonMediaUploadState
  sermon: Readonly<{
    syncId: string
    syncVersion: number
    currentRevision: string
  }>
  recording: SermonMediaRecording
  chunkSizeBytes: number
  chunkCount: number
  receivedChunks: readonly number[]
  receivedBytes: number
  expiresAt: string
  completedAt: string | null
}>

export class SermonMediaError extends Error {
  readonly code: string
  readonly status: number
  readonly retryable: boolean
  readonly retryAfterSeconds: number | null

  constructor(
    code: string,
    message: string,
    status = 400,
    retryable = false,
    retryAfterSeconds: number | null = null,
  ) {
    super(message)
    this.name = 'SermonMediaError'
    this.code = code
    this.status = status
    this.retryable = retryable
    this.retryAfterSeconds = Number.isSafeInteger(retryAfterSeconds)
      && Number(retryAfterSeconds) > 0
      ? Number(retryAfterSeconds)
      : null
  }
}

function fail(
  code: string,
  message: string,
  status = 400,
  retryable = false,
): never {
  throw new SermonMediaError(code, message, status, retryable)
}

function record(value: unknown, field: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_REQUEST', `${field} must be an object.`)
  }
  return value as UnknownRecord
}

function exactKeys(
  value: UnknownRecord,
  expected: readonly string[],
  field: string,
) {
  const actual = Object.keys(value).sort()
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    fail(
      'INVALID_REQUEST',
      `${field} contains unsupported or missing fields.`,
    )
  }
}

function text(
  value: unknown,
  field: string,
  maximum: number,
): string {
  if (typeof value !== 'string') {
    fail('INVALID_REQUEST', `${field} must be text.`)
  }
  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (!normalized) fail('INVALID_REQUEST', `${field} is required.`)
  if (
    normalized.length > maximum
    || normalized.includes('\0')
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    fail('INVALID_REQUEST', `${field} is invalid.`)
  }
  return normalized
}

function identifier(value: unknown, field: string) {
  const normalized = text(value, field, 128)
  if (!ID_PATTERN.test(normalized)) {
    fail('INVALID_REQUEST', `${field} is invalid.`)
  }
  return normalized
}

function digest(value: unknown, field: string) {
  const normalized = text(value, field, 64)
  if (!SHA256_PATTERN.test(normalized)) {
    fail('INVALID_SHA256', `${field} must be a lowercase SHA-256 digest.`)
  }
  return normalized
}

function positiveInteger(
  value: unknown,
  field: string,
  maximum = Number.MAX_SAFE_INTEGER,
) {
  if (
    !Number.isSafeInteger(value)
    || Number(value) < 1
    || Number(value) > maximum
  ) {
    fail('INVALID_REQUEST', `${field} is invalid.`)
  }
  return Number(value)
}

function recording(value: unknown): SermonMediaRecording {
  const raw = record(value, 'recording')
  exactKeys(raw, EXACT_RECORDING_KEYS, 'recording')
  if (raw.kind !== 'audio') {
    fail('INVALID_RECORDING', 'recording.kind must be “audio”.')
  }
  const language = text(raw.language, 'recording.language', 35).toLowerCase()
  if (!LANGUAGE_PATTERN.test(language)) {
    fail(
      'INVALID_RECORDING',
      'recording.language must be a BCP-47-style language tag.',
    )
  }
  const mediaType = text(raw.mediaType, 'recording.mediaType', 200)
  if (
    !SERMON_MEDIA_ACCEPTED_MEDIA_TYPES.includes(
      mediaType as typeof SERMON_MEDIA_ACCEPTED_MEDIA_TYPES[number],
    )
  ) {
    fail(
      'UNSUPPORTED_MEDIA_TYPE',
      'recording.mediaType must be audio/mpeg or audio/mp4.',
      415,
    )
  }
  const fileName = text(raw.fileName, 'recording.fileName', 255)
  if (
    fileName === '.'
    || fileName === '..'
    || fileName.includes('/')
    || fileName.includes('\\')
    || /^[A-Za-z]:/.test(fileName)
  ) {
    fail(
      'INVALID_RECORDING',
      'recording.fileName must be a file name, not a path.',
    )
  }
  const extension = fileName.toLowerCase()
  if (
    (mediaType === 'audio/mpeg' && !extension.endsWith('.mp3'))
    || (
      mediaType === 'audio/mp4'
      && !extension.endsWith('.m4a')
      && !extension.endsWith('.mp4')
    )
  ) {
    fail(
      'MEDIA_TYPE_MISMATCH',
      'recording.fileName extension does not match recording.mediaType.',
      415,
    )
  }
  let durationSeconds: number | null = null
  if (raw.durationSeconds !== null) {
    if (
      typeof raw.durationSeconds !== 'number'
      || !Number.isFinite(raw.durationSeconds)
      || raw.durationSeconds <= 0
    ) {
      fail(
        'INVALID_RECORDING',
        'recording.durationSeconds must be a positive number or null.',
      )
    }
    durationSeconds = raw.durationSeconds
  }
  return Object.freeze({
    id: identifier(raw.id, 'recording.id'),
    kind: 'audio',
    language,
    mediaType:
      mediaType as typeof SERMON_MEDIA_ACCEPTED_MEDIA_TYPES[number],
    fileName,
    sha256: digest(raw.sha256, 'recording.sha256'),
    sizeBytes: positiveInteger(
      raw.sizeBytes,
      'recording.sizeBytes',
      SERMON_MEDIA_MAXIMUM_BYTES,
    ),
    durationSeconds,
  })
}

export function normalizeSermonMediaInitRequest(
  value: unknown,
): SermonMediaInitRequest {
  const raw = record(value, 'Request body')
  exactKeys(raw, EXACT_INIT_KEYS, 'Request body')
  if (raw.schemaVersion !== SERMON_MEDIA_SCHEMA_VERSION) {
    fail(
      'UNSUPPORTED_SCHEMA_VERSION',
      `schemaVersion must be ${SERMON_MEDIA_SCHEMA_VERSION}.`,
    )
  }
  const rawSermon = record(raw.sermon, 'sermon')
  exactKeys(rawSermon, EXACT_SERMON_KEYS, 'sermon')
  return Object.freeze({
    schemaVersion: SERMON_MEDIA_SCHEMA_VERSION,
    sermon: Object.freeze({
      syncId: identifier(rawSermon.syncId, 'sermon.syncId'),
      expectedSyncVersion: positiveInteger(
        rawSermon.expectedSyncVersion,
        'sermon.expectedSyncVersion',
      ),
      expectedCurrentRevision: digest(
        rawSermon.expectedCurrentRevision,
        'sermon.expectedCurrentRevision',
      ),
    }),
    recording: recording(raw.recording),
  })
}

export function normalizeSermonMediaCompleteRequest(value: unknown) {
  const raw = record(value, 'Request body')
  exactKeys(raw, EXACT_COMPLETE_KEYS, 'Request body')
  if (raw.schemaVersion !== SERMON_MEDIA_SCHEMA_VERSION) {
    fail(
      'UNSUPPORTED_SCHEMA_VERSION',
      `schemaVersion must be ${SERMON_MEDIA_SCHEMA_VERSION}.`,
    )
  }
  return Object.freeze({ schemaVersion: SERMON_MEDIA_SCHEMA_VERSION })
}

export function normalizeSermonMediaIdempotencyKey(value: unknown) {
  if (
    typeof value !== 'string'
    || !IDEMPOTENCY_KEY_PATTERN.test(value)
  ) {
    fail(
      value ? 'INVALID_IDEMPOTENCY_KEY' : 'PRECONDITION_REQUIRED',
      value
        ? 'Idempotency-Key is invalid.'
        : 'Idempotency-Key is required.',
      value ? 400 : 428,
    )
  }
  return value
}

export function sermonMediaIdempotencyHash(
  communityId: number,
  operation: string,
  value: unknown,
) {
  const key = normalizeSermonMediaIdempotencyKey(value)
  return createHash('sha256')
    .update('heritage-sermon-media-idempotency-v1\0', 'utf8')
    .update(String(communityId), 'ascii')
    .update('\0', 'utf8')
    .update(operation, 'utf8')
    .update('\0', 'utf8')
    .update(key, 'utf8')
    .digest('hex')
}

export function sermonMediaRequestHash(
  operation: string,
  value: unknown,
) {
  return createHash('sha256')
    .update('heritage-sermon-media-request-v1\0', 'utf8')
    .update(operation, 'utf8')
    .update('\0', 'utf8')
    .update(JSON.stringify(value), 'utf8')
    .digest('hex')
}

export function sermonMediaChunkCount(sizeBytes: number) {
  return Math.ceil(sizeBytes / SERMON_MEDIA_CHUNK_SIZE_BYTES)
}

export function expectedSermonMediaChunk(
  sizeBytes: number,
  index: number,
) {
  const count = sermonMediaChunkCount(sizeBytes)
  if (!Number.isSafeInteger(index) || index < 0 || index >= count) {
    fail(
      'INVALID_CHUNK_INDEX',
      `Chunk index must be between 0 and ${count - 1}.`,
    )
  }
  const startByte = index * SERMON_MEDIA_CHUNK_SIZE_BYTES
  const endByte = Math.min(
    sizeBytes,
    startByte + SERMON_MEDIA_CHUNK_SIZE_BYTES,
  ) - 1
  return Object.freeze({
    index,
    startByte,
    endByte,
    totalBytes: sizeBytes,
    sizeBytes: endByte - startByte + 1,
  })
}

export function normalizeSermonMediaChunkHeaders({
  index,
  contentLength,
  contentRange,
  sha256,
  totalSizeBytes,
}: {
  index: unknown
  contentLength: unknown
  contentRange: unknown
  sha256: unknown
  totalSizeBytes: number
}): SermonMediaChunkHeaders {
  const normalizedIndex = Number(index)
  const expected = expectedSermonMediaChunk(
    totalSizeBytes,
    normalizedIndex,
  )
  if (
    typeof contentLength !== 'string'
    || !/^(0|[1-9]\d*)$/.test(contentLength)
    || Number(contentLength) !== expected.sizeBytes
  ) {
    fail(
      'INVALID_CONTENT_LENGTH',
      `Content-Length must be exactly ${expected.sizeBytes}.`,
      422,
    )
  }
  const range = typeof contentRange === 'string'
    ? /^bytes ([0-9]+)-([0-9]+)\/([0-9]+)$/.exec(contentRange)
    : null
  if (
    !range
    || Number(range[1]) !== expected.startByte
    || Number(range[2]) !== expected.endByte
    || Number(range[3]) !== expected.totalBytes
  ) {
    fail(
      'INVALID_CONTENT_RANGE',
      `Content-Range must be “bytes ${expected.startByte}-${expected.endByte}/${expected.totalBytes}”.`,
      422,
    )
  }
  return Object.freeze({
    ...expected,
    sha256: digest(sha256, 'X-Content-SHA256'),
  })
}

export function exactSermonMediaSlot(
  documentSource: unknown,
  requested: SermonMediaRecording,
) {
  let parsed: unknown
  try {
    parsed = JSON.parse(String(documentSource || ''))
  } catch {
    fail(
      'INVALID_SERMON_STATE',
      'The canonical sermon document is not valid JSON.',
      500,
    )
  }
  let document: CanonicalSermonDocument
  try {
    document = normalizeSermonDocument(parsed)
  } catch {
    fail(
      'INVALID_SERMON_STATE',
      'The canonical sermon document is invalid.',
      500,
    )
  }
  const candidates = document.media.filter(media => media.id === requested.id)
  if (candidates.length !== 1) {
    fail(
      'MEDIA_SLOT_NOT_FOUND',
      'The current sermon does not contain the requested recording slot.',
      409,
    )
  }
  const media = candidates[0]
  const matches =
    media.kind === requested.kind
    && media.language === requested.language
    && media.mediaType === requested.mediaType
    && media.fileName === requested.fileName
    && media.sha256 === requested.sha256
    && media.sizeBytes === requested.sizeBytes
    && media.durationSeconds === requested.durationSeconds
    && media.url === null
  if (!matches) {
    fail(
      'MEDIA_SLOT_CONFLICT',
      'The current sermon recording slot does not exactly match this upload.',
      409,
    )
  }
  return media
}

export function assertSermonMediaBinding(
  sermon: UnknownRecord,
  binding: SermonMediaBinding,
  requested: SermonMediaRecording,
) {
  if (
    String(sermon.syncId || '') !== binding.syncId
    || Number(sermon.syncVersion) !== binding.expectedSyncVersion
    || String(sermon.syncCurrentRevision || '')
      !== binding.expectedCurrentRevision
  ) {
    fail(
      'STALE_SERMON_BINDING',
      'The sermon or recording no longer matches this upload.',
      412,
    )
  }
  if (sermon.syncArchived === true) {
    fail(
      'SERMON_ARCHIVED',
      'Archived sermons cannot accept recording uploads.',
      409,
    )
  }
  exactSermonMediaSlot(sermon.syncCurrentDocumentSource, requested)
}

export function uploadStateAllowsChunks(state: SermonMediaUploadState) {
  return state === 'uploading'
}

export function uploadStateIsTerminal(state: SermonMediaUploadState) {
  return [
    'internal',
    'complete',
    'cancelled',
    'superseded',
    'expired',
  ].includes(state)
}

export function sermonMediaSessionExpired(
  expiresAt: unknown,
  now = new Date(),
) {
  const timestamp = Date.parse(String(expiresAt || ''))
  return !Number.isFinite(timestamp) || timestamp <= now.getTime()
}

export function sermonMediaErrorEnvelope(error: SermonMediaError) {
  return {
    schemaVersion: SERMON_MEDIA_SCHEMA_VERSION,
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    },
  }
}
