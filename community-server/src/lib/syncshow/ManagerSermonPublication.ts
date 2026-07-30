import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import {
  MAX_SERMON_BODY_ENTRIES,
  MAX_SERMON_SOURCE_BYTES,
  normalizeSermonDocument,
  parseSermonDocument,
  serializeSermonDocument,
  type CanonicalSermonDocument,
} from './SermonDocument.ts'
import {
  MAX_PUBLIC_SERMON_MEDIA,
  PublicSermonPublicationError,
  buildPublicSermonProjection,
  derivePublicSermonId,
  serializePublicSermonCatalogItem,
  type StoredPublicSermonPublication,
} from './PublicSermonPublication.ts'

export const MANAGER_SERMON_PUBLICATION_SCHEMA_VERSION = 1
export const MANAGER_SERMON_PUBLISH_INTENT_SCHEMA_VERSION = 2
export const MAX_MANAGER_SERMON_PUBLICATION_REQUEST_BYTES = 128 * 1024

const SYNC_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const PUBLIC_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,95}$/
const PUBLISH_INTENT_V1_KEYS = [
  'schemaVersion',
  'action',
  'syncId',
  'expectedSyncVersion',
  'expectedCurrentRevision',
  'expectedPublicationVersion',
  'expectedPublicRevision',
  'selectedBodyEntryIds',
  'selectedMediaIds',
  'publicAudienceConfirmed',
  'canonicalLinkConfirmed',
]
const PUBLISH_INTENT_V2_KEYS = [
  ...PUBLISH_INTENT_V1_KEYS,
  'directAudio',
  'recordingRightsAndPrivacyConfirmed',
]
const DIRECT_AUDIO_KEYS = [
  'url',
  'title',
  'language',
  'mediaType',
  'durationSeconds',
]
const WITHDRAW_INTENT_KEYS = [
  'schemaVersion',
  'action',
  'syncId',
  'expectedSyncVersion',
  'expectedCurrentRevision',
  'expectedPublicationVersion',
  'expectedPublicRevision',
]
const STORED_PUBLICATION_KEYS = [
  'schemaVersion',
  'active',
  'visibility',
  'publicationVersion',
  'publishedAt',
  'withdrawnAt',
  'syncId',
  'publicId',
  'publicRevision',
  'publishedDocumentSource',
  'selectedBodyEntryIds',
  'selectedMediaIds',
  'detailChecksum',
  'detailSource',
  'catalogItemChecksum',
  'catalogItemSource',
]

type MutableRecord = Record<string, any>

export type ManagerDirectAudio = Readonly<{
  url: string
  title: string
  language: string
  mediaType: 'audio/mpeg' | 'audio/mp4' | 'audio/ogg' | 'audio/webm' | 'audio/wav'
  durationSeconds: number | null
}>

export type ManagerSermonPublishIntentV1 = Readonly<{
  schemaVersion: 1
  action: 'publish'
  syncId: string
  expectedSyncVersion: number
  expectedCurrentRevision: string
  expectedPublicationVersion: number | null
  expectedPublicRevision: string | null
  selectedBodyEntryIds: readonly string[]
  selectedMediaIds: readonly string[]
  publicAudienceConfirmed: true
  canonicalLinkConfirmed: true
}>

export type ManagerSermonPublishIntentV2 = Readonly<{
  schemaVersion: 2
  action: 'publish'
  syncId: string
  expectedSyncVersion: number
  expectedCurrentRevision: string
  expectedPublicationVersion: number | null
  expectedPublicRevision: string | null
  selectedBodyEntryIds: readonly string[]
  selectedMediaIds: readonly string[]
  publicAudienceConfirmed: true
  canonicalLinkConfirmed: true
  directAudio: ManagerDirectAudio
  recordingRightsAndPrivacyConfirmed: true
}>

export type ManagerSermonPublishIntent =
  | ManagerSermonPublishIntentV1
  | ManagerSermonPublishIntentV2

export type ManagerSermonWithdrawIntent = Readonly<{
  schemaVersion: 1
  action: 'withdraw'
  syncId: string
  expectedSyncVersion: number
  expectedCurrentRevision: string
  expectedPublicationVersion: number
  expectedPublicRevision: string
}>

