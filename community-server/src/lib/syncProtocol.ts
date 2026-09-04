export const SYNC_RECORD_TYPES = new Set([
  'bible-position',
  'resource-position',
  'active-reading-plan',
  'reading-plan-item',
  'reading-plan-day',
  'reading-plan-day-note',
  'bible-bookmark',
  'resource-bookmark',
  'note',
  'highlight',
])

const MAX_RECORD_ID_LENGTH = 240
const MAX_BATCH_SIZE = 500
const MAX_VALUE_BYTES = 128 * 1024

function utf8Length(value: string) {
  return Buffer.byteLength(value, 'utf8')
}

function truncateUtf8(value: string, maximumBytes: number) {
  let result = ''
  for (const character of value) {
    if (utf8Length(result) + utf8Length(character) > maximumBytes) break
    result += character
  }
  return result
}

export function normalizeDeviceIdentity(input: unknown) {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const deviceId = String(value.deviceId || '').trim()
  if (!/^[A-Za-z0-9._:-]{16,160}$/.test(deviceId)) throw new Error('This device needs a new secure identity.')
  const deviceName = truncateUtf8(String(value.deviceName || 'Heritage device').trim(), 120) || 'Heritage device'
  const platform = truncateUtf8(String(value.platform || 'unknown').trim(), 40) || 'unknown'
  return { deviceId, deviceName, platform }
}

export type ClientSyncChange = {
  recordType: string
  recordId: string
  schemaVersion: number
  baseRevision: number
  deleted: boolean
  updatedAt: string | null
  value: unknown
  preservePrevious: boolean
}

export function normalizeSyncChanges(input: unknown): ClientSyncChange[] {
  if (!Array.isArray(input) || input.length > MAX_BATCH_SIZE) throw new Error('Too many synchronized changes were sent at once.')
  const seen = new Set<string>()
  return input.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('A synchronized change is invalid.')
    const value = raw as Record<string, unknown>
    const recordType = String(value.recordType || '')
    const recordId = String(value.recordId || '')
    const schemaVersion = Number(value.schemaVersion)
    const baseRevision = Number(value.baseRevision || 0)
    const deleted = value.deleted === true
    const updatedAt = typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt))
      ? new Date(value.updatedAt).toISOString()
      : null
    if (!SYNC_RECORD_TYPES.has(recordType)) throw new Error('A synchronized record type is unsupported.')
    if (!recordId || utf8Length(recordId) > MAX_RECORD_ID_LENGTH || /[\u0000-\u001f]/.test(recordId)) throw new Error('A synchronized record ID is invalid.')
    if (!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > 20) throw new Error('A synchronized schema version is unsupported.')
    if (!Number.isSafeInteger(baseRevision) || baseRevision < 0) throw new Error('A synchronized base revision is invalid.')
    if (!deleted) {
      let serialized: string | undefined
      try {
        serialized = JSON.stringify(value.value)
      } catch {
        throw new Error('A synchronized record value is not valid JSON.')
      }
      if (typeof serialized !== 'string') throw new Error('A synchronized record value is not valid JSON.')
      if (utf8Length(serialized) > MAX_VALUE_BYTES) throw new Error('A synchronized record is too large.')
    }
    const key = `${recordType}\u0000${recordId}`
    if (seen.has(key)) throw new Error('The same synchronized record was sent twice.')
    seen.add(key)
    return {
      recordType,
      recordId,
      schemaVersion,
      baseRevision,
      deleted,
      updatedAt,
      value: deleted ? null : value.value,
      preservePrevious: value.preservePrevious === true,
    }
  })
}
