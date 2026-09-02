import { createHash } from 'node:crypto'
import type {
  CollectionBeforeValidateHook,
  CollectionConfig,
  FieldAccess,
} from 'payload'
import {
  createCommunityContent,
  manageCommunityContent,
  updateRelationAsSystemAdmin,
} from '@/access'
import serviceCore from '../../packages/service-core/node.js'

type UnknownRecord = Record<string, unknown>

const {
  createHeritageServiceDocument,
  parseHeritageServiceDocumentSource,
  serializeHeritageServiceDocument,
} = serviceCore

const denyClientWrite: FieldAccess = () => false
const technicalFieldAccess = {
  create: denyClientWrite,
  update: denyClientWrite,
}
const STATUS_OPTIONS = [
  { label: 'Planning', value: 'planning' },
  { label: 'Ready for this revision', value: 'ready' },
  { label: 'Archived privately', value: 'archived' },
  { label: 'Cancelled', value: 'cancelled' },
]

function relationId(value: unknown) {
  const raw = value && typeof value === 'object' && 'id' in value
    ? (value as { id: unknown }).id
    : value
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : 0
}

function canonicalTimestamp(value: unknown, fallback: string) {
  const parsed = new Date(String(value || fallback))
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString()
}

function payloadServiceDate(value: unknown) {
  const source = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source)) return ''
  const date = new Date(`${source}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function blankDocument(data: UnknownRecord, now: string) {
  const serviceDate = String(data.serviceDate || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) return null
  const syncId = String(data.syncId || `service-${serviceDate}`)
  const project = {
    schemaVersion: 1,
    kind: 'syncshow-service-project',
    id: syncId,
    title: String(data.title || 'Sunday Service').trim() || 'Sunday Service',
    serviceDate,
    createdAt: now,
    updatedAt: now,
    revision: 1,
    preferredProfileId: 'main-sanctuary',
    channelIds: ['english', 'russian', 'media'],
    channels: {
      english: { id: 'english', label: 'English', language: 'en' },
      russian: { id: 'russian', label: 'Russian', language: 'ru' },
      media: { id: 'media', label: 'Media', language: 'und' },
    },
    rootItemIds: [],
    items: {},
    resources: {},
    assets: {},
    presetPack: {
      id: 'main-sanctuary',
      version: 1,
      sha256: null,
    },
  }
  return serializeHeritageServiceDocument(
    createHeritageServiceDocument(project),
  )
}

export const prepareHeritageServiceDocument: CollectionBeforeValidateHook = ({
  data,
  originalDoc,
  operation,
  context,
}) => {
  const next = { ...(data as UnknownRecord | undefined) }
  const original = originalDoc as UnknownRecord | undefined
  const now = canonicalTimestamp(
    (context as UnknownRecord | undefined)?.serviceDocumentChangedAt,
    new Date().toISOString(),
  )
  const documentSource = typeof next.documentSource === 'string'
    ? next.documentSource
    : typeof original?.documentSource === 'string'
      ? original.documentSource
      : blankDocument(next, now)
  if (!documentSource) {
    throw new Error('Choose a service date before creating the shared service document.')
  }

  let document
  try {
    document = parseHeritageServiceDocumentSource(documentSource)
  } catch {
    throw new Error('The shared service document is not canonical HeritageServiceDocumentV1 content.')
  }
  const canonicalSource = serializeHeritageServiceDocument(document)
  if (canonicalSource !== documentSource) {
    throw new Error('The shared service document must use canonical serialization.')
  }
  const revision = createHash('sha256')
    .update(canonicalSource, 'utf8')
    .digest('hex')
  const priorRevision = String(original?.revision || '')
  const contentChanged = operation === 'create' || revision !== priorRevision
  const priorStatus = String(original?.status || 'planning')
  let status = String(next.status || priorStatus || 'planning')
  if (!['planning', 'ready', 'archived', 'cancelled'].includes(status)) {
    status = 'planning'
  }
  // Readiness is an approval of exact bytes. Content changes always return to
  // Planning; a manager can mark that unchanged revision Ready in a second,
  // explicit action. Payload versions retain the earlier ready revision.
  if (contentChanged && status === 'ready') status = 'planning'

  const oldVersion = Number(original?.syncVersion || 0)
  const statusChanged = status !== priorStatus
  const changed = operation === 'create' || contentChanged || statusChanged
  const syncVersion = operation === 'create'
    ? 1
    : changed
      ? oldVersion + 1
      : oldVersion
  const changedAt = changed
    ? now
    : canonicalTimestamp(original?.changedAt, now)
  const readyRevision = status === 'ready' ? revision : null
  const readyAt = status === 'ready'
    ? canonicalTimestamp(original?.readyAt, now)
    : null

  return {
    ...next,
    community: relationId(next.community || original?.community) || next.community,
    syncId: document.id,
    title: document.project.title,
    serviceDate: payloadServiceDate(document.project.serviceDate),
    status,
    syncVersion,
    revision,
    documentSource: canonicalSource,
    changedAt,
    readyRevision,
    readyAt,
  }
}

export const ServiceDocuments: CollectionConfig = {
  slug: 'service-documents',
  labels: {
    singular: 'Shared service document',
    plural: 'Shared service documents',
  },
  indexes: [
    { fields: ['community', 'syncId'], unique: true },
    { fields: ['community', 'changedAt'] },
  ],
  admin: {
    hidden: true,
    useAsTitle: 'title',
    group: 'Planning',
    description: 'Canonical storage for the visual Plan a service editor and SyncShow. Display routing stays on the venue computer.',
    defaultColumns: ['title', 'serviceDate', 'status', 'changedAt'],
    listSearchableFields: ['title'],
    hideAPIURL: true,
  },
  access: {
    read: manageCommunityContent,
    create: createCommunityContent,
    update: manageCommunityContent,
    delete: () => false,
  },
  hooks: {
    beforeValidate: [prepareHeritageServiceDocument],
  },
  fields: [
    {
      name: 'community',
      label: 'Church',
      type: 'relationship',
      relationTo: 'communities',
      required: true,
      index: true,
      access: { update: updateRelationAsSystemAdmin },
    },
    {
      name: 'title',
      label: 'Service title',
      type: 'text',
      required: true,
      maxLength: 200,
      admin: {
        readOnly: true,
        description: 'Derived from the shared document.',
      },
    },
    {
      name: 'serviceDate',
      label: 'Service date',
      type: 'date',
      required: true,
      index: true,
      admin: {
        date: { pickerAppearance: 'dayOnly', displayFormat: 'MMMM d, yyyy' },
        description: 'Used to create an empty English, Russian, and Media document. Later changes come from the shared editor.',
      },
    },
    {
      name: 'status',
      label: 'Revision status',
      type: 'select',
      required: true,
      defaultValue: 'planning',
      index: true,
      options: STATUS_OPTIONS,
      admin: {
        position: 'sidebar',
        description: 'Ready approves only the currently saved revision. Any content edit returns the new revision to Planning.',
      },
    },
    {
      name: 'documentSource',
      label: 'Shared service content',
      type: 'textarea',
      required: true,
      admin: {
        rows: 24,
        description: 'Canonical HeritageServiceDocumentV1 source. The visual preparation editor replaces this technical view during the pilot.',
      },
      validate: (value: unknown) => (
        typeof value === 'string'
        && Buffer.byteLength(value, 'utf8') <= 16 * 1024 * 1024
          ? true
          : 'The shared service document is too large.'
      ),
    },
    {
      name: 'syncId',
      type: 'text',
      required: true,
      index: true,
      hidden: true,
      access: technicalFieldAccess,
    },
    {
      name: 'syncVersion',
      type: 'number',
      required: true,
      min: 1,
      hidden: true,
      access: technicalFieldAccess,
    },
    {
      name: 'revision',
      type: 'text',
      required: true,
      hidden: true,
      access: technicalFieldAccess,
    },
    {
      name: 'changedAt',
      type: 'date',
      required: true,
      index: true,
      hidden: true,
      access: technicalFieldAccess,
    },
    {
      name: 'readyRevision',
      type: 'text',
      hidden: true,
      access: technicalFieldAccess,
    },
    {
      name: 'readyAt',
      type: 'date',
      hidden: true,
      access: technicalFieldAccess,
    },
    {
      name: 'lastIdempotencyKey',
      type: 'text',
      hidden: true,
      access: technicalFieldAccess,
    },
  ],
}