export type StoredManagerSermonPublication = Readonly<{
  schemaVersion: 1
  active: boolean
  visibility: 'public'
  publicationVersion: number
  publishedAt: string
  withdrawnAt: string | null
  syncId: string
  publicId: string
  publicRevision: string
  publishedDocumentSource: string
  selectedBodyEntryIds: readonly string[]
  selectedMediaIds: readonly string[]
  detailChecksum: string
  detailSource: string
  catalogItemChecksum: string
  catalogItemSource: string
}>

export class ManagerSermonPublicationError extends Error {
  code: string
  details: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message)
    this.name = 'ManagerSermonPublicationError'
    this.code = code
    this.details = details
  }
}

function fail(
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): never {
  throw new ManagerSermonPublicationError(code, message, details)
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  return Object.freeze(value)
}

function isPlainRecord(value: unknown): value is MutableRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertExactKeys(
  value: unknown,
  expectedKeys: string[],
  label: string,
  code: string,
): asserts value is MutableRecord {
  if (!isPlainRecord(value)) fail(code, `${label} must be a plain object.`)
  const expected = new Set(expectedKeys)
  for (const key of expectedKeys) {
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

function protocolText(
  value: unknown,
  label: string,
  maximumBytes: number,
  pattern: RegExp,
  code: string,
): string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || Buffer.byteLength(value, 'utf8') > maximumBytes
    || /[\u0000-\u001f\u007f]/u.test(value)
    || !pattern.test(value)
  ) {
    fail(code, `${label} is invalid.`)
  }
  return value
}

const DIRECT_AUDIO_MEDIA_TYPES = new Set<ManagerDirectAudio['mediaType']>([
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
])
const DIRECT_AUDIO_LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/
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

function normalizedIntentText(
  value: unknown,
  label: string,
  maximumBytes: number,
  code: string,
): string {
  if (typeof value !== 'string') fail(code, `${label} must be text.`)
  const normalized = value.trim().normalize('NFC')
  if (
    normalized.length === 0
    || Buffer.byteLength(normalized, 'utf8') > maximumBytes
    || /[\u0000-\u001f\u007f]/u.test(normalized)
  ) {
    fail(code, `${label} is invalid.`)
  }
  return normalized
}

function normalizeManagerDirectAudioUrl(value: unknown, code: string): string {
  const normalized = normalizedIntentText(
    value,
    'Direct recording URL',
    2048,
    code,
  )
  if (normalized.includes('\\')) {
    fail(code, 'Direct recording URL must be a normal HTTPS URL.')
  }
  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    fail(code, 'Direct recording URL must be a complete HTTPS URL.')
  }
  const hostname = parsed.hostname
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .toLowerCase()
  if (
    parsed.protocol !== 'https:'
    || !hostname
    || parsed.username
    || parsed.password
    || parsed.hash
    || parsed.search
    || parsed.port
    || parsed.pathname === '/'
    || parsed.pathname.endsWith('/')
    || hostname.endsWith('.')
    || !hostname.includes('.')
    || isIP(hostname) !== 0
    || hostname === 'localhost'
    || NONPUBLIC_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix))
  ) {
    fail(
      code,
      'Direct recording URL must be a stable public HTTPS file URL without credentials, a query string, fragment, private host, or nonstandard port.',
    )
  }
  const canonical = parsed.toString()
  if (canonical.length > 2048 || Buffer.byteLength(canonical, 'utf8') > 2048) {
    fail(code, 'Direct recording URL must be 2048 characters or fewer after normalization.')
  }
  return canonical
}

