import { createHash } from 'node:crypto'
import serviceCore from '../../../packages/service-core/node.js'
import {
  normalizeCommunityServicePlanEnvelope,
} from './CommunityServicePlan.ts'

type UnknownRecord = Record<string, unknown>

const {
  createHeritageServiceDocument,
  serializeHeritageServiceDocument,
} = serviceCore

function timestamp(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ''))
  if (Number.isNaN(date.getTime())) {
    throw new Error('The legacy service plan change time is invalid.')
  }
  return date.toISOString()
}

function safeItemId(value: string, index: number) {
  const preferred = value.replace(/[^A-Za-z0-9._:-]+/g, '-').slice(0, 100)
  return /^[A-Za-z0-9]/.test(preferred)
    ? `legacy-${index + 1}-${preferred}`
    : `legacy-${index + 1}`
}

export function legacyServicePlanToServiceDocument(row: UnknownRecord) {
  const changedAt = timestamp(row.changedAt)
  const envelope = normalizeCommunityServicePlanEnvelope({
    syncId: row.syncId,
    syncVersion: row.syncVersion,
    revision: row.revision,
    documentSource: row.documentSource,
    status: row.status,
    changedAt,
  })
  const items: Record<string, UnknownRecord> = {}
  const rootItemIds: string[] = []
  envelope.plan.entries.forEach((entry, index) => {
    const id = safeItemId(entry.id, index)
    rootItemIds.push(id)
    if (entry.kind === 'section') {
      items[id] = {
        id,
        kind: 'group',
        title: entry.title,
        createdAt: changedAt,
        updatedAt: changedAt,
        operatorNotes: 'Migrated from the former Community service-plan editor.',
        groupKind: 'section',
        childIds: [],
      }
      return
    }
    const pin = entry.kind === 'song' || entry.kind === 'sermon'
      ? ` Legacy ${entry.kind} pin: ${entry.syncId} at sync version ${entry.expectedSyncVersion}, revision ${entry.expectedRevision}.`
      : entry.kind === 'scripture'
        ? ` Legacy Scripture details: ${JSON.stringify({
            range: entry.range,
            translationId: entry.translationId,
            sermonReading: entry.sermonReading || null,
          })}.`
        : ''
    items[id] = {
      id,
      kind: 'notice',
      title: entry.title,
      createdAt: changedAt,
      updatedAt: changedAt,
      operatorNotes: `Review and replace this migrated outline item with native content.${pin}`,
      textByChannel: {
        english: entry.title,
        russian: entry.title,
      },
      presetId: 'notice-text',
    }
  })
  const project = {
    schemaVersion: 1,
    kind: 'syncshow-service-project',
    id: envelope.syncId,
    title: envelope.plan.title,
    serviceDate: envelope.plan.serviceDate,
    createdAt: changedAt,
    updatedAt: changedAt,
    revision: 1,
    preferredProfileId: 'main-sanctuary',
    channelIds: ['english', 'russian', 'media'],
    channels: {
      english: { id: 'english', label: 'English', language: 'en' },
      russian: { id: 'russian', label: 'Russian', language: 'ru' },
      media: { id: 'media', label: 'Media', language: 'und' },
    },
    rootItemIds,
    items,
    resources: {},
    assets: {},
    presetPack: {
      id: 'main-sanctuary',
      version: 1,
      sha256: null,
    },
  }
  const documentSource = serializeHeritageServiceDocument(
    createHeritageServiceDocument(project),
  )
  return Object.freeze({
    communityId: Number(row.communityId),
    syncId: envelope.syncId,
    syncVersion: 1,
    revision: createHash('sha256').update(documentSource, 'utf8').digest('hex'),
    documentSource,
    status: envelope.status === 'draft' ? 'planning' : envelope.status,
    title: envelope.plan.title,
    serviceDate: envelope.plan.serviceDate,
    changedAt,
  })
}
