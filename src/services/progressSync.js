import { inspectCommunity, beginCommunityJoin, communityApiRequest, getCommunities } from './communities.js'
import { getCommunitySession, saveCommunitySession } from './communitySessions.js'
import { exportHeritageData, getStoredJson, removeStoredValue, setStoredJson, STORAGE_KEYS } from './persistentStorage.js'

const DEFAULT_SYNC_SERVER = import.meta.env.VITE_HERITAGE_SYNC_SERVER_URL || 'https://wotbc.heritage.faith'
const RECORD_SCHEMA_VERSION = 1

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

async function contentHash(value) {
  const bytes = new TextEncoder().encode(stableJson(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function recordKey(recordType, recordId) {
  return `${recordType}\u0000${recordId}`
}

function validTimestamp(value, fallback = null) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : fallback
}

function itemTimestamp(item) {
  return validTimestamp(item?.dateModified)
    || validTimestamp(item?.updatedAt)
    || validTimestamp(item?.dateCreated)
    || validTimestamp(item?.createdAt)
    || new Date(0).toISOString()
}

function localRecord(recordType, recordId, value, updatedAt) {
  return {
    recordType,
    recordId: String(recordId),
    schemaVersion: RECORD_SCHEMA_VERSION,
    deleted: false,
    value,
    updatedAt: validTimestamp(updatedAt) || new Date(0).toISOString(),
  }
}

function readLocalPlanKeys() {
  const keys = []
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith(STORAGE_KEYS.readingPlanPrefix) && key.endsWith(':progress')) keys.push(key)
    }
  } catch {}
  return keys
}

export async function collectLocalSyncRecords() {
  const records = []
  const reader = await getStoredJson(STORAGE_KEYS.readerProgress, { bible: null, resources: {} })
  if (reader?.bible) records.push(localRecord('bible-position', 'bible', reader.bible, reader.bible.updatedAt))
  for (const [resourceId, progress] of Object.entries(reader?.resources || {})) {
    records.push(localRecord('resource-position', resourceId, { resourceId, ...progress }, progress?.updatedAt))
  }

  const activePlan = await getStoredJson(STORAGE_KEYS.activeReadingPlan, null)
  if (activePlan) {
    records.push(localRecord(
      'active-reading-plan',
      'active',
      activePlan,
      activePlan.updatedAt || activePlan.startedAt || activePlan.startedOn,
    ))
  }

  for (const key of readLocalPlanKeys()) {
    const planId = key.slice(STORAGE_KEYS.readingPlanPrefix.length, -':progress'.length)
    const progress = await getStoredJson(key, null)
    if (!progress) continue
    for (const [day, itemIds] of Object.entries(progress.completedItems || {})) {
      for (const itemId of Array.isArray(itemIds) ? itemIds : []) {
        const value = { planId, day: Number(day), itemId: String(itemId), complete: true }
        records.push(localRecord('reading-plan-item', `${planId}|${day}|${itemId}`, value, progress.updatedAt))
      }
    }
    for (const day of Array.isArray(progress.completedDays) ? progress.completedDays : []) {
      const normalizedDay = Number(day)
      if (!Number.isInteger(normalizedDay) || normalizedDay < 1) continue
      records.push(localRecord(
        'reading-plan-day',
        `${planId}|${normalizedDay}`,
        { planId, day: normalizedDay, complete: true },
        progress.updatedAt,
      ))
    }
    for (const [day, note] of Object.entries(progress.dayNotes || {})) {
      if (!String(note || '').trim()) continue
      const value = { planId, day: Number(day), note: String(note) }
      records.push(localRecord('reading-plan-day-note', `${planId}|${day}`, value, progress.updatedAt))
    }
  }

  for (const [recordType, storageKey] of [
    ['bible-bookmark', STORAGE_KEYS.bookmarks],
    ['resource-bookmark', STORAGE_KEYS.resourceBookmarks],
    ['note', STORAGE_KEYS.notes],
    ['highlight', STORAGE_KEYS.highlights],
  ]) {
    const values = await getStoredJson(storageKey, [])
    for (const item of Array.isArray(values) ? values : []) {
      if (!item?.id) continue
      records.push(localRecord(recordType, item.id, item, itemTimestamp(item)))
    }
  }
  return records
}

