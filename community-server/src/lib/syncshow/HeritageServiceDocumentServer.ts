import { createHash } from 'node:crypto'
import serviceCore from '../../../packages/service-core/node.js'

type UnknownRecord = Record<string, unknown>

const {
  HERITAGE_SERVICE_DOCUMENT_STATUSES,
  MAX_HERITAGE_SERVICE_DOCUMENT_BYTES,
  MAX_HERITAGE_SERVICE_DOCUMENT_PAGE_ITEMS,
  normalizeHeritageServiceDocumentChangePage,
  normalizeHeritageServiceDocumentEnvelope,
  normalizeHeritageServiceDocumentPage,
  normalizeHeritageServiceDocumentSummary,
  parseHeritageServiceDocumentSource,
  serializeHeritageServiceDocument,
} = serviceCore

export const MAX_SERVICE_DOCUMENT_TRANSFER_BYTES =
  (MAX_HERITAGE_SERVICE_DOCUMENT_BYTES * 2) + (64 * 1024)
export const MAX_SERVICE_DOCUMENT_PAGE_ITEMS =
  MAX_HERITAGE_SERVICE_DOCUMENT_PAGE_ITEMS
export const MAX_SERVICE_DOCUMENT_CURSOR_BYTES = 2048

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const REVISION_PATTERN = /^[a-f0-9]{64}$/
const IDEMPOTENCY_KEY_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/

export type ServiceDocumentWrite = Readonly<{
  syncId: string
  documentSource: string
  revision: string
  status: string
  baseSyncVersion: number | null
  baseRevision: string | null
}>

export class HeritageServiceDocumentServerError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 400) {
    super(message)
    this.name = 'HeritageServiceDocumentServerError'
    this.code = code
    this.status = status
  }
}

function fail(code: string, message: string, status = 400): never {
  throw new HeritageServiceDocumentServerError(code, message, status)
}

function exactKeys(value: UnknownRecord, expected: string[]) {
  const actual = Object.keys(value).sort()
  const wanted = [...expected].sort()
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) {
    fail('INVALID_SERVICE_DOCUMENT_REQUEST', 'Service-document request fields are invalid.')
  }
}

function identifier(value: unknown, label = 'Service document syncId') {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    fail('INVALID_SYNC_ID', `${label} is invalid.`)
  }
  return value
}

function positiveInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    fail('INVALID_SERVICE_DOCUMENT_BASE', `${label} is invalid.`)
  }
  return Number(value)
}

function revision(value: unknown, label: string) {
  if (typeof value !== 'string' || !REVISION_PATTERN.test(value)) {
    fail('INVALID_SERVICE_DOCUMENT_BASE', `${label} is invalid.`)
  }
  return value
}

export function serviceDocumentIdempotencyKey(value: unknown) {
  if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
    fail(
      'PRECONDITION_REQUIRED',
      'A valid Idempotency-Key is required for service-document writes.',
      428,
    )
  }
  return value
}

export function normalizeServiceDocumentWrite(
  raw: unknown,
  { update = false }: { update?: boolean } = {},
): ServiceDocumentWrite {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('INVALID_SERVICE_DOCUMENT_REQUEST', 'Service-document request must be an object.')
  }
  const value = raw as UnknownRecord
  exactKeys(value, update
    ? [
        'syncId',
        'baseSyncVersion',
        'baseRevision',
        'documentSource',
        'status',
      ]
    : ['syncId', 'documentSource', 'status'])
  const syncId = identifier(value.syncId)
  if (typeof value.status !== 'string'
    || !HERITAGE_SERVICE_DOCUMENT_STATUSES.includes(value.status)) {
    fail('INVALID_SERVICE_DOCUMENT_STATUS', 'Service-document status is invalid.')
  }
  if (typeof value.documentSource !== 'string') {
    fail('INVALID_SERVICE_DOCUMENT_SOURCE', 'Service-document source is invalid.')
  }
  let document
  try {
    document = parseHeritageServiceDocumentSource(value.documentSource)
  } catch {
    fail('INVALID_SERVICE_DOCUMENT_SOURCE', 'Service-document source is invalid.')
  }
  const documentSource = serializeHeritageServiceDocument(document)
  if (documentSource !== value.documentSource || document.id !== syncId) {
    fail(
      'SERVICE_DOCUMENT_ID_MISMATCH',
      'Service-document source does not match its sync identity.',
      409,
    )
  }
  const documentRevision = createHash('sha256')
    .update(documentSource, 'utf8')
    .digest('hex')
  return Object.freeze({
    syncId,
    documentSource,
    revision: documentRevision,
    status: value.status,
    baseSyncVersion: update
      ? positiveInteger(value.baseSyncVersion, 'Base sync version')
      : null,
    baseRevision: update
      ? revision(value.baseRevision, 'Base revision')
      : null,
  })
}

function changedAt(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ''))
  if (Number.isNaN(date.getTime())) {
    fail('INVALID_SERVICE_DOCUMENT_STATE', 'Stored service-document change time is invalid.', 500)
  }
  return date.toISOString()
}

export function serviceDocumentEnvelope(row: UnknownRecord) {
  return normalizeHeritageServiceDocumentEnvelope({
    syncId: row.syncId,
    syncVersion: row.syncVersion,
    revision: row.revision,
    documentSource: row.documentSource,
    status: row.status,
    changedAt: changedAt(row.changedAt),
  }, {
    revisionForSource: (source: string) => createHash('sha256')
      .update(source, 'utf8')
      .digest('hex'),
  })
}

export function serviceDocumentResponse(row: UnknownRecord) {
  const envelope = serviceDocumentEnvelope(row)
  return {
    syncId: envelope.syncId,
    syncVersion: envelope.syncVersion,
    revision: envelope.revision,
    documentSource: envelope.documentSource,
    status: envelope.status,
    changedAt: envelope.changedAt,
  }
}

export function serviceDocumentSummary(row: UnknownRecord) {
  if (typeof row.documentSource === 'string') {
    const envelope = serviceDocumentEnvelope(row)
    return normalizeHeritageServiceDocumentSummary({
      syncId: envelope.syncId,
      syncVersion: envelope.syncVersion,
      revision: envelope.revision,
      status: envelope.status,
      title: envelope.project.title,
      serviceDate: envelope.project.serviceDate,
      changedAt: envelope.changedAt,
    })
  }
  return normalizeHeritageServiceDocumentSummary({
    syncId: row.syncId,
    syncVersion: row.syncVersion,
    revision: row.revision,
    status: row.status,
    title: row.title,
    serviceDate: row.serviceDate,
    changedAt: changedAt(row.changedAt),
  })
}

export function serviceDocumentListPage(value: UnknownRecord, maximumItems: number) {
  return normalizeHeritageServiceDocumentPage(value, { maximumItems })
}

export function serviceDocumentChangePage(value: UnknownRecord, maximumItems: number) {
  return normalizeHeritageServiceDocumentChangePage(value, { maximumItems })
}

export function serviceDocumentEtag(row: UnknownRecord) {
  return `"${revision(row.revision, 'Stored service-document revision')}"`
}

export function serviceDocumentRouteId(value: unknown) {
  return identifier(String(value || ''))
}
