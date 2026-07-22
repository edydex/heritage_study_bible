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
