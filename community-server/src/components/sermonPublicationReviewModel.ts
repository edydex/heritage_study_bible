const SHA256_PATTERN = /^[a-f0-9]{64}$/
const PUBLICATION_STATUSES = new Set(['draft', 'ready', 'published', 'archived'])
const VISIBILITIES = new Set(['private', 'members', 'unlisted', 'public'])
const BODY_KINDS = new Set(['manuscript', 'slide-notes', 'transcript', 'other'])
const MEDIA_KINDS = new Set(['audio', 'video', 'transcript', 'document'])
const MEDIA_STATUSES = new Set(['pending', 'processing', 'ready', 'failed'])
const DIRECT_AUDIO_MEDIA_TYPES = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
])
const SERMON_SYNC_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/
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

type MutableRecord = Record<string, unknown>

export type SermonPublicationPointer = Readonly<{
  schemaVersion: 1
  active: boolean
  publicationVersion: number
  publicRevision: string
  publicId: string
  detailChecksum: string
  publishedAt: string
  withdrawnAt: string | null
  selectedBodyEntryIds: readonly string[]
  selectedMediaIds: readonly string[]
}>

export type SermonPublicationListItem = Readonly<{
  syncId: string
  syncVersion: number
  currentRevision: string
  updatedAt: string
  archived: boolean
  title: string
  speaker: string
  serviceDate: string
  publicationStatus: 'draft' | 'ready' | 'published' | 'archived'
  visibility: 'private' | 'members' | 'unlisted' | 'public'
  publication: SermonPublicationPointer | null
}>

export type SermonPublicationReviewTarget =
  | Readonly<{ kind: 'generic' }>
  | Readonly<{
      kind: 'invalid'
      reason: 'ambiguous' | 'format' | 'missing'
    }>
  | Readonly<{ kind: 'exact'; syncId: string }>

export type SermonPublicationReviewTargetResolution =
  | Readonly<{ kind: 'generic' }>
  | Readonly<{
      kind: 'invalid'
      reason: 'ambiguous' | 'format' | 'missing'
    }>
  | Readonly<{ kind: 'select'; syncId: string }>
  | Readonly<{ kind: 'unavailable'; syncId: string }>

export type SermonBodyReviewEntry = Readonly<{
  id: string
  kind: 'manuscript' | 'slide-notes' | 'transcript' | 'other'
  language: string
  sourceId: string | null
  sectionId: string | null
  text: string
}>

export type SermonMediaReviewEntry = Readonly<{
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
}>

export type SermonSourceReviewEntry = Readonly<{
  id: string
  kind: string
  fileName: string
  mediaType: string
  sha256: string
  sizeBytes: number
}>

export type CanonicalSermonReviewDocument = Readonly<{
  schemaVersion: 1 | 2 | 3
  id: string
  title: string
  titles: Readonly<Record<string, string>>
  defaultLanguage: string
  speaker: string
  serviceDate: string
  seriesTitle: string | null
  body: readonly SermonBodyReviewEntry[]
  media: readonly SermonMediaReviewEntry[]
  sources: readonly SermonSourceReviewEntry[]
  publication: Readonly<{
    status: 'draft' | 'ready' | 'published' | 'archived'
    visibility: 'private' | 'members' | 'unlisted' | 'public'
    publishedAt: string | null
    canonicalUrl: string | null
  }>
}>

export type SermonPublicationDetail = Readonly<{
  schemaVersion: 1
  sermon: Readonly<{
    syncId: string
    syncVersion: number
    currentRevision: string
    updatedAt: string
    archived: boolean
    documentSource: string
    document: CanonicalSermonReviewDocument
  }>
  publication: SermonPublicationPointer | null
}>

export type PublicationReviewDraft = Readonly<{
  selectedBodyEntryIds: readonly string[]
  selectedMediaIds: readonly string[]
  directAudio: Readonly<{
    url: string
    title: string
    language: string
    mediaType: 'audio/mpeg' | 'audio/mp4' | 'audio/ogg' | 'audio/webm' | 'audio/wav'
    durationSeconds: string
  }>
  bodySelectionConfirmed: boolean
  mediaSelectionConfirmed: boolean
  publicAudienceConfirmed: boolean
  canonicalLinkConfirmed: boolean
  recordingRightsAndPrivacyConfirmed: boolean
}>

