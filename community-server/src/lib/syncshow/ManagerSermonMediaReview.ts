import type { CanonicalSermonDocument } from './SermonDocument.ts'
import { sermonMediaCommunityNamespace } from './SermonMediaStore.ts'
import {
  sermonMediaObjectKey,
  type StoredSermonMediaObject,
} from './SermonMediaStorage.ts'

const SYNC_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const UPLOAD_ID_PATTERN = /^[A-Za-z0-9_-]{32,128}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/
const MEDIA_TYPES = new Set(['audio/mpeg', 'audio/mp4'])
const MAXIMUM_BYTES = 1_073_741_824

type UnknownRecord = Record<string, unknown>

export type ManagerSermonRecording = Readonly<{
  reviewId: string
  slotId: string
  title: string
  language: string
  mediaType: 'audio/mpeg' | 'audio/mp4'
  fileName: string
  sha256: string
  sizeBytes: number
  durationSeconds: number | null
  completedAt: string
  eligibility: 'publishable' | 'review-only'
}>

export type ManagerSermonRecordingAuthority = Readonly<{
  recording: ManagerSermonRecording
  object: StoredSermonMediaObject
}>

export class ManagerSermonMediaReviewError extends Error {
  code: string
  status: number
  headers: Readonly<Record<string, string>>

  constructor(
    code: string,
    message: string,
    status = 500,
    headers: Readonly<Record<string, string>> = {},
  ) {
    super(message)
    this.name = 'ManagerSermonMediaReviewError'
    this.code = code
    this.status = status
    this.headers = Object.freeze({ ...headers })
  }
}

function invalidState(message: string): never {
  throw new ManagerSermonMediaReviewError(
    'INVALID_MANAGED_RECORDING_STATE',
    message,
    500,
  )
}

function integer(value: unknown, label: string, minimum = 1): number {
  const result = Number(value)
  if (!Number.isSafeInteger(result) || result < minimum) {
    invalidState(`${label} is invalid.`)
  }
  return result
}

function timestamp(value: unknown, label: string): string {
  const result = value instanceof Date ? value.toISOString() : String(value || '')
  const parsed = new Date(result)
  if (!result || !Number.isFinite(parsed.getTime())) invalidState(`${label} is invalid.`)
  return parsed.toISOString()
}

function safeFileName(value: unknown): string {
  const result = String(value || '')
  if (
    !result
    || result.length > 255
    || result === '.'
    || result === '..'
    || /[\\/\u0000-\u001f\u007f]/.test(result)
  ) {
    invalidState('Stored recording file name is invalid.')
  }
  return result
}

function nullableDuration(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const result = Number(value)
  if (!Number.isFinite(result) || result <= 0) {
    invalidState('Stored recording duration is invalid.')
  }
  return result
}

export function managerSermonRecordingReviewId(value: unknown): string {
  const result = String(value || '')
  if (!UPLOAD_ID_PATTERN.test(result)) {
    throw new ManagerSermonMediaReviewError(
      'MANAGED_RECORDING_NOT_FOUND',
      'Managed recording not found.',
      404,
    )
  }
  return result
}