export function normalizeManagerDirectAudio(
  value: unknown,
  code = 'INVALID_PUBLICATION_INTENT',
): ManagerDirectAudio | null {
  if (value === null) return null
  assertExactKeys(value, DIRECT_AUDIO_KEYS, 'Direct recording', code)
  const title = normalizedIntentText(value.title, 'Direct recording title', 1200, code)
  if (title.length > 300) {
    fail(code, 'Direct recording title must be 300 characters or fewer.')
  }
  const language = normalizedIntentText(
    value.language,
    'Direct recording language',
    35,
    code,
  ).toLowerCase()
  if (!DIRECT_AUDIO_LANGUAGE_PATTERN.test(language)) {
    fail(code, 'Direct recording language must be a BCP-47-style language tag.')
  }
  if (
    typeof value.mediaType !== 'string'
    || !DIRECT_AUDIO_MEDIA_TYPES.has(value.mediaType as ManagerDirectAudio['mediaType'])
  ) {
    fail(code, 'Direct recording media type is unsupported.')
  }
  const durationSeconds = value.durationSeconds === null
    ? null
    : value.durationSeconds
  if (
    durationSeconds !== null
    && (
      typeof durationSeconds !== 'number'
      || !Number.isFinite(durationSeconds)
      || durationSeconds <= 0
    )
  ) {
    fail(code, 'Direct recording duration must be a positive finite number or null.')
  }
  return deepFreeze({
    url: normalizeManagerDirectAudioUrl(value.url, code),
    title,
    language,
    mediaType: value.mediaType as ManagerDirectAudio['mediaType'],
    durationSeconds,
  })
}

export function deriveManagerDirectAudioId(audio: ManagerDirectAudio): string {
  const normalized = normalizeManagerDirectAudio(audio, 'INVALID_DIRECT_AUDIO')
  if (!normalized) fail('INVALID_DIRECT_AUDIO', 'Direct recording is required.')
  return `community-direct-audio:${sha256(
    `heritage-community-direct-audio-v1\0${normalized.url}`,
  )}`
}

function normalizeSyncId(value: unknown, code: string): string {
  return protocolText(value, 'Sermon sync ID', 128, SYNC_ID_PATTERN, code)
}

function normalizeSha256(value: unknown, label: string, code: string): string {
  return protocolText(value, label, 64, SHA256_PATTERN, code)
}

function normalizePositiveVersion(
  value: unknown,
  label: string,
  code: string,
  nullable = false,
): number | null {
  if (nullable && value === null) return null
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    fail(code, `${label} must be a positive safe integer${nullable ? ' or null' : ''}.`)
  }
  return value as number
}

function normalizeNullableSha256(
  value: unknown,
  label: string,
  code: string,
): string | null {
  return value === null ? null : normalizeSha256(value, label, code)
}

function normalizeSelectionIds(
  value: unknown,
  label: string,
  maximum: number,
  code: string,
): string[] {
  if (!Array.isArray(value) || value.length > maximum) {
    fail(code, `${label} must contain at most ${maximum} IDs.`)
  }
  const seen = new Set<string>()
  return value.map((rawId, index) => {
    const id = protocolText(
      rawId,
      `${label} item ${index + 1}`,
      128,
      SYNC_ID_PATTERN,
      code,
    )
    if (seen.has(id)) fail(code, `${label} repeats an ID.`, { id })
    seen.add(id)
    return id
  })
}

function normalizeExpectedPointer(
  value: MutableRecord,
  code: string,
  requireActive: boolean,
) {
  const expectedPublicationVersion = normalizePositiveVersion(
    value.expectedPublicationVersion,
    'Expected publication version',
    code,
    true,
  )
  const expectedPublicRevision = normalizeNullableSha256(
    value.expectedPublicRevision,
    'Expected public revision',
    code,
  )
  if ((expectedPublicationVersion === null) !== (expectedPublicRevision === null)) {
    fail(
      code,
      'Expected publication version and public revision must both be null or both be present.',
    )
  }
  if (requireActive && expectedPublicationVersion === null) {
    fail(code, 'Withdrawal requires an active publication pointer.')
  }
  return { expectedPublicationVersion, expectedPublicRevision }
}