export type SermonPublishIntentV1 = Readonly<{
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

export type SermonPublishIntentV2 = Readonly<{
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
  directAudio: Readonly<{
    url: string
    title: string
    language: string
    mediaType: 'audio/mpeg' | 'audio/mp4' | 'audio/ogg' | 'audio/webm' | 'audio/wav'
    durationSeconds: number | null
  }>
  recordingRightsAndPrivacyConfirmed: true
}>

export type SermonPublishIntent = SermonPublishIntentV1 | SermonPublishIntentV2

export type SermonWithdrawIntent = Readonly<{
  schemaVersion: 1
  action: 'withdraw'
  syncId: string
  expectedSyncVersion: number
  expectedCurrentRevision: string
  expectedPublicationVersion: number
  expectedPublicRevision: string
}>

export type SermonPublicationMutationResponse = Readonly<{
  schemaVersion: 1
  sermon: Readonly<{
    syncId: string
    syncVersion: number
    currentRevision: string
    updatedAt: string
    archived: boolean
  }>
  publication: SermonPublicationPointer
}>

export class SermonPublicationReviewDataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SermonPublicationReviewDataError'
  }
}

function fail(message: string): never {
  throw new SermonPublicationReviewDataError(message)
}

function record(value: unknown, label: string): MutableRecord {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail(`${label} is not a plain object.`)
  }
  return value as MutableRecord
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
  label: string,
): MutableRecord {
  const result = record(value, label)
  const actual = Object.keys(result).sort()
  const expected = [...keys].sort()
  if (
    actual.length !== expected.length
    || actual.some((key, index) => key !== expected[index])
  ) {
    fail(`${label} does not match the supported response contract.`)
  }
  return result
}

function text(value: unknown, label: string, { empty = false } = {}): string {
  if (typeof value !== 'string' || (!empty && !value)) fail(`${label} is invalid.`)
  return value
}

function nullableText(value: unknown, label: string): string | null {
  return value === null ? null : text(value, label)
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') fail(`${label} is invalid.`)
  return value
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) fail(`${label} is invalid.`)
  return Number(value)
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) fail(`${label} is invalid.`)
  return Number(value)
}

function nullableNumber(value: unknown, label: string): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail(`${label} is invalid.`)
  }
  return value
}

function sha256(value: unknown, label: string): string {
  const result = text(value, label)
  if (!SHA256_PATTERN.test(result)) fail(`${label} is invalid.`)
  return result
}

function nullableSha256(value: unknown, label: string): string | null {
  return value === null ? null : sha256(value, label)
}

function oneOf<T extends string>(
  value: unknown,
  values: ReadonlySet<string>,
  label: string,
): T {
  const result = text(value, label)
  if (!values.has(result)) fail(`${label} is invalid.`)
  return result as T
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) fail(`${label} is invalid.`)
  const seen = new Set<string>()
  return value.map((item, index) => {
    const result = text(item, `${label} ${index + 1}`)
    if (seen.has(result)) fail(`${label} repeats an ID.`)
    seen.add(result)
    return result
  })
}

function localizedText(value: unknown, label: string): Record<string, string> {
  const raw = record(value, label)
  const entries = Object.entries(raw)
  if (!entries.length) fail(`${label} is empty.`)
  return Object.fromEntries(entries.map(([language, item]) => [
    text(language, `${label} language`),
    text(item, `${label}.${language}`),
  ]))
}

function nullableHttpUrl(value: unknown, label: string): string | null {
  if (value === null) return null
  const result = text(value, label)
  try {
    const parsed = new URL(result)
    if (
      !['http:', 'https:'].includes(parsed.protocol)
      || !parsed.hostname
      || parsed.username
      || parsed.password
    ) {
      fail(`${label} is invalid.`)
    }
    return parsed.toString()
  } catch (error) {
    if (error instanceof SermonPublicationReviewDataError) throw error
    fail(`${label} is invalid.`)
  }
}

function nullableHttpsUrl(value: unknown, label: string): string | null {
  const result = nullableHttpUrl(value, label)
  if (result === null) return null
  const parsed = new URL(result)
  if (parsed.protocol !== 'https:' || parsed.hash) {
    fail(`${label} is invalid.`)
  }
  return result
}

