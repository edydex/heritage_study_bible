import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveCommunitySession } from './communitySessions.js'
import { buildLocalChanges, performManualSync, recordKey, resolveSyncConflict } from './progressSync.js'
import { getStoredJson, setStoredJson, STORAGE_KEYS } from './persistentStorage.js'

const community = {
  manifestUrl: 'https://sync.example/.well-known/heritage-community.json',
  status: 'joined',
  manifest: {
    id: 'test-community',
    apiBaseUrl: 'https://sync.example/api',
    sync: {
      accountUrl: 'https://sync.example/api/community/account',
      recordsUrl: 'https://sync.example/api/community/sync/v1/records',
      conflictsUrl: 'https://sync.example/api/community/account/conflicts',
      resolveConflictUrl: 'https://sync.example/api/community/account/conflicts/resolve',
    },
  },
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('progressSync', () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem(STORAGE_KEYS.communities, JSON.stringify([community]))
    await saveCommunitySession('test-community', { token: 'session-token' }, community)
    vi.restoreAllMocks()
  })

  it('emits a tombstone for a record removed after synchronization', async () => {
    const key = recordKey('note', 'removed-note')
    const changes = await buildLocalChanges([], {
      knownKeys: [key],
      records: { [key]: { serverRevision: 7, contentHash: 'old', deleted: false } },
      blockedConflicts: [],
    })

    expect(changes).toEqual([expect.objectContaining({
      recordType: 'note',
      recordId: 'removed-note',
      baseRevision: 7,
      deleted: true,
    })])
  })

  it('preserves the previous server value during a first-account overlap', async () => {
    const localNote = { id: 'shared', text: 'new local value', dateModified: '2026-09-03T12:00:00.000Z' }
    await setStoredJson(STORAGE_KEYS.notes, [localNote])
    let posted
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (String(url).endsWith('/account')) {
        return jsonResponse({ currentDeviceId: 'device-a', conflicts: 0 })
      }
      if ((options.method || 'GET') === 'GET') {
        return jsonResponse({
          latestRevision: 5,
          records: [{
            recordType: 'note', recordId: 'shared', schemaVersion: 1,
            serverRevision: 5, deleted: false, contentHash: 'server-hash',
            updatedAt: '2026-08-01T12:00:00.000Z',
            value: { id: 'shared', text: 'older server value', dateModified: '2026-08-01T12:00:00.000Z' },
          }],
        })
      }
      posted = JSON.parse(options.body)
      return jsonResponse({
        latestRevision: 6,
        syncedAt: '2026-09-03T12:00:01.000Z',
        conflicts: [],
        acknowledgements: [{
          recordType: 'note', recordId: 'shared', serverRevision: 6,
          contentHash: posted.changes[0].contentHash, deleted: false,
        }],
        records: [{
          ...posted.changes[0], serverRevision: 6,
        }],
      })
    }))

    await performManualSync()

    expect(posted.changes[0]).toMatchObject({ baseRevision: 5, preservePrevious: true })
    await expect(getStoredJson(STORAGE_KEYS.syncRollback, null)).resolves.toMatchObject({
      reason: 'before-first-account-sync',
    })
    await expect(getStoredJson(STORAGE_KEYS.notes, [])).resolves.toEqual([localNote])
  })

  it('keeps a stale base revision so a later same-record edit becomes a conflict', async () => {
    const key = recordKey('note', 'shared')
    const localNote = { id: 'shared', text: 'device A edit', dateModified: '2026-09-03T13:00:00.000Z' }
    await setStoredJson(STORAGE_KEYS.notes, [localNote])
    await setStoredJson(STORAGE_KEYS.syncState, {
      schemaVersion: 1,
      communityId: 'test-community',
      lastRevision: 1,
      initialComplete: true,
      knownKeys: [key],
      records: { [key]: { serverRevision: 1, contentHash: 'old-hash', deleted: false } },
      blockedConflicts: [],
    })
    let posted
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (String(url).endsWith('/account')) return jsonResponse({ currentDeviceId: 'device-a', conflicts: 0 })
      if ((options.method || 'GET') === 'GET') {
        return jsonResponse({
          latestRevision: 2,
          records: [{
            recordType: 'note', recordId: 'shared', schemaVersion: 1,
            serverRevision: 2, deleted: false, contentHash: 'device-b-hash',
            updatedAt: '2026-09-03T12:59:00.000Z',
            value: { id: 'shared', text: 'device B edit', dateModified: '2026-09-03T12:59:00.000Z' },
          }],
        })
      }
      posted = JSON.parse(options.body)
      return jsonResponse({
        latestRevision: 2,
        syncedAt: '2026-09-03T13:00:01.000Z',
        acknowledgements: [],
        conflicts: [{ recordType: 'note', recordId: 'shared', reason: 'changed-on-another-device' }],
        records: [],
      })
    }))

    const result = await performManualSync()

    expect(posted.changes[0]).toMatchObject({ baseRevision: 1, preservePrevious: false })
    expect(result.state).toMatchObject({ status: 'conflict', conflictCount: 1 })
    await expect(getStoredJson(STORAGE_KEYS.notes, [])).resolves.toEqual([localNote])
  })

  it('applies the authoritative record and unblocks future sync after conflict review', async () => {
    const key = recordKey('note', 'shared')
    await setStoredJson(STORAGE_KEYS.notes, [{
      id: 'shared', text: 'device A edit', dateModified: '2026-09-03T13:00:00.000Z',
    }])
    await setStoredJson(STORAGE_KEYS.syncState, {
      schemaVersion: 1,
      communityId: 'test-community',
      lastRevision: 2,
      initialComplete: true,
      knownKeys: [key],
      records: { [key]: { serverRevision: 1, contentHash: 'old-hash', deleted: false } },
      blockedConflicts: [key],
      conflictCount: 1,
      status: 'conflict',
    })
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (String(url).endsWith('/account')) return jsonResponse({ currentDeviceId: 'device-a', conflicts: 1 })
      if (String(url).endsWith('/conflicts/resolve') && options.method === 'POST') {
        return jsonResponse({
          ok: true,
          action: 'discard-conflict',
          record: {
            recordType: 'note', recordId: 'shared', schemaVersion: 1,
            serverRevision: 4, deleted: false, updatedAt: '2026-09-03T13:01:00.000Z',
            value: { id: 'shared', text: 'device B edit', dateModified: '2026-09-03T13:01:00.000Z' },
          },
        })
      }
      throw new Error(`Unexpected request: ${url}`)
    }))

    await resolveSyncConflict({ id: 9, recordType: 'note', recordId: 'shared' }, 'discard-conflict')

    await expect(getStoredJson(STORAGE_KEYS.notes, [])).resolves.toEqual([
      { id: 'shared', text: 'device B edit', dateModified: '2026-09-03T13:01:00.000Z' },
    ])
    await expect(getStoredJson(STORAGE_KEYS.syncState, null)).resolves.toMatchObject({
      lastRevision: 4,
      blockedConflicts: [],
      conflictCount: 0,
      status: 'synced',
      records: { [key]: { serverRevision: 4, deleted: false } },
    })
  })
})
