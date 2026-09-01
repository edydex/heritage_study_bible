import { communityAuthEnabled, communityPublicConfig, publicJson } from '@/lib/publicConfig'

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
        schemaVersion: 1,
        apiBaseUrl: `${communityPublicConfig.publicUrl}/api/community/syncshow/v1`,
        deviceAuthorization: true,
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