function parsePointer(value: unknown, label: string): SermonPublicationPointer {
  const raw = exactRecord(value, [
    'schemaVersion',
    'active',
    'publicationVersion',
    'publicRevision',
    'publicId',
    'detailChecksum',
    'publishedAt',
    'withdrawnAt',
    'selectedBodyEntryIds',
    'selectedMediaIds',
  ], label)
  if (raw.schemaVersion !== 1) fail(`${label} uses an unsupported schema version.`)
  return {
    schemaVersion: 1,
    active: boolean(raw.active, `${label}.active`),
    publicationVersion: positiveInteger(
      raw.publicationVersion,
      `${label}.publicationVersion`,
    ),
    publicRevision: sha256(raw.publicRevision, `${label}.publicRevision`),
    publicId: text(raw.publicId, `${label}.publicId`),
    detailChecksum: sha256(raw.detailChecksum, `${label}.detailChecksum`),
    publishedAt: text(raw.publishedAt, `${label}.publishedAt`),
    withdrawnAt: nullableText(raw.withdrawnAt, `${label}.withdrawnAt`),
    selectedBodyEntryIds: stringArray(
      raw.selectedBodyEntryIds,
      `${label}.selectedBodyEntryIds`,
    ),
    selectedMediaIds: stringArray(
      raw.selectedMediaIds,
      `${label}.selectedMediaIds`,
    ),
  }
}

function parseNullablePointer(
  value: unknown,
  label: string,
): SermonPublicationPointer | null {
  return value === null ? null : parsePointer(value, label)
}

function parseListItem(value: unknown, index: number): SermonPublicationListItem {
  const label = `Sermon publication list item ${index + 1}`
  const raw = exactRecord(value, [
    'syncId',
    'syncVersion',
    'currentRevision',
    'updatedAt',
    'archived',
    'title',
    'speaker',
    'serviceDate',
    'publicationStatus',
    'visibility',
    'publication',
  ], label)
  return {
    syncId: text(raw.syncId, `${label}.syncId`),
    syncVersion: positiveInteger(raw.syncVersion, `${label}.syncVersion`),
    currentRevision: sha256(raw.currentRevision, `${label}.currentRevision`),
    updatedAt: text(raw.updatedAt, `${label}.updatedAt`),
    archived: boolean(raw.archived, `${label}.archived`),
    title: text(raw.title, `${label}.title`),
    speaker: text(raw.speaker, `${label}.speaker`),
    serviceDate: text(raw.serviceDate, `${label}.serviceDate`),
    publicationStatus: oneOf(
      raw.publicationStatus,
      PUBLICATION_STATUSES,
      `${label}.publicationStatus`,
    ),
    visibility: oneOf(raw.visibility, VISIBILITIES, `${label}.visibility`),
    publication: parseNullablePointer(raw.publication, `${label}.publication`),
  }
}

export function parseSermonPublicationList(
  value: unknown,
): readonly SermonPublicationListItem[] {
  const raw = exactRecord(value, ['schemaVersion', 'items'], 'Sermon publication list')
  if (raw.schemaVersion !== 1) {
    fail('Sermon publication list uses an unsupported schema version.')
  }
  if (!Array.isArray(raw.items)) fail('Sermon publication list items are invalid.')
  const items = raw.items.map(parseListItem)
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item.syncId)) fail('Sermon publication list repeats a sync ID.')
    seen.add(item.syncId)
  }
  return items
}

export function reviewableSermonPublications(
  items: readonly SermonPublicationListItem[],
): readonly SermonPublicationListItem[] {
  return items.filter(item => (
    item.publicationStatus === 'ready' || item.publication?.active === true
  ))
}

export function parseSermonPublicationReviewTarget(
  searchParams: Readonly<
    Record<string, string | readonly string[] | undefined>
  > | undefined,
): SermonPublicationReviewTarget {
  if (
    !searchParams
    || !Object.prototype.hasOwnProperty.call(searchParams, 'sermon')
  ) {
    return { kind: 'generic' }
  }
  const value = searchParams.sermon
  if (value === undefined || value === '') {
    return { kind: 'invalid', reason: 'missing' }
  }
  if (typeof value !== 'string') {
    return { kind: 'invalid', reason: 'ambiguous' }
  }
  if (!SERMON_SYNC_ID_PATTERN.test(value)) {
    return { kind: 'invalid', reason: 'format' }
  }
  return { kind: 'exact', syncId: value }
}