export function normalizeManagerSermonPublishIntent(
  value: unknown,
): ManagerSermonPublishIntent {
  const code = 'INVALID_PUBLICATION_INTENT'
  if (!isPlainRecord(value)) {
    fail(code, 'Sermon publish intent must be a plain object.')
  }
  if (
    value.schemaVersion !== MANAGER_SERMON_PUBLICATION_SCHEMA_VERSION
    && value.schemaVersion !== MANAGER_SERMON_PUBLISH_INTENT_SCHEMA_VERSION
  ) {
    fail(code, 'Sermon publish intent uses an unsupported schema version.')
  }
  assertExactKeys(
    value,
    value.schemaVersion === MANAGER_SERMON_PUBLICATION_SCHEMA_VERSION
      ? PUBLISH_INTENT_V1_KEYS
      : PUBLISH_INTENT_V2_KEYS,
    'Sermon publish intent',
    code,
  )
  if (value.action !== 'publish') fail(code, 'Sermon publish action must be publish.')
  if (value.publicAudienceConfirmed !== true || value.canonicalLinkConfirmed !== true) {
    fail(
      code,
      'Publishing requires explicit public-audience and canonical-link confirmation.',
    )
  }
  const pointer = normalizeExpectedPointer(value, code, false)
  const common = {
    action: 'publish',
    syncId: normalizeSyncId(value.syncId, code),
    expectedSyncVersion: normalizePositiveVersion(
      value.expectedSyncVersion,
      'Expected sermon sync version',
      code,
    )!,
    expectedCurrentRevision: normalizeSha256(
      value.expectedCurrentRevision,
      'Expected current sermon revision',
      code,
    ),
    expectedPublicationVersion: pointer.expectedPublicationVersion,
    expectedPublicRevision: pointer.expectedPublicRevision,
    selectedBodyEntryIds: normalizeSelectionIds(
      value.selectedBodyEntryIds,
      'Selected public body entries',
      MAX_SERMON_BODY_ENTRIES,
      code,
    ),
    selectedMediaIds: normalizeSelectionIds(
      value.selectedMediaIds,
      'Selected public media',
      MAX_PUBLIC_SERMON_MEDIA,
      code,
    ),
    publicAudienceConfirmed: true,
    canonicalLinkConfirmed: true,
  } as const
  if (value.schemaVersion === MANAGER_SERMON_PUBLICATION_SCHEMA_VERSION) {
    return deepFreeze({
      schemaVersion: 1,
      ...common,
    })
  }
  const directAudio = normalizeManagerDirectAudio(value.directAudio, code)
  if (directAudio === null) {
    fail(code, 'Version 2 publication intent must supply a direct recording.')
  }
  if (value.recordingRightsAndPrivacyConfirmed !== true) {
    fail(
      code,
      'Direct recording rights and privacy must be confirmed before publication.',
    )
  }
  if (common.selectedBodyEntryIds.length === 0) {
    fail(
      code,
      'Publishing a direct recording requires at least one selected written sermon section for accessible review.',
    )
  }
  return deepFreeze({
    schemaVersion: 2,
    ...common,
    directAudio,
    recordingRightsAndPrivacyConfirmed: true as const,
  })
}

export function normalizeManagerSermonWithdrawIntent(
  value: unknown,
): ManagerSermonWithdrawIntent {
  const code = 'INVALID_PUBLICATION_INTENT'
  assertExactKeys(value, WITHDRAW_INTENT_KEYS, 'Sermon withdraw intent', code)
  if (value.schemaVersion !== MANAGER_SERMON_PUBLICATION_SCHEMA_VERSION) {
    fail(code, 'Sermon withdraw intent uses an unsupported schema version.')
  }
  if (value.action !== 'withdraw') fail(code, 'Sermon withdraw action must be withdraw.')
  const pointer = normalizeExpectedPointer(value, code, true)
  return deepFreeze({
    schemaVersion: 1,
    action: 'withdraw',
    syncId: normalizeSyncId(value.syncId, code),
    expectedSyncVersion: normalizePositiveVersion(
      value.expectedSyncVersion,
      'Expected sermon sync version',
      code,
    )!,
    expectedCurrentRevision: normalizeSha256(
      value.expectedCurrentRevision,
      'Expected current sermon revision',
      code,
    ),
    expectedPublicationVersion: pointer.expectedPublicationVersion!,
    expectedPublicRevision: pointer.expectedPublicRevision!,
  })
}

