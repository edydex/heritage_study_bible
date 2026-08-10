import {
  headersWithCors,
  type Endpoint,
  type PayloadRequest,
} from 'payload'
import {
  normalizeSermonMediaCompleteRequest,
  normalizeSermonMediaIdempotencyKey,
  normalizeSermonMediaInitRequest,
  requireSermonMediaEnabled,
  SERMON_MEDIA_SCHEMA_VERSION,
  sermonMediaErrorEnvelope,
  SermonMediaError,
  type SermonMediaUploadView,
  sermonMediaEnabled,
} from '@/lib/syncshow/SermonMedia'
import {
  authorizeSermonMedia,
  cancelSermonMediaUpload,
  completeSermonMediaUpload,
  getSermonMediaUpload,
  initializeSermonMediaUpload,
  putSermonMediaChunk,
  type SermonMediaChunkRecord,
} from '@/lib/syncshow/SermonMediaStore'
import {
  storeSermonMediaChunk,
} from '@/lib/syncshow/SermonMediaStorage'

type UnknownRecord = Record<string, unknown>

const MAX_JSON_BYTES = 32 * 1024

type SermonMediaEndpointDependencies = Readonly<{
  enabled: typeof requireSermonMediaEnabled
  authorize: typeof authorizeSermonMedia
  initialize: typeof initializeSermonMediaUpload
  get: typeof getSermonMediaUpload
  putChunk: typeof putSermonMediaChunk
  storeChunk: typeof storeSermonMediaChunk
  complete: typeof completeSermonMediaUpload
  cancel: typeof cancelSermonMediaUpload
}>

const defaultDependencies: SermonMediaEndpointDependencies = {
  enabled: requireSermonMediaEnabled,
  authorize: authorizeSermonMedia,
  initialize: initializeSermonMediaUpload,
  get: getSermonMediaUpload,
  putChunk: putSermonMediaChunk,
  storeChunk: storeSermonMediaChunk,
  complete: completeSermonMediaUpload,
  cancel: cancelSermonMediaUpload,
}

function responseHeaders(req: PayloadRequest, extra: HeadersInit = {}) {
  const headers = headersWithCors({ headers: new Headers(extra), req })
  headers.set('Cache-Control', 'private, no-store')
  headers.set('Vary', 'Authorization')
  headers.set('X-Content-Type-Options', 'nosniff')
  return headers
}

function json(
  req: PayloadRequest,
  value: unknown,
  init: ResponseInit = {},
) {
  return Response.json(value, {
    ...init,
    headers: responseHeaders(req, init.headers),
  })
}

function errorResponse(req: PayloadRequest, error: unknown) {
  if (error instanceof SermonMediaError) {
    const headers = new Headers()
    if (error.retryAfterSeconds !== null) {
      headers.set('Retry-After', String(error.retryAfterSeconds))
    }
    return json(
      req,
      sermonMediaErrorEnvelope(error),
      { status: error.status, headers },
    )
  }
  req.payload.logger.error(
    { err: error },
    'SyncShow managed sermon-media request failed',
  )
  return json(
    req,
    sermonMediaErrorEnvelope(new SermonMediaError(
      'SERVER_ERROR',
      'The Community server could not complete the private recording request.',
      500,
    )),
    { status: 500 },
  )
}

async function boundedJson(req: PayloadRequest) {
  const contentType = String(req.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
  if (contentType !== 'application/json') {
    throw new SermonMediaError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Recording upload JSON requests must use application/json.',
      415,
    )
  }
  const contentLength = req.headers.get('content-length')
  if (
    contentLength
    && (
      !/^(0|[1-9]\d*)$/.test(contentLength)
      || Number(contentLength) > MAX_JSON_BYTES
    )
  ) {
    throw new SermonMediaError(
      'REQUEST_TOO_LARGE',
      `Recording upload JSON requests must be ${MAX_JSON_BYTES} bytes or fewer.`,
      413,
    )
  }
  if (!req.body) {
    throw new SermonMediaError(
      'INVALID_REQUEST',
      'This request has no readable JSON body.',
    )
  }
  const chunks: Uint8Array[] = []
  let sizeBytes = 0
  const reader = req.body.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!(value instanceof Uint8Array)) {
        throw new SermonMediaError(
          'INVALID_REQUEST',
          'This request has an invalid JSON body stream.',
        )
      }
      sizeBytes += value.byteLength
      if (sizeBytes > MAX_JSON_BYTES) {
        await reader.cancel('sermon-media JSON body exceeded limit')
          .catch(() => undefined)
        throw new SermonMediaError(
          'REQUEST_TOO_LARGE',
          `Recording upload JSON requests must be ${MAX_JSON_BYTES} bytes or fewer.`,
          413,
        )
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  let source: string
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(
      Buffer.concat(chunks.map(chunk =>
        Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)
      )),
    )
    const parsed = JSON.parse(source)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object')
    }
    return parsed as UnknownRecord
  } catch {
    throw new SermonMediaError(
      'INVALID_JSON',
      'The recording upload body must be a JSON object.',
    )
  }
}

function routeUploadId(req: PayloadRequest) {
  const uploadId = String(req.routeParams?.id || '')
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(uploadId)) {
    throw new SermonMediaError(
      'UPLOAD_NOT_FOUND',
      'Recording upload not found.',
      404,
    )
  }
  return uploadId
}

