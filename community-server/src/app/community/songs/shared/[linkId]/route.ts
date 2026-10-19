import config from '@payload-config'
import { getPayload } from 'payload'
import {
  renderSongPublicLinkHtml,
  songPublicLinkResponseHeaders,
  unavailableSongPublicLinkResponse,
} from '@/lib/syncshow/SongPublicLink'
import {
  loadActiveSongPublicLinkSnapshot,
} from '@/lib/syncshow/SongPublicLinkStore'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  _request: Request,
  context: { params: Promise<{ linkId: string }> },
) {
  try {
    const { linkId } = await context.params
    const payload = await getPayload({ config })
    const snapshot = await loadActiveSongPublicLinkSnapshot(
      payload as never,
      linkId,
    )
    if (!snapshot) return unavailableSongPublicLinkResponse()
    return new Response(renderSongPublicLinkHtml(snapshot), {
      status: 200,
      headers: songPublicLinkResponseHeaders('text/html; charset=utf-8'),
    })
  } catch {
    // Unknown, expired, revoked, corrupt, and temporarily unavailable links
    // intentionally share one body. Never log or reflect the bearer path.
    return unavailableSongPublicLinkResponse()
  }
}
