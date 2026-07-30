import type {
  CollectionBeforeChangeHook,
  CollectionConfig,
  FieldAccess,
} from 'payload'
import { isSystemAdmin, manageCommunityContent } from '@/access'

type UnknownRecord = Record<string, unknown>

const systemAdminField: FieldAccess =
  ({ req }) => req.user?.systemRole === 'system-admin'
const immutableFieldAccess = {
  update: () => false,
}
const secretFieldAccess = {
  create: systemAdminField,
  read: systemAdminField,
  update: systemAdminField,
}

function numericId(value: unknown) {
  const raw = value && typeof value === 'object' && 'id' in value
    ? (value as { id: unknown }).id
    : value
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function parseAuditSource(value: unknown) {
  if (typeof value !== 'string' || value.length > 64 * 1024) {
    throw new Error('The song public-link audit record is invalid.')
  }
  let parsed: UnknownRecord
  try {
    parsed = JSON.parse(value) as UnknownRecord
  } catch {
    throw new Error('The song public-link audit record is invalid.')
  }
  if (
    !parsed
    || typeof parsed !== 'object'
    || Array.isArray(parsed)
    || parsed.schemaVersion !== 1
    || !Array.isArray(parsed.events)
    || parsed.events.length < 1
    || parsed.events.length > 16
  ) {
    throw new Error('The song public-link audit record is invalid.')
  }
  return parsed as { schemaVersion: 1; events: UnknownRecord[] }
}

export function applyManagerSongPublicLinkRevocation({
  data,
  originalDoc,
  userId,
  now = new Date(),
}: {
  data: UnknownRecord
  originalDoc: UnknownRecord
  userId: unknown
  now?: Date
}) {
  const unsupported = Object.keys(data).filter(key => key !== 'revokedAt')
  if (unsupported.length) {
    throw new Error('Song public links are immutable except for revocation.')
  }
  if (originalDoc.revokedAt) {
    return { revokedAt: originalDoc.revokedAt }
  }
  if (!data.revokedAt) return data
  if (!Number.isFinite(now.getTime())) {
    throw new Error('The song public-link revocation clock is invalid.')
  }
  const actorId = numericId(userId)
  if (!actorId) {
    throw new Error('A signed-in Community manager is required to revoke this link.')
  }
  const linkVersion = Number(originalDoc.linkVersion)
  if (!Number.isSafeInteger(linkVersion) || linkVersion < 1) {
    throw new Error('The song public-link version is invalid.')
  }
  const at = now.toISOString()
  const audit = parseAuditSource(originalDoc.auditSource)
  return {
    revokedAt: at,
    linkVersion: linkVersion + 1,
    auditSource: JSON.stringify({
      schemaVersion: 1,
      events: [
        ...audit.events,
        {
          type: 'revoked',
          at,
          source: 'community-admin',
          userId: actorId,
        },
      ],
    }),
  }
}

const protectImmutableLink: CollectionBeforeChangeHook = ({
  data,
  operation,
  originalDoc,
  req,
  context,
}) => {
  if (
    operation !== 'update'
    || (context as UnknownRecord | undefined)?.songPublicLinkInternalMutation
      === true
  ) {
    return data
  }
  return applyManagerSongPublicLinkRevocation({
    data: data as UnknownRecord,
    originalDoc: originalDoc as unknown as UnknownRecord,
    userId: req.user?.id,
  })
}

/**
 * Private immutable bearer-link authority.
 *
 * Snapshot, permission review, audit, and idempotency bytes never flow through
 * the anonymous route. Community managers may only make the one-way
 * `revokedAt` transition from the admin UI; management endpoints use the
 * explicitly marked internal mutation context.
 */
export const SyncShowSongPublicLinks: CollectionConfig = {
  slug: 'syncshow-song-public-links',
  labels: {
    singular: 'Song public link',
    plural: 'Song public links',
  },
  admin: {
    useAsTitle: 'linkId',
    group: 'Integrations',
    description:
      'Revocable anonymous links to immutable, separately reviewed song-family snapshots.',
    defaultColumns: [
      'label',
      'songSyncId',
      'issuedAt',
      'expiresAt',
      'revokedAt',
    ],
    hideAPIURL: true,
  },
  access: {
    read: manageCommunityContent,
    create: () => false,
    update: manageCommunityContent,
    delete: () => false,
  },
  hooks: {
    beforeChange: [protectImmutableLink],
  },
  indexes: [
    {
      fields: ['community', 'songSyncId', 'issuedAt'],
    },
  ],
  fields: [
    {
      name: 'community',
      type: 'relationship',
      relationTo: 'communities',
      required: true,
      index: true,
      access: immutableFieldAccess,
    },
    {
      name: 'song',
      type: 'relationship',
      relationTo: 'songs',
      required: true,
      index: true,
      hidden: true,
      access: immutableFieldAccess,
    },
    {
      name: 'schemaVersion',
      type: 'number',
      required: true,
      min: 1,
      max: 1,
      hidden: true,
      access: immutableFieldAccess,
    },
    {
      name: 'linkId',
      label: 'Bearer link ID',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'linkVersion',
      type: 'number',
      required: true,
      min: 1,
      admin: { readOnly: true, position: 'sidebar' },
      access: immutableFieldAccess,
    },
    {
      name: 'songSyncId',
      label: 'Song sync ID',
      type: 'text',
      required: true,
      index: true,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'songSyncVersion',
      label: 'Pinned song version',
      type: 'number',
      required: true,
      min: 1,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'familyRevision',
      label: 'Pinned family revision',
      type: 'text',
      required: true,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'reviewRevision',
      label: 'Permission review revision',
      type: 'text',
      required: true,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'label',
      label: 'Private operator label',
      type: 'text',
      maxLength: 120,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'issuedAt',
      label: 'Created',
      type: 'date',
      required: true,
      index: true,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'expiresAt',
      label: 'Expires',
      type: 'date',
      index: true,
      admin: { readOnly: true },
      access: immutableFieldAccess,
    },
    {
      name: 'revokedAt',
      label: 'Revoke this link',
      type: 'date',
      index: true,
      admin: {
        description:
          'Set this once to revoke the anonymous link. It cannot be undone.',
      },
      access: {
        update: ({ req }) => Boolean(req.user),
      },
    },
    {
      name: 'snapshotChecksum',
      type: 'text',
      required: true,
      hidden: true,
      access: immutableFieldAccess,
    },
    {
      name: 'snapshotSource',
      type: 'textarea',
      required: true,
      hidden: true,
      access: immutableFieldAccess,
    },
    {
      name: 'reviewSource',
      type: 'textarea',
      required: true,
      hidden: true,
      access: immutableFieldAccess,
    },
    {
      name: 'auditSource',
      type: 'textarea',
      required: true,
      hidden: true,
      access: immutableFieldAccess,
    },
    {
      name: 'createIdempotencyKeyHash',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      hidden: true,
      access: secretFieldAccess,
    },
    {
      name: 'createRequestHash',
      type: 'text',
      required: true,
      hidden: true,
      access: secretFieldAccess,
    },
    {
      name: 'revokeIdempotencyKeyHash',
      type: 'text',
      unique: true,
      index: true,
      hidden: true,
      access: secretFieldAccess,
    },
    {
      name: 'revokeRequestHash',
      type: 'text',
      hidden: true,
      access: secretFieldAccess,
    },
  ],
}
