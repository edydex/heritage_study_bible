import {
  headersWithCors,
  type Endpoint,
  type PayloadRequest,
} from 'payload'
import {
  MAX_SONG_PUBLIC_LINK_PAGE_ITEMS,
  MAX_SONG_PUBLIC_LINK_REQUEST_BYTES,
  SongPublicLinkError,
  normalizeSongPublicLinkCreateRequest,
  normalizeSongPublicLinkIdempotencyKey,
} from '@/lib/syncshow/SongPublicLink'
import {
  authorizeSongPublicLinks,
  createSongPublicLink,
  decodeSongPublicLinkCursor,
  listSongPublicLinks,
  revokeSongPublicLink,
} from '@/lib/syncshow/SongPublicLinkStore'

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
  if (error instanceof SongPublicLinkError) {
    return json(
      req,
      { code: error.code, error: error.message },
      { status: error.status },
    )
  }
  req.payload.logger.error(
    { err: error },
    'SyncShow song public-link request failed',
  )
  return json(req, {
    code: 'SERVER_ERROR',
    error: 'The Community server could not complete the song public-link request.',
  }, { status: 500 })
}

async function boundedJson(req: PayloadRequest) {
  const contentType = String(req.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLocaleLowerCase()
  if (contentType !== 'application/json') {
    throw new SongPublicLinkError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Song public-link requests must use application/json.',
      415,
    )
  }
  const contentLength = Number(req.headers.get('content-length') || 0)
  if (
    Number.isFinite(contentLength)
    && contentLength > MAX_SONG_PUBLIC_LINK_REQUEST_BYTES
  ) {
    throw new SongPublicLinkError(
      'REQUEST_TOO_LARGE',
      `Song public-link requests must be ${MAX_SONG_PUBLIC_LINK_REQUEST_BYTES} bytes or fewer.`,
      413,
    )
  }
  if (!req.text) {
    throw new SongPublicLinkError(
      'INVALID_REQUEST',
      'This request has no readable JSON body.',
    )
  }
  const source = await req.text()
  if (
    Buffer.byteLength(source, 'utf8')
      > MAX_SONG_PUBLIC_LINK_REQUEST_BYTES
  ) {
    throw new SongPublicLinkError(
      'REQUEST_TOO_LARGE',
      `Song public-link requests must be ${MAX_SONG_PUBLIC_LINK_REQUEST_BYTES} bytes or fewer.`,
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
    throw new SongPublicLinkError(
      'INVALID_JSON',
      'Song public-link request body must be a JSON object.',
    )
  }
}

function idempotencyKey(req: PayloadRequest, operation: string) {
  const value = req.headers.get('idempotency-key')
  if (!value) {
    throw new SongPublicLinkError(
      'PRECONDITION_REQUIRED',
      `Idempotency-Key is required for song public-link ${operation}.`,
      428,
    )
  }
  return normalizeSongPublicLinkIdempotencyKey(value)
}

function expectedSongVersion(
  req: PayloadRequest,
  songSyncId: string,
) {
  const value = req.headers.get('if-match')
  if (!value) {
    throw new SongPublicLinkError(
      'PRECONDITION_REQUIRED',
      'If-Match is required for song public-link creation.',
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
    throw new SongPublicLinkError(
      'VERSION_CONFLICT',
      'The song changed on the server. Refresh it before creating a link.',
      412,
    )
  }
  return version
}

function routeLinkId(req: PayloadRequest) {
  return String(req.routeParams?.linkId || '')
}

function expectedLinkVersion(
  req: PayloadRequest,
  linkId: string,
) {
  const value = req.headers.get('if-match')
  if (!value) {
    throw new SongPublicLinkError(
      'PRECONDITION_REQUIRED',
      'If-Match is required for song public-link revocation.',
      428,
    )
  }
  const match =
    /^"song-public-link:([A-Za-z0-9_-]{32,128}):([1-9]\d*)"$/.exec(value)
  const version = Number(match?.[2])
  if (
    !match
    || match[1] !== linkId
    || !Number.isSafeInteger(version)
  ) {
    throw new SongPublicLinkError(
      'VERSION_CONFLICT',
      'The song public link changed on the server. Refresh it before revoking.',
      412,
    )
  }
  return version
}

function oneQueryValue(url: URL, name: string, required = false) {
  const values = url.searchParams.getAll(name)
  if (values.length > 1 || (required && values.length !== 1)) {
    throw new SongPublicLinkError(
      'INVALID_QUERY',
      `Song public-link query parameter ${name} is invalid.`,
    )
  }
  return values[0] ?? null
}

function listQuery(req: PayloadRequest) {
  const url = new URL(req.url || 'http://localhost')
  const allowed = new Set(['songSyncId', 'cursor', 'limit'])
  if ([...url.searchParams.keys()].some(key => !allowed.has(key))) {
    throw new SongPublicLinkError(
      'INVALID_QUERY',
      'Song public-link list query contains unsupported parameters.',
    )
  }
  const songSyncId = oneQueryValue(url, 'songSyncId', true) || ''
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(songSyncId)
  ) {
    throw new SongPublicLinkError(
      'INVALID_SYNC_ID',
      'Song sync ID is invalid.',
    )
  }
  const cursor = oneQueryValue(url, 'cursor')
  if (cursor === '') {
    throw new SongPublicLinkError(
      'INVALID_CURSOR',
      'Song public-link cursor is invalid.',
    )
  }
  const rawLimit = oneQueryValue(url, 'limit')
  if (rawLimit !== null && !/^[1-9]\d*$/.test(rawLimit)) {
    throw new SongPublicLinkError(
      'INVALID_LIMIT',
      `Song public-link limit must be 1-${MAX_SONG_PUBLIC_LINK_PAGE_ITEMS}.`,
    )
  }
  const limit = rawLimit === null
    ? MAX_SONG_PUBLIC_LINK_PAGE_ITEMS
    : Number(rawLimit)
  if (
    !Number.isSafeInteger(limit)
    || limit < 1
    || limit > MAX_SONG_PUBLIC_LINK_PAGE_ITEMS
  ) {
    throw new SongPublicLinkError(
      'INVALID_LIMIT',
      `Song public-link limit must be 1-${MAX_SONG_PUBLIC_LINK_PAGE_ITEMS}.`,
    )
  }
  return { songSyncId, cursor, limit }
}

const listLinks: Endpoint = {
  path: '/community/syncshow/v1/song-public-links',
  method: 'get',
  handler: async req => {
    try {
      const authority = await authorizeSongPublicLinks(req, 'read')
      const query = listQuery(req)
      const cursor = decodeSongPublicLinkCursor(
        req.payload,
        authority,
        query.songSyncId,
        query.cursor,
      )
      return json(
        req,
        await listSongPublicLinks(req, authority, {
          songSyncId: query.songSyncId,
          cursor,
          limit: query.limit,
        }),
      )
    } catch (error) {
      return errorResponse(req, error)
    }
  },
}

const createLink: Endpoint = {
  path: '/community/syncshow/v1/song-public-links',
  method: 'post',
  handler: async req => {
    try {
      const authority = await authorizeSongPublicLinks(req, 'write')
      const operationKey = idempotencyKey(req, 'creation')
      const request = normalizeSongPublicLinkCreateRequest(
        await boundedJson(req),
        { enforceCurrentTime: false },
      )
      const expectedVersion = expectedSongVersion(
        req,
        request.songSyncId,
      )
      const result = await createSongPublicLink(
        req,
        authority,
        request,
        expectedVersion,
        operationKey,
      )
      return json(req, { link: result.link }, {
        status: result.created ? 201 : 200,
        headers: {
          ETag:
            `"song-public-link:${result.link.linkId}:${result.link.linkVersion}"`,
          Location:
            `/api/community/syncshow/v1/song-public-links/${encodeURIComponent(result.link.linkId)}`,
        },
      })
    } catch (error) {
      return errorResponse(req, error)
    }
  },
}

const revokeLink: Endpoint = {
  path: '/community/syncshow/v1/song-public-links/:linkId',
  method: 'delete',
  handler: async req => {
    try {
      const authority = await authorizeSongPublicLinks(req, 'write')
      const linkId = routeLinkId(req)
      const operationKey = idempotencyKey(req, 'revocation')
      const expectedVersion = expectedLinkVersion(req, linkId)
      const link = await revokeSongPublicLink(
        req,
        authority,
        linkId,
        expectedVersion,
        operationKey,
      )
      return json(req, { link }, {
        headers: {
          ETag: `"song-public-link:${link.linkId}:${link.linkVersion}"`,
        },
      })
    } catch (error) {
      return errorResponse(req, error)
    }
  },
}

export const songPublicLinkEndpoints: Endpoint[] = [
  listLinks,
  createLink,
  revokeLink,
]
