import {
  headersWithCors,
  type Endpoint,
  type PayloadRequest,
} from 'payload'
import {
  MAX_SONG_MEMBER_SHARING_REQUEST_BYTES,
  SongMemberSharingError,
  normalizeSongMemberSharingRequest,
} from '@/lib/syncshow/SongMemberSharing'
import {
  authorizeSongMemberSharing,
  shareSongWithMembers,
} from '@/lib/syncshow/SongMemberSharingStore'

type UnknownRecord = Record<string, unknown>

function responseHeaders(req: PayloadRequest, extra: HeadersInit = {}) {
  const headers = headersWithCors({ headers: new Headers(extra), req })
  headers.set('Cache-Control', 'private, no-store')
  headers.set('Vary', 'Authorization')
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
  if (error instanceof SongMemberSharingError) {
    return json(
      req,
      { code: error.code, error: error.message },
      { status: error.status },
    )
  }
  req.payload.logger.error(
    { err: error },
    'SyncShow song member-sharing request failed',
  )
  return json(req, {
    code: 'SERVER_ERROR',
    error: 'The Community server could not complete the member-sharing request.',
  }, { status: 500 })
}

async function boundedJson(req: PayloadRequest) {
  const contentType = String(req.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLocaleLowerCase()
  if (contentType !== 'application/json') {
    throw new SongMemberSharingError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Song member-sharing requests must use application/json.',
      415,
    )
  }
  const contentLength = Number(req.headers.get('content-length') || 0)
  if (
    Number.isFinite(contentLength)
    && contentLength > MAX_SONG_MEMBER_SHARING_REQUEST_BYTES
  ) {
    throw new SongMemberSharingError(
      'REQUEST_TOO_LARGE',
      `Song member-sharing requests must be ${MAX_SONG_MEMBER_SHARING_REQUEST_BYTES} bytes or fewer.`,
      413,
    )
  }
  if (!req.text) {
    throw new SongMemberSharingError(
      'INVALID_REQUEST',
      'This request has no readable JSON body.',
    )
  }
  const source = await req.text()
  if (
    Buffer.byteLength(source, 'utf8')
      > MAX_SONG_MEMBER_SHARING_REQUEST_BYTES
  ) {
    throw new SongMemberSharingError(
      'REQUEST_TOO_LARGE',
      `Song member-sharing requests must be ${MAX_SONG_MEMBER_SHARING_REQUEST_BYTES} bytes or fewer.`,
      413,
    )
  }
  try {
    const parsed = JSON.parse(source)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object')
    }
    return parsed as UnknownRecord
  } catch {
    throw new SongMemberSharingError(
      'INVALID_JSON',
      'Song member-sharing request body must be a JSON object.',
    )
  }
}

function routeSyncId(req: PayloadRequest) {
  const value = String(req.routeParams?.syncId || '')
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) {
    throw new SongMemberSharingError(
      'INVALID_SYNC_ID',
      'Song sync ID is invalid.',
    )
  }
  return value
}

function expectedSongVersion(req: PayloadRequest, songSyncId: string) {
  const value = req.headers.get('if-match')
  if (!value) {
    throw new SongMemberSharingError(
      'PRECONDITION_REQUIRED',
      'If-Match is required for member sharing.',
      428,
    )
  }
  const match =
    /^"song:([A-Za-z0-9][A-Za-z0-9._:-]{0,127}):([1-9]\d*)"$/.exec(value)
  const version = Number(match?.[2])
  if (
    !match
    || match[1] !== songSyncId
    || !Number.isSafeInteger(version)
  ) {
    throw new SongMemberSharingError(
      'VERSION_CONFLICT',
      'The song changed on the server. Refresh it before sharing.',
      412,
    )
  }
  return version
}

function idempotencyKey(req: PayloadRequest) {
  const value = req.headers.get('idempotency-key')
  if (!value) {
    throw new SongMemberSharingError(
      'PRECONDITION_REQUIRED',
      'Idempotency-Key is required for member sharing.',
      428,
    )
  }
  return value
}

const shareSong: Endpoint = {
  path: '/community/syncshow/v1/song-member-sharing/:syncId',
  method: 'post',
  handler: async req => {
    try {
      const authority = await authorizeSongMemberSharing(req)
      const songSyncId = routeSyncId(req)
      const expectedVersion = expectedSongVersion(req, songSyncId)
      const operationKey = idempotencyKey(req)
      const request = normalizeSongMemberSharingRequest(
        await boundedJson(req),
      )
      const result = await shareSongWithMembers(
        req,
        authority,
        songSyncId,
        expectedVersion,
        request,
        operationKey,
      )
      return json(req, { receipt: result.receipt }, {
        status: result.created ? 201 : 200,
        headers: {
          ETag:
            `"song:${result.receipt.songSyncId}:${result.receipt.songSyncVersion}"`,
        },
      })
    } catch (error) {
      return errorResponse(req, error)
    }
  },
}

export const songMemberSharingEndpoints: Endpoint[] = [shareSong]