function canonicalTimestamp(value: unknown, label: string, code: string): string {
  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    || !Number.isFinite(Date.parse(value))
  ) {
    fail(code, `${label} must be a canonical UTC timestamp.`)
  }
  let canonical = ''
  try {
    canonical = new Date(value).toISOString()
  } catch {
    canonical = ''
  }
  if (canonical !== value) fail(code, `${label} must be a canonical UTC timestamp.`)
  return value
}

function sha256(source: string): string {
  return createHash('sha256').update(source, 'utf8').digest('hex')
}

function orderedSelections(
  document: CanonicalSermonDocument,
  bodyIds: readonly string[],
  mediaIds: readonly string[],
) {
  const body = new Set(bodyIds)
  const media = new Set(mediaIds)
  return {
    selectedBodyEntryIds: (document.body || [])
      .filter(entry => body.has(entry.id))
      .map(entry => entry.id),
    selectedMediaIds: document.media
      .filter(entry => media.has(entry.id))
      .map(entry => entry.id),
  }
}

function directAudioMedia(audio: ManagerDirectAudio) {
  return {
    id: deriveManagerDirectAudioId(audio),
    kind: 'audio' as const,
    status: 'ready' as const,
    title: audio.title,
    language: audio.language,
    mediaType: audio.mediaType,
    fileName: null,
    sha256: null,
    sizeBytes: null,
    durationSeconds: audio.durationSeconds,
    url: audio.url,
  }
}

function sameDirectAudioMedia(
  left: CanonicalSermonDocument['media'][number],
  right: ReturnType<typeof directAudioMedia>,
): boolean {
  return left.id === right.id
    && left.kind === right.kind
    && left.status === right.status
    && left.title === right.title
    && left.language === right.language
    && left.mediaType === right.mediaType
    && left.fileName === null
    && left.sha256 === null
    && left.sizeBytes === null
    && left.durationSeconds === right.durationSeconds
    && left.url === right.url
}

function isReplaceableDirectAudioMedia(
  current: CanonicalSermonDocument['media'][number],
  proposed: ReturnType<typeof directAudioMedia>,
): boolean {
  return current.id === proposed.id
    && current.kind === 'audio'
    && current.status === 'ready'
    && current.url === proposed.url
    && current.fileName === null
    && current.sha256 === null
    && current.sizeBytes === null
    && DIRECT_AUDIO_MEDIA_TYPES.has(
      current.mediaType as ManagerDirectAudio['mediaType'],
    )
}

function withManagerDirectAudio(
  document: CanonicalSermonDocument,
  audio: ManagerDirectAudio,
): { document: CanonicalSermonDocument; mediaId: string } {
  const media = directAudioMedia(audio)
  const sameId = document.media.find(candidate => candidate.id === media.id)
  if (sameId) {
    const duplicateUrl = document.media.find(candidate => (
      candidate.id !== media.id && candidate.url === media.url
    ))
    if (duplicateUrl) {
      fail(
        'DIRECT_AUDIO_URL_CONFLICT',
        'This recording URL already exists under a different media ID. Select that reviewed media item instead.',
        { mediaId: duplicateUrl.id },
      )
    }
    if (sameDirectAudioMedia(sameId, media)) {
      return { document, mediaId: media.id }
    }
    if (!isReplaceableDirectAudioMedia(sameId, media)) {
      fail(
        'DIRECT_AUDIO_ID_CONFLICT',
        'The deterministic direct recording ID already belongs to different media.',
        { mediaId: media.id },
      )
    }
    return {
      document: normalizeSermonDocument({
        ...document,
        media: document.media.map(candidate => (
          candidate.id === media.id ? media : candidate
        )),
      }),
      mediaId: media.id,
    }
  }
  const sameUrl = document.media.find(candidate => candidate.url === media.url)
  if (sameUrl) {
    fail(
      'DIRECT_AUDIO_URL_CONFLICT',
      'This recording URL already exists under a different media ID. Select that reviewed media item instead.',
      { mediaId: sameUrl.id },
    )
  }
  return {
    document: normalizeSermonDocument({
      ...document,
      media: [...document.media, media],
    }),
    mediaId: media.id,
  }
}

