import { Readable } from 'node:stream'
import {
  ManagerSermonMediaReviewError,
  managerSermonRecordingByteRange,
} from './ManagerSermonMediaReview.ts'
import { unavailablePublicSermonResponse } from './PublicSermonPublication.ts'
import {
  loadActivePublicSermonMediaObject,
  publicSermonMediaUrl,
  type ActivePublicSermonMediaObject,
  type PublicPublicationPayload,
} from './SermonPublicationStore.ts'
import { openSermonMediaObjectForRead } from './SermonMediaStorage.ts'

export type PublicSermonMediaRequest = Readonly<{
  request: Request
  payload: PublicPublicationPayload
  communityId: number | null
  publicId: string
  sha256: string
  head: boolean
}>

function responseHeaders(
  authority: ActivePublicSermonMediaObject,
  range: Readonly<{ startByte: number; endByte: number }> | null,
) {
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers':
      'Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag',
    // Every request must re-read the active publication pointer so withdrawal
    // and replacement take effect without a browser or intermediary TTL.
    'Cache-Control': 'no-store',
    'Content-Length': String(range
      ? range.endByte - range.startByte + 1
      : authority.sizeBytes),
    'Content-Type': authority.mediaType,
    'Cross-Origin-Resource-Policy': 'cross-origin',
    ETag: `"sha256:${authority.sha256}"`,
    'X-Content-Type-Options': 'nosniff',
  })
  if (range) {
    headers.set(
      'Content-Range',
      `bytes ${range.startByte}-${range.endByte}/${authority.sizeBytes}`,
    )
  }
  return headers
}

function rangeNotSatisfiableResponse(
  authority: ActivePublicSermonMediaObject,
) {
  const headers = responseHeaders(authority, null)
  headers.delete('Content-Length')
  headers.set('Content-Range', `bytes */${authority.sizeBytes}`)
  return new Response(null, { status: 416, headers })
}

export async function servePublicSermonMedia({
  request,
  payload,
  communityId,
  publicId,
  sha256,
  head,
}: PublicSermonMediaRequest): Promise<Response> {
  if (communityId == null) return unavailablePublicSermonResponse()

  // The route parameters may be decoded by Next before this helper sees them.
  // Require the request to use the one generated path spelling and no query so
  // percent-encoded aliases, trailing segments, and cache-key variants never
  // become alternate byte-serving authorities. The request origin is allowed
  // to reflect a trusted reverse proxy; publication still binds the configured
  // absolute origin inside the immutable sermon source.
  try {
    const requested = new URL(request.url)
    const canonical = new URL(publicSermonMediaUrl(publicId, sha256))
    if (
      requested.pathname !== canonical.pathname
      || requested.search !== ''
      || requested.hash !== ''
    ) {
      return unavailablePublicSermonResponse()
    }
  } catch {
    return unavailablePublicSermonResponse()
  }

  let opened: Awaited<ReturnType<typeof openSermonMediaObjectForRead>> | null = null
  try {
    const authority = await loadActivePublicSermonMediaObject(
      payload,
      communityId,
      publicId,
      sha256,
    )
    if (!authority) return unavailablePublicSermonResponse()

    // Open before interpreting Range. Missing or inconsistent private storage
    // remains the same anonymous 404 as every other unavailable authority.
    opened = await openSermonMediaObjectForRead(authority.object)
    if (head) {
      await opened.close()
      opened = null
      return new Response(null, {
        status: 200,
        headers: responseHeaders(authority, null),
      })
    }

    const etag = `"sha256:${authority.sha256}"`
    const ifRange = request.headers.get('if-range')
    let range: ReturnType<typeof managerSermonRecordingByteRange>
    try {
      range = managerSermonRecordingByteRange(
        ifRange === null || ifRange === etag
          ? request.headers.get('range')
          : null,
        authority.sizeBytes,
      )
    } catch (error) {
      if (
        error instanceof ManagerSermonMediaReviewError
        && error.status === 416
      ) {
        await opened.close()
        opened = null
        return rangeNotSatisfiableResponse(authority)
      }
      throw error
    }

    const stream = opened.createReadStream(
      range?.startByte ?? 0,
      range?.endByte ?? authority.sizeBytes - 1,
    )
    const response = new Response(
      Readable.toWeb(stream) as unknown as ReadableStream<Uint8Array>,
      {
        status: range ? 206 : 200,
        headers: responseHeaders(authority, range),
      },
    )
    opened = null
    return response
  } catch {
    await opened?.close().catch(() => undefined)
    return unavailablePublicSermonResponse()
  }
}

export function publicSermonMediaOptionsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'If-Range, Range',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers':
        'Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag',
      'Cache-Control': 'no-store',
    },
  })
}
