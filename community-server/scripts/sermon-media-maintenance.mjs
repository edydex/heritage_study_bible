import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import {
  lstat,
  open,
  readFile,
  readdir,
  rmdir,
  stat,
  unlink,
} from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import {
  cleanupSermonMediaStaging,
  sermonMediaStorageRoot,
} from '../src/lib/syncshow/SermonMediaStorage.ts'

const { Client } = pg
const connectionString = process.env.DATABASE_URL
const quiesced =
  process.env.HERITAGE_SERMON_MEDIA_MAINTENANCE_QUIESCED === 'true'
const requireBackupReadyRaw =
  process.env.HERITAGE_SERMON_MEDIA_MAINTENANCE_REQUIRE_BACKUP_READY
    || 'false'
const requireBackupReady = requireBackupReadyRaw === 'true'
const graceSeconds = (() => {
  const raw =
    process.env.HERITAGE_SERMON_MEDIA_ORPHAN_GRACE_SECONDS || '86400'
  if (!/^(0|[1-9]\d*)$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value)
    && value >= 3_600
    && value <= 30 * 24 * 60 * 60
    ? value
    : null
})()

if (!connectionString) {
  console.error('DATABASE_URL is required; its value is never printed.')
  process.exit(2)
}
if (!quiesced) {
  console.error(
    'Refusing maintenance unless HERITAGE_SERMON_MEDIA_MAINTENANCE_QUIESCED=true after the application is stopped.',
  )
  process.exit(2)
}
if (!['true', 'false'].includes(requireBackupReadyRaw)) {
  console.error(
    'HERITAGE_SERMON_MEDIA_MAINTENANCE_REQUIRE_BACKUP_READY must be true or false.',
  )
  process.exit(2)
}
if (graceSeconds === null) {
  console.error(
    'HERITAGE_SERMON_MEDIA_ORPHAN_GRACE_SECONDS must be 3600..2592000.',
  )
  process.exit(2)
}

const UPLOAD_ID_PATTERN = /^[A-Za-z0-9_-]{32,128}$/
const NAMESPACE_PATTERN = /^[a-f0-9]{64}$/
const PREFIX_PATTERN = /^[a-f0-9]{2}$/
const DIGEST_PATTERN = /^[a-f0-9]{64}$/
const OBJECT_KEY_PATTERN =
  /^objects\/[a-f0-9]{64}\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}$/

function confined(root, relative) {
  const value = path.resolve(root, ...relative.split('/'))
  if (!value.startsWith(`${root}${path.sep}`)) {
    throw new Error('A sermon-media maintenance path escaped its root.')
  }
  return value
}

async function directoryEntries(value, pattern, label) {
  let metadata
  try {
    metadata = await lstat(value)
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw new Error(`${label} is not a real directory.`)
  }
  const entries = await readdir(value, { withFileTypes: true })
  for (const entry of entries) {
    if (
      !pattern.test(entry.name)
      || entry.isSymbolicLink()
      || !entry.isDirectory()
    ) {
      throw new Error(`${label} contains an unsupported entry.`)
    }
  }
  return entries.map(entry => entry.name).sort()
}

async function objectFiles(root) {
  const result = []
  const objectsRoot = confined(root, 'objects')
  for (const namespace of await directoryEntries(
    objectsRoot,
    NAMESPACE_PATTERN,
    'The private object root',
  )) {
    const namespaceRoot = path.join(objectsRoot, namespace)
    const namespaceEntries = await readdir(namespaceRoot, {
      withFileTypes: true,
    })
    if (
      namespaceEntries.length !== 1
      || namespaceEntries[0].name !== 'sha256'
      || namespaceEntries[0].isSymbolicLink()
      || !namespaceEntries[0].isDirectory()
    ) {
      throw new Error('A private Community object namespace is malformed.')
    }
    const shaRoot = path.join(namespaceRoot, 'sha256')
    for (const prefix of await directoryEntries(
      shaRoot,
      PREFIX_PATTERN,
      'A private object digest directory',
    )) {
      const prefixRoot = path.join(shaRoot, prefix)
      const entries = await readdir(prefixRoot, { withFileTypes: true })
      for (const entry of entries) {
        if (
          !DIGEST_PATTERN.test(entry.name)
          || entry.name.slice(0, 2) !== prefix
          || entry.isSymbolicLink()
          || !entry.isFile()
        ) {
          throw new Error('A private object digest directory is malformed.')
        }
        result.push({
          digest: entry.name,
          key: `objects/${namespace}/sha256/${prefix}/${entry.name}`,
          path: path.join(prefixRoot, entry.name),
        })
      }
    }
  }
  return result.sort((left, right) => left.key.localeCompare(right.key))
}