export function nextCanonicalPublicationTime(
  previousPublishedAt: string | null,
  now = new Date(),
): string {
  const nowMs = now.getTime()
  if (!Number.isFinite(nowMs)) {
    fail('INVALID_PUBLICATION_TIMESTAMP', 'Publication clock returned an invalid time.')
  }
  const previousMs = previousPublishedAt === null ? Number.NEGATIVE_INFINITY : Date.parse(
    canonicalTimestamp(
      previousPublishedAt,
      'Previous publication time',
      'INVALID_STORED_PUBLICATION',
    ),
  )
  return new Date(Math.max(nowMs, previousMs + 1)).toISOString()
}

export function buildManagerSermonPublicationTransition(options: {
  documentSource: string
  publishedAt: string
  selectedBodyEntryIds: readonly string[]
  selectedMediaIds: readonly string[]
  directAudio?: ManagerDirectAudio | null
}) {
  const optionKeys = isPlainRecord(options)
    ? Object.keys(options).sort().join('\0')
    : ''
  if (
    !isPlainRecord(options)
    || ![
      [
        'documentSource',
        'publishedAt',
        'selectedBodyEntryIds',
        'selectedMediaIds',
      ].sort().join('\0'),
      [
        'documentSource',
        'publishedAt',
        'selectedBodyEntryIds',
        'selectedMediaIds',
        'directAudio',
      ].sort().join('\0'),
    ].includes(optionKeys)
    || typeof options.documentSource !== 'string'
    || Buffer.byteLength(options.documentSource, 'utf8') > MAX_SERMON_SOURCE_BYTES
  ) {
    fail(
      'INVALID_PUBLICATION_TRANSITION',
      'Publication transition input is invalid.',
    )
  }
  let readyDocument: CanonicalSermonDocument
  try {
    readyDocument = parseSermonDocument(options.documentSource)
  } catch {
    fail(
      'INVALID_PUBLICATION_DOCUMENT',
      'Publication input is not a valid canonical sermon.',
    )
  }
  if (serializeSermonDocument(readyDocument) !== options.documentSource) {
    fail(
      'NONCANONICAL_PUBLICATION_DOCUMENT',
      'Publication input must use exact canonical sermon bytes.',
    )
  }
  if (readyDocument.publication.status !== 'ready') {
    fail(
      'SERMON_NOT_READY',
      'Only an exact Ready sermon revision can be published.',
      { actualStatus: readyDocument.publication.status },
    )
  }
  const publishedAt = canonicalTimestamp(
    options.publishedAt,
    'Publication time',
    'INVALID_PUBLICATION_TIMESTAMP',
  )
  let sourceDocument = readyDocument
  let selectedMediaIds = [...options.selectedMediaIds]
  const suppliedDirectAudio = Object.prototype.hasOwnProperty.call(options, 'directAudio')
    ? normalizeManagerDirectAudio(
        options.directAudio,
        'INVALID_PUBLICATION_TRANSITION',
      )
    : null
  if (suppliedDirectAudio) {
    const merged = withManagerDirectAudio(sourceDocument, suppliedDirectAudio)
    sourceDocument = merged.document
    if (!selectedMediaIds.includes(merged.mediaId)) {
      if (selectedMediaIds.length >= MAX_PUBLIC_SERMON_MEDIA) {
        fail(
          'TOO_MANY_PUBLIC_MEDIA',
          `Publishing the direct recording would exceed ${MAX_PUBLIC_SERMON_MEDIA} selected media items.`,
        )
      }
      selectedMediaIds.push(merged.mediaId)
    }
  }
  const selectedMedia = new Set(selectedMediaIds)
  const includesPublicAudio = sourceDocument.media.some(media => (
    selectedMedia.has(media.id) && media.kind === 'audio'
  ))
  if (includesPublicAudio && options.selectedBodyEntryIds.length === 0) {
    fail(
      'PUBLIC_AUDIO_REQUIRES_WRITTEN_ALTERNATIVE',
      'Publishing audio requires at least one selected written sermon section for accessible review.',
    )
  }
  const document = normalizeSermonDocument({
    ...sourceDocument,
    publication: {
      ...readyDocument.publication,
      status: 'published',
      visibility: 'public',
      publishedAt,
    },
  })
  const documentSource = serializeSermonDocument(document)
  if (Buffer.byteLength(documentSource, 'utf8') > MAX_SERMON_SOURCE_BYTES) {
    fail(
      'PUBLICATION_DOCUMENT_TOO_LARGE',
      'Adding the direct recording would exceed the canonical sermon size limit.',
    )
  }
  const publicRevision = sha256(documentSource)
  let projection: ReturnType<typeof buildPublicSermonProjection>
  try {
    projection = buildPublicSermonProjection({
      documentSource,
      publicRevision,
      selectedBodyEntryIds: options.selectedBodyEntryIds,
      selectedMediaIds,
    })
  } catch (error) {
    if (error instanceof PublicSermonPublicationError) {
      fail(error.code, error.message, error.details)
    }
    throw error
  }
  const selection = orderedSelections(
    document,
    options.selectedBodyEntryIds,
    selectedMediaIds,
  )
  return deepFreeze({
    document,
    documentSource,
    publicRevision,
    projection,
    ...selection,
  })
}

