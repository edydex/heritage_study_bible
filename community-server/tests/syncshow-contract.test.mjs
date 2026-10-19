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
    "endpoint: 'sermons'",
    "endpoint: 'sermon-publications'",
    "'syncshow:sermons:read'",
    "'syncshow:sermons:write'",
    "'syncshow:sermon-publications:read'",
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

test('sermon change cursors use one private commit-ordered snapshot window', async () => {
  const [endpoint, publicationEndpoint, canonicalStore, journal, config] = await Promise.all([
    source('endpoints/syncShow.ts'),
    source('endpoints/sermonPublications.ts'),
    source('lib/syncshow/CanonicalSermonStore.ts'),
    source('collections/SyncShowSermonChanges.ts'),
    source('payload.config.ts'),
  ])
  const listStart = endpoint.indexOf('const sermonsListGet')
  const createStart = endpoint.indexOf('const sermonsCreate')
  const listBlock = endpoint.slice(listStart, createStart)
  assert.match(listBlock, /sermonJournalHighWater/)
  assert.match(listBlock, /latestSermonChangesInSnapshot/)
  assert.match(listBlock, /cursor\.checkpoint/)
  assert.match(listBlock, /cursor\.through/)
  assert.match(listBlock, /encodeSermonSnapshotCursor/)
  assert.match(listBlock, /encodeSermonCheckpoint/)
  assert.match(endpoint, /createHmac\('sha256', sermonCursorSecret\(req\)\)/)
  assert.match(endpoint, /SERMON_CURSOR_HMAC_DOMAIN/)
  assert.match(endpoint, /timingSafeEqual\(actualSignature, expectedSignature\)/)
  assert.match(endpoint, /parsed\.communityId !== communityId/)
  assert.match(endpoint, /parsed\.lane !== SERMON_CURSOR_LANE/)
  assert.match(endpoint, /SELECT DISTINCT ON \("sync_id"\)/)
  assert.match(endpoint, /"id" > \$\{checkpoint\}/)
  assert.match(endpoint, /"id" <= \$\{through\}/)
  assert.match(endpoint, /ORDER BY "sync_id" ASC, "id" DESC/)
  assert.match(endpoint, /The sermon sync cursor is beyond this Community journal/)
  assert.match(endpoint, /changedAt: new Date\(timestamp\)\.toISOString\(\)/)
  assert.match(canonicalStore, /pg_advisory_xact_lock\(hashtext\('syncshow-sermon-change-sequence'\)\)/)
  assert.match(endpoint, /recordSermonChange/)
  assert.match(journal, /Append-only private change journal/)
  assert.match(journal, /fields: \['sermon', 'syncVersion'\], unique: true/)
  assert.match(journal, /update: \(\) => false/)
  assert.match(journal, /delete: \(\) => false/)
  assert.match(journal, /beforeDelete: \[rejectSermonChangeDeletion\]/)
  assert.match(journal, /name: 'documentSource'[\s\S]*type: 'textarea'[\s\S]*required: true[\s\S]*hidden: true/)
  assert.match(journal, /protectSermonChangeAuthority/)
  assert.match(journal, /syncShowSermonChangeMutation/)
  assert.match(journal, /serializeSermonDocument\(document\) !== documentSource/)
  assert.match(journal, /createHash\('sha256'\)\.update\(documentSource, 'utf8'\)/)
  assert.match(endpoint, /documentSource: String\(sermon\.syncCurrentDocumentSource\)/)
  assert.match(publicationEndpoint, /documentSource: String\(sermon\.syncCurrentDocumentSource\)/)
  assert.match(canonicalStore, /context: \{ syncShowSermonChangeMutation: true \}/)
  assert.match(publicationEndpoint, /context: \{ syncShowSermonChangeMutation: true \}/)
  assert.match(config, /SyncShowSermonChanges/)
})