async function verifiedDigest(value, expectedSize, expectedDigest) {
  const handle = await open(
    value,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  )
  try {
    const metadata = await handle.stat()
    if (!metadata.isFile() || metadata.size !== expectedSize) return false
    const hash = createHash('sha256')
    const buffer = Buffer.allocUnsafe(1024 * 1024)
    let position = 0
    while (true) {
      const read = await handle.read(buffer, 0, buffer.length, position)
      if (!read.bytesRead) break
      position += read.bytesRead
      hash.update(buffer.subarray(0, read.bytesRead))
    }
    return hash.digest('hex') === expectedDigest
  } finally {
    await handle.close()
  }
}

async function removeEmptyObjectParents(root, value) {
  const objectsRoot = confined(root, 'objects')
  let current = path.dirname(value)
  while (current.startsWith(`${objectsRoot}${path.sep}`)) {
    try {
      await rmdir(current)
    } catch (error) {
      if (error?.code === 'ENOTEMPTY' || error?.code === 'ENOENT') return
      throw error
    }
    current = path.dirname(current)
  }
}

async function stagingDirectories(root) {
  return await directoryEntries(
    confined(root, 'staging'),
    UPLOAD_ID_PATTERN,
    'The private staging root',
  )
}

const client = new Client({ connectionString })
const root = sermonMediaStorageRoot()
const graceBefore = Date.now() - graceSeconds * 1000
const report = {
  schemaVersion: 1,
  mode: 'quiesced',
  graceSeconds,
  expiredUploads: 0,
  cleanedTerminalStaging: 0,
  cleanedOrphanStaging: 0,
  removedOrphanObjects: 0,
  active: {
    uploads: 0,
    finalizing: 0,
    reservedBytes: 0,
  },
  retained: {
    objects: 0,
    bytes: 0,
  },
  stagingDirectories: 0,
}

