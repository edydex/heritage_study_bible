import pg from 'pg'
import {
  normalizeSyncDocuments,
  synthesizeLegacySyncDocuments,
} from '../src/lib/syncShowProtocol.ts'

const { Client } = pg
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is required. This command never prints or modifies it.')
  process.exit(2)
}

const expectedSongs = process.env.SYNCSHOW_EXPECTED_SONGS
  ? Number(process.env.SYNCSHOW_EXPECTED_SONGS)
  : null
const client = new Client({ connectionString })

function fallbackSyncId(row) {
  const slug = String(row.slug || '')
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(slug)
    ? slug
    : `heritage:${row.id}`
}

await client.connect()
try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  const songs = (await client.query('SELECT * FROM "songs" ORDER BY "id"')).rows
  const textRows = (await client.query(`
    SELECT "parent_id", "path", "text"
    FROM "songs_texts"
    WHERE "text" IS NOT NULL
    ORDER BY "parent_id", "order", "id"
  `)).rows
  const authorsBySong = new Map()
  for (const row of textRows) {
    if (row.path !== 'authors') continue
    const authors = authorsBySong.get(row.parent_id) || []
    authors.push(row.text)
    authorsBySong.set(row.parent_id, authors)
  }

  const identities = new Set()
  const duplicateSyncIds = []
  const failures = []
  const topologyFailures = []
  const visibility = { private: 0, public: 0, 'scheduled-public': 0 }
  let alreadyCanonical = 0
  let convertible = 0
  let metadataOnly = 0

  for (const row of songs) {
    const syncId = row.sync_id || fallbackSyncId(row)
    if (identities.has(syncId)) duplicateSyncIds.push({ id: row.id, syncId })
    identities.add(syncId)
    const projectedVisibility = row.visibility
      || (row.status === 'published' ? 'public' : 'private')
    if (Object.hasOwn(visibility, projectedVisibility)) visibility[projectedVisibility] += 1
    else failures.push({ id: row.id, syncId, error: `invalid visibility: ${projectedVisibility}` })
    if (projectedVisibility === 'scheduled-public' && !row.publish_at) {
      failures.push({ id: row.id, syncId, error: 'scheduled-public is missing publishAt' })
    }

    const existingDocuments = Array.isArray(row.sync_documents) ? row.sync_documents : []
    const song = {
      id: row.id,
      syncId,
      slug: row.slug,
      title: row.title,
      russianTitle: row.russian_title,
      lyrics: row.lyrics,
      russianLyrics: row.russian_lyrics,
      authors: authorsBySong.get(row.id),
      license: row.license,
      copyright: row.copyright,
      rightsNotes: row.rights_notes,
      sourceUrl: row.source_url,
      syncDocuments: existingDocuments,
    }
    try {
      const documents = existingDocuments.length
        ? normalizeSyncDocuments(existingDocuments) || []
        : synthesizeLegacySyncDocuments(song)
      if (existingDocuments.length) alreadyCanonical += 1
      else if (documents.length) convertible += 1
      else metadataOnly += 1
      if (documents.length) {
        const roots = documents.filter(document => !/^translationOf:/m.test(document.source))
        if (roots.length !== 1) {
          topologyFailures.push({
            id: row.id,
            syncId,
            documentCount: documents.length,
            rootCount: roots.length,
          })
        }
      }
    } catch (error) {
      failures.push({
        id: row.id,
        syncId,
        error: error instanceof Error ? error.message : 'unknown conversion error',
      })
    }
  }

  const report = {
    mode: 'read-only',
    totalSongs: songs.length,
    expectedSongs,
    countMatches: expectedSongs == null || songs.length === expectedSongs,
    visibility,
    alreadyCanonical,
    convertible,
    metadataOnly,
    duplicateSyncIds,
    topologyFailures,
    failures,
  }
  console.log(JSON.stringify(report, null, 2))
  if (!report.countMatches
    || duplicateSyncIds.length
    || topologyFailures.length
    || failures.length) {
    process.exitCode = 1
  }
} finally {
  await client.query('ROLLBACK').catch(() => undefined)
  await client.end()
}