export function resolveSermonPublicationReviewTarget(
  target: SermonPublicationReviewTarget,
  items: readonly SermonPublicationListItem[],
): SermonPublicationReviewTargetResolution {
  if (target.kind !== 'exact') return target
  const exact = items.find(item => (
    item.syncId === target.syncId
    && (
      item.publicationStatus === 'ready'
      || item.publication?.active === true
    )
  ))
  return exact
    ? { kind: 'select', syncId: exact.syncId }
    : { kind: 'unavailable', syncId: target.syncId }
}

function parseBody(value: unknown): SermonBodyReviewEntry[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) fail('Canonical sermon body is invalid.')
  const seen = new Set<string>()
  return value.map((item, index) => {
    const label = `Canonical sermon body entry ${index + 1}`
    const raw = record(item, label)
    const id = text(raw.id, `${label}.id`)
    if (seen.has(id)) fail('Canonical sermon body repeats an ID.')
    seen.add(id)
    return {
      id,
      kind: oneOf(raw.kind, BODY_KINDS, `${label}.kind`),
      language: text(raw.language, `${label}.language`),
      sourceId: nullableText(raw.sourceId, `${label}.sourceId`),
      sectionId: nullableText(raw.sectionId, `${label}.sectionId`),
      text: text(raw.text, `${label}.text`),
    }
  })
}

function parseMedia(value: unknown): SermonMediaReviewEntry[] {
  if (!Array.isArray(value)) fail('Canonical sermon media is invalid.')
  const seen = new Set<string>()
  return value.map((item, index) => {
    const label = `Canonical sermon media item ${index + 1}`
    const raw = record(item, label)
    const id = text(raw.id, `${label}.id`)
    if (seen.has(id)) fail('Canonical sermon media repeats an ID.')
    seen.add(id)
    return {
      id,
      kind: oneOf(raw.kind, MEDIA_KINDS, `${label}.kind`),
      status: oneOf(raw.status, MEDIA_STATUSES, `${label}.status`),
      title: text(raw.title, `${label}.title`),
      language: text(raw.language, `${label}.language`),
      mediaType: text(raw.mediaType, `${label}.mediaType`),
      fileName: nullableText(raw.fileName, `${label}.fileName`),
      sha256: nullableSha256(raw.sha256, `${label}.sha256`),
      sizeBytes: nullableNumber(raw.sizeBytes, `${label}.sizeBytes`),
      durationSeconds: nullableNumber(
        raw.durationSeconds,
        `${label}.durationSeconds`,
      ),
      url: nullableHttpUrl(raw.url, `${label}.url`),
    }
  })
}

function parseSources(value: unknown): SermonSourceReviewEntry[] {
  if (!Array.isArray(value)) fail('Canonical sermon sources are invalid.')
  const seen = new Set<string>()
  return value.map((item, index) => {
    const label = `Canonical sermon source ${index + 1}`
    const raw = record(item, label)
    const id = text(raw.id, `${label}.id`)
    if (seen.has(id)) fail('Canonical sermon sources repeat an ID.')
    seen.add(id)
    return {
      id,
      kind: text(raw.kind, `${label}.kind`),
      fileName: text(raw.fileName, `${label}.fileName`),
      mediaType: text(raw.mediaType, `${label}.mediaType`),
      sha256: sha256(raw.sha256, `${label}.sha256`),
      sizeBytes: nonNegativeInteger(raw.sizeBytes, `${label}.sizeBytes`),
    }
  })
}

function parseSeriesTitle(
  value: unknown,
  defaultLanguage: string,
): string | null {
  if (value === null) return null
  const raw = record(value, 'Canonical sermon series')
  const titles = localizedText(raw.titles, 'Canonical sermon series titles')
  return titles[defaultLanguage] || Object.values(titles)[0] || null
}

