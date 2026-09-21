import type { PayloadRequest } from 'payload'
import { getConfiguredCommunityId } from './configuredCommunity.ts'
import { communityRequestAccess } from './communityMemberRequest.ts'
import { publicUrl } from './publicConfig.ts'
import { SYNCSHOW_TRANSLATION_ARCHIVE_SCOPE, SYNCSHOW_TRANSLATION_CONTROL_SCOPE, SyncShowProtocolError } from './syncShowProtocol.ts'
import { authorizeSyncShow } from '../endpoints/syncShow.ts'

export const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie', 'X-Content-Type-Options': 'nosniff' }

export async function authorizeTranslation(req: PayloadRequest, options: { origin?: string; archiveReview?: boolean } = {}, write = true) {
  const origin = new URL(options.origin ?? publicUrl).origin
  const device = (req.headers.get('authorization') || '').startsWith('SyncShow ')
  // Cookie-authenticated writes require the church origin. Device tokens are explicit bearer credentials.
  if (!device && (write || req.headers.has('origin')) && req.headers.get('origin') !== origin) throw new SyncShowProtocolError('ORIGIN', 'Open live translation from your church website.', 403)
  const communityId = await getConfiguredCommunityId(req.payload)
  if (!communityId) throw new SyncShowProtocolError('SETUP', 'This church has not been configured.', 503)
  let identity: string
  if (device) {
    const auth = await authorizeSyncShow(req, options.archiveReview ? SYNCSHOW_TRANSLATION_ARCHIVE_SCOPE : SYNCSHOW_TRANSLATION_CONTROL_SCOPE).catch(error => {
      if (options.archiveReview && error instanceof SyncShowProtocolError && error.status === 401) throw new SyncShowProtocolError('ACCESS', 'Recorded services need an approved SyncShow connection with recording-review access. Update SyncShow and reconnect this church, or use Community in your browser.', 401)
      throw error
    })
    if (String(auth.communityId) !== String(communityId)) throw new SyncShowProtocolError('ACCESS', 'This connection belongs to another church.', 403)
    identity = `community:${communityId}:connection:${auth.connection.id}`
  } else {
    const access = await communityRequestAccess(req.payload, req.headers, communityId)
    if (!access.user) throw new SyncShowProtocolError('ACCESS', 'Sign in to control live translation.', 401)
    if (!access.manager) throw new SyncShowProtocolError('ACCESS', 'A church manager account is required.', 403)
    identity = `community:${communityId}:user:${access.user.id}`
  }
  return { origin, communityId, identity }
}
