import { sql } from '@payloadcms/db-postgres'
import { createHash } from 'node:crypto'
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
  refreshPublicSermonCatalog,
  validateSermonPublicationRow,
} from '@/lib/syncshow/SermonPublicationStore'
import {
  parseSermonDocument,
  serializeSermonDocument,
} from '@/lib/syncshow/SermonDocument'
import {
  lockedCommunityTimeZone,
  payloadPreachedAtForServiceDate,
  serviceDateForProjectedPreachedAt,
} from '@/lib/syncshow/SermonDateProjection'
import { serializePublicSermonCatalogItem } from '@/lib/syncshow/PublicSermonPublication'

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
  if ((req.headers.get('authorization') || '').startsWith('SyncShow ')) {
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
    const sermonId = Number(sermon.id)
    await lockPublication(transactionDb, communityId, sermonId)
    const existingRow = await findSermonPublication(req, communityId, sermonId)
    const existing = existingRow ? validateSermonPublicationRow(existingRow) : null
    assertPublicationCas(existing, intent)

    const afterCurrentRevision = nextCanonicalPublicationTime(
      String(sermon.syncChangedAt || ''),
    )
    const publishedAt = existing
      ? nextCanonicalPublicationTime(existing.publishedAt, new Date(afterCurrentRevision))
      : afterCurrentRevision
    const transition = buildManagerSermonPublicationTransition({
      documentSource: String(sermon.syncCurrentDocumentSource || ''),
      publishedAt,
      selectedBodyEntryIds: intent.selectedBodyEntryIds,
      selectedMediaIds: intent.selectedMediaIds,
      directAudio: intent.schemaVersion === 2 ? intent.directAudio : null,
    })
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
  publishEndpoint,
  withdrawEndpoint,
]
