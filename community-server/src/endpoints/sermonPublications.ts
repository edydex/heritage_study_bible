import { sql } from '@payloadcms/db-postgres'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import {
  headersWithCors,
  type Endpoint,
  type PayloadRequest,
} from 'payload'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import {
  ManagerSermonPublicationError,
  MAX_MANAGER_SERMON_PUBLICATION_REQUEST_BYTES,
  buildManagerSermonPublicationTransition,
  nextCanonicalPublicationTime,
  normalizeManagerSermonPublishIntent,
  normalizeManagerSermonWithdrawIntent,
  type ManagerSermonPublishIntent,
  type ManagerSermonWithdrawIntent,
  type StoredManagerSermonPublication,
} from '@/lib/syncshow/ManagerSermonPublication'
import {
  deactivateSermonPublicationForArchive,
  findSermonPublication,
  isPublicSermonMediaNamespaceUrl,
  refreshPublicSermonCatalog,
  parsePublicSermonMediaUrl,
  publicSermonMediaUrl,
  validateSermonPublicationRow,
} from '@/lib/syncshow/SermonPublicationStore'
import {
  parseSermonDocument,
  serializeSermonDocument,
} from '@/lib/syncshow/SermonDocument'
import {
  ManagerSermonMediaReviewError,
  managerSermonRecordingByteRange,
  managerSermonRecordingContentDisposition,
  managerSermonRecordingReviewId,
  normalizeManagerSermonRecording,
  type ManagerSermonRecordingAuthority,
} from '@/lib/syncshow/ManagerSermonMediaReview'
import { SermonMediaError } from '@/lib/syncshow/SermonMedia'
import { sermonMediaCommunityNamespace } from '@/lib/syncshow/SermonMediaStore'
import {
  openSermonMediaObjectForRead,
  sermonMediaObjectKey,
} from '@/lib/syncshow/SermonMediaStorage'
import {
  lockedCommunityTimeZone,
  payloadPreachedAtForServiceDate,
  serviceDateForProjectedPreachedAt,
} from '@/lib/syncshow/SermonDateProjection'
import {
  derivePublicSermonId,
  serializePublicSermonCatalogItem,
} from '@/lib/syncshow/PublicSermonPublication'

type RequestDoc = Record<string, any>
type DrizzleRows = { rows?: RequestDoc[] } | RequestDoc[]
type PublicationTransactionAdapter = {
  beginTransaction: () => Promise<null | number | string>
  commitTransaction: (id: number | string) => Promise<void>
  rollbackTransaction: (id: number | string) => Promise<void>
  sessions?: Record<string, {
    db: { execute: (query: unknown) => Promise<{ rows?: RequestDoc[] }> }
  }>
}

function resultRows(result: DrizzleRows): RequestDoc[] {
  if (Array.isArray(result)) return result
  return Array.isArray(result.rows) ? result.rows : []
}

class PublicationEndpointError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'PublicationEndpointError'
    this.code = code
    this.status = status
  }
}

function responseHeaders(req: PayloadRequest, extra: HeadersInit = {}) {
  const headers = headersWithCors({ headers: new Headers(extra), req })
  headers.set('Cache-Control', 'private, no-store')
  headers.set('Vary', 'Authorization, Cookie')
  headers.set('X-Content-Type-Options', 'nosniff')
  return headers
}

function json(
  req: PayloadRequest,
  value: unknown,
  init: ResponseInit = {},
): Response {
  return Response.json(value, {
    ...init,
    headers: responseHeaders(req, init.headers),
  })
}

function endpointError(req: PayloadRequest, error: unknown): Response {
  if (error instanceof PublicationEndpointError) {
    return json(req, { code: error.code, error: error.message }, { status: error.status })
  }
  if (error instanceof ManagerSermonPublicationError) {
    const status = [
      'INVALID_PUBLICATION_INTENT',
      'UNKNOWN_PUBLIC_BODY_SELECTION',
      'UNKNOWN_PUBLIC_MEDIA_SELECTION',
      'PUBLIC_MEDIA_NOT_READY',
      'PUBLIC_AUDIO_REQUIRES_WRITTEN_ALTERNATIVE',
    ].includes(error.code)
      ? 400
      : error.code === 'SERMON_NOT_READY'
        ? 409
        : error.code === 'INVALID_STORED_PUBLICATION'
          ? 500
          : 409
    return json(req, { code: error.code, error: error.message }, { status })
  }
  if (error instanceof ManagerSermonMediaReviewError) {
    return json(
      req,
      { code: error.code, error: error.message },
      { status: error.status, headers: error.headers },
    )
  }
  if (error instanceof SermonMediaError) {
    return json(
      req,
      { code: error.code, error: error.message },
      { status: error.status },
    )
  }
  req.payload.logger.error({ err: error }, 'Manager sermon publication endpoint failed')
  return json(
    req,
    {
      code: 'PUBLICATION_SERVER_ERROR',
      error: 'The Community server could not complete the sermon publication request.',
    },
    { status: 500 },
  )
}

function relationId(value: unknown): number {
  const raw = value && typeof value === 'object' && 'id' in value
    ? (value as { id: unknown }).id
    : value
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : 0
}

function routeSyncId(req: PayloadRequest): string {
  const syncId = String(req.routeParams?.syncId || '')
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(syncId)) {
    throw new PublicationEndpointError(
      'INVALID_SYNC_ID',
      'The sermon sync ID is invalid.',
      400,
    )
  }
  return syncId
}

