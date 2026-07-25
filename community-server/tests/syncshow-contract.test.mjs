import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sourceRoot = new URL('../src/', import.meta.url)

async function source(path) {
  return readFile(new URL(path, sourceRoot), 'utf8')
}

test('the migration image contains the read-only SyncShow preflight script', async () => {
  const dockerfile = await readFile(new URL('../Dockerfile', import.meta.url), 'utf8')
  const migrations = dockerfile.slice(
    dockerfile.indexOf('FROM base AS migrations'),
    dockerfile.indexOf('FROM base AS runner'),
  )
  assert.match(migrations, /COPY scripts \.\/scripts/)
})

test('discovery and device endpoints match SyncShow CommunityClient exactly', async () => {
  const [manifest, endpoint] = await Promise.all([
    source('app/.well-known/heritage-community.json/route.ts'),
    source('endpoints/syncShow.ts'),
  ])
  for (const expected of [
    "apiBaseUrl: `${communityPublicConfig.publicUrl}/api/community/syncshow/v1`",
    "deviceStart: 'auth/device/start'",
    "deviceStatus: 'auth/device/status'",
    "deviceToken: 'auth/device/token'",
    "deviceCancel: 'auth/device/cancel'",
    "revoke: 'auth/revoke'",
    "songs: 'songs'",
  ]) assert.match(manifest, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

  assert.match(endpoint, /data\.deviceName/)
  assert.match(endpoint, /data\.scopes/)
  assert.match(endpoint, /deviceId,\s*deviceSecret,\s*userCode:/s)
  assert.match(endpoint, /pollIntervalMs:/)
  assert.match(endpoint, /findDeviceGrant\(req, data\)/)
  assert.match(endpoint, /refreshToken: null/)
  assert.match(endpoint, /scopes,\s*account:/s)
  assert.match(endpoint, /deviceGrantPollingStatus\(grant, new Date\(\), TOKEN_RETRY_MINUTES \* 60_000\)/)
})

test('token exchange is transactional and safely repeatable after a lost response', async () => {
  const endpoint = await source('endpoints/syncShow.ts')
  const start = endpoint.indexOf('const deviceToken')
  const end = endpoint.indexOf('const deviceCancel')
  const block = endpoint.slice(start, end)
  assert.match(block, /syncShowAccessToken/)
  assert.match(block, /TOKEN_RETRY_MINUTES/)
  assert.match(block, /FROM "syncshow_device_grants"[\s\S]*FOR UPDATE;/)
  assert.match(block, /FROM "syncshow_connections"[\s\S]*FOR UPDATE;/)
  assert.match(block, /req\.transactionID = transactionId/)
  assert.match(block, /req\.payload\.create\([\s\S]*collection: 'syncshow-connections'[\s\S]*req,/)
  assert.match(block, /req\.payload\.update\([\s\S]*collection: 'syncshow-device-grants'[\s\S]*req,/)
  assert.match(block, /commitTransaction/)
  assert.match(block, /rollbackTransaction/)
  assert.match(block, /lockedStatus === 'consumed'/)
})

test('GET approval only displays a form while approval itself is an explicit POST', async () => {
  const endpoint = await source('endpoints/syncShow.ts')
  const getStart = endpoint.indexOf('const deviceApprovalPage')
  const postStart = endpoint.indexOf('const deviceApprovalPost')
  const getBlock = endpoint.slice(getStart, postStart)
  assert.match(getBlock, /method: 'get'/)
  assert.match(getBlock, /Opening this page never approves/)
  assert.doesNotMatch(getBlock, /payload\.update/)
  assert.match(endpoint.slice(postStart), /method: 'post'/)
  assert.match(endpoint.slice(postStart), /status: 'approved'/)
})

test('song changes use bounded cursor pagination and do not truncate libraries over 100', async () => {
  const endpoint = await source('endpoints/syncShow.ts')
  assert.match(endpoint, /url\.searchParams\.get\('cursor'\)/)
  assert.match(endpoint, /limit: limit \+ 1/)
  assert.match(endpoint, /sort: \['updatedAt', 'id'\]/)
  assert.match(endpoint, /const hasMore = pageDocs\.length > limit/)
  assert.match(endpoint, /nextCursor,/)
  assert.match(endpoint, /hasMore,/)
})

test('CAS holds a row lock and performs the Payload update in the same transaction', async () => {
  const endpoint = await source('endpoints/syncShow.ts')
  const start = endpoint.indexOf('async function updateSongWithCas')
  const end = endpoint.indexOf('const deviceStart')
  const block = endpoint.slice(start, end)
  assert.match(block, /FOR UPDATE/)
  assert.match(block, /req\.transactionID = transactionId/)
  assert.match(block, /req\.payload\.update/)
  assert.match(block, /req,\s*\}\)/s)
  assert.match(block, /return requestDoc\(updated\)/)
  assert.match(block, /commitTransaction/)
  assert.match(block, /rollbackTransaction/)
  assert.doesNotMatch(block, /UPDATE "songs"\s+SET "sync_version"/)
})

test('DELETE is a CAS-protected archive tombstone and physical song deletion is disabled', async () => {
  const [endpoint, songs] = await Promise.all([
    source('endpoints/syncShow.ts'),
    source('collections/Songs.ts'),
  ])
  assert.match(endpoint, /const songDelete: Endpoint/)
  assert.match(endpoint, /method: 'delete'/)
  assert.match(endpoint, /If-Match is required for song archival/)
  assert.match(endpoint, /status: 'archived'/)
  assert.match(endpoint, /visibility: 'private'/)
  assert.match(songs, /delete: \(\) => false/)
})

test('ordinary song catalog/content routes require members and enforce scheduled server time', async () => {
  const [catalog, content, access] = await Promise.all([
    source('app/catalogs/[type]/route.ts'),
    source('app/content/[type]/[id]/route.ts'),
    source('access.ts'),
  ])
  assert.match(catalog, /communityRequestAccess/)
  assert.match(catalog, /!songAccess\?\.authenticated/)
  assert.match(catalog, /songAccess\?\.manager/)
  assert.match(catalog, /status: \{ not_equals: 'archived' \}/)
  assert.match(catalog, /type === 'songs' && !songAccess\?\.manager/)
  assert.match(catalog, /visibility: \{ equals: 'scheduled-public' \}/)
  assert.match(catalog, /publishAt: \{ less_than_equal: now \}/)
  assert.match(content, /!access\.authenticated/)
  assert.match(content, /isSongVisibleToMember/)
  assert.match(content, /'Cache-Control': 'private, no-store'/)
  assert.match(content, /Vary: 'Authorization'/)
  assert.match(access, /readSongsByVisibility/)
  assert.match(access, /publishAt: \{ less_than_equal: now \}/)
})

test('stable sync identity cannot be changed through ordinary Payload updates', async () => {
  const [songs, hook] = await Promise.all([
    source('collections/Songs.ts'),
    source('lib/syncShowSongHooks.ts'),
  ])
  assert.match(songs, /name: 'syncId'[\s\S]*access: \{ update: \(\) => false \}/)
  assert.match(hook, /operation === 'update' && existing\.syncId/)
  assert.match(hook, /next\.syncId = existing\.syncId/)
})
