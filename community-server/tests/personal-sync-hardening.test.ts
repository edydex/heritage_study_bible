import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  isAuthorizedFirstSyncPreservation,
  isIdempotentSyncWrite,
} from '../src/endpoints/sync.ts'
import { orderedRecordLockKeys } from '../src/lib/syncDatabase.ts'
import { decryptSyncPayload, encryptSyncPayload } from '../src/lib/syncEncryption.ts'
import { normalizeDeviceIdentity, normalizeSyncChanges, type ClientSyncChange } from '../src/lib/syncProtocol.ts'
import { SyncConflicts } from '../src/collections/SyncConflicts.ts'
import { SyncRecords } from '../src/collections/SyncRecords.ts'

const secret = 'test-only-community-secret-that-is-longer-than-thirty-two-bytes'

function change(overrides: Partial<ClientSyncChange> = {}): ClientSyncChange {
  return {
    recordType: 'note',
    recordId: 'note-1',
    schemaVersion: 1,
    baseRevision: 4,
    deleted: false,
    updatedAt: '2026-09-03T20:00:00.000Z',
    value: { text: 'private study note' },
    preservePrevious: false,
    ...overrides,
  }
}

test('synchronized values use authenticated encryption and keyed record-bound hashes', () => {
  const first = encryptSyncPayload({
    secret,
    userId: '41',
    recordType: 'note',
    recordId: 'note-1',
    schemaVersion: 1,
    deleted: false,
    value: { text: 'private study note', tags: ['grace'] },
  })
  const second = encryptSyncPayload({
    secret,
    userId: '41',
    recordType: 'note',
    recordId: 'note-1',
    schemaVersion: 1,
    deleted: false,
    value: { tags: ['grace'], text: 'private study note' },
  })
  const anotherRecord = encryptSyncPayload({
    secret,
    userId: '41',
    recordType: 'note',
    recordId: 'note-2',
    schemaVersion: 1,
    deleted: false,
    value: { text: 'private study note', tags: ['grace'] },
  })

  assert.notEqual(first.ciphertext, second.ciphertext, 'fresh IVs must randomize ciphertext')
  assert.equal(first.contentHash, second.contentHash, 'canonical content stays idempotent')
  assert.notEqual(first.contentHash, anotherRecord.contentHash, 'hashes are bound to record metadata')
  assert.notEqual(first.contentHash, encryptSyncPayload({
    secret: `${secret}-different`,
    userId: '41',
    recordType: 'note',
    recordId: 'note-1',
    schemaVersion: 1,
    deleted: false,
    value: { text: 'private study note', tags: ['grace'] },
  }).contentHash, 'a database-only disclosure cannot compute the digest')
  assert.deepEqual(decryptSyncPayload({
    secret,
    userId: '41',
    recordType: 'note',
    recordId: 'note-1',
    schemaVersion: 1,
    deleted: false,
    ...first,
  }), { tags: ['grace'], text: 'private study note' })
  assert.throws(() => decryptSyncPayload({
    secret,
    userId: '42',
    recordType: 'note',
    recordId: 'note-1',
    schemaVersion: 1,
    deleted: false,
    ...first,
  }))
})

test('protocol limits use UTF-8 bytes rather than JavaScript character counts', () => {
  assert.throws(() => normalizeSyncChanges([{
    ...change(),
    recordId: '🙂'.repeat(61),
  }]), /record ID is invalid/)

  assert.throws(() => normalizeSyncChanges([{
    ...change(),
    value: '🙂'.repeat(33_000),
  }]), /record is too large/)

  const device = normalizeDeviceIdentity({
    deviceId: '1234567890abcdef',
    deviceName: '🙂'.repeat(100),
    platform: '🙂'.repeat(100),
  })
  assert.equal(Buffer.byteLength(device.deviceName, 'utf8'), 120)
  assert.equal(Buffer.byteLength(device.platform, 'utf8'), 40)
})

test('record locks are deterministically ordered and scoped to the account', () => {
  assert.deepEqual(orderedRecordLockKeys(9, [
    { recordType: 'note', recordId: 'z' },
    { recordType: 'bible-bookmark', recordId: 'a' },
    { recordType: 'note', recordId: 'a' },
  ]), [
    'heritage-sync-record:9:bible-bookmark\0a',
    'heritage-sync-record:9:note\0a',
    'heritage-sync-record:9:note\0z',
  ])
})

test('first-sync preservation is server-authorized only for a newer client value', () => {
  const existing = {
    serverRevision: 4,
    clientUpdatedAt: '2026-09-03T19:00:00.000Z',
    updatedAt: '2026-09-03T19:00:01.000Z',
  }
  const candidate = change({ preservePrevious: true })
  assert.equal(isAuthorizedFirstSyncPreservation({ existing, change: candidate, sinceRevision: 0 }), true)
  assert.equal(isAuthorizedFirstSyncPreservation({ existing, change: candidate, sinceRevision: 1 }), false)
  assert.equal(isAuthorizedFirstSyncPreservation({
    existing,
    change: change({ preservePrevious: true, updatedAt: '2026-09-03T18:00:00.000Z' }),
    sinceRevision: 0,
  }), false)
  assert.equal(isAuthorizedFirstSyncPreservation({
    existing,
    change: change({ preservePrevious: true, baseRevision: 3 }),
    sinceRevision: 0,
  }), false)
})

test('idempotence includes schema version and tombstone state', () => {
  const existing = { schemaVersion: 1, contentHash: 'keyed', deleted: false }
  assert.equal(isIdempotentSyncWrite(existing, change(), 'keyed'), true)
  assert.equal(isIdempotentSyncWrite(existing, change({ schemaVersion: 2 }), 'keyed'), false)
  assert.equal(isIdempotentSyncWrite(existing, change({ deleted: true }), 'keyed'), false)
})

test('a member cannot directly read or mutate any account sync collection', async () => {
  const memberRequest = { req: { user: { id: 41, systemRole: 'member' } } } as never
  const anotherMemberRequest = { req: { user: { id: 42, systemRole: 'member' } } } as never
  for (const collection of [SyncRecords, SyncConflicts]) {
    assert.equal(await collection.access?.read?.(memberRequest), false)
    assert.equal(await collection.access?.read?.(anotherMemberRequest), false)
    assert.equal(await collection.access?.create?.(memberRequest), false)
    assert.equal(await collection.access?.update?.(memberRequest), false)
  }
})

test('custom account and sync endpoints trust only the validated Community session boundary', () => {
  const accountSource = readFileSync(new URL('../src/endpoints/account.ts', import.meta.url), 'utf8')
  const syncSource = readFileSync(new URL('../src/endpoints/sync.ts', import.meta.url), 'utf8')
  const authSource = readFileSync(new URL('../src/endpoints/auth.ts', import.meta.url), 'utf8')
  for (const source of [accountSource, syncSource]) {
    assert.match(source, /const session = await currentCommunitySession\(req\)/)
    assert.match(source, /const userId = relationId\(session\?\.user\)/)
    assert.doesNotMatch(source, /!req\.user|Number\(req\.user\.id\)/)
  }
  assert.doesNotMatch(authSource, /!req\.user|String\(req\.user\.email\)|userID: req\.user\.id/)
})