export function publicationFieldsFromPayload(raw: unknown): MutableRecord {
  if (!isPlainRecord(raw)) {
    fail('INVALID_STORED_PUBLICATION', 'Stored publication row is invalid.')
  }
  const publishedAt = raw.publishedAt instanceof Date
    ? raw.publishedAt.toISOString()
    : raw.publishedAt
  const withdrawnAt = raw.withdrawnAt instanceof Date
    ? raw.withdrawnAt.toISOString()
    : raw.withdrawnAt ?? null
  return {
    schemaVersion: raw.schemaVersion,
    active: raw.active,
    visibility: raw.visibility,
    publicationVersion: raw.publicationVersion,
    publishedAt,
    withdrawnAt,
    syncId: raw.syncId,
    publicId: raw.publicId,
    publicRevision: raw.publicRevision,
    publishedDocumentSource: raw.publishedDocumentSource,
    selectedBodyEntryIds: raw.selectedBodyEntryIds,
    selectedMediaIds: raw.selectedMediaIds,
    detailChecksum: raw.detailChecksum,
    detailSource: raw.detailSource,
    catalogItemChecksum: raw.catalogItemChecksum,
    catalogItemSource: raw.catalogItemSource,
  }
}

export function normalizeStoredManagerSermonPublication(
  value: unknown,
): StoredManagerSermonPublication {
  const code = 'INVALID_STORED_PUBLICATION'
  assertExactKeys(value, STORED_PUBLICATION_KEYS, 'Stored sermon publication', code)
  if (value.schemaVersion !== 1) fail(code, 'Stored publication schema is unsupported.')
  if (typeof value.active !== 'boolean') fail(code, 'Stored publication active state is invalid.')
  if (value.visibility !== 'public') fail(code, 'Stored publication visibility is invalid.')
  const publicationVersion = normalizePositiveVersion(
    value.publicationVersion,
    'Stored publication version',
    code,
  )!
  const publishedAt = canonicalTimestamp(value.publishedAt, 'Published time', code)
  const withdrawnAt = value.withdrawnAt === null
    ? null
    : canonicalTimestamp(value.withdrawnAt, 'Withdrawal time', code)
  if ((value.active && withdrawnAt !== null) || (!value.active && withdrawnAt === null)) {
    fail(code, 'Stored publication active and withdrawal states disagree.')
  }
  if (withdrawnAt !== null && Date.parse(withdrawnAt) < Date.parse(publishedAt)) {
    fail(code, 'Stored withdrawal cannot predate publication.')
  }
  const syncId = normalizeSyncId(value.syncId, code)
  const publicId = protocolText(value.publicId, 'Public sermon ID', 96, PUBLIC_ID_PATTERN, code)
  const publicRevision = normalizeSha256(value.publicRevision, 'Public revision', code)
  if (
    typeof value.publishedDocumentSource !== 'string'
    || Buffer.byteLength(value.publishedDocumentSource, 'utf8') > MAX_SERMON_SOURCE_BYTES
  ) {
    fail(code, 'Stored published sermon source is invalid.')
  }
  let document: CanonicalSermonDocument
  try {
    document = parseSermonDocument(value.publishedDocumentSource)
  } catch {
    fail(code, 'Stored published sermon source is invalid.')
  }
  if (
    serializeSermonDocument(document) !== value.publishedDocumentSource
    || sha256(value.publishedDocumentSource) !== publicRevision
    || document.id !== syncId
    || document.publication.status !== 'published'
    || document.publication.visibility !== 'public'
    || document.publication.publishedAt !== publishedAt
    || derivePublicSermonId(document.id) !== publicId
  ) {
    fail(code, 'Stored published sermon audit identity is inconsistent.')
  }
  const selectedBodyEntryIds = normalizeSelectionIds(
    value.selectedBodyEntryIds,
    'Stored selected body entries',
    MAX_SERMON_BODY_ENTRIES,
    code,
  )
  const selectedMediaIds = normalizeSelectionIds(
    value.selectedMediaIds,
    'Stored selected media',
    MAX_PUBLIC_SERMON_MEDIA,
    code,
  )
  const ordered = orderedSelections(document, selectedBodyEntryIds, selectedMediaIds)
  if (
    JSON.stringify(ordered.selectedBodyEntryIds) !== JSON.stringify(selectedBodyEntryIds)
    || JSON.stringify(ordered.selectedMediaIds) !== JSON.stringify(selectedMediaIds)
  ) {
    fail(code, 'Stored public selections are not in canonical document order.')
  }
  const detailChecksum = normalizeSha256(
    value.detailChecksum,
    'Stored public detail checksum',
    code,
  )
  if (typeof value.detailSource !== 'string') {
    fail(code, 'Stored public detail source is invalid.')
  }
  const projection = buildPublicSermonProjection({
    documentSource: value.publishedDocumentSource,
    publicRevision,
    selectedBodyEntryIds,
    selectedMediaIds,
  })
  if (
    projection.detailSource !== value.detailSource
    || projection.detailChecksum !== detailChecksum
    || projection.detail.publicId !== publicId
  ) {
    fail(code, 'Stored public detail bytes do not match the immutable published source.')
  }
  const catalogItemChecksum = normalizeSha256(
    value.catalogItemChecksum,
    'Stored catalog item checksum',
    code,
  )
  const expectedCatalogItemSource = serializePublicSermonCatalogItem(
    projection.catalogItem,
  )
  if (
    typeof value.catalogItemSource !== 'string'
    || value.catalogItemSource !== expectedCatalogItemSource
    || sha256(value.catalogItemSource) !== catalogItemChecksum
  ) {
    fail(code, 'Stored public catalog item does not match the immutable published source.')
  }
  return deepFreeze({
    schemaVersion: 1,
    active: value.active,
    visibility: 'public',
    publicationVersion,
    publishedAt,
    withdrawnAt,
    syncId,
    publicId,
    publicRevision,
    publishedDocumentSource: value.publishedDocumentSource,
    selectedBodyEntryIds,
    selectedMediaIds,
    detailChecksum,
    detailSource: value.detailSource,
    catalogItemChecksum,
    catalogItemSource: value.catalogItemSource,
  })
}

export function activePublicProjectionRecord(
  publication: StoredManagerSermonPublication,
): StoredPublicSermonPublication {
  if (!publication.active) {
    fail('PUBLICATION_NOT_ACTIVE', 'Only an active publication can be served anonymously.')
  }
  return deepFreeze({
    schemaVersion: 1,
    active: true,
    visibility: 'public',
    publicationVersion: publication.publicationVersion,
    publishedAt: publication.publishedAt,
    sermonId: publication.syncId,
    publicId: publication.publicId,
    publicRevision: publication.publicRevision,
    selectedBodyEntryIds: publication.selectedBodyEntryIds,
    selectedMediaIds: publication.selectedMediaIds,
    detailChecksum: publication.detailChecksum,
    detailSource: publication.detailSource,
  })
}