async function boundedJson(req: PayloadRequest): Promise<RequestDoc> {
  const contentType = String(req.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
  if (contentType !== 'application/json') {
    throw new PublicationEndpointError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Sermon publication requests must use application/json.',
      415,
    )
  }
  const contentLength = Number(req.headers.get('content-length') || 0)
  if (
    Number.isFinite(contentLength)
    && contentLength > MAX_MANAGER_SERMON_PUBLICATION_REQUEST_BYTES
  ) {
    throw new PublicationEndpointError(
      'REQUEST_TOO_LARGE',
      `Publication request must be ${MAX_MANAGER_SERMON_PUBLICATION_REQUEST_BYTES} bytes or fewer.`,
      413,
    )
  }
  if (!req.text) {
    throw new PublicationEndpointError('INVALID_REQUEST', 'Request body is unavailable.', 400)
  }
  const source = await req.text()
  if (Buffer.byteLength(source, 'utf8') > MAX_MANAGER_SERMON_PUBLICATION_REQUEST_BYTES) {
    throw new PublicationEndpointError(
      'REQUEST_TOO_LARGE',
      `Publication request must be ${MAX_MANAGER_SERMON_PUBLICATION_REQUEST_BYTES} bytes or fewer.`,
      413,
    )
  }
  try {
    const value = JSON.parse(source || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid')
    return value
  } catch {
    throw new PublicationEndpointError(
      'INVALID_JSON',
      'Request body must be a JSON object.',
      400,
    )
  }
}

async function authenticatedManagerUserId(req: PayloadRequest): Promise<number> {
  // A SyncShow service token is deliberately never an approval credential,
  // even when the same HTTP request also happens to carry a browser cookie.
  if (/^SyncShow(?:[ \t]+|$)/i.test(req.headers.get('authorization') || '')) {
    throw new PublicationEndpointError(
      'COMMUNITY_AUTH_REQUIRED',
      'A signed-in Community manager is required to publish a sermon.',
      401,
    )
  }
  const current = req.user || (await req.payload.auth({ headers: req.headers })).user
  const userId = relationId(current)
  if (!userId) {
    throw new PublicationEndpointError(
      'COMMUNITY_AUTH_REQUIRED',
      'A signed-in Community manager is required to publish a sermon.',
      401,
    )
  }
  return userId
}

async function configuredCommunity(req: PayloadRequest): Promise<number> {
  const communityId = await getConfiguredCommunityId(req.payload)
  if (communityId == null) {
    throw new PublicationEndpointError(
      'COMMUNITY_NOT_READY',
      'This Community has not finished setup.',
      503,
    )
  }
  return communityId
}

async function hasManagerMembership(
  req: PayloadRequest,
  userId: number,
  communityId: number,
) {
  return Boolean((await req.payload.find({
    collection: 'memberships',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    where: {
      and: [
        { user: { equals: userId } },
        { community: { equals: communityId } },
        { role: { in: ['owner', 'admin', 'leader'] } },
      ],
    },
  })).docs[0])
}

async function managerReadContext(req: PayloadRequest) {
  const userId = await authenticatedManagerUserId(req)
  const communityId = await configuredCommunity(req)
  if (!await hasManagerMembership(req, userId, communityId)) {
    throw new PublicationEndpointError(
      'MANAGER_REQUIRED',
      'Your current Community role cannot review sermon publication.',
      403,
    )
  }
  return { userId, communityId }
}

async function findSermon(
  req: PayloadRequest,
  communityId: number,
  syncId: string,
): Promise<RequestDoc | null> {
  const result = await req.payload.find({
    collection: 'sermons',
    depth: 0,
    limit: 2,
    overrideAccess: true,
    showHiddenFields: true,
    req,
    where: {
      and: [
        { community: { equals: communityId } },
        { syncId: { equals: syncId } },
      ],
    },
  })
  if (result.docs.length > 1) throw new Error('Sermon sync identity uniqueness was violated.')
  return result.docs[0] as unknown as RequestDoc || null
}

async function assertLiveManager(
  transactionDb: {
    execute: (query: unknown) => Promise<{ rows?: RequestDoc[] }>
  },
  userId: number,
  communityId: number,
) {
  const membership = (await transactionDb.execute(sql`
    SELECT "id"
    FROM "memberships"
    WHERE "user_id" = ${userId}
      AND "community_id" = ${communityId}
      AND "role" IN ('owner', 'admin', 'leader')
    FOR SHARE;
  `)).rows?.[0]
  if (!membership) {
    throw new PublicationEndpointError(
      'MANAGER_REQUIRED',
      'Your current Community role cannot publish or withdraw sermons.',
      403,
    )
  }
}

async function lockSermon(
  transactionDb: {
    execute: (query: unknown) => Promise<{ rows?: RequestDoc[] }>
  },
  communityId: number,
  syncId: string,
) {
  return (await transactionDb.execute(sql`
    SELECT "id"
    FROM "sermons"
    WHERE "community_id" = ${communityId}
      AND "sync_id" = ${syncId}
    FOR UPDATE;
  `)).rows?.[0] || null
}

async function lockPublication(
  transactionDb: {
    execute: (query: unknown) => Promise<{ rows?: RequestDoc[] }>
  },
  communityId: number,
  sermonId: number,
) {
  await transactionDb.execute(sql`
    SELECT "id"
    FROM "syncshow_sermon_publications"
    WHERE "community_id" = ${communityId}
      AND "sermon_id" = ${sermonId}
    FOR UPDATE;
  `)
}

function assertSermonCas(
  sermon: RequestDoc,
  intent: ManagerSermonPublishIntent | ManagerSermonWithdrawIntent,
) {
  if (
    Number(sermon.syncVersion) !== intent.expectedSyncVersion
    || String(sermon.syncCurrentRevision || '') !== intent.expectedCurrentRevision
  ) {
    throw new PublicationEndpointError(
      'SERMON_VERSION_CONFLICT',
      'The sermon changed. Refresh its current revision before continuing.',
      412,
    )
  }
  if (sermon.syncArchived === true) {
    throw new PublicationEndpointError(
      'SERMON_ARCHIVED',
      'An archived sermon cannot be published or withdrawn.',
      409,
    )
  }
}

function assertPublicationCas(
  publication: StoredManagerSermonPublication | null,
  intent: ManagerSermonPublishIntent | ManagerSermonWithdrawIntent,
) {
  if (!publication) {
    if (
      intent.expectedPublicationVersion !== null
      || intent.expectedPublicRevision !== null
    ) {
      throw new PublicationEndpointError(
        'PUBLICATION_VERSION_CONFLICT',
        'The sermon publication pointer changed. Refresh it before continuing.',
        412,
      )
    }
    return
  }
  if (
    publication.publicationVersion !== intent.expectedPublicationVersion
    || publication.publicRevision !== intent.expectedPublicRevision
  ) {
    throw new PublicationEndpointError(
      'PUBLICATION_VERSION_CONFLICT',
      'The sermon publication pointer changed. Refresh it before continuing.',
      412,
    )
  }
}

function unavailableSourceObjects(document: {
  sources: readonly {
    id: string
    sha256: string
    sizeBytes: number
  }[]
}) {
  return document.sources.map(source => ({
    sourceId: source.id,
    sha256: source.sha256,
    sizeBytes: source.sizeBytes,
    available: false,
  }))
}

function inspectCurrentSermon(sermon: RequestDoc) {
  const syncId = String(sermon.syncId || '')
  const documentSource = String(sermon.syncCurrentDocumentSource || '')
  let document
  try {
    document = parseSermonDocument(documentSource)
  } catch {
    throw new Error('Stored canonical sermon document is invalid.')
  }
  const revision = createHash('sha256').update(documentSource, 'utf8').digest('hex')
  if (
    serializeSermonDocument(document) !== documentSource
    || document.id !== syncId
    || revision !== String(sermon.syncCurrentRevision || '')
    || (sermon.syncArchived === true) !== (document.publication.status === 'archived')
    || String(sermon.syncPublicationStatus || '') !== document.publication.status
    || String(sermon.syncVisibility || '') !== document.publication.visibility
  ) {
    throw new Error('Stored canonical sermon identity is invalid.')
  }
  const syncVersion = Number(sermon.syncVersion)
  if (!Number.isSafeInteger(syncVersion) || syncVersion < 1) {
    throw new Error('Stored canonical sermon version is invalid.')
  }
  return {
    document,
    documentSource,
    syncId,
    syncVersion,
    currentRevision: revision,
    updatedAt: databaseTimestamp(sermon.syncChangedAt, 'Stored sermon update time'),
    archived: sermon.syncArchived === true,
  }
}

async function lockManagedRecordingForPublication(
  transactionDb: {
    execute: (query: unknown) => Promise<{ rows?: RequestDoc[] }>
  },
  communityId: number,
  sermonId: number,
  current: ReturnType<typeof inspectCurrentSermon>,
  selectedReviewId: string,
): Promise<ManagerSermonRecordingAuthority> {
  const result = await transactionDb.execute(sql`
    SELECT
      u."upload_id" AS "uploadId",
      u."schema_version" AS "schemaVersion",
      u."community_id" AS "uploadCommunityId",
      u."sermon_id" AS "sermonId",
      u."state" AS "state",
      u."sync_id" AS "syncId",
      u."expected_sync_version" AS "expectedSyncVersion",
      u."expected_current_revision" AS "expectedCurrentRevision",
      u."recording_id" AS "recordingId",
      u."kind" AS "kind",
      u."language" AS "language",
      u."media_type" AS "mediaType",
      u."file_name" AS "fileName",
      u."sha256" AS "sha256",
      u."size_bytes" AS "sizeBytes",
      u."duration_seconds" AS "durationSeconds",
      u."completed_at" AS "completedAt",
      u."object_id" AS "objectId",
      o."id" AS "objectRowId",
      o."community_id" AS "objectCommunityId",
      o."sha256" AS "objectSha256",
      o."size_bytes" AS "objectSizeBytes",
      o."media_type" AS "objectMediaType",
      o."storage_key" AS "storageKey"
    FROM "syncshow_sermon_media_uploads" u
    JOIN "syncshow_sermon_media_objects" o
      ON o."id" = u."object_id"
      AND o."community_id" = u."community_id"
    WHERE u."community_id" = ${communityId}
      AND u."sermon_id" = ${sermonId}
      AND u."sync_id" = ${current.syncId}
      AND u."upload_id" = ${selectedReviewId}
      AND u."state" IN ('complete', 'superseded')
      AND u."object_id" IS NOT NULL
    FOR UPDATE OF u, o;
  `)
  const rows = result.rows || []
  if (rows.length === 0) {
    throw new ManagerSermonMediaReviewError(
      'MANAGED_RECORDING_NOT_FOUND',
      'Managed recording not found.',
      404,
    )
  }
  if (rows.length !== 1) {
    throw new Error('Managed recording review identity uniqueness was violated.')
  }
  const authority = normalizeManagerSermonRecording(rows[0], {
    syncId: current.syncId,
    syncVersion: current.syncVersion,
    currentRevision: current.currentRevision,
    communityId,
    sermonId,
    archived: current.archived,
    document: current.document,
  })
  if (authority.recording.eligibility !== 'publishable') {
    throw new PublicationEndpointError(
      'MANAGED_RECORDING_NOT_PUBLISHABLE',
      'The selected managed recording is historical or no longer matches the current sermon revision.',
      409,
    )
  }
  return authority
}

type CanonicalSermonMedia = ReturnType<typeof parseSermonDocument>['media'][number]

function sameCanonicalMediaDescriptor(
  left: CanonicalSermonMedia,
  right: CanonicalSermonMedia,
): boolean {
  return left.id === right.id
    && left.kind === right.kind
    && left.status === right.status
    && left.title === right.title
    && left.language === right.language
    && left.mediaType === right.mediaType
    && left.fileName === right.fileName
    && left.sha256 === right.sha256
    && left.sizeBytes === right.sizeBytes
    && left.durationSeconds === right.durationSeconds
    && left.url === right.url
}

function selectedManagedMedia(
  current: ReturnType<typeof inspectCurrentSermon>,
  selectedMediaIds: readonly string[],
) {
  const selected = new Set(selectedMediaIds)
  return current.document.media.flatMap(media => {
    if (!selected.has(media.id) || !media.url) return []
    if (!isPublicSermonMediaNamespaceUrl(media.url)) return []
    return [{ media, identity: parsePublicSermonMediaUrl(media.url) }]
  })
}

async function assertPreservedManagedMediaObject(
  transactionDb: {
    execute: (query: unknown) => Promise<{ rows?: RequestDoc[] }>
  },
  communityId: number,
  media: CanonicalSermonMedia,
) {
  const result = await transactionDb.execute(sql`
    SELECT
      "id" AS "objectId",
      "community_id" AS "communityId",
      "sha256" AS "sha256",
      "size_bytes" AS "sizeBytes",
      "media_type" AS "mediaType",
      "storage_key" AS "storageKey"
    FROM "syncshow_sermon_media_objects"
    WHERE "community_id" = ${communityId}
      AND "sha256" = ${media.sha256}
    FOR UPDATE;
  `)
  const rows = result.rows || []
  if (rows.length === 0) {
    throw new PublicationEndpointError(
      'MANAGED_RECORDING_OBJECT_UNAVAILABLE',
      'The preserved Community-managed recording is no longer available.',
      503,
    )
  }
  if (rows.length !== 1) {
    throw new Error('Managed recording object uniqueness was violated.')
  }
  const row = rows[0]
  if (
    Number(row.communityId) !== communityId
    || String(row.sha256 || '') !== media.sha256
    || Number(row.sizeBytes) !== media.sizeBytes
    || String(row.mediaType || '') !== media.mediaType
    || String(row.storageKey || '') !== sermonMediaObjectKey(
      sermonMediaCommunityNamespace(communityId),
      String(media.sha256 || ''),
    )
  ) {
    throw new Error('Preserved managed recording object identity is inconsistent.')
  }
  const opened = await openSermonMediaObjectForRead({
    storageKey: String(row.storageKey),
    sha256: String(row.sha256),
    sizeBytes: Number(row.sizeBytes),
  })
  await opened.close()
}

async function assertManagedMediaSelectionPolicy(
  transactionDb: {
    execute: (query: unknown) => Promise<{ rows?: RequestDoc[] }>
  },
  communityId: number,
  current: ReturnType<typeof inspectCurrentSermon>,
  intent: ManagerSermonPublishIntent,
  existing: StoredManagerSermonPublication | null,
) {
  if (
    intent.schemaVersion === 2
    && isPublicSermonMediaNamespaceUrl(intent.directAudio.url)
  ) {
    throw new PublicationEndpointError(
      'MANAGED_RECORDING_REVIEW_REQUIRED',
      'A Community-managed recording must be selected through its private manager review.',
      409,
    )
  }
  const managedSelections = selectedManagedMedia(current, intent.selectedMediaIds)
  if (managedSelections.length === 0) return
  if (intent.schemaVersion !== 1) {
    throw new PublicationEndpointError(
      'MANAGED_RECORDING_SELECTION_CONFLICT',
      'A direct recording and a Community-managed recording cannot be published together.',
      409,
    )
  }
  if (!existing?.active) {
    throw new PublicationEndpointError(
      'MANAGED_RECORDING_REVIEW_REQUIRED',
      'Publishing this Community-managed recording requires a fresh private review and rights confirmation.',
      409,
    )
  }
  const previous = parseSermonDocument(existing.publishedDocumentSource)
  for (const { media, identity } of managedSelections) {
    const previousMedia = previous.media.find(candidate => candidate.id === media.id)
    if (
      !identity
      || identity.publicId !== existing.publicId
      || identity.sha256 !== media.sha256
      || !existing.selectedMediaIds.includes(media.id)
      || !previousMedia
      || !sameCanonicalMediaDescriptor(previousMedia, media)
    ) {
      throw new PublicationEndpointError(
        'MANAGED_RECORDING_REVIEW_REQUIRED',
        'The Community-managed recording binding changed and requires a fresh private review and rights confirmation.',
        409,
      )
    }
    await assertPreservedManagedMediaObject(transactionDb, communityId, media)
  }
}

async function recordSermonChange(
  req: PayloadRequest,
  communityId: number,
  sermon: RequestDoc,
) {
  await req.payload.create({
    collection: 'syncshow-sermon-changes' as never,
    overrideAccess: true,
    context: { syncShowSermonChangeMutation: true },
    req,
    data: {
      community: communityId,
      sermon: Number(sermon.id),
      syncId: String(sermon.syncId),
      syncVersion: Number(sermon.syncVersion),
      revision: String(sermon.syncCurrentRevision),
      documentSource: String(sermon.syncCurrentDocumentSource),
      archived: sermon.syncArchived === true,
      changedAt: String(sermon.syncChangedAt),
    } as never,
  })
}

function publicationPointer(
  publication: StoredManagerSermonPublication,
) {
  return {
    schemaVersion: 1,
    active: publication.active,
    publicationVersion: publication.publicationVersion,
    publicRevision: publication.publicRevision,
    publicId: publication.publicId,
    detailChecksum: publication.detailChecksum,
    publishedAt: publication.publishedAt,
    withdrawnAt: publication.withdrawnAt,
    selectedBodyEntryIds: publication.selectedBodyEntryIds,
    selectedMediaIds: publication.selectedMediaIds,
  }
}

function mutationResponse(
  sermon: RequestDoc,
  publication: StoredManagerSermonPublication,
) {
  const current = inspectCurrentSermon(sermon)
  return {
    schemaVersion: 1,
    sermon: {
      syncId: current.syncId,
      syncVersion: current.syncVersion,
      currentRevision: current.currentRevision,
      updatedAt: current.updatedAt,
      archived: current.archived,
    },
    publication: publicationPointer(publication),
  }
}

async function withPublicationTransaction<T>(
  req: PayloadRequest,
  userId: number,
  communityId: number,
  callback: (
    transactionDb: {
      execute: (query: unknown) => Promise<{ rows?: RequestDoc[] }>
    },
  ) => Promise<T>,
): Promise<T> {
  const adapter = req.payload.db as unknown as PublicationTransactionAdapter
  const transactionId = await adapter.beginTransaction()
  if (!transactionId) {
    throw new PublicationEndpointError(
      'PUBLICATION_TRANSACTION_UNAVAILABLE',
      'Atomic sermon publication is temporarily unavailable.',
      503,
    )
  }
  if (!adapter.sessions?.[String(transactionId)]?.db) {
    await adapter.rollbackTransaction(transactionId)
    throw new PublicationEndpointError(
      'PUBLICATION_TRANSACTION_UNAVAILABLE',
      'Atomic sermon publication is temporarily unavailable.',
      503,
    )
  }
  const transactionDb = adapter.sessions[String(transactionId)].db
  const previousTransactionId = req.transactionID
  let committed = false
  try {
    req.transactionID = transactionId
    await transactionDb.execute(sql`
      SELECT pg_advisory_xact_lock(hashtext('syncshow-sermon-change-sequence'));
    `)
    await assertLiveManager(transactionDb, userId, communityId)
    const result = await callback(transactionDb)
    await adapter.commitTransaction(transactionId)
    committed = true
    return result
  } catch (error) {
    if (!committed) await adapter.rollbackTransaction(transactionId)
    throw error
  } finally {
    req.transactionID = previousTransactionId
  }
}

async function publish(
  req: PayloadRequest,
  userId: number,
  communityId: number,
  intent: ManagerSermonPublishIntent,
) {
  return withPublicationTransaction(req, userId, communityId, async transactionDb => {
    if (!await lockSermon(transactionDb, communityId, intent.syncId)) {
      throw new PublicationEndpointError('SERMON_NOT_FOUND', 'Sermon not found.', 404)
    }
    const sermon = await findSermon(req, communityId, intent.syncId)
    if (!sermon) throw new PublicationEndpointError('SERMON_NOT_FOUND', 'Sermon not found.', 404)
    assertSermonCas(sermon, intent)
    const current = inspectCurrentSermon(sermon)
    const sermonId = Number(sermon.id)
    await lockPublication(transactionDb, communityId, sermonId)
    const existingRow = await findSermonPublication(req, communityId, sermonId)
    const existing = existingRow ? validateSermonPublicationRow(existingRow) : null
    assertPublicationCas(existing, intent)
    if (intent.schemaVersion !== 3) {
      await assertManagedMediaSelectionPolicy(
        transactionDb,
        communityId,
        current,
        intent,
        existing,
      )
    }

    const afterCurrentRevision = nextCanonicalPublicationTime(
      String(sermon.syncChangedAt || ''),
    )
    const publishedAt = existing
      ? nextCanonicalPublicationTime(existing.publishedAt, new Date(afterCurrentRevision))
      : afterCurrentRevision
    const commonTransition = {
      documentSource: current.documentSource,
      publishedAt,
      selectedBodyEntryIds: intent.selectedBodyEntryIds,
      selectedMediaIds: intent.selectedMediaIds,
    }
    let transition
    if (intent.schemaVersion === 3) {
      const authority = await lockManagedRecordingForPublication(
        transactionDb,
        communityId,
        sermonId,
        current,
        intent.managedRecordingReviewId,
      )
      const opened = await openSermonMediaObjectForRead(authority.object)
      await opened.close()
      for (const selectedMediaId of intent.selectedMediaIds) {
        const selected = current.document.media.find(media => media.id === selectedMediaId)
        if (
          selected?.url
          && selected.id !== authority.recording.slotId
          && isPublicSermonMediaNamespaceUrl(selected.url)
        ) {
          throw new PublicationEndpointError(
            'MANAGED_RECORDING_SELECTION_CONFLICT',
            'Select only the explicitly reviewed Community-managed recording for this publication.',
            409,
          )
        }
      }
      const slot = current.document.media.find(media => (
        media.id === authority.recording.slotId
      ))
      if (!slot) {
        throw new Error('Publishable managed recording lost its canonical media slot.')
      }
      transition = buildManagerSermonPublicationTransition({
        ...commonTransition,
        managedRecording: {
          slotId: authority.recording.slotId,
          title: slot.title,
          language: authority.recording.language,
          mediaType: authority.recording.mediaType,
          fileName: authority.recording.fileName,
          sha256: authority.recording.sha256,
          sizeBytes: authority.recording.sizeBytes,
          durationSeconds: authority.recording.durationSeconds,
          url: publicSermonMediaUrl(
            derivePublicSermonId(current.syncId),
            authority.recording.sha256,
          ),
        },
      })
    } else if (intent.schemaVersion === 2) {
      transition = buildManagerSermonPublicationTransition({
        ...commonTransition,
        directAudio: intent.directAudio,
      })
    } else {
      transition = buildManagerSermonPublicationTransition(commonTransition)
    }
    const timeZone = await lockedCommunityTimeZone(transactionDb, communityId)
    const syncVersion = intent.expectedSyncVersion + 1
    const updatedSermon = await req.payload.update({
      collection: 'sermons',
      id: sermonId,
      overrideAccess: true,
      showHiddenFields: true,
      context: { syncShowSermonMutation: true },
      req,
      data: {
        title: transition.document.titles[transition.document.defaultLanguage],
        speaker: transition.document.speaker.name,
        preachedAt: payloadPreachedAtForServiceDate(
          transition.document.serviceDate,
          timeZone,
        ),
        series: transition.document.series?.titles[transition.document.defaultLanguage] || null,
        status: 'draft',
        syncCurrentDocumentSource: transition.documentSource,
        syncCurrentRevision: transition.publicRevision,
        syncVersion,
        syncArchived: false,
        syncPublicationStatus: 'published',
        syncVisibility: 'public',
        syncSourceObjects: unavailableSourceObjects(transition.document),
        syncChangedAt: publishedAt,
      },
    }) as unknown as RequestDoc
    const publicationData = {
      community: communityId,
      sermon: sermonId,
      schemaVersion: 1,
      active: true,
      visibility: 'public',
      publicationVersion: (existing?.publicationVersion || 0) + 1,
      publishedAt,
      withdrawnAt: null,
      syncId: intent.syncId,
      publicId: transition.projection.detail.publicId,
      publicRevision: transition.publicRevision,
      publishedDocumentSource: transition.documentSource,
      selectedBodyEntryIds: transition.selectedBodyEntryIds,
      selectedMediaIds: transition.selectedMediaIds,
      detailChecksum: transition.projection.detailChecksum,
      detailSource: transition.projection.detailSource,
      catalogItemSource: serializePublicSermonCatalogItem(
        transition.projection.catalogItem,
      ),
      catalogItemChecksum: '',
    }
    publicationData.catalogItemChecksum = createHash('sha256')
      .update(publicationData.catalogItemSource, 'utf8')
      .digest('hex')
    const storedRow = existingRow
      ? await req.payload.update({
          collection: 'syncshow-sermon-publications' as never,
          id: existingRow.id as never,
          overrideAccess: true,
          showHiddenFields: true,
          req,
          data: publicationData as never,
        })
      : await req.payload.create({
          collection: 'syncshow-sermon-publications' as never,
          overrideAccess: true,
          showHiddenFields: true,
          req,
          data: publicationData as never,
        })
    const stored = validateSermonPublicationRow(storedRow)
    await refreshPublicSermonCatalog(req, communityId, publishedAt)
    await recordSermonChange(req, communityId, updatedSermon)
    return mutationResponse(updatedSermon, stored)
  })
}

async function withdraw(
  req: PayloadRequest,
  userId: number,
  communityId: number,
  intent: ManagerSermonWithdrawIntent,
) {
  return withPublicationTransaction(req, userId, communityId, async transactionDb => {
    if (!await lockSermon(transactionDb, communityId, intent.syncId)) {
      throw new PublicationEndpointError('SERMON_NOT_FOUND', 'Sermon not found.', 404)
    }
    const sermon = await findSermon(req, communityId, intent.syncId)
    if (!sermon) throw new PublicationEndpointError('SERMON_NOT_FOUND', 'Sermon not found.', 404)
    assertSermonCas(sermon, intent)
    const sermonId = Number(sermon.id)
    await lockPublication(transactionDb, communityId, sermonId)
    const existingRow = await findSermonPublication(req, communityId, sermonId)
    const existing = existingRow ? validateSermonPublicationRow(existingRow) : null
    assertPublicationCas(existing, intent)
    if (!existingRow || !existing?.active) {
      throw new PublicationEndpointError(
        'PUBLICATION_NOT_ACTIVE',
        'This sermon is not currently published.',
        409,
      )
    }
    const updated = await deactivateSermonPublicationForArchive(
      req,
      communityId,
      sermonId,
      nextCanonicalPublicationTime(String(sermon.syncChangedAt || '')),
    )
    if (!updated || updated.active) {
      throw new Error('Sermon publication withdrawal did not deactivate its pointer.')
    }
    return mutationResponse(sermon, updated)
  })
}

async function publicationForSermon(
  req: PayloadRequest,
  communityId: number,
  sermonId: number,
) {
  const row = await findSermonPublication(req, communityId, sermonId)
  return row ? validateSermonPublicationRow(row) : null
}

function reviewId(req: PayloadRequest): string {
  return managerSermonRecordingReviewId(req.routeParams?.reviewId)
}

function managerReviewDatabase(req: PayloadRequest) {
  const database = (req.payload.db as unknown as {
    drizzle?: { execute: (query: unknown) => Promise<DrizzleRows> }
  }).drizzle
  if (!database) {
    throw new PublicationEndpointError(
      'MANAGED_RECORDING_REVIEW_UNAVAILABLE',
      'Private managed-recording review is temporarily unavailable.',
      503,
    )
  }
  return database
}

async function managedRecordingsForSermon(
  req: PayloadRequest,
  communityId: number,
  sermon: RequestDoc,
  selectedReviewId: string | null = null,
): Promise<readonly ManagerSermonRecordingAuthority[]> {
  const current = inspectCurrentSermon(sermon)
  const result = await managerReviewDatabase(req).execute(sql`
    SELECT
      u."upload_id" AS "uploadId",
      u."schema_version" AS "schemaVersion",
      u."community_id" AS "uploadCommunityId",
      u."sermon_id" AS "sermonId",
      u."state" AS "state",
      u."sync_id" AS "syncId",
      u."expected_sync_version" AS "expectedSyncVersion",
      u."expected_current_revision" AS "expectedCurrentRevision",
      u."recording_id" AS "recordingId",
      u."kind" AS "kind",
      u."language" AS "language",
      u."media_type" AS "mediaType",
      u."file_name" AS "fileName",
      u."sha256" AS "sha256",
      u."size_bytes" AS "sizeBytes",
      u."duration_seconds" AS "durationSeconds",
      u."completed_at" AS "completedAt",
      u."object_id" AS "objectId",
      o."id" AS "objectRowId",
      o."community_id" AS "objectCommunityId",
      o."sha256" AS "objectSha256",
      o."size_bytes" AS "objectSizeBytes",
      o."media_type" AS "objectMediaType",
      o."storage_key" AS "storageKey"
    FROM "syncshow_sermon_media_uploads" u
    JOIN "syncshow_sermon_media_objects" o
      ON o."id" = u."object_id"
      AND o."community_id" = u."community_id"
    WHERE u."community_id" = ${communityId}
      AND u."sermon_id" = ${Number(sermon.id)}
      AND u."sync_id" = ${current.syncId}
      AND u."state" IN ('complete', 'superseded')
      AND u."object_id" IS NOT NULL
      AND (${selectedReviewId}::text IS NULL OR u."upload_id" = ${selectedReviewId})
    ORDER BY u."completed_at" DESC, u."upload_id" ASC
    LIMIT ${selectedReviewId === null ? 101 : 2};
  `)
  const rows = resultRows(result)
  if (selectedReviewId === null && rows.length > 100) {
    throw new PublicationEndpointError(
      'MANAGED_RECORDING_REVIEW_TOO_LARGE',
      'This sermon has too many preserved recordings for manager review.',
      503,
    )
  }
  if (selectedReviewId !== null && rows.length !== 1) {
    throw new ManagerSermonMediaReviewError(
      'MANAGED_RECORDING_NOT_FOUND',
      'Managed recording not found.',
      404,
    )
  }
  return rows.map(row => normalizeManagerSermonRecording(row, {
    syncId: current.syncId,
    syncVersion: current.syncVersion,
    currentRevision: current.currentRevision,
    communityId,
    sermonId: Number(sermon.id),
    archived: current.archived,
    document: current.document,
  })).sort((left, right) => {
    const eligibility = Number(right.recording.eligibility === 'publishable')
      - Number(left.recording.eligibility === 'publishable')
    if (eligibility) return eligibility
    const completion = right.recording.completedAt.localeCompare(
      left.recording.completedAt,
    )
    return completion || left.recording.reviewId.localeCompare(right.recording.reviewId)
  })
}

async function managedRecordingContext(req: PayloadRequest) {
  const { communityId } = await managerReadContext(req)
  const syncId = routeSyncId(req)
  const sermon = await findSermon(req, communityId, syncId)
  if (!sermon) {
    throw new PublicationEndpointError('SERMON_NOT_FOUND', 'Sermon not found.', 404)
  }
  return { communityId, sermon, current: inspectCurrentSermon(sermon) }
}

function managedRecordingResponseHeaders(
  req: PayloadRequest,
  authority: ManagerSermonRecordingAuthority,
  disposition: 'inline' | 'attachment',
  range: Readonly<{ startByte: number; endByte: number }> | null,
) {
  const headers = responseHeaders(req, {
    'Accept-Ranges': 'bytes',
    'Content-Disposition': managerSermonRecordingContentDisposition(
      disposition,
      authority.recording.fileName,
    ),
    'Content-Length': String(range
      ? range.endByte - range.startByte + 1
      : authority.recording.sizeBytes),
    'Content-Type': authority.recording.mediaType,
    'Cross-Origin-Resource-Policy': 'same-origin',
    ETag: `"sha256:${authority.recording.sha256}"`,
    'X-Robots-Tag': 'noindex, noarchive',
  })
  if (range) {
    headers.set(
      'Content-Range',
      `bytes ${range.startByte}-${range.endByte}/${authority.recording.sizeBytes}`,
    )
  }
  return headers
}

async function serveManagedRecording(
  req: PayloadRequest,
  disposition: 'inline' | 'attachment',
  head: boolean,
) {
  const { communityId, sermon } = await managedRecordingContext(req)
  const selected = reviewId(req)
  const authority = (await managedRecordingsForSermon(
    req,
    communityId,
    sermon,
    selected,
  ))[0]
  const etag = `"sha256:${authority.recording.sha256}"`
  const ifRange = req.headers.get('if-range')
  // RFC 9110 defines Range for GET. A HEAD response reports the complete
  // representation metadata and therefore ignores Range and If-Range.
  const range = head
    ? null
    : managerSermonRecordingByteRange(
        ifRange === null || ifRange === etag ? req.headers.get('range') : null,
        authority.recording.sizeBytes,
      )
  const headers = managedRecordingResponseHeaders(
    req,
    authority,
    disposition,
    range,
  )
  const opened = await openSermonMediaObjectForRead(authority.object)
  if (head) {
    await opened.close()
    return new Response(null, { status: range ? 206 : 200, headers })
  }

  try {
    const stream = opened.createReadStream(
      range?.startByte ?? 0,
      range?.endByte ?? authority.recording.sizeBytes - 1,
    )
    return new Response(
      Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>,
      { status: range ? 206 : 200, headers },
    )
  } catch (error) {
    await opened.close()
    throw error
  }
}

function databaseTimestamp(value: unknown, label: string): string {
  const source = value instanceof Date ? value.toISOString() : String(value || '')
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(source)) {
    if (Number.isFinite(Date.parse(source)) && new Date(source).toISOString() === source) {
      return source
    }
    throw new Error(`${label} is invalid.`)
  }
  // Raw node-postgres TIMESTAMPTZ values use PostgreSQL's offset form instead
  // of the ISO bytes returned by Payload's Local API.
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?[+-]\d{2}(?::?\d{2})?$/.test(source)) {
    throw new Error(`${label} is invalid.`)
  }
  const parsed = new Date(source)
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} is invalid.`)
  return parsed.toISOString()
}

function databaseServiceDate(value: unknown, timeZone: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return serviceDateForProjectedPreachedAt(
    databaseTimestamp(value, 'Stored sermon date'),
    String(timeZone || ''),
  )
}

function boundedSelection(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length > 256) throw new Error(`${label} is invalid.`)
  const seen = new Set<string>()
  return value.map(raw => {
    const id = String(raw)
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id) || seen.has(id)) {
      throw new Error(`${label} is invalid.`)
    }
    seen.add(id)
    return id
  })
}

function publicationPointerFromSummaryRow(row: RequestDoc) {
  if (row.publicationRowId == null) return null
  const schemaVersion = Number(row.publicationSchemaVersion)
  const publicationVersion = Number(row.publicationVersion)
  const active = row.publicationActive
  const publicationVisibility = String(row.publicationVisibility || '')
  const publicRevision = String(row.publicRevision || '')
  const publicId = String(row.publicId || '')
  const detailChecksum = String(row.detailChecksum || '')
  const publishedAt = databaseTimestamp(row.publishedAt, 'Stored publication time')
  const withdrawnAt = row.withdrawnAt == null
    ? null
    : databaseTimestamp(row.withdrawnAt, 'Stored withdrawal time')
  if (
    schemaVersion !== 1
    || typeof active !== 'boolean'
    || publicationVisibility !== 'public'
    || !Number.isSafeInteger(publicationVersion)
    || publicationVersion < 1
    || !/^[a-f0-9]{64}$/.test(publicRevision)
    || !/^sermon-[a-f0-9]{64}$/.test(publicId)
    || !/^[a-f0-9]{64}$/.test(detailChecksum)
    || (active && withdrawnAt !== null)
    || (!active && withdrawnAt === null)
    || (withdrawnAt !== null && Date.parse(withdrawnAt) < Date.parse(publishedAt))
  ) {
    throw new Error('Stored publication summary is invalid.')
  }
  return {
    schemaVersion: 1,
    active,
    publicationVersion,
    publicRevision,
    publicId,
    detailChecksum,
    publishedAt,
    withdrawnAt,
    selectedBodyEntryIds: boundedSelection(
      row.selectedBodyEntryIds,
      'Stored body selections',
    ),
    selectedMediaIds: boundedSelection(
      row.selectedMediaIds,
      'Stored media selections',
    ),
  }
}

const listEndpoint: Endpoint = {
  path: '/community/sermon-publications',
  method: 'get',
  handler: async req => {
    try {
      const { communityId } = await managerReadContext(req)
      const database = (req.payload.db as unknown as {
        drizzle?: { execute: (query: unknown) => Promise<DrizzleRows> }
      }).drizzle
      if (!database) {
        throw new PublicationEndpointError(
          'PUBLICATION_REVIEW_UNAVAILABLE',
          'The bounded sermon publication review list is temporarily unavailable.',
          503,
        )
      }
      const result = await database.execute(sql`
        SELECT
          s."id" AS "sermonRowId",
          s."sync_id" AS "syncId",
          s."sync_version" AS "syncVersion",
          s."sync_current_revision" AS "currentRevision",
          s."sync_changed_at" AS "updatedAt",
          s."sync_archived" AS "archived",
          s."title" AS "title",
          s."speaker" AS "speaker",
          s."preached_at" AS "serviceDate",
          c."time_zone" AS "timeZone",
          s."sync_publication_status" AS "publicationStatus",
          s."sync_visibility" AS "visibility",
          p."id" AS "publicationRowId",
          p."schema_version" AS "publicationSchemaVersion",
          p."active" AS "publicationActive",
          p."visibility" AS "publicationVisibility",
          p."publication_version" AS "publicationVersion",
          p."published_at" AS "publishedAt",
          p."withdrawn_at" AS "withdrawnAt",
          p."public_id" AS "publicId",
          p."public_revision" AS "publicRevision",
          p."selected_body_entry_ids" AS "selectedBodyEntryIds",
          p."selected_media_ids" AS "selectedMediaIds",
          p."detail_checksum" AS "detailChecksum"
        FROM "sermons" s
        JOIN "communities" c
          ON c."id" = s."community_id"
        LEFT JOIN "syncshow_sermon_publications" p
          ON p."sermon_id" = s."id"
          AND p."community_id" = s."community_id"
          AND p."sync_id" = s."sync_id"
        WHERE s."community_id" = ${communityId}
          AND s."sync_id" IS NOT NULL
          AND s."sync_archived" IS NOT TRUE
          AND (
            s."sync_publication_status" = 'ready'
            OR p."active" = true
          )
        ORDER BY s."sync_changed_at" DESC, s."sync_id" ASC
        LIMIT 1001;
      `)
      const rows = resultRows(result)
      if (rows.length > 1000) {
        throw new PublicationEndpointError(
          'PUBLICATION_REVIEW_TOO_LARGE',
          'This Community has too many sermons for the publication review list.',
          503,
        )
      }
      const items = rows.map(row => {
        const syncVersion = Number(row.syncVersion)
        const syncId = String(row.syncId || '')
        const currentRevision = String(row.currentRevision || '')
        const publicationStatus = String(row.publicationStatus || '')
        const visibility = String(row.visibility || '')
        if (
          !Number.isSafeInteger(syncVersion)
          || syncVersion < 1
          || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(syncId)
          || !/^[a-f0-9]{64}$/.test(currentRevision)
          || !['draft', 'ready', 'published', 'archived'].includes(publicationStatus)
          || !['private', 'members', 'unlisted', 'public'].includes(visibility)
        ) {
          throw new Error('Stored sermon publication summary is invalid.')
        }
        return {
          syncId,
          syncVersion,
          currentRevision,
          updatedAt: databaseTimestamp(row.updatedAt, 'Stored sermon update time'),
          archived: row.archived === true,
          title: String(row.title || ''),
          speaker: String(row.speaker || ''),
          serviceDate: databaseServiceDate(row.serviceDate, row.timeZone),
          publicationStatus,
          visibility,
          publication: publicationPointerFromSummaryRow(row),
        }
      })
      return json(req, { schemaVersion: 1, items })
    } catch (error) {
      return endpointError(req, error)
    }
  },
}

const detailEndpoint: Endpoint = {
  path: '/community/sermon-publications/:syncId',
  method: 'get',
  handler: async req => {
    try {
      const { communityId } = await managerReadContext(req)
      const syncId = routeSyncId(req)
      const sermon = await findSermon(req, communityId, syncId)
      if (!sermon) {
        throw new PublicationEndpointError('SERMON_NOT_FOUND', 'Sermon not found.', 404)
      }
      const current = inspectCurrentSermon(sermon)
      const publication = await publicationForSermon(
        req,
        communityId,
        Number(sermon.id),
      )
      return json(req, {
        schemaVersion: 1,
        sermon: {
          syncId: current.syncId,
          syncVersion: current.syncVersion,
          currentRevision: current.currentRevision,
          updatedAt: current.updatedAt,
          archived: current.archived,
          documentSource: current.documentSource,
        },
        publication: publication ? publicationPointer(publication) : null,
      })
    } catch (error) {
      return endpointError(req, error)
    }
  },
}

const managedRecordingsEndpoint: Endpoint = {
  path: '/community/sermon-publications/:syncId/managed-recordings',
  method: 'get',
  handler: async req => {
    try {
      const { communityId, sermon, current } = await managedRecordingContext(req)
      const authorities = await managedRecordingsForSermon(
        req,
        communityId,
        sermon,
      )
      return json(req, {
        schemaVersion: 1,
        sermon: {
          syncId: current.syncId,
          syncVersion: current.syncVersion,
          currentRevision: current.currentRevision,
        },
        recordings: authorities.map(authority => authority.recording),
      })
    } catch (error) {
      return endpointError(req, error)
    }
  },
}

function managedRecordingByteEndpoint(
  disposition: 'inline' | 'attachment',
  method: 'get' | 'head',
): Endpoint {
  return {
    path: `/community/sermon-publications/:syncId/managed-recordings/:reviewId/${
      disposition === 'inline' ? 'content' : 'download'
    }`,
    method,
    handler: async req => {
      try {
        return await serveManagedRecording(req, disposition, method === 'head')
      } catch (error) {
        return endpointError(req, error)
      }
    },
  }
}

const publishEndpoint: Endpoint = {
  path: '/community/sermon-publications/:syncId/publish',
  method: 'post',
  handler: async req => {
    try {
      const { userId, communityId } = await managerReadContext(req)
      const syncId = routeSyncId(req)
      const intent = normalizeManagerSermonPublishIntent(await boundedJson(req))
      if (intent.syncId !== syncId) {
        throw new PublicationEndpointError(
          'IMMUTABLE_SYNC_ID',
          'The route and publication intent sermon IDs must match.',
          409,
        )
      }
      return json(req, await publish(req, userId, communityId, intent))
    } catch (error) {
      return endpointError(req, error)
    }
  },
}

const withdrawEndpoint: Endpoint = {
  path: '/community/sermon-publications/:syncId/withdraw',
  method: 'post',
  handler: async req => {
    try {
      const { userId, communityId } = await managerReadContext(req)
      const syncId = routeSyncId(req)
      const intent = normalizeManagerSermonWithdrawIntent(await boundedJson(req))
      if (intent.syncId !== syncId) {
        throw new PublicationEndpointError(
          'IMMUTABLE_SYNC_ID',
          'The route and publication intent sermon IDs must match.',
          409,
        )
      }
      return json(req, await withdraw(req, userId, communityId, intent))
    } catch (error) {
      return endpointError(req, error)
    }
  },
}

export const managerSermonPublicationEndpoints: Endpoint[] = [
  listEndpoint,
  detailEndpoint,
  managedRecordingsEndpoint,
  managedRecordingByteEndpoint('inline', 'get'),
  managedRecordingByteEndpoint('inline', 'head'),
  managedRecordingByteEndpoint('attachment', 'get'),
  managedRecordingByteEndpoint('attachment', 'head'),
  publishEndpoint,
  withdrawEndpoint,
]
