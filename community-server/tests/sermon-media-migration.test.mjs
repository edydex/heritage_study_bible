import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function source(relative) {
  return readFileSync(new URL(relative, import.meta.url), 'utf8')
}

const migration = source(
  '../src/migrations/20260730_230000_sermon_media_staging.ts',
)
const migrationIndex = source('../src/migrations/index.ts')
const payloadConfig = source('../src/payload.config.ts')
const endpoint = source('../src/endpoints/sermonMedia.ts')
const store = source('../src/lib/syncshow/SermonMediaStore.ts')
const storage = source('../src/lib/syncshow/SermonMediaStorage.ts')
const protocol = source('../src/lib/syncShowProtocol.ts')
const mediaProtocol = source('../src/lib/syncshow/SermonMedia.ts')
const packageSource = source('../package.json')
const maintenance = source('../scripts/sermon-media-maintenance.mjs')
const runtimeMaintenance = source(
  '../src/lib/syncshow/SermonMediaMaintenance.ts',
)

test('additive migration creates strict private upload/chunk/object state', () => {
  assert.match(
    migration,
    /CREATE TYPE "public"\."enum_syncshow_sermon_media_upload_state"[\s\S]*'uploading'[\s\S]*'finalizing'[\s\S]*'internal'[\s\S]*'complete'[\s\S]*'cancelled'[\s\S]*'superseded'[\s\S]*'expired'/,
  )
  assert.match(migration, /CREATE TABLE "syncshow_sermon_media_uploads"/)
  assert.match(migration, /CREATE TABLE "syncshow_sermon_media_chunks"/)
  assert.match(migration, /CREATE TABLE "syncshow_sermon_media_objects"/)
  assert.match(migration, /"size_bytes" BETWEEN 1 AND 1073741824/)
  assert.match(migration, /"chunk_size_bytes" = 8388608/)
  assert.match(
    migration,
    /"media_type" IN \('audio\/mpeg', 'audio\/mp4'\)/,
  )
  assert.match(
    migration,
    /"storage_key"[\s\S]*\^objects\/\[a-f0-9\]\{64\}\/sha256\/\[a-f0-9\]\{2\}\/\[a-f0-9\]\{64\}\$/,
  )
  assert.match(
    migration,
    /FOREIGN KEY \("community_id"\)[\s\S]*ON DELETE restrict/,
  )
  assert.match(
    migration,
    /FOREIGN KEY \("connection_id"\)[\s\S]*ON DELETE restrict/,
  )
  assert.match(
    migration,
    /FOREIGN KEY \("sermon_id"\)[\s\S]*ON DELETE restrict/,
  )
  assert.match(
    migration,
    /FOREIGN KEY \("object_id", "community_id"\)[\s\S]*"id",[\s\S]*"community_id"[\s\S]*ON DELETE restrict/,
  )
  assert.match(
    migration,
    /syncshow_sermon_media_objects_id_community_unique[\s\S]*UNIQUE\("id", "community_id"\)/,
  )
  assert.match(
    migration,
    /syncshow_sermon_media_objects_community_sha256_unique[\s\S]*UNIQUE\("community_id", "sha256"\)/,
  )
  assert.match(migration, /"staging_cleaned_at"/)
  assert.match(
    migration,
    /syncshow_sermon_media_uploads_active_slot_idx[\s\S]*WHERE "state" IN \('uploading', 'finalizing', 'complete'\)/,
  )
  assert.match(
    migration,
    /syncshow_sermon_media_chunks_upload_index_unique/,
  )
  assert.match(
    migration,
    /syncshow_sermon_media_chunks_idempotency_unique/,
  )
  assert.match(
    migration,
    /"state" = 'superseded'[\s\S]*"object_id" IS NOT NULL[\s\S]*"completed_at" IS NOT NULL/,
  )
  assert.doesNotMatch(migration, /ON DELETE cascade/i)
  assert.doesNotMatch(migration, /public_url|canonical_url|published_at/i)
})

test('migration is ordered after the existing July 30 sharing migration', () => {
  const sharing = migrationIndex.indexOf(
    "name: '20260730_120000_song_member_sharing'",
  )
  const media = migrationIndex.indexOf(
    "name: '20260730_230000_sermon_media_staging'",
  )
  assert.ok(sharing >= 0 && media > sharing)
  assert.match(
    migrationIndex,
    /migration_20260730_230000_sermon_media_staging\.up/,
  )
  assert.match(
    migrationIndex,
    /migration_20260730_230000_sermon_media_staging\.down/,
  )
})