function routeChunkIndex(req: PayloadRequest) {
  const raw = String(req.routeParams?.index || '')
  if (!/^(0|[1-9]\d*)$/.test(raw)) {
    throw new SermonMediaError(
      'INVALID_CHUNK_INDEX',
      'The recording chunk index is invalid.',
    )
  }
  const index = Number(raw)
  if (!Number.isSafeInteger(index)) {
    throw new SermonMediaError(
      'INVALID_CHUNK_INDEX',
      'The recording chunk index is invalid.',
    )
  }
  return index
}

function idempotencyKey(req: PayloadRequest) {
  return normalizeSermonMediaIdempotencyKey(
    req.headers.get('idempotency-key'),
  )
}

function uploadEnvelope(upload: SermonMediaUploadView) {
  return {
    schemaVersion: SERMON_MEDIA_SCHEMA_VERSION,
    upload,
  }
}

function publicChunk(chunk: SermonMediaChunkRecord) {
  return {
    index: chunk.index,
    sha256: chunk.sha256,
    sizeBytes: chunk.sizeBytes,
    receivedAt: chunk.receivedAt,
  }
}

export function createSermonMediaEndpoints(
  dependencies: SermonMediaEndpointDependencies = defaultDependencies,
): Endpoint[] {
  const initialize: Endpoint = {
    path: '/community/syncshow/v1/sermon-media/uploads',
    method: 'post',
    handler: async req => {
      try {
        dependencies.enabled()
        const authority = await dependencies.authorize(req, 'write')
        const key = idempotencyKey(req)
        const request = normalizeSermonMediaInitRequest(
          await boundedJson(req),
        )
        const result = await dependencies.initialize(
          req,
          authority,
          request,
          key,
        )
        return json(req, uploadEnvelope(result.upload), {
          status: result.created ? 201 : 200,
        })
      } catch (error) {
        return errorResponse(req, error)
      }
    },
  }

  const status: Endpoint = {
    path: '/community/syncshow/v1/sermon-media/uploads/:id',
    method: 'get',
    handler: async req => {
      try {
        dependencies.enabled()
        const authority = await dependencies.authorize(req, 'read')
        const upload = await dependencies.get(
          req,
          authority,
          routeUploadId(req),
        )
        return json(req, uploadEnvelope(upload))
      } catch (error) {
        return errorResponse(req, error)
      }
    },
  }

  const putChunk: Endpoint = {
    path: '/community/syncshow/v1/sermon-media/uploads/:id/chunks/:index',
    method: 'put',
    handler: async req => {
      try {
        dependencies.enabled()
        const contentType = String(req.headers.get('content-type') || '')
          .split(';', 1)[0]
          .trim()
          .toLowerCase()
        if (contentType !== 'application/octet-stream') {
          throw new SermonMediaError(
            'UNSUPPORTED_MEDIA_TYPE',
            'Recording chunks must use application/octet-stream.',
            415,
          )
        }
        const contentEncoding =
          String(req.headers.get('content-encoding') || 'identity')
            .trim()
            .toLowerCase()
        if (contentEncoding !== 'identity') {
          throw new SermonMediaError(
            'UNSUPPORTED_CONTENT_ENCODING',
            'Recording chunks must not use HTTP content encoding.',
            415,
          )
        }
        const authority = await dependencies.authorize(req, 'write')
        const uploadId = routeUploadId(req)
        const rawHeaders = {
          index: routeChunkIndex(req),
          contentLength: req.headers.get('content-length'),
          contentRange: req.headers.get('content-range'),
          sha256: req.headers.get('x-content-sha256'),
        }
        const result = await dependencies.putChunk(
          req,
          authority,
          uploadId,
          rawHeaders,
          idempotencyKey(req),
          async headers => await dependencies.storeChunk({
            uploadId,
            headers,
            body: req.body ?? null,
          }),
        )
        return json(req, {
          schemaVersion: SERMON_MEDIA_SCHEMA_VERSION,
          chunk: publicChunk(result.chunk),
          upload: result.upload,
        }, { status: result.created ? 201 : 200 })
      } catch (error) {
        return errorResponse(req, error)
      }
    },
  }

  const complete: Endpoint = {
    path: '/community/syncshow/v1/sermon-media/uploads/:id/complete',
    method: 'post',
    handler: async req => {
      try {
        dependencies.enabled()
        const authority = await dependencies.authorize(req, 'write')
        normalizeSermonMediaCompleteRequest(await boundedJson(req))
        const completion = await dependencies.complete(
          req,
          authority,
          routeUploadId(req),
          idempotencyKey(req),
        )
        return json(req, uploadEnvelope(completion.upload), {
          status: completion.accepted ? 202 : 200,
        })
      } catch (error) {
        return errorResponse(req, error)
      }
    },
  }

  const cancel: Endpoint = {
    path: '/community/syncshow/v1/sermon-media/uploads/:id',
    method: 'delete',
    handler: async req => {
      try {
        dependencies.enabled()
        const authority = await dependencies.authorize(req, 'write')
        const upload = await dependencies.cancel(
          req,
          authority,
          routeUploadId(req),
          idempotencyKey(req),
        )
        return json(req, uploadEnvelope(upload))
      } catch (error) {
        return errorResponse(req, error)
      }
    },
  }

  return [initialize, status, putChunk, complete, cancel]
}

export const sermonMediaEndpoints = sermonMediaEnabled()
  ? createSermonMediaEndpoints()
  : []