function parseCanonicalDocument(
  source: string,
  syncId: string,
): CanonicalSermonReviewDocument {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    fail('Canonical sermon document is not valid JSON.')
  }
  const raw = record(value, 'Canonical sermon document')
  if (raw.schemaVersion !== 1 && raw.schemaVersion !== 2 && raw.schemaVersion !== 3) {
    fail('Canonical sermon document uses an unsupported schema version.')
  }
  if (raw.kind !== 'syncshow-sermon') fail('Canonical sermon document kind is invalid.')
  const id = text(raw.id, 'Canonical sermon document ID')
  if (id !== syncId) fail('Canonical sermon document ID does not match the review item.')
  const defaultLanguage = text(
    raw.defaultLanguage,
    'Canonical sermon default language',
  )
  const titles = localizedText(raw.titles, 'Canonical sermon titles')
  if (!titles[defaultLanguage]) {
    fail('Canonical sermon title is missing its default language.')
  }
  const speaker = record(raw.speaker, 'Canonical sermon speaker')
  const publication = record(raw.publication, 'Canonical sermon publication')
  return {
    schemaVersion: raw.schemaVersion,
    id,
    title: titles[defaultLanguage],
    titles,
    defaultLanguage,
    speaker: text(speaker.name, 'Canonical sermon speaker name'),
    serviceDate: text(raw.serviceDate, 'Canonical sermon service date'),
    seriesTitle: parseSeriesTitle(raw.series, defaultLanguage),
    body: parseBody(raw.body),
    media: parseMedia(raw.media),
    sources: parseSources(raw.sources),
    publication: {
      status: oneOf(
        publication.status,
        PUBLICATION_STATUSES,
        'Canonical sermon publication status',
      ),
      visibility: oneOf(
        publication.visibility,
        VISIBILITIES,
        'Canonical sermon publication visibility',
      ),
      publishedAt: nullableText(
        publication.publishedAt,
        'Canonical sermon published time',
      ),
      canonicalUrl: nullableHttpsUrl(
        publication.canonicalUrl,
        'Canonical sermon link',
      ),
    },
  }
}

function parseDetailSermon(value: unknown) {
  const raw = exactRecord(value, [
    'syncId',
    'syncVersion',
    'currentRevision',
    'updatedAt',
    'archived',
    'documentSource',
  ], 'Sermon publication detail')
  const syncId = text(raw.syncId, 'Sermon publication detail sync ID')
  const documentSource = text(
    raw.documentSource,
    'Sermon publication detail canonical source',
  )
  return {
    syncId,
    syncVersion: positiveInteger(
      raw.syncVersion,
      'Sermon publication detail sync version',
    ),
    currentRevision: sha256(
      raw.currentRevision,
      'Sermon publication detail current revision',
    ),
    updatedAt: text(raw.updatedAt, 'Sermon publication detail updated time'),
    archived: boolean(raw.archived, 'Sermon publication detail archived state'),
    documentSource,
    document: parseCanonicalDocument(documentSource, syncId),
  }
}

export function parseSermonPublicationDetail(
  value: unknown,
): SermonPublicationDetail {
  const raw = exactRecord(
    value,
    ['schemaVersion', 'sermon', 'publication'],
    'Sermon publication detail response',
  )
  if (raw.schemaVersion !== 1) {
    fail('Sermon publication detail uses an unsupported schema version.')
  }
  return {
    schemaVersion: 1,
    sermon: parseDetailSermon(raw.sermon),
    publication: parseNullablePointer(raw.publication, 'Sermon publication pointer'),
  }
}

function draftLanguage(value: string): string {
  const normalized = value.trim().toLowerCase()
  return LANGUAGE_PATTERN.test(normalized) ? normalized : 'en'
}

export function createEmptyPublicationReviewDraft(
  defaultLanguage = 'en',
): PublicationReviewDraft {
  return {
    selectedBodyEntryIds: [],
    selectedMediaIds: [],
    directAudio: {
      url: '',
      title: 'Sermon audio',
      language: draftLanguage(defaultLanguage),
      mediaType: 'audio/mpeg',
      durationSeconds: '',
    },
    bodySelectionConfirmed: false,
    mediaSelectionConfirmed: false,
    publicAudienceConfirmed: false,
    canonicalLinkConfirmed: false,
    recordingRightsAndPrivacyConfirmed: false,
  }
}

