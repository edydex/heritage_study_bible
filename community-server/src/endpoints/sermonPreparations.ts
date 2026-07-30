import { sql } from '@payloadcms/db-postgres'
import {
  headersWithCors,
  type Endpoint,
  type PayloadRequest,
} from 'payload'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { SyncShowProtocolError } from '@/lib/syncShowProtocol'
import {
  createCanonicalSermon,
  type CanonicalSermonRecord,
  type CanonicalSermonTransactionDatabase,
} from '@/lib/syncshow/CanonicalSermonStore'
import {
  ManagerSermonPreparationError,
  MAX_MANAGER_SERMON_PREPARATION_REQUEST_BYTES,
  prepareManagerSermon,
} from '@/lib/syncshow/ManagerSermonPreparation'
import { parseSermonDocument } from '@/lib/syncshow/SermonDocument'

type RequestDoc = Record<string, unknown>

class SermonPreparationEndpointError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'SermonPreparationEndpointError'
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
  if (error instanceof SermonPreparationEndpointError) {
    return json(req, { code: error.code, error: error.message }, { status: error.status })
  }
  if (error instanceof ManagerSermonPreparationError) {
    return json(req, { code: error.code, error: error.message }, { status: 400 })
  }
  if (error instanceof SyncShowProtocolError) {
    return json(req, { code: error.code, error: error.message }, { status: error.status })
  }
  req.payload.logger.error({ err: error }, 'Manager sermon preparation endpoint failed')
  return json(
    req,
    {
      code: 'SERMON_PREPARATION_SERVER_ERROR',
      error: 'The Community server could not prepare this sermon.',
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

async function boundedJson(req: PayloadRequest): Promise<RequestDoc> {
  const contentType = String(req.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
  if (contentType !== 'application/json') {
    throw new SermonPreparationEndpointError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Sermon preparation requests must use application/json.',
      415,
    )
  }
  const contentLength = Number(req.headers.get('content-length') || 0)
  if (
    Number.isFinite(contentLength)
    && contentLength > MAX_MANAGER_SERMON_PREPARATION_REQUEST_BYTES
  ) {
    throw new SermonPreparationEndpointError(
      'REQUEST_TOO_LARGE',
      `Sermon preparation must be ${MAX_MANAGER_SERMON_PREPARATION_REQUEST_BYTES} bytes or fewer.`,
      413,
    )
  }
  if (!req.text) {
    throw new SermonPreparationEndpointError(
      'INVALID_REQUEST',
      'Sermon preparation body is unavailable.',
      400,
    )
  }
  const source = await req.text()
  if (Buffer.byteLength(source, 'utf8') > MAX_MANAGER_SERMON_PREPARATION_REQUEST_BYTES) {
    throw new SermonPreparationEndpointError(
      'REQUEST_TOO_LARGE',
      `Sermon preparation must be ${MAX_MANAGER_SERMON_PREPARATION_REQUEST_BYTES} bytes or fewer.`,
      413,
    )
  }
  try {
    const value = JSON.parse(source || '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid')
    return value as RequestDoc
  } catch {
    throw new SermonPreparationEndpointError(
      'INVALID_JSON',
      'Sermon preparation body must be a JSON object.',
      400,
    )
  }
}

async function authenticatedManagerUserId(req: PayloadRequest): Promise<number> {
  if ((req.headers.get('authorization') || '').startsWith('SyncShow ')) {
    throw new SermonPreparationEndpointError(
      'COMMUNITY_AUTH_REQUIRED',
      'A signed-in Community manager is required to prepare a sermon.',
      401,
    )
  }
  const current = req.user || (await req.payload.auth({ headers: req.headers })).user
  const userId = relationId(current)
  if (!userId) {
    throw new SermonPreparationEndpointError(
      'COMMUNITY_AUTH_REQUIRED',
      'A signed-in Community manager is required to prepare a sermon.',
      401,
    )
  }
  return userId
}

async function configuredCommunity(req: PayloadRequest): Promise<number> {
  const communityId = await getConfiguredCommunityId(req.payload)
  if (communityId == null) {
    throw new SermonPreparationEndpointError(
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
): Promise<boolean> {
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

async function managerContext(req: PayloadRequest) {
  const userId = await authenticatedManagerUserId(req)
  const communityId = await configuredCommunity(req)
  if (!await hasManagerMembership(req, userId, communityId)) {
    throw new SermonPreparationEndpointError(
      'MANAGER_REQUIRED',
      'Your current Community role cannot prepare sermons.',
      403,
    )
  }
  return { userId, communityId }
}

async function assertLiveManager(
  database: CanonicalSermonTransactionDatabase,
  userId: number,
  communityId: number,
) {
  const membership = (await database.execute(sql`
    SELECT "id"
    FROM "memberships"
    WHERE "user_id" = ${userId}
      AND "community_id" = ${communityId}
      AND "role" IN ('owner', 'admin', 'leader')
    FOR SHARE;
  `)).rows?.[0]
  if (!membership) {
    throw new SermonPreparationEndpointError(
      'MANAGER_REQUIRED',
      'Your Community manager role changed. Sign in again before preparing a sermon.',
      403,
    )
  }
}

function responseSermon(
  sermon: CanonicalSermonRecord,
  created: boolean,
) {
  const document = parseSermonDocument(String(sermon.syncCurrentDocumentSource || ''))
  const primary = document.references.find(reference => (
    reference.role === 'primary' && reference.reviewStatus === 'confirmed'
  ))
  const recordId = relationId(sermon.id)
  const syncVersion = Number(sermon.syncVersion)
  if (
    !recordId
    || !Number.isSafeInteger(syncVersion)
    || syncVersion < 1
    || !primary
  ) {
    throw new Error('Stored manager-prepared sermon is invalid.')
  }
  return {
    schemaVersion: 1,
    created,
    sermon: {
      recordId,
      syncId: document.id,
      syncVersion,
      currentRevision: String(sermon.syncCurrentRevision || ''),
      title: document.titles[document.defaultLanguage],
      speaker: document.speaker.name,
      serviceDate: document.serviceDate,
      passageLabel: primary.enteredText,
      publicationStatus: document.publication.status,
      visibility: document.publication.visibility,
      bodyEntryCount: document.body?.length || 0,
    },
  }
}

const prepareSermon: Endpoint = {
  path: '/community/sermon-preparations',
  method: 'post',
  handler: async req => {
    try {
      const { userId, communityId } = await managerContext(req)
      const prepared = prepareManagerSermon(await boundedJson(req))
      const idempotencyKey = req.headers.get('idempotency-key')
      if (!idempotencyKey) {
        throw new SermonPreparationEndpointError(
          'PRECONDITION_REQUIRED',
          'Idempotency-Key is required for sermon preparation.',
          428,
        )
      }
      if (idempotencyKey !== prepared.idempotencyKey) {
        throw new SermonPreparationEndpointError(
          'IDEMPOTENCY_MISMATCH',
          'The sermon preparation request no longer matches its retry identity.',
          409,
        )
      }
      const result = await createCanonicalSermon(
        req,
        communityId,
        prepared.write,
        prepared.idempotencyKey,
        {
          authorize: database => assertLiveManager(database, userId, communityId),
        },
      )
      return json(
        req,
        responseSermon(result.sermon, result.created),
        { status: result.created ? 201 : 200 },
      )
    } catch (error) {
      return endpointError(req, error)
    }
  },
}

export const managerSermonPreparationEndpoints: Endpoint[] = [prepareSermon]