test('device and manager sermon creates share one atomic canonical store', async () => {
  const [endpoint, store] = await Promise.all([
    source('endpoints/syncShow.ts'),
    source('lib/syncshow/CanonicalSermonStore.ts'),
  ])
  assert.match(endpoint, /createCanonicalSermon\(/)
  assert.match(endpoint, /findCanonicalSermon\(/)
  assert.doesNotMatch(endpoint, /createSermonWithIdempotency/)
  assert.match(store, /export async function findCanonicalSermon/)
  assert.match(store, /export async function createCanonicalSermon/)
  assert.match(store, /syncshow-sermon-create:\$\{communityId\}:\$\{idempotencyKey\}/)
  assert.match(store, /syncshow-sermon-id:\$\{communityId\}:\$\{write\.syncId\}/)
  assert.match(store, /\]\.sort\(\)/)
  assert.match(store, /IDEMPOTENCY_KEY_REUSED/)
  assert.match(store, /SYNC_ID_EXISTS/)
  assert.match(store, /syncCreateIdempotencyHash: hash/)
  assert.match(store, /await appendCanonicalSermonChange/)
  assert.match(store, /await adapter\.commitTransaction\(transactionId\)/)

  const transactionStart = store.indexOf('req.transactionID = transactionId')
  const authorization = store.indexOf('await options.authorize?.(transactionDb)')
  const replayLookup = store.indexOf('const byKey = await findByIdempotencyKey')
  assert.ok(transactionStart >= 0 && transactionStart < authorization)
  assert.ok(authorization < replayLookup)
})

test('sermon CAS allows only current or one-step exact retry and archives immutably', async () => {
  const endpoint = await source('endpoints/syncShow.ts')
  const updateStart = endpoint.indexOf('async function updateSermonWithCas')
  const deviceStart = endpoint.indexOf('const deviceStart')
  const updateBlock = endpoint.slice(updateStart, deviceStart)
  assert.match(updateBlock, /FOR UPDATE/)
  assert.match(updateBlock, /currentVersion === expectedVersion \|\| currentVersion === expectedVersion \+ 1/)
  assert.match(updateBlock, /current\.syncArchived === true/)
  assert.match(updateBlock, /SERMON_ARCHIVED/)
  assert.match(updateBlock, /recordSermonChange/)
  assert.match(endpoint, /const sermonDelete: Endpoint/)
  assert.match(endpoint, /status: 'archived'/)
  assert.match(endpoint, /visibility: 'private'/)
  assert.match(endpoint, /publishedAt: null/)
  assert.match(endpoint, /canonicalUrl: null/)
  assert.match(endpoint, /INVALID_ARCHIVE_TOMBSTONE/)
})

test('canonical sermon source and create replay identity stay private and protected', async () => {
  const sermons = await source('collections/Sermons.ts')
  for (const field of [
    'syncVersion',
    'syncCurrentDocumentSource',
    'syncCurrentRevision',
    'syncPublicationStatus',
    'syncVisibility',
    'syncSourceObjects',
    'syncChangedAt',
    'syncCreateIdempotencyKey',
    'syncCreateIdempotencyHash',
  ]) {
    const start = sermons.indexOf(`name: '${field}'`)
    assert.notEqual(start, -1)
    const end = sermons.indexOf('\n    {', start + 1)
    const block = sermons.slice(start, end === -1 ? undefined : end)
    assert.match(block, /hidden: true/)
    assert.match(block, /access: protectedSyncFieldAccess/)
  }
  for (const field of ['syncId', 'syncArchived']) {
    const start = sermons.indexOf(`name: '${field}'`)
    assert.notEqual(start, -1)
    const end = sermons.indexOf('\n    {', start + 1)
    const block = sermons.slice(start, end === -1 ? undefined : end)
    assert.match(block, /admin: \{ hidden: true \}/)
    assert.match(block, /access: planningQueryableSyncFieldAccess/)
  }
  assert.match(sermons, /const schemaQueryableSelectionField: FieldAccess = \(\) => true/)
  assert.match(sermons, /read: schemaQueryableSelectionField/)
  assert.match(sermons, /context\.syncShowSermonMutation !== true/)
  assert.match(sermons, /next\[field\] = originalDoc\[field\]/)
  assert.match(sermons, /next\.status = 'draft'/)
  assert.match(sermons, /read: readSermonsByPublicationOrManager/)
  assert.match(sermons, /syncId: \{ exists: false \}/)
  assert.match(sermons, /\['owner', 'admin', 'leader'\]/)
  assert.match(sermons, /update: manageLegacySermonsOnly/)
  assert.match(sermons, /delete: manageLegacySermonsOnly/)
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
  const [catalog, content, access, publicConfig] = await Promise.all([
    source('app/catalogs/[type]/route.ts'),
    source('app/content/[type]/[id]/route.ts'),
    source('access.ts'),
    source('lib/publicConfig.ts'),
  ])
  assert.match(catalog, /communityRequestAccess/)
  assert.match(catalog, /!songAccess\?\.authenticated/)
  assert.match(catalog, /songAccess\?\.manager/)
  assert.match(catalog, /status: \{ not_equals: 'archived' \}/)
  assert.match(catalog, /type === 'songs' && !songAccess\?\.manager/)
  assert.match(catalog, /visibility: \{ equals: 'scheduled-public' \}/)
  assert.match(catalog, /publishAt: \{ less_than_equal: now \}/)
  assert.match(catalog, /const catalogJson = type === 'songs' \? privateAuthorizationJson : publicJson/)
  assert.match(content, /!access\.authenticated/)
  assert.match(content, /isSongVisibleToMember/)
  assert.match(content, /const contentJson = type === 'songs' \? privateAuthorizationJson : publicJson/)
  assert.doesNotMatch(content, /return publicJson\(\{ error: 'Not found\.'/)
  assert.match(publicConfig, /headers\.set\('Cache-Control', 'private, no-store'\)/)
  assert.match(publicConfig, /vary\.push\('Authorization'\)/)
  assert.match(access, /readSongsByVisibility/)
  assert.match(access, /publishAt: \{ less_than_equal: now \}/)
})

test('strict public sermons advertise only the authoritative materialized lane', async () => {
  const [
    manifest,
    catalog,
    content,
    strictRoute,
    passageIndexRoute,
    publication,
    store,
  ] = await Promise.all([
    source('app/heritage-content.json/route.ts'),
    source('app/catalogs/[type]/route.ts'),
    source('app/content/[type]/[id]/route.ts'),
    source('app/publications/sermons/catalog.json/route.ts'),
    source('app/indexes/sermon-passages/route.ts'),
    source('lib/syncshow/PublicSermonPublication.ts'),
    source('lib/syncshow/SermonPublicationStore.ts'),
  ])
  assert.match(manifest, /sermons: '\/catalogs\/sermons'/)
  assert.match(manifest, /publications:\s*\{\s*sermons: PUBLIC_SERMON_DISCOVERY_DESCRIPTOR/s)
  assert.match(catalog, /sermons: 'sermons'/)
  assert.match(content, /sermons: 'sermons'/)
  assert.match(content, /\^sermon-\[a-f0-9\]\{64\}\$/)
  assert.match(content, /loadActivePublicSermonPublication/)
  assert.match(strictRoute, /loadStoredPublicSermonCatalog/)
  assert.doesNotMatch(strictRoute, /loadActivePublicSermonPublications/)
  assert.doesNotMatch(strictRoute, /publishedDocumentSource|detailSource/)
  assert.match(publication, /heritage-public-sermon-publication/)
  assert.match(publication, /\/publications\/sermons\/catalog\.json/)
  assert.match(publication, /\/indexes\/sermon-passages/)
  assert.match(publication, /heritage-public-sermon-passage-index/)
  assert.match(publication, /application\/vnd\.heritage\.sermon\+json/)
  assert.match(publication, /document\.publication\.visibility !== 'public'/)
  assert.match(publication, /raw\.active !== true/)
  assert.match(publication, /raw\.visibility !== 'public'/)
  assert.match(passageIndexRoute, /loadStoredPublicSermonCatalog/)
  assert.match(passageIndexRoute, /catalog\.passageIndexSource/)
  assert.match(passageIndexRoute, /catalog\.passageIndexChecksum/)
  assert.doesNotMatch(passageIndexRoute, /publishedDocumentSource|detailSource/)
  assert.match(store, /syncshow_sermon_publication_catalogs/)
  assert.match(store, /parsePublicSermonCatalogSource/)
  assert.match(store, /buildPublicSermonPassageIndex/)
  assert.match(store, /passage_index_checksum/)
  assert.match(store, /passage_index_source/)
  assert.match(store, /SELECT "id"[\s\S]*FOR UPDATE/)
  assert.match(store, /SELECT p\."catalog_item_source"/)
})

test('service tokens read exact publication projection state without manuscript bytes', async () => {
  const [manifest, endpoint, protocol, state] = await Promise.all([
    source('app/.well-known/heritage-community.json/route.ts'),
    source('endpoints/syncShow.ts'),
    source('lib/syncShowProtocol.ts'),
    source('lib/syncshow/CommunitySermonPublicationState.ts'),
  ])
  assert.match(manifest, /sermonPublications:\s*\{[\s\S]*endpoint: 'sermon-publications'/)
  assert.match(manifest, /scopes: \['syncshow:sermon-publications:read'\]/)
  assert.match(protocol, /SYNCSHOW_SERMON_PUBLICATION_READ_SCOPE/)
  assert.match(
    endpoint,
    /scopes\.includes\(SYNCSHOW_SERMON_PUBLICATION_READ_SCOPE\)[\s\S]*!scopes\.includes\(SYNCSHOW_SERMON_READ_SCOPE\)/,
  )
  assert.match(
    endpoint,
    /scope === SYNCSHOW_SERMON_PUBLICATION_READ_SCOPE[\s\S]*SYNCSHOW_SERMON_READ_SCOPE,\s*SYNCSHOW_SERMON_PUBLICATION_READ_SCOPE/,
  )
  assert.match(endpoint, /path: '\/community\/syncshow\/v1\/sermon-publications\/:syncId'/)
  assert.match(endpoint, /buildCommunitySermonPublicationState/)
  assert.match(state, /publicationVersion: number \| null/)
  assert.match(state, /catalogChecksum: string \| null/)
  assert.match(state, /passageIndexChecksum: string \| null/)
  assert.doesNotMatch(state, /documentSource|detailSource|catalogItemSource/)
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
