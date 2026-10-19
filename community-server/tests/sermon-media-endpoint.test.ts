import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  createSermonMediaEndpoints,
} from '../src/endpoints/sermonMedia.ts'
import {
  normalizeSermonMediaChunkHeaders,
  SermonMediaError,
} from '../src/lib/syncshow/SermonMedia.ts'

type AnyRecord = Record<string, any>

const fixture = JSON.parse(readFileSync(new URL(
  './fixtures/community-sermon-media-wire-v1.json',
  import.meta.url,
), 'utf8')) as AnyRecord

const authority = Object.freeze({
  connectionId: 3,
  communityId: 7,
  userId: 11,
  mode: 'write' as const,
})

function request({
  body,
  headers = {},
  routeParams = {},
  stream,
}: {
  body?: unknown
  headers?: Record<string, string>
  routeParams?: Record<string, string>
  stream?: ReadableStream<Uint8Array>
} = {}) {
  const bodyStream = stream ?? (
    body === undefined
      ? null
      : new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(JSON.stringify(body)),
            )
            controller.close()
          },
        })
  )
  return {
    body: bodyStream,
    headers: new Headers(headers),
    method: 'POST',
    payload: {
      config: { cors: '*' },
      logger: {
        error: () => undefined,
      },
    },
    routeParams,
    text: async () => JSON.stringify(body ?? {}),
  } as any
}

function endpoint(
  endpoints: ReturnType<typeof createSermonMediaEndpoints>,
  path: string,
  method: string,
) {
  const handler = endpoints.find(candidate =>
    candidate.path === path && candidate.method === method
  )?.handler
  assert.ok(handler, `missing ${method.toUpperCase()} ${path}`)
  return handler
}

function jsonHeaders(key = 'attempt-key-0001') {
  return {
    authorization: 'SyncShow test-token',
    'content-type': 'application/json',
    'idempotency-key': key,
  }
}

function dependencies(overrides: AnyRecord = {}) {
  return {
    enabled: () => undefined,
    authorize: async (_req: unknown, mode: 'read' | 'write') => ({
      ...authority,
      mode,
    }),
    initialize: async () => ({
      upload: structuredClone(fixture.uploadingResponse.upload),
      created: true,
    }),
    get: async () => structuredClone(fixture.uploadingResponse.upload),
    storeChunk: async () => ({
      storageKey:
        `staging/${fixture.uploadingResponse.upload.id}/chunks/`
          + `00000000-${fixture.firstChunkResponse.chunk.sha256}.chunk`,
      sha256: fixture.firstChunkResponse.chunk.sha256,
      sizeBytes: fixture.firstChunkResponse.chunk.sizeBytes,
    }),
    putChunk: async (
      _req: unknown,
      _authority: unknown,
      _uploadId: string,
      rawHeaders: AnyRecord,
      _key: string,
      store: (headers: AnyRecord) => Promise<unknown>,
    ) => {
      await store(normalizeSermonMediaChunkHeaders({
        index: rawHeaders.index,
        contentLength: rawHeaders.contentLength,
        contentRange: rawHeaders.contentRange,
        sha256: rawHeaders.sha256,
        totalSizeBytes: fixture.initRequest.recording.sizeBytes,
      }))
      return {
      chunk: {
        ...structuredClone(fixture.firstChunkResponse.chunk),
        startByte: 0,
        endByte: 8388607,
        storageKey: 'private-key-must-not-leak',
      },
      upload: structuredClone(fixture.firstChunkResponse.upload),
      created: true,
      }
    },
    complete: async () => ({
      upload: structuredClone(fixture.finalizingResponse.upload),
      accepted: true,
    }),
    cancel: async () =>
      structuredClone(fixture.cancelledResponse.upload),
    ...overrides,
  } as any
}

test('all private-only v1 routes are registered without a serving route', () => {
  const endpoints = createSermonMediaEndpoints(dependencies())
  assert.deepEqual(endpoints.map(item => [item.method, item.path]), [
    ['post', '/community/syncshow/v1/sermon-media/uploads'],
    ['get', '/community/syncshow/v1/sermon-media/uploads/:id'],
    ['put', '/community/syncshow/v1/sermon-media/uploads/:id/chunks/:index'],
    ['post', '/community/syncshow/v1/sermon-media/uploads/:id/complete'],
    ['delete', '/community/syncshow/v1/sermon-media/uploads/:id'],
  ])
  assert.equal(
    endpoints.some(item => /objects|download|public|serve/.test(item.path)),
    false,
  )
})