test('scope dependencies remain additive for existing grants', () => {
  assert.match(
    protocol,
    /SYNCSHOW_SERMON_MEDIA_READ_SCOPE[\s\S]*syncshow:sermon-media:read/,
  )
  assert.match(
    protocol,
    /SYNCSHOW_SERMON_MEDIA_WRITE_SCOPE[\s\S]*syncshow:sermon-media:write/,
  )
  assert.match(
    endpoint,
    /authorize\(req, 'read'\)/,
  )
  assert.match(
    endpoint,
    /authorize\(req, 'write'\)/,
  )
  assert.match(
    store,
    /'syncshow:sermons:read',[\s\S]*SERMON_MEDIA_READ_SCOPE/,
  )
  assert.match(
    store,
    /SERMON_MEDIA_READ_SCOPE,[\s\S]*SERMON_MEDIA_WRITE_SCOPE/,
  )
})

test('every operation rechecks live authority and sermon binding', () => {
  assert.match(
    store,
    /async function validateLiveUpload[\s\S]*recheckAuthority[\s\S]*lockedSermon[\s\S]*assertSermonMediaBinding/,
  )
  for (const operation of [
    'getSermonMediaUpload',
    'putSermonMediaChunk',
    'claimSermonMediaFinalization',
    'finishSermonMediaFinalization',
    'cancelSermonMediaUpload',
  ]) {
    const start = store.indexOf(`function ${operation}`)
    const next = store.indexOf('\nexport ', start + 1)
    const block = store.slice(start, next > start ? next : undefined)
    assert.ok(start >= 0, `missing ${operation}`)
    assert.match(block, /validateLiveUpload/)
  }
  assert.match(
    store,
    /WHERE "upload_id" = \$\{uploadId\}[\s\S]*AND "community_id" = \$\{authority\.communityId\}/,
  )
})

test('init replay recovery and replacement preserve safe lock ordering', () => {
  assert.match(store, /heritage-sermon-media-active-slot-v1/)
  assert.match(store, /pg_advisory_xact_lock/)
  assert.match(
    store,
    /"state" = 'superseded'[\s\S]*"state" IN \('uploading', 'finalizing', 'complete'\)/,
  )
  const init = store.slice(
    store.indexOf('export async function initializeSermonMediaUpload'),
    store.indexOf('export async function getSermonMediaUpload'),
  )
  assert.ok(
    init.indexOf('await recheckAuthority')
      < init.indexOf('await lockSermonMediaAdmission'),
  )
  assert.ok(
    init.indexOf('await lockSermonMediaAdmission')
      < init.indexOf('const replayCandidate'),
  )
  assert.ok(
    init.indexOf('const replayCandidate')
      < init.indexOf('sermon = await lockedSermon'),
  )
  assert.ok(
    init.indexOf('sermon = await lockedSermon')
      < init.indexOf('const replay ='),
  )
  assert.ok(
    init.indexOf('const replay =')
      < init.indexOf('assertSermonMediaBinding('),
  )
  assert.match(
    init,
    /const liveError = await validateLiveUpload[\s\S]*cleanupUploadIds = \[String\(upload\.uploadId\)\][\s\S]*return \{ error: liveError \}/,
  )
  assert.ok(
    init.indexOf('if (sameBinding)')
      < init.indexOf('const leasedFinalization'),
  )
  assert.match(
    init,
    /if \(sameBinding\)[\s\S]*sameBinding\.state === 'complete'[\s\S]*upload: await uploadView\(database, sameBinding\),[\s\S]*created: false[\s\S]*UPLOAD_ALREADY_EXISTS/,
  )
  assert.match(
    init,
    /WHERE "community_id" = \$\{authority\.communityId\}[\s\S]*AND "sermon_id" = \$\{Number\(sermon\.id\)\}[\s\S]*AND "recording_id" = \$\{request\.recording\.id\}/,
  )
  assert.match(
    init,
    /FINALIZATION_IN_PROGRESS[\s\S]*Retry replacement shortly/,
  )
})

