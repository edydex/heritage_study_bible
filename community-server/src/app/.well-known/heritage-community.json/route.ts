import { communityAuthEnabled, communityPublicConfig, publicJson } from '@/lib/publicConfig'
import { sermonMediaEnabled } from '@/lib/syncshow/SermonMedia'

export function GET() {
  return publicJson({
    schemaVersion: 1,
    kind: 'heritage-community',
    id: communityPublicConfig.id,
    name: communityPublicConfig.name,
    description: communityPublicConfig.description,
    website: communityPublicConfig.publicUrl,
    contentServerUrl: `${communityPublicConfig.publicUrl}/heritage-content.json`,
    apiBaseUrl: `${communityPublicConfig.publicUrl}/api`,
    integrations: {
      syncShow: {
        schemaVersion: 2,
        apiBaseUrl: `${communityPublicConfig.publicUrl}/api/community/syncshow/v1`,
        deviceAuthorization: true,
        // Keep the v1 song aliases for older SyncShow installations while the
        // v2 resources map advertises each lane independently.
        songLibrary: true,
        scopes: ['syncshow:songs:read', 'syncshow:songs:write'],
        endpoints: {
          deviceStart: 'auth/device/start',
          deviceStatus: 'auth/device/status',
          deviceToken: 'auth/device/token',
          deviceCancel: 'auth/device/cancel',
          revoke: 'auth/revoke',
          songs: 'songs',
        },
        resources: {
          songs: {
            schemaVersion: 1,
            endpoint: 'songs',
            scopes: ['syncshow:songs:read', 'syncshow:songs:write'],
            memberSharing: {
              schemaVersion: 1,
              endpoint: 'song-member-sharing',
              reviewScope: 'community-members',
            },
          },
          songPublicLinks: {
            schemaVersion: 1,
            endpoint: 'song-public-links',
            publicBaseUrl:
              `${communityPublicConfig.publicUrl}/community/songs/shared/`,
            scopes: [
              'syncshow:song-public-links:read',
              'syncshow:song-public-links:write',
            ],
          },
          sermons: {
            schemaVersion: 1,
            endpoint: 'sermons',
            scopes: ['syncshow:sermons:read', 'syncshow:sermons:write'],
          },
          ...(sermonMediaEnabled()
            ? {
                sermonMedia: {
                  schemaVersion: 1,
                  endpoint: 'sermon-media',
                  scopes: [
                    'syncshow:sermon-media:read',
                    'syncshow:sermon-media:write',
                  ],
                  chunkSizeBytes: 8388608,
                  maximumBytes: 1073741824,
                  acceptedMediaTypes: ['audio/mpeg', 'audio/mp4'],
                  sessionTtlSeconds: 604800,
                },
              }
            : {}),
          sermonPublications: {
            schemaVersion: 1,
            endpoint: 'sermon-publications',
            scopes: ['syncshow:sermon-publications:read'],
          },
          servicePlans: {
            schemaVersion: 2,
            endpoint: 'service-plans',
            scopes: ['syncshow:service-plans:read'],
          },
        },
      },
    },
    ...(communityAuthEnabled
      ? {
          auth: {
            method: 'email-magic-link',
            requestPath: '/community/auth/magic-link',
            sessionPath: '/community/auth/session',
          },
          capabilities: {
            events: true,
            rsvps: true,
            calendarExport: true,
          },
        }
      : {}),
  })
}

export function OPTIONS() {
  return publicJson(null, { status: 204 })
}