export function isPublicMediaSelectable(media: SermonMediaReviewEntry): boolean {
  if (media.status !== 'ready' || media.url === null) return false
  const normalized = media.url.trim()
  if (
    !normalized
    || normalized.length > 2048
    || normalized.includes('\\')
  ) {
    return false
  }
  try {
    const parsed = new URL(normalized)
    const hostname = parsed.hostname
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .toLowerCase()
    return (
      parsed.protocol === 'https:'
      && Boolean(hostname)
      && !parsed.username
      && !parsed.password
      && !parsed.hash
      && !parsed.search
      && !parsed.port
      && !hostname.endsWith('.')
      && hostname.includes('.')
      && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
      && !hostname.includes(':')
      && hostname !== 'localhost'
      && !NONPUBLIC_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix))
      && parsed.toString().length <= 2048
    )
  } catch {
    return false
  }
}

export function hasDirectAudioDraft(draft: PublicationReviewDraft): boolean {
  return draft.directAudio.url.trim().length > 0
}

function normalizedDirectAudioUrl(value: string): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > 2048 || normalized.includes('\\')) {
    fail('Direct recording URL must be a complete public HTTPS file URL.')
  }
  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    fail('Direct recording URL must be a complete public HTTPS file URL.')
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
    || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
    || hostname.includes(':')
    || hostname === 'localhost'
    || NONPUBLIC_HOST_SUFFIXES.some(suffix => hostname.endsWith(suffix))
  ) {
    fail(
      'Direct recording URL must be a stable public HTTPS file URL without credentials, a query string, fragment, private host, or nonstandard port.',
    )
  }
  const canonical = parsed.toString()
  if (canonical.length > 2048) {
    fail('Direct recording URL must be 2048 characters or fewer after normalization.')
  }
  return canonical
}

export function directAudioPreviewUrl(value: string): string | null {
  try {
    return normalizedDirectAudioUrl(value)
  } catch {
    return null
  }
}