test('disabled handlers fail before authorization with a bounded 404', async () => {
  let authorized = false
  const endpoints = createSermonMediaEndpoints(dependencies({
    enabled: () => {
      throw new SermonMediaError(
        'FEATURE_DISABLED',
        'Managed sermon recording uploads are not enabled on this Community server.',
        404,
      )
    },
    authorize: async () => {
      authorized = true
      return authority
    },
  }))
  const response = await endpoint(
    endpoints,
    '/community/syncshow/v1/sermon-media/uploads',
    'post',
  )(request({
    body: fixture.initRequest,
    headers: jsonHeaders(),
  }))
  assert.equal(response.status, 404)
  assert.equal(authorized, false)
  assert.deepEqual(await response.json(), {
    schemaVersion: 1,
    error: {
      code: 'FEATURE_DISABLED',
      message:
        'Managed sermon recording uploads are not enabled on this Community server.',
      retryable: false,
    },
  })
})

test('init is 201 first and 200 on exact idempotent replay', async () => {
  let calls = 0
  const endpoints = createSermonMediaEndpoints(dependencies({
    initialize: async () => ({
      upload: structuredClone(fixture.uploadingResponse.upload),
      created: calls++ === 0,
    }),
  }))
  const handler = endpoint(
    endpoints,
    '/community/syncshow/v1/sermon-media/uploads',
    'post',
  )
  const first = await handler(request({
    body: fixture.initRequest,
    headers: jsonHeaders(),
  }))
  assert.equal(first.status, 201)
  assert.deepEqual(await first.json(), fixture.uploadingResponse)
  const replay = await handler(request({
    body: fixture.initRequest,
    headers: jsonHeaders(),
  }))
  assert.equal(replay.status, 200)
  assert.deepEqual(await replay.json(), fixture.uploadingResponse)
})

test('status resumes an upload without leaking storage identity', async () => {
  const endpoints = createSermonMediaEndpoints(dependencies())
  const response = await endpoint(
    endpoints,
    '/community/syncshow/v1/sermon-media/uploads/:id',
    'get',
  )(request({
    headers: { authorization: 'SyncShow test-token' },
    routeParams: { id: fixture.uploadingResponse.upload.id },
  }))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body, fixture.uploadingResponse)
  const source = JSON.stringify(body)
  assert.doesNotMatch(source, /storage|\/app\/|objects\/sha256|url/i)
})

test('chunk upload enforces exact headers and redacts its private key', async () => {
  const endpoints = createSermonMediaEndpoints(dependencies())
  const handler = endpoint(
    endpoints,
    '/community/syncshow/v1/sermon-media/uploads/:id/chunks/:index',
    'put',
  )
  const response = await handler(request({
    headers: {
      authorization: 'SyncShow test-token',
      'content-type': 'application/octet-stream',
      'content-length': String(fixture.firstChunkResponse.chunk.sizeBytes),
      'content-range':
        `bytes 0-8388607/${fixture.initRequest.recording.sizeBytes}`,
      'x-content-sha256': fixture.firstChunkResponse.chunk.sha256,
      'idempotency-key': 'chunk-key-0000001',
    },
    routeParams: {
      id: fixture.uploadingResponse.upload.id,
      index: '0',
    },
    stream: new ReadableStream({
      start(controller) {
        controller.close()
      },
    }),
  }))
  assert.equal(response.status, 201)
  const body = await response.json()
  assert.deepEqual(body, fixture.firstChunkResponse)
  assert.doesNotMatch(JSON.stringify(body), /private-key|storageKey/)

  const invalid = await handler(request({
    headers: {
      authorization: 'SyncShow test-token',
      'content-type': 'application/octet-stream',
      'content-length': '6',
      'content-range': 'bytes 0-5/8388614',
      'x-content-sha256': fixture.firstChunkResponse.chunk.sha256,
      'idempotency-key': 'chunk-key-0000002',
    },
    routeParams: {
      id: fixture.uploadingResponse.upload.id,
      index: '0',
    },
  }))
  assert.equal(invalid.status, 422)
  assert.equal((await invalid.json()).error.code, 'INVALID_CONTENT_LENGTH')
})