await client.connect()
try {
  await client.query('BEGIN')
  const expired = await client.query(`
    UPDATE "syncshow_sermon_media_uploads"
    SET
      "state" = 'expired',
      "expired_at" = now(),
      "finalization_lease_token_hash" = NULL,
      "finalization_lease_expires_at" = NULL,
      "updated_at" = now()
    WHERE "expires_at" <= now()
      AND "state" IN ('uploading', 'finalizing')
    RETURNING "upload_id"
  `)
  report.expiredUploads = expired.rowCount || 0
  await client.query('COMMIT')

  await client.query('BEGIN')
  if (requireBackupReady) {
    // The supported wrapper has stopped the app and holds the appliance
    // operations lock. These database locks add a fail-closed barrier against
    // any unexpected writer before fresh unreferenced objects are removed.
    await client.query(`SET LOCAL lock_timeout = '5s'`)
    await client.query(`
      LOCK TABLE
        "syncshow_sermon_media_uploads",
        "syncshow_sermon_media_chunks",
        "syncshow_sermon_media_objects"
      IN ACCESS EXCLUSIVE MODE
    `)
  }
  const capacity = await client.query(`
    SELECT
      COUNT(*) FILTER (
        WHERE "state" IN ('uploading', 'finalizing')
      ) AS "active_uploads",
      COUNT(*) FILTER (
        WHERE "state" = 'finalizing'
      ) AS "finalizing",
      COALESCE(SUM("size_bytes") FILTER (
        WHERE "state" IN ('uploading', 'finalizing')
      ), 0) AS "reserved_bytes"
    FROM "syncshow_sermon_media_uploads"
  `)
  report.active.uploads = Number(capacity.rows[0].active_uploads)
  report.active.finalizing = Number(capacity.rows[0].finalizing)
  report.active.reservedBytes = Number(capacity.rows[0].reserved_bytes)
  if (
    requireBackupReady
    && (
      report.active.uploads !== 0
      || report.active.finalizing !== 0
      || report.active.reservedBytes !== 0
    )
  ) {
    throw new Error(
      'Backup-ready maintenance found nonexpired active recording work.',
    )
  }

  const terminal = await client.query(`
    SELECT "upload_id"
    FROM "syncshow_sermon_media_uploads"
    WHERE "state" IN (
      'internal',
      'complete',
      'cancelled',
      'superseded',
      'expired'
    )
    ORDER BY "id"
  `)
  const known = await client.query(`
    SELECT "upload_id", "state"
    FROM "syncshow_sermon_media_uploads"
  `)
  const stateByUpload = new Map(
    known.rows.map(row => [String(row.upload_id), String(row.state)]),
  )
  const retained = await client.query(`
    SELECT "storage_key", "size_bytes", "sha256"
    FROM "syncshow_sermon_media_objects"
    ORDER BY "storage_key"
  `)
  const serviceSchema = await client.query(`SELECT COUNT(*)::int AS count FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN ('service_documents', 'syncshow_service_document_changes')`)
  const serviceTableCount = Number(serviceSchema.rows[0].count)
  if (serviceTableCount !== 0 && serviceTableCount !== 2) throw new Error('The service-document media schema is incomplete.')
  if (serviceTableCount === 2) {
    if (requireBackupReady) await client.query('LOCK TABLE service_documents, syncshow_service_document_changes IN SHARE MODE')
    const serviceAssets = await client.query(await readFile(new URL('./service-document-asset-inventory.sql', import.meta.url), 'utf8'))
    retained.rows.push(...serviceAssets.rows)
  }
  const retainedByKey = new Map()
  for (const row of retained.rows) {
    const key = String(row.storage_key)
    if (!OBJECT_KEY_PATTERN.test(key)) {
      throw new Error('The database contains an invalid private object key.')
    }
    const existing = retainedByKey.get(key)
    if (existing && (existing.digest !== String(row.sha256) || existing.sizeBytes !== Number(row.size_bytes))) {
      throw new Error('Two private media references disagree about the same object.')
    }
    retainedByKey.set(key, {
      digest: String(row.sha256),
      sizeBytes: Number(row.size_bytes),
    })
  }
  const files = await objectFiles(root)
  const fileByKey = new Map(files.map(file => [file.key, file]))
  for (const [key, object] of retainedByKey) {
    const file = fileByKey.get(key)
    if (!file) {
      throw new Error('A retained private recording object is missing.')
    }
    const metadata = await lstat(file.path)
    if (
      metadata.isSymbolicLink()
      || !metadata.isFile()
      || metadata.size !== object.sizeBytes
      || file.digest !== object.digest
      || !await verifiedDigest(
        file.path,
        object.sizeBytes,
        object.digest,
      )
    ) {
      throw new Error('A retained private recording object is inconsistent.')
    }
  }

  // Only after every retained object has passed a complete byte-for-byte
  // verification may offline repair discard terminal chunks. In particular,
  // this preserves the only recovery source when a crash left a complete DB
  // row but its finalized object is missing or corrupt.
  for (const row of terminal.rows) {
    const uploadId = String(row.upload_id)
    await cleanupSermonMediaStaging(uploadId)
    await client.query(`
      UPDATE "syncshow_sermon_media_uploads"
      SET "staging_cleaned_at" = now(), "updated_at" = now()
      WHERE "upload_id" = $1
        AND "state" IN (
          'internal',
          'complete',
          'cancelled',
          'superseded',
          'expired'
        )
    `, [uploadId])
    report.cleanedTerminalStaging += 1
  }

  for (const uploadId of await stagingDirectories(root)) {
    if (stateByUpload.has(uploadId)) continue
    const value = confined(root, `staging/${uploadId}`)
    const metadata = await stat(value)
    if (metadata.mtimeMs > graceBefore) continue
    await cleanupSermonMediaStaging(uploadId)
    report.cleanedOrphanStaging += 1
  }

  for (const file of files) {
    if (retainedByKey.has(file.key)) continue
    const metadata = await lstat(file.path)
    if (!requireBackupReady && metadata.mtimeMs > graceBefore) continue
    if (
      metadata.size < 1
      || metadata.size > 1024 * 1024 * 1024
      || !await verifiedDigest(file.path, metadata.size, file.digest)
    ) {
      throw new Error(
        'An unreferenced private object failed content-address verification.',
      )
    }
    await unlink(file.path)
    await removeEmptyObjectParents(root, file.path)
    report.removedOrphanObjects += 1
  }

  report.retained.objects = retainedByKey.size
  report.retained.bytes = [...retainedByKey.values()].reduce(
    (total, object) => total + object.sizeBytes,
    0,
  )
  report.stagingDirectories = (await stagingDirectories(root)).length
  await client.query('COMMIT')
  console.log(JSON.stringify(report))
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined)
  console.error(
    error instanceof Error ? error.message : 'Sermon-media maintenance failed.',
  )
  process.exitCode = 1
} finally {
  await client.end()
}