function currentRecordsByKey(records) {
  return new Map(records.map(record => [recordKey(record.recordType, record.recordId), record]))
}

export async function buildLocalChanges(records, state) {
  const byKey = currentRecordsByKey(records)
  const changes = []
  const knownKeys = new Set([...(state.knownKeys || []), ...Object.keys(state.records || {})])
  for (const [key, record] of byKey) {
    const metadata = state.records?.[key]
    const hash = await contentHash(record.value)
    record.contentHash = hash
    if (metadata?.contentHash === hash && metadata.deleted !== true) continue
    if (state.blockedConflicts?.includes(key)) continue
    changes.push({
      ...record,
      baseRevision: Number(metadata?.serverRevision || 0),
      preservePrevious: false,
    })
  }
  for (const key of knownKeys) {
    if (byKey.has(key) || state.blockedConflicts?.includes(key)) continue
    const separator = key.indexOf('\u0000')
    if (separator < 1) continue
    const metadata = state.records?.[key]
    if (metadata?.deleted === true) continue
    changes.push({
      recordType: key.slice(0, separator),
      recordId: key.slice(separator + 1),
      schemaVersion: RECORD_SCHEMA_VERSION,
      baseRevision: Number(metadata?.serverRevision || 0),
      deleted: true,
      value: null,
      updatedAt: new Date().toISOString(),
      preservePrevious: false,
    })
  }
  return changes
}

function remoteRecordMap(localRecords, remoteRecords, locallyChangedKeys) {
  const map = currentRecordsByKey(localRecords)
  for (const remote of remoteRecords) {
    const key = recordKey(remote.recordType, remote.recordId)
    if (locallyChangedKeys.has(key)) continue
    if (remote.deleted) map.delete(key)
    else map.set(key, { ...remote, deleted: false })
  }
  return map
}

async function applyRecordMap(records) {
  const values = [...records.values()].filter(record => !record.deleted)
  const bible = values.find(record => record.recordType === 'bible-position')?.value || null
  const resources = Object.fromEntries(values
    .filter(record => record.recordType === 'resource-position')
    .map(record => [record.recordId, record.value]))
  await setStoredJson(STORAGE_KEYS.readerProgress, { bible, resources })

  const activePlan = values.find(record => record.recordType === 'active-reading-plan')?.value || null
  if (activePlan) await setStoredJson(STORAGE_KEYS.activeReadingPlan, activePlan)
  else await removeStoredValue(STORAGE_KEYS.activeReadingPlan)

  for (const [recordType, storageKey] of [
    ['bible-bookmark', STORAGE_KEYS.bookmarks],
    ['resource-bookmark', STORAGE_KEYS.resourceBookmarks],
    ['note', STORAGE_KEYS.notes],
    ['highlight', STORAGE_KEYS.highlights],
  ]) {
    await setStoredJson(storageKey, values.filter(record => record.recordType === recordType).map(record => record.value))
  }

  for (const key of readLocalPlanKeys()) {
    const existing = await getStoredJson(key, {})
    await setStoredJson(key, { ...existing, completedItems: {}, completedDays: [], dayNotes: {} })
  }
  const plans = new Map()
  for (const record of values.filter(record => record.recordType.startsWith('reading-plan-'))) {
    const planId = record.value?.planId
    if (!planId) continue
    if (!plans.has(planId)) plans.set(planId, { items: [], days: [], notes: [] })
    if (record.recordType === 'reading-plan-item') plans.get(planId).items.push(record.value)
    if (record.recordType === 'reading-plan-day') plans.get(planId).days.push(record.value)
    if (record.recordType === 'reading-plan-day-note') plans.get(planId).notes.push(record.value)
  }
  for (const [planId, planRecords] of plans) {
    const key = `${STORAGE_KEYS.readingPlanPrefix}${planId}:progress`
    const existing = await getStoredJson(key, {})
    const completedItems = {}
    for (const item of planRecords.items) {
      const day = String(item.day)
      if (!completedItems[day]) completedItems[day] = []
      if (!completedItems[day].includes(item.itemId)) completedItems[day].push(item.itemId)
    }
    const dayNotes = Object.fromEntries(planRecords.notes.map(note => [String(note.day), note.note]))
    await setStoredJson(key, {
      ...existing,
      completedItems,
      completedDays: [...new Set(planRecords.days.map(day => Number(day.day)).filter(Number.isInteger))],
      dayNotes,
      updatedAt: new Date().toISOString(),
    })
  }
}