export function normalizeManagerSermonRecording(
  row: UnknownRecord,
  current: Readonly<{
    syncId: string
    syncVersion: number
    currentRevision: string
    communityId: number
    sermonId: number
    archived: boolean
    document: CanonicalSermonDocument
  }>,
): ManagerSermonRecordingAuthority {
  const reviewId = managerSermonRecordingReviewId(row.uploadId)
  const schemaVersion = integer(row.schemaVersion, 'Stored recording schema')
  const objectId = integer(row.objectId, 'Stored recording object relation')
  const objectRowId = integer(row.objectRowId, 'Stored recording object identity')
  const sermonId = integer(row.sermonId, 'Stored recording sermon identity')
  const state = String(row.state || '')
  const syncId = String(row.syncId || '')
  const expectedSyncVersion = integer(
    row.expectedSyncVersion,
    'Stored recording sermon version',
  )
  const expectedCurrentRevision = String(row.expectedCurrentRevision || '')
  const slotId = String(row.recordingId || '')
  const language = String(row.language || '')
  const mediaType = String(row.mediaType || '')
  const fileName = safeFileName(row.fileName)
  const sha256 = String(row.sha256 || '')
  const sizeBytes = integer(row.sizeBytes, 'Stored recording size')
  const durationSeconds = nullableDuration(row.durationSeconds)
  const completedAt = timestamp(row.completedAt, 'Stored recording completion time')
  const objectCommunityId = integer(
    row.objectCommunityId,
    'Stored recording object Community',
  )
  const uploadCommunityId = integer(
    row.uploadCommunityId,
    'Stored recording upload Community',
  )
  const objectSha256 = String(row.objectSha256 || '')
  const objectSizeBytes = integer(row.objectSizeBytes, 'Stored recording object size')
  const objectMediaType = String(row.objectMediaType || '')
  const storageKey = String(row.storageKey || '')

  if (
    !['complete', 'superseded'].includes(state)
    || schemaVersion !== 1
    || objectId !== objectRowId
    || sermonId !== current.sermonId
    || !SYNC_ID_PATTERN.test(syncId)
    || syncId !== current.syncId
    || !SHA256_PATTERN.test(expectedCurrentRevision)
    || !SYNC_ID_PATTERN.test(slotId)
    || String(row.kind || '') !== 'audio'
    || !LANGUAGE_PATTERN.test(language)
    || !MEDIA_TYPES.has(mediaType)
    || !SHA256_PATTERN.test(sha256)
    || sizeBytes > MAXIMUM_BYTES
    || uploadCommunityId !== current.communityId
    || uploadCommunityId !== objectCommunityId
    || objectSha256 !== sha256
    || objectSizeBytes !== sizeBytes
    || objectMediaType !== mediaType
    || storageKey !== sermonMediaObjectKey(
      sermonMediaCommunityNamespace(current.communityId),
      sha256,
    )
  ) {
    invalidState('Stored managed recording identity is inconsistent.')
  }

  const matchesCurrentSlot = current.document.media.some(media => (
    media.id === slotId
    && media.kind === 'audio'
    && media.language === language
    && media.mediaType === mediaType
    && media.fileName === fileName
    && media.sha256 === sha256
    && media.sizeBytes === sizeBytes
    && media.durationSeconds === durationSeconds
    && media.url === null
  ))
  const currentSlot = current.document.media.find(media => media.id === slotId)
  const eligibility = state === 'complete'
    && !current.archived
    && expectedSyncVersion === current.syncVersion
    && expectedCurrentRevision === current.currentRevision
    && matchesCurrentSlot
      ? 'publishable'
      : 'review-only'

  return Object.freeze({
    recording: Object.freeze({
      reviewId,
      slotId,
      title: matchesCurrentSlot ? currentSlot?.title || fileName : fileName,
      language,
      mediaType: mediaType as ManagerSermonRecording['mediaType'],
      fileName,
      sha256,
      sizeBytes,
      durationSeconds,
      completedAt,
      eligibility,
    }),
    object: Object.freeze({ storageKey, sha256, sizeBytes }),
  })
}

export type ManagerSermonRecordingByteRange = Readonly<{
  startByte: number
  endByte: number
}>

export function managerSermonRecordingByteRange(
  value: string | null,
  sizeBytes: number,
): ManagerSermonRecordingByteRange | null {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1) {
    invalidState('Stored recording size is invalid.')
  }
  if (value === null) return null
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value)
  if (!match) {
    // Unsupported range units and multi-range requests are ignored so the
    // caller can return the complete private object. This endpoint supports
    // exactly one byte range, which is sufficient for browser audio seeking.
    return null
  }
  if (!match[1] && !match[2]) {
    throw new ManagerSermonMediaReviewError(
      'RANGE_NOT_SATISFIABLE',
      'The requested recording byte range is not satisfiable.',
      416,
      { 'Content-Range': `bytes */${sizeBytes}` },
    )
  }

  let startByte: number
  let endByte: number
  if (!match[1]) {
    const suffixLength = Number(match[2])
    if (!Number.isSafeInteger(suffixLength) || suffixLength < 1) {
      throw new ManagerSermonMediaReviewError(
        'RANGE_NOT_SATISFIABLE',
        'The requested recording byte range is not satisfiable.',
        416,
        { 'Content-Range': `bytes */${sizeBytes}` },
      )
    }
    startByte = Math.max(0, sizeBytes - suffixLength)
    endByte = sizeBytes - 1
  } else {
    startByte = Number(match[1])
    endByte = match[2] ? Number(match[2]) : sizeBytes - 1
    if (endByte >= sizeBytes) endByte = sizeBytes - 1
  }
  if (
    !Number.isSafeInteger(startByte)
    || !Number.isSafeInteger(endByte)
    || startByte < 0
    || startByte >= sizeBytes
    || endByte < startByte
  ) {
    throw new ManagerSermonMediaReviewError(
      'RANGE_NOT_SATISFIABLE',
      'The requested recording byte range is not satisfiable.',
      416,
      { 'Content-Range': `bytes */${sizeBytes}` },
    )
  }
  return Object.freeze({ startByte, endByte })
}

export function managerSermonRecordingContentDisposition(
  disposition: 'inline' | 'attachment',
  fileName: string,
) {
  const safe = safeFileName(fileName)
  const fallback = safe
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(safe).replace(/[!'()*]/g, character =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`
}
