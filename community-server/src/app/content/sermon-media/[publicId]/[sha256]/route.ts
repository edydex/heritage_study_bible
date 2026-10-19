import config from '@payload-config'
import { getPayload } from 'payload'
import { getConfiguredCommunityId } from '@/lib/configuredCommunity'
import { unavailablePublicSermonResponse } from '@/lib/syncshow/PublicSermonPublication'
import {
  publicSermonMediaOptionsResponse,
  servePublicSermonMedia,
} from '@/lib/syncshow/PublicSermonMediaRoute'

type PublicSermonMediaRouteContext = {
  params: Promise<{ publicId: string; sha256: string }>
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function serve(
  request: Request,
  context: PublicSermonMediaRouteContext,
  head: boolean,
) {
  try {
    const [{ publicId, sha256 }, payload] = await Promise.all([
      context.params,
      getPayload({ config }),
    ])
    const communityId = await getConfiguredCommunityId(payload)
    return await servePublicSermonMedia({
      request,
      payload: payload as never,
      communityId,
      publicId,
      sha256,
      head,
    })
  } catch {
    return unavailablePublicSermonResponse()
  }
}

export function GET(
  request: Request,
  context: PublicSermonMediaRouteContext,
) {
  return serve(request, context, false)
}

export function HEAD(
  request: Request,
  context: PublicSermonMediaRouteContext,
) {
  return serve(request, context, true)
}

export function OPTIONS() {
  return publicSermonMediaOptionsResponse()
}