export async function getSyncState() {
  return getStoredJson(STORAGE_KEYS.syncState, {
    schemaVersion: 1,
    lastRevision: 0,
    records: {},
    knownKeys: [],
    blockedConflicts: [],
    initialComplete: false,
    lastSyncedAt: null,
    status: '',
  })
}

async function saveSyncState(state) {
  await setStoredJson(STORAGE_KEYS.syncState, state)
  return state
}

export async function getSyncCommunity() {
  const state = await getSyncState()
  const communities = getCommunities()
  const selected = communities.find(record => record.manifest.id === state.communityId)
    || communities.find(record => record.primary && record.status === 'joined')
    || communities.find(record => record.status === 'joined')
    || communities.find(record => record.status === 'sync-only')
  return selected || null
}

export async function inspectDefaultSyncCommunity() {
  return inspectCommunity(DEFAULT_SYNC_SERVER)
}

export async function beginSyncSignIn(email) {
  const preview = await inspectDefaultSyncCommunity()
  const result = await beginCommunityJoin(preview, email, { flow: 'sync' })
  const state = await getSyncState()
  await saveSyncState({
    ...state,
    communityId: preview.manifest.id,
    serverUrl: preview.manifestUrl,
    pendingEmail: result.email,
    verificationSentAt: new Date().toISOString(),
    verificationExpiresAt: result.expiresAt || null,
    status: 'waiting',
  })
  return result
}

export async function clearPendingSyncSignIn() {
  const state = await getSyncState()
  await saveSyncState({ ...state, pendingEmail: '', status: '' })
}

function sessionAuthorization(session) {
  return { Authorization: `Community ${session.token}` }
}