test('completion is leased, crash-recoverable, private, and cleaned', () => {
  assert.match(store, /FINALIZATION_LEASE_SECONDS/)
  assert.match(store, /finalizationLeaseExpiresAt/)
  assert.match(store, /assembleSermonMediaObject/)
  assert.match(store, /verifySermonMediaObject/)
  assert.match(store, /cleanupTerminalStaging/)
  assert.match(
    store,
    /inProgress: true,[\s\S]*upload: await uploadView\(database, upload\)/,
  )
  assert.match(
    store,
    /enqueueSermonMediaFinalization[\s\S]*setImmediate\([\s\S]*drainSermonMediaFinalizationQueue/,
  )
  assert.match(
    endpoint,
    /status: completion\.accepted \? 202 : 200/,
  )
  assert.match(storage, /constants\.O_EXCL/)
  assert.match(storage, /constants\.O_NOFOLLOW/)
  assert.match(storage, /temporary\.handle\.sync\(\)/)
  assert.match(storage, /await rename\(temporary\.path, destination\)/)
  const rootProvisioning = storage.slice(
    storage.indexOf('async function ensureRoot'),
    storage.indexOf('async function ensurePrivateDirectory'),
  )
  assert.match(
    rootProvisioning,
    /let created = false[\s\S]*await mkdir\(root,[\s\S]*created = true[\s\S]*if \(created\) await fsyncDirectory\(path\.dirname\(root\)\)/,
  )
  const directoryProvisioning = storage.slice(
    storage.indexOf('async function ensurePrivateDirectory'),
    storage.indexOf('async function fsyncDirectory'),
  )
  assert.match(
    directoryProvisioning,
    /const parent = current[\s\S]*await mkdir\(current,[\s\S]*created = true[\s\S]*if \(created\) await fsyncDirectory\(parent\)/,
  )
  assert.match(storage, /validateMediaContainer/)
  assert.match(storage, /MAX_ISO_BOXES = 16_384/)
  assert.match(storage, /cleanupSermonMediaStaging/)
  assert.match(
    store,
    /putSermonMediaChunk[\s\S]*const stored = await store\(headers\)[\s\S]*INSERT INTO "syncshow_sermon_media_chunks"/,
  )
  assert.doesNotMatch(endpoint, /storageKey/)
  assert.doesNotMatch(endpoint, /objectId/)
  assert.doesNotMatch(endpoint, /url:/)
  assert.match(
    store,
    /INSERT INTO "syncshow_sermon_media_objects" \([\s\S]*"community_id"[\s\S]*ON CONFLICT \("community_id", "sha256"\)/,
  )
  assert.match(
    store,
    /sermonMediaCommunityNamespace\(communityId[\s\S]*createHash\('sha256'\)/,
  )
})

test('bounded runtime and quiesced maintenance are fail-closed', () => {
  assert.match(
    store,
    /sweepSermonMediaUploads[\s\S]*FOR UPDATE SKIP LOCKED/,
  )
  assert.match(
    store,
    /"state" = 'finalizing'[\s\S]*"finalization_lease_expires_at" <= now\(\)/,
  )
  assert.match(
    store,
    /"staging_cleaned_at" IS NULL[\s\S]*cleanupSermonMediaStaging[\s\S]*"staging_cleaned_at" = now\(\)/,
  )
  assert.match(
    store,
    /const expiredUploads = await inPayloadTransaction[\s\S]*RETURNING "upload"\."upload_id" AS "uploadId"[\s\S]*return expired\.length[\s\S]*return await inPayloadTransaction[\s\S]*cleanupSermonMediaStaging/,
  )
  assert.match(runtimeMaintenance, /sermonMediaStorageRootIsReady/)
  assert.match(runtimeMaintenance, /SWEEP_INTERVAL_MS = 15 \* 60 \* 1000/)
  assert.match(
    runtimeMaintenance,
    /FINALIZATION_RECOVERY_INTERVAL_MS = 30 \* 1000/,
  )
  assert.match(runtimeMaintenance, /recoverSermonMediaFinalization/)
  assert.match(
    store,
    /recoverSermonMediaFinalization[\s\S]*const finalizationEnabled = sermonMediaEnabled\(\)[\s\S]*"finalization_lease_expires_at" <= now\(\)[\s\S]*FROM "syncshow_connections"[\s\S]*FROM "memberships"[\s\S]*lockedSermon[\s\S]*lockedUpload[\s\S]*if \(!authorityValid\)[\s\S]*transitionUpload\(database, Number\(upload\.id\), 'expired'\)[\s\S]*if \(!finalizationEnabled\)[\s\S]*enqueueSermonMediaFinalization/,
  )
  assert.match(
    maintenance,
    /HERITAGE_SERMON_MEDIA_MAINTENANCE_QUIESCED === 'true'/,
  )
  assert.match(maintenance, /verifiedDigest/)
  assert.match(
    maintenance,
    /retainedByKey\.has\(file\.key\)[\s\S]*graceBefore[\s\S]*verifiedDigest/,
  )
  assert.match(
    maintenance,
    /MAINTENANCE_REQUIRE_BACKUP_READY[\s\S]*LOCK TABLE[\s\S]*syncshow_sermon_media_uploads[\s\S]*syncshow_sermon_media_chunks[\s\S]*syncshow_sermon_media_objects[\s\S]*ACCESS EXCLUSIVE MODE/,
  )
  assert.match(
    maintenance,
    /requireBackupReady[\s\S]*report\.active\.uploads !== 0[\s\S]*Backup-ready maintenance found nonexpired active recording work/,
  )
  assert.match(
    maintenance,
    /if \(!requireBackupReady && metadata\.mtimeMs > graceBefore\) continue/,
  )
  assert.ok(
    maintenance.indexOf('for (const [key, object] of retainedByKey)')
      < maintenance.indexOf('for (const row of terminal.rows)'),
  )
  assert.match(
    packageSource,
    /maintenance:sermon-media[\s\S]*sermon-media-maintenance\.mjs/,
  )
})

test('JSON and chunk bodies are bounded before untrusted streams can grow', () => {
  assert.match(endpoint, /const MAX_JSON_BYTES = 32 \* 1024/)
  assert.match(endpoint, /req\.body\.getReader\(\)/)
  assert.match(endpoint, /sizeBytes > MAX_JSON_BYTES[\s\S]*reader\.cancel/)
  assert.doesNotMatch(endpoint, /await req\.text\(\)/)
  assert.match(storage, /CHUNK_STREAM_INACTIVITY_MS = 45_000/)
  assert.match(storage, /CHUNK_STREAM_TOTAL_MS = 15 \* 60 \* 1000/)
  assert.match(storage, /lastProgressAt = Date\.now\(\)/)
  assert.match(storage, /reader\.cancel\('sermon-media chunk stream deadline'\)/)
  assert.match(store, /MAX_CONCURRENT_CHUNK_REQUESTS_GLOBAL = 4/)
  assert.match(
    store,
    /MAX_CONCURRENT_CHUNK_REQUESTS_PER_CONNECTION = 1/,
  )
  assert.match(
    store,
    /acquireSermonMediaChunkRequestSlot[\s\S]*CHUNK_REQUEST_CAPACITY/,
  )
  assert.match(store, /SET LOCAL lock_timeout = '5s'/)
  assert.match(store, /CHUNK_LOCK_CAPACITY/)
  assert.match(
    store,
    /WITH "received" AS[\s\S]*SUM\("size_bytes"\)[\s\S]*"remainingBytes"/,
  )
  assert.doesNotMatch(
    store.slice(
      store.indexOf('async function enforceSermonMediaStorageReserve'),
      store.indexOf('async function enforceFinalizationAdmission'),
    ),
    /SUM\("size_bytes"\)[\s\S]*AS "reservedBytes"/,
  )
  const putRoute = endpoint.slice(
    endpoint.indexOf('const putChunk: Endpoint'),
    endpoint.indexOf('const complete: Endpoint'),
  )
  assert.doesNotMatch(putRoute, /dependencies\.get\(/)
  assert.match(putRoute, /dependencies\.putChunk\(/)
  assert.doesNotMatch(store, /prepareSermonMediaChunk/)
  assert.doesNotMatch(store, /recordSermonMediaChunk/)
  const putStore = store.slice(
    store.indexOf('export async function putSermonMediaChunk'),
    store.indexOf('function completeRequestHash'),
  )
  assert.ok(
    putStore.indexOf('acquireSermonMediaChunkRequestSlot')
      < putStore.indexOf('inTransaction'),
  )
  assert.ok(
    putStore.indexOf('lockedAuthorizedUpload')
      < putStore.indexOf('normalizeSermonMediaChunkHeaders'),
  )
})

test('Payload registers only private API endpoints and the full suite', () => {
  assert.match(
    payloadConfig,
    /import \{ sermonMediaEndpoints \} from '@\/endpoints\/sermonMedia'/,
  )
  assert.match(payloadConfig, /\.\.\.sermonMediaEndpoints,/)
  assert.match(
    mediaProtocol,
    /HERITAGE_SYNCSHOW_SERMON_MEDIA_ENABLED === 'true'/,
  )
  assert.match(
    endpoint,
    /sermonMediaEnabled\(\)[\s\S]*\? createSermonMediaEndpoints\(\)[\s\S]*: \[\]/,
  )
  assert.match(endpoint, /dependencies\.enabled\(\)/)
  assert.match(
    packageSource,
    /tests\/sermon-media-contract\.test\.ts/,
  )
  assert.match(
    packageSource,
    /tests\/sermon-media-endpoint\.test\.ts/,
  )
  assert.match(
    packageSource,
    /tests\/sermon-media-storage\.test\.ts/,
  )
  assert.match(
    packageSource,
    /tests\/sermon-media-migration\.test\.mjs/,
  )
  assert.doesNotMatch(payloadConfig, /SyncShowSermonMediaObject/)
})