test('complete accepts background work and exact replay stays bounded', async () => {
  const endpoints = createSermonMediaEndpoints(dependencies())
  const routeParams = { id: fixture.uploadingResponse.upload.id }
  const completed = await endpoint(
    endpoints,
    '/community/syncshow/v1/sermon-media/uploads/:id/complete',
    'post',
  )(request({
    body: { schemaVersion: 1 },
    headers: jsonHeaders('complete-key-0001'),
    routeParams,
  }))
  assert.equal(completed.status, 202)
  assert.deepEqual(await completed.json(), fixture.finalizingResponse)

  const replayEndpoints = createSermonMediaEndpoints(dependencies({
    complete: async () => ({
      upload: structuredClone(fixture.completeResponse.upload),
      accepted: false,
    }),
  }))
  const replay = await endpoint(
    replayEndpoints,
    '/community/syncshow/v1/sermon-media/uploads/:id/complete',
    'post',
  )(request({
    body: { schemaVersion: 1 },
    headers: jsonHeaders('complete-key-0001'),
    routeParams,
  }))
  assert.equal(replay.status, 200)
  assert.deepEqual(await replay.json(), fixture.completeResponse)

  const cancelled = await endpoint(
    endpoints,
    '/community/syncshow/v1/sermon-media/uploads/:id',
    'delete',
  )(request({
    headers: {
      authorization: 'SyncShow test-token',
      'idempotency-key': 'cancel-key-0000001',
    },
    routeParams,
  }))
  assert.equal(cancelled.status, 200)
  assert.deepEqual(await cancelled.json(), fixture.cancelledResponse)
})

test('missing preconditions, conflicts, and stale binding use exact errors', async () => {
  const initialize = endpoint(
    createSermonMediaEndpoints(dependencies()),
    '/community/syncshow/v1/sermon-media/uploads',
    'post',
  )
  const missing = await initialize(request({
    body: fixture.initRequest,
    headers: { 'content-type': 'application/json' },
  }))
  assert.equal(missing.status, 428)
  assert.deepEqual(await missing.json(), {
    schemaVersion: 1,
    error: {
      code: 'PRECONDITION_REQUIRED',
      message: 'Idempotency-Key is required.',
      retryable: false,
    },
  })

  const conflict = await endpoint(
    createSermonMediaEndpoints(dependencies({
      initialize: async () => {
        throw new SermonMediaError(
          'UPLOAD_ALREADY_EXISTS',
          'This exact sermon recording is active under another Idempotency-Key.',
          409,
        )
      },
    })),
    '/community/syncshow/v1/sermon-media/uploads',
    'post',
  )(request({
    body: fixture.initRequest,
    headers: jsonHeaders('another-attempt-key'),
  }))
  assert.equal(conflict.status, 409)
  assert.equal((await conflict.json()).error.retryable, false)

  const stale = await endpoint(
    createSermonMediaEndpoints(dependencies({
      get: async () => {
        throw new SermonMediaError(
          fixture.staleError.error.code,
          fixture.staleError.error.message,
          412,
        )
      },
    })),
    '/community/syncshow/v1/sermon-media/uploads/:id',
    'get',
  )(request({
    headers: { authorization: 'SyncShow test-token' },
    routeParams: { id: fixture.uploadingResponse.upload.id },
  }))
  assert.equal(stale.status, 412)
  assert.deepEqual(await stale.json(), fixture.staleError)
})

test('JSON bodies are capped while streaming without Content-Length', async () => {
  let initialized = false
  const endpoints = createSermonMediaEndpoints(dependencies({
    initialize: async () => {
      initialized = true
      return {
        upload: structuredClone(fixture.uploadingResponse.upload),
        created: true,
      }
    },
  }))
  const oversized = new Uint8Array(32 * 1024 + 1)
  oversized.fill(0x20)
  const response = await endpoint(
    endpoints,
    '/community/syncshow/v1/sermon-media/uploads',
    'post',
  )(request({
    headers: jsonHeaders(),
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(oversized)
        controller.close()
      },
    }),
  }))
  assert.equal(response.status, 413)
  assert.equal((await response.json()).error.code, 'REQUEST_TOO_LARGE')
  assert.equal(initialized, false)
})

test('retryable capacity errors include Retry-After', async () => {
  const response = await endpoint(
    createSermonMediaEndpoints(dependencies({
      initialize: async () => {
        throw new SermonMediaError(
          'ACTIVE_UPLOAD_CAPACITY',
          'The server is busy.',
          429,
          true,
          60,
        )
      },
    })),
    '/community/syncshow/v1/sermon-media/uploads',
    'post',
  )(request({
    body: fixture.initRequest,
    headers: jsonHeaders(),
  }))
  assert.equal(response.status, 429)
  assert.equal(response.headers.get('retry-after'), '60')
})