async function syncRequest(community, url, session, options = {}) {
  let response
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20_000)
  try {
    response = await fetch(url, {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      ...options,
      signal: controller.signal,
      headers: {
        ...sessionAuthorization(session),
        ...(options.body != null ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    })
  } catch (error) {
    const wrapped = new Error(error?.name === 'AbortError'
      ? 'The Community server took too long to respond. Your local reading data is safe; try again.'
      : 'You appear to be offline. Your local reading data is safe; reconnect and try again.')
    wrapped.cause = error
    throw wrapped
  } finally {
    window.clearTimeout(timeout)
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(response.status === 401
      ? 'Your sign-in expired or this device was revoked. Sign in again to continue.'
      : response.status >= 500
        ? 'The Community server is temporarily unavailable. Your local data is safe; try again later.'
        : data.error || 'Sync could not finish. Your local data is safe; try again.')
    error.status = response.status
    throw error
  }
  return data
}

async function pullAllRecordPages(community, session, startRevision) {
  let cursor = Number(startRevision || 0)
  const records = []
  while (true) {
    const pullUrl = new URL(community.manifest.sync.recordsUrl)
    pullUrl.searchParams.set('since', String(cursor))
    pullUrl.searchParams.set('limit', '500')
    const page = await syncRequest(community, pullUrl.href, session)
    records.push(...(Array.isArray(page.records) ? page.records : []))
    const next = Number(page.nextRevision ?? page.latestRevision ?? cursor)
    if (!Number.isSafeInteger(next) || next < cursor || (page.hasMore && next === cursor)) {
      throw new Error('The Community server returned an invalid synchronization cursor.')
    }
    cursor = next
    if (!page.hasMore) return { records, latestRevision: cursor }
  }
}

export async function loadSyncAccount() {
  let community = await getSyncCommunity()
  if (community && !community.manifest?.sync?.accountUrl) {
    const state = await getSyncState()
    const refreshed = await inspectCommunity(state.serverUrl || community.manifestUrl)
    community = { ...community, ...refreshed, status: community.status, member: community.member }
  }
  if (!community?.manifest?.sync?.accountUrl) return null
  const session = await getCommunitySession(community.manifest.id, community)
  if (!session?.token) return null
  try {
    const account = await syncRequest(community, community.manifest.sync.accountUrl, session)
    const state = await getSyncState()
    if (state.pendingEmail) await saveSyncState({ ...state, pendingEmail: '', status: state.status === 'waiting' ? '' : state.status })
    return { community, session, account }
  } catch (error) {
    if (error.status === 401) await saveCommunitySession(community.manifest.id, null, community)
    throw error
  }
}

export async function loadSyncConflicts(existingContext = null) {
  const context = existingContext || await loadSyncAccount()
  if (!context) throw new Error('Sign in again to review synchronized changes.')
  const conflictsUrl = context.community.manifest.sync.conflictsUrl
  if (!conflictsUrl) throw new Error('This Community server does not support conflict review yet.')
  const conflicts = []
  let after = 0
  while (true) {
    const url = new URL(conflictsUrl)
    url.searchParams.set('after', String(after))
    url.searchParams.set('limit', '100')
    const page = await syncRequest(context.community, url.href, context.session)
    conflicts.push(...(Array.isArray(page.conflicts) ? page.conflicts : []))
    const nextAfter = Number(page.nextAfter ?? after)
    if (!Number.isSafeInteger(nextAfter) || nextAfter < after || (page.hasMore && nextAfter === after)) {
      throw new Error('The Community server returned an invalid conflict page.')
    }
    after = nextAfter
    if (!page.hasMore) return conflicts
  }
}

export async function resolveSyncConflict(conflict, action) {
  if (!conflict || !Number.isSafeInteger(Number(conflict.id))) throw new Error('That synchronized change is no longer available.')
  if (action !== 'use-conflict' && action !== 'discard-conflict') throw new Error('Choose which synchronized change to keep.')
  const context = await loadSyncAccount()
  if (!context) throw new Error('Sign in again to review synchronized changes.')
  const resolveUrl = context.community.manifest.sync.resolveConflictUrl
  if (!resolveUrl) throw new Error('This Community server does not support conflict review yet.')
  const result = await syncRequest(context.community, resolveUrl, context.session, {
    method: 'POST',
    body: JSON.stringify({ conflictId: Number(conflict.id), action }),
  })

  const state = await getSyncState()
  const localRecords = await collectLocalSyncRecords()
  const records = currentRecordsByKey(localRecords)
  const key = recordKey(conflict.recordType, conflict.recordId)
  const authoritative = result.record
  const metadata = { ...(state.records || {}) }
  const knownKeys = new Set(state.knownKeys || [])
  let lastRevision = Number(state.lastRevision || 0)
  if (authoritative) {
    if (authoritative.deleted) records.delete(key)
    else records.set(key, { ...authoritative, deleted: false })
    metadata[key] = {
      serverRevision: Number(authoritative.serverRevision || 0),
      contentHash: authoritative.deleted ? '' : await contentHash(authoritative.value),
      deleted: authoritative.deleted === true,
    }
    knownKeys.add(key)
    lastRevision = Math.max(lastRevision, Number(authoritative.serverRevision || 0))
  } else {
    records.delete(key)
    delete metadata[key]
    knownKeys.delete(key)
  }
  await applyRecordMap(records)
  const blockedConflicts = (state.blockedConflicts || []).filter(blockedKey => blockedKey !== key)
  const conflictCount = Math.max(0, Number(state.conflictCount || 0) - 1)
  await saveSyncState({
    ...state,
    records: metadata,
    knownKeys: [...knownKeys],
    blockedConflicts,
    conflictCount,
    status: conflictCount ? 'conflict' : 'synced',
    lastRevision,
    lastSyncedAt: new Date().toISOString(),
  })
  return result
}

export async function performManualSync() {
  const accountContext = await loadSyncAccount()
  if (!accountContext) throw new Error('Sign in before synchronizing.')
  const { community, session, account } = accountContext
  const state = await getSyncState()
  if (!state.initialComplete) {
    await setStoredJson(STORAGE_KEYS.syncRollback, {
      createdAt: new Date().toISOString(),
      reason: 'before-first-account-sync',
      backup: await exportHeritageData(),
    })
  }

  const localRecords = await collectLocalSyncRecords()
  const initialChanges = await buildLocalChanges(localRecords, state)
  const locallyChangedKeys = new Set(initialChanges.map(change => recordKey(change.recordType, change.recordId)))
  const pull = await pullAllRecordPages(community, session, state.lastRevision || 0)

  const remoteByKey = new Map(pull.records.map(record => [recordKey(record.recordType, record.recordId), record]))
  for (const change of initialChanges) {
    const remote = remoteByKey.get(recordKey(change.recordType, change.recordId))
    if (!remote || remote.deleted || await contentHash(remote.value) === change.contentHash) continue
    // Only first-account reconciliation may intentionally adopt the current
    // revision and preserve the prior server value. On later synchronizations,
    // keep the stale base revision so the server records a real conflict rather
    // than silently overwriting an edit made by another device.
    const localUpdatedAt = Date.parse(change.updatedAt || '')
    const remoteUpdatedAt = Date.parse(remote.updatedAt || '')
    if (!state.initialComplete && Number.isFinite(localUpdatedAt) && localUpdatedAt > remoteUpdatedAt) {
      change.baseRevision = remote.serverRevision
      change.preservePrevious = true
    }
  }
  const mergedBeforePush = remoteRecordMap(localRecords, pull.records, locallyChangedKeys)
  const batches = initialChanges.length
    ? Array.from({ length: Math.ceil(initialChanges.length / 500) }, (_, index) => initialChanges.slice(index * 500, (index + 1) * 500))
    : [[]]
  const response = { acknowledgements: [], conflicts: [], records: [], latestRevision: pull.latestRevision, syncedAt: null }
  let responseCursor = pull.latestRevision
  for (const changes of batches) {
    const page = await syncRequest(community, community.manifest.sync.recordsUrl, session, {
      method: 'POST',
      body: JSON.stringify({
        deviceId: account.currentDeviceId,
        // The server permits timestamp-checked preservation only for an
        // account's first reconciliation. Later requests use the fully pulled
        // cursor and cannot opt around the stale-base conflict check.
        sinceRevision: state.initialComplete ? responseCursor : 0,
        limit: 500,
        changes,
      }),
    })
    response.acknowledgements.push(...(page.acknowledgements || []))
    response.conflicts.push(...(page.conflicts || []))
    response.records.push(...(page.records || []))
    response.syncedAt = page.syncedAt || response.syncedAt
    responseCursor = Math.max(responseCursor, Number(page.nextRevision ?? page.latestRevision ?? responseCursor))
    if (page.hasMore) {
      const remaining = await pullAllRecordPages(community, session, responseCursor)
      response.records.push(...remaining.records)
      responseCursor = remaining.latestRevision
    }
  }
  response.latestRevision = responseCursor

  const conflictKeys = new Set(response.conflicts.map(conflict => recordKey(conflict.recordType, conflict.recordId)))
  const finalMap = remoteRecordMap([...mergedBeforePush.values()], response.records, conflictKeys)
  await applyRecordMap(finalMap)

  const metadata = { ...(state.records || {}) }
  for (const record of response.records) {
    const key = recordKey(record.recordType, record.recordId)
    metadata[key] = {
      serverRevision: record.serverRevision,
      contentHash: record.deleted ? '' : await contentHash(record.value),
      deleted: record.deleted,
    }
  }
  const submittedByKey = new Map(initialChanges.map(change => [recordKey(change.recordType, change.recordId), change]))
  for (const acknowledgement of response.acknowledgements) {
    const key = recordKey(acknowledgement.recordType, acknowledgement.recordId)
    const submitted = submittedByKey.get(key)
    metadata[key] = {
      serverRevision: acknowledgement.serverRevision,
      contentHash: acknowledgement.deleted ? '' : submitted?.contentHash || metadata[key]?.contentHash || '',
      deleted: acknowledgement.deleted === true,
    }
  }
  const blockedConflicts = [...new Set([...(state.blockedConflicts || []), ...conflictKeys])]
  const nextState = await saveSyncState({
    ...state,
    schemaVersion: 1,
    communityId: community.manifest.id,
    serverUrl: community.manifestUrl,
    pendingEmail: '',
    status: response.conflicts.length ? 'conflict' : 'synced',
    lastRevision: Math.max(Number(state.lastRevision || 0), Number(pull.latestRevision || 0), Number(response.latestRevision || 0)),
    records: metadata,
    knownKeys: [...new Set([...Object.keys(metadata), ...finalMap.keys()])],
    blockedConflicts,
    conflictCount: Number(account.conflicts || 0) + response.conflicts.length,
    initialComplete: true,
    lastSyncedAt: response.syncedAt || new Date().toISOString(),
  })
  return { state: nextState, conflicts: response.conflicts, records: response.records.length }
}

export async function requestAccountReverification() {
  const context = await loadSyncAccount()
  if (!context) throw new Error('Sign in again to continue.')
  return syncRequest(context.community, context.community.manifest.auth.reverifyUrl, context.session, { method: 'POST', body: '{}' })
}

export async function changeAccountProtection(input) {
  const context = await loadSyncAccount()
  if (!context) throw new Error('Sign in again to continue.')
  return syncRequest(context.community, context.community.manifest.sync.protectionUrl, context.session, {
    method: 'POST', body: JSON.stringify(input),
  })
}

export async function revokeSyncDevice(deviceId) {
  const context = await loadSyncAccount()
  if (!context) throw new Error('Sign in again to continue.')
  const result = await syncRequest(context.community, context.community.manifest.sync.revokeDeviceUrl, context.session, {
    method: 'POST', body: JSON.stringify({ deviceId }),
  })
  if (result.currentDeviceRevoked) await saveCommunitySession(context.community.manifest.id, null, context.community)
  return result
}

export async function signOutSyncAccount() {
  const context = await loadSyncAccount()
  if (!context) return
  await syncRequest(context.community, context.community.manifest.auth.logoutUrl, context.session, { method: 'POST', body: '{}' })
  await saveCommunitySession(context.community.manifest.id, null, context.community)
}

export async function eraseSynchronizedAccountData() {
  const context = await loadSyncAccount()
  if (!context) throw new Error('Sign in again to continue.')
  const result = await syncRequest(context.community, context.community.manifest.sync.eraseUrl, context.session, {
    method: 'POST', body: JSON.stringify({ confirmation: 'ERASE' }),
  })
  await saveCommunitySession(context.community.manifest.id, null, context.community)
  await saveSyncState({ schemaVersion: 1, lastRevision: 0, records: {}, knownKeys: [], blockedConflicts: [], initialComplete: false, lastSyncedAt: null, status: '' })
  return result
}

export async function exportSynchronizedAccountData() {
  const context = await loadSyncAccount()
  if (!context) throw new Error('Sign in again to continue.')
  return syncRequest(context.community, context.community.manifest.sync.exportUrl, context.session)
}

export async function getSyncSessionForServer(serverUrl) {
  const preview = await inspectCommunity(serverUrl)
  const session = await getCommunitySession(preview.manifest.id, preview)
  return { preview, session }
}

export { DEFAULT_SYNC_SERVER, recordKey, stableJson }