function directAudioFromDraft(
  draft: PublicationReviewDraft,
): SermonPublishIntentV2['directAudio'] | null {
  if (!hasDirectAudioDraft(draft)) return null
  const title = draft.directAudio.title.trim().normalize('NFC')
  if (!title || title.length > 300 || /[\u0000-\u001f\u007f]/u.test(title)) {
    fail('Direct recording title is required and must be 300 characters or fewer.')
  }
  const language = draft.directAudio.language.trim().toLowerCase()
  if (!LANGUAGE_PATTERN.test(language)) {
    fail('Direct recording language must be a BCP-47-style tag such as en or ru.')
  }
  if (!DIRECT_AUDIO_MEDIA_TYPES.has(draft.directAudio.mediaType)) {
    fail('Direct recording format is unsupported.')
  }
  const durationText = draft.directAudio.durationSeconds.trim()
  const durationSeconds = durationText === '' ? null : Number(durationText)
  if (
    durationSeconds !== null
    && (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
  ) {
    fail('Direct recording duration must be a positive number of seconds or blank.')
  }
  return {
    url: normalizedDirectAudioUrl(draft.directAudio.url),
    title,
    language,
    mediaType: draft.directAudio.mediaType,
    durationSeconds,
  }
}

function orderedSelectedIds(
  selectedIds: readonly string[],
  availableIds: readonly string[],
  label: string,
): string[] {
  const selected = new Set(selectedIds)
  if (selected.size !== selectedIds.length) fail(`${label} repeats an ID.`)
  const available = new Set(availableIds)
  for (const id of selected) {
    if (!available.has(id)) fail(`${label} includes content that is no longer available.`)
  }
  return availableIds.filter(id => selected.has(id))
}

export function buildSermonPublishIntent(
  detail: SermonPublicationDetail,
  draft: PublicationReviewDraft,
): SermonPublishIntent {
  if (detail.sermon.archived) fail('An archived sermon cannot be published.')
  if (detail.sermon.document.publication.status !== 'ready') {
    fail('Only a current Ready sermon revision can be published.')
  }
  if (!draft.bodySelectionConfirmed || !draft.mediaSelectionConfirmed) {
    fail('Review both the written-content and media choices before publishing.')
  }
  if (!draft.publicAudienceConfirmed || !draft.canonicalLinkConfirmed) {
    fail('Confirm the public audience and canonical-link state before publishing.')
  }
  const directAudio = directAudioFromDraft(draft)
  if (directAudio && !draft.recordingRightsAndPrivacyConfirmed) {
    fail('Confirm the recording rights, participant privacy, and public-host disclosure before publishing.')
  }
  const selectedBodyEntryIds = orderedSelectedIds(
    draft.selectedBodyEntryIds,
    detail.sermon.document.body.map(entry => entry.id),
    'Written-content selection',
  )
  const selectedMediaIds = orderedSelectedIds(
    draft.selectedMediaIds,
    detail.sermon.document.media.map(entry => entry.id),
    'Media selection',
  )
  const mediaById = new Map(
    detail.sermon.document.media.map(media => [media.id, media]),
  )
  for (const id of selectedMediaIds) {
    if (!isPublicMediaSelectable(mediaById.get(id)!)) {
      fail(`Selected media “${id}” is not ready at a public HTTPS URL.`)
    }
  }
  const includesAudio = directAudio !== null || selectedMediaIds.some(
    id => mediaById.get(id)?.kind === 'audio',
  )
  if (includesAudio && selectedBodyEntryIds.length === 0) {
    fail('Select at least one written sermon section before publishing a recording.')
  }
  const common = {
    action: 'publish',
    syncId: detail.sermon.syncId,
    expectedSyncVersion: detail.sermon.syncVersion,
    expectedCurrentRevision: detail.sermon.currentRevision,
    expectedPublicationVersion: detail.publication?.publicationVersion ?? null,
    expectedPublicRevision: detail.publication?.publicRevision ?? null,
    selectedBodyEntryIds,
    selectedMediaIds,
    publicAudienceConfirmed: true,
    canonicalLinkConfirmed: true,
  } as const
  if (!directAudio) {
    return {
      schemaVersion: 1,
      ...common,
    }
  }
  return {
    schemaVersion: 2,
    ...common,
    directAudio,
    recordingRightsAndPrivacyConfirmed: true,
  }
}

export function buildSermonWithdrawIntent(
  detail: SermonPublicationDetail,
): SermonWithdrawIntent {
  if (detail.sermon.archived) fail('An archived sermon cannot be withdrawn.')
  if (!detail.publication?.active) fail('This sermon is not currently public.')
  return {
    schemaVersion: 1,
    action: 'withdraw',
    syncId: detail.sermon.syncId,
    expectedSyncVersion: detail.sermon.syncVersion,
    expectedCurrentRevision: detail.sermon.currentRevision,
    expectedPublicationVersion: detail.publication.publicationVersion,
    expectedPublicRevision: detail.publication.publicRevision,
  }
}

export function parseSermonPublicationMutationResponse(
  value: unknown,
): SermonPublicationMutationResponse {
  const raw = exactRecord(
    value,
    ['schemaVersion', 'sermon', 'publication'],
    'Sermon publication mutation response',
  )
  if (raw.schemaVersion !== 1) {
    fail('Sermon publication mutation response uses an unsupported schema version.')
  }
  const sermon = exactRecord(raw.sermon, [
    'syncId',
    'syncVersion',
    'currentRevision',
    'updatedAt',
    'archived',
  ], 'Sermon publication mutation sermon')
  return {
    schemaVersion: 1,
    sermon: {
      syncId: text(sermon.syncId, 'Sermon publication mutation sync ID'),
      syncVersion: positiveInteger(
        sermon.syncVersion,
        'Sermon publication mutation sync version',
      ),
      currentRevision: sha256(
        sermon.currentRevision,
        'Sermon publication mutation current revision',
      ),
      updatedAt: text(
        sermon.updatedAt,
        'Sermon publication mutation updated time',
      ),
      archived: boolean(
        sermon.archived,
        'Sermon publication mutation archived state',
      ),
    },
    publication: parsePointer(raw.publication, 'Sermon publication mutation pointer'),
  }
}

export function isSermonPublicationConflict(
  status: number,
  code: string | null,
): boolean {
  return status === 412 && (
    code === 'SERMON_VERSION_CONFLICT'
    || code === 'PUBLICATION_VERSION_CONFLICT'
  )
}
