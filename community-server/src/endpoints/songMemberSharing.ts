import { headersWithCors, type Endpoint } from 'payload'

// Keep a clear response for older installed SyncShow clients, rather than letting
// a cached capability recreate the retired sharing state.
export const songMemberSharingEndpoints: Endpoint[] = [{
  path: '/community/syncshow/v1/song-member-sharing/:syncId',
  method: 'post',
  handler: async req => {
    const headers = headersWithCors({ headers: new Headers(), req })
    headers.set('Cache-Control', 'private, no-store')
    return Response.json({
      code: 'LEGACY_MEMBER_SHARING_RETIRED',
      error: 'Member sharing has been replaced by Songbook publication. Open the song in your church workspace to choose Published, Unlisted, or Private.',
    }, { status: 410, headers })
  },
}]
