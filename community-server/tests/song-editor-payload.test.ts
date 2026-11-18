import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase'
import { up, down } from '../src/migrations/20261002_000000_retire_song_member_sharing'
import { songLibraryBaseFilter } from '../src/lib/songLibraryView'
import { serializeSongForSync } from '../src/lib/syncShowProtocol'

const databaseUrl = process.env.HERITAGE_SONG_EDITOR_TEST_DATABASE

test('real song creation, tenant ownership, publication/archive and legacy normalization preserve content', { skip: !databaseUrl }, async () => {
  assertDisposableLiveDatabase({ databaseUrl, expectedDatabase: 'heritage_song_editor_test', expectedMarker: 'song-editor-rehearsal', variableName: 'HERITAGE_SONG_EDITOR_TEST_DATABASE' })
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  assert.equal((await client.query('select current_database() as db')).rows[0].db, 'heritage_song_editor_test')
  const migrationDB = payload.db.drizzle
  const prefix = `song-editor-${randomUUID()}`
  const community = (await payload.find({ collection: 'communities', where: { slug: { equals: 'song-editor-ci' } } })).docs[0]
  assert.ok(community)
  try {
    const manager = await payload.create({ collection: 'users', data: { email: prefix + '@example.test', password: 'Test-song-editor-manager-2026', systemRole: 'member', displayName: 'Rehearsal manager', accountProtection: 'email', syncGeneration: 1 } })
    await payload.create({ collection: 'memberships', data: { community: community.id, user: manager.id, role: 'admin', joinedAt: new Date().toISOString() } })
    const song = await payload.create({ collection: 'songs', user: manager, overrideAccess: false, data: {
      title: 'Song Editor Rehearsal ' + prefix, russianTitle: 'Проверка песенного редактора',
      lyrics: 'Verse 1\nEnglish verse\n\nChorus\nRefrain words', russianLyrics: 'Куплет 1\nРусский куплет\n\nПрипев\nСлова припева', authors: ['Writer One', 'Автор Два'],
      chordSheet: '[G]English [C]verse', russianChordSheet: '[G]Русский [C]куплет',
      rightsNotes: 'PRIVATE NOTE',
    } as never })
    assert.equal(typeof song.community === 'object' ? song.community.id : song.community, community.id)
    assert.match(song.slug, /^song-editor-rehearsal-/)
    const original = await payload.findByID({ collection: 'songs', id: song.id, showHiddenFields: true })
    const updated = await payload.update({ collection: 'songs', id: song.id, user: manager, overrideAccess: false, data: { title: 'Renamed song', slug: 'custom-' + prefix } })
    assert.equal(updated.syncId, original.syncId)
    assert.equal(updated.chordSheet, original.chordSheet)
    assert.equal(updated.russianChordSheet, original.russianChordSheet)
    assert.deepEqual(updated.authors, original.authors)
    assert.deepEqual((updated.syncDocuments as any[]).map(doc => doc.id), (original.syncDocuments as any[]).map(doc => doc.id))
    const published = await payload.update({ collection: 'songs', id: song.id, user: manager, overrideAccess: false, data: { songbookVisibility: 'published', status: 'draft' } })
    assert.equal(((await payload.findByID({ collection: 'songs', id: published.id, showHiddenFields: true })).songbookContent as any).lyrics, song.lyrics)
    const archived = await payload.update({ collection: 'songs', id: song.id, user: manager, overrideAccess: false, data: { songbookVisibility: 'private', status: 'archived' } })
    assert.equal(archived.status, 'archived')
    assert.equal((await payload.findByID({ collection: 'songs', id: archived.id, showHiddenFields: true })).songbookContent, null)
    assert.equal(archived.lyrics,song.lyrics)
    assert.equal(archived.russianLyrics,song.russianLyrics)
    assert.equal(serializeSongForSync({...archived}).archived,true)
    const library = (where: unknown) => payload.find({collection:'songs',user:manager,overrideAccess:false,
      where:{and:[{id:{equals:song.id}},songLibraryBaseFilter(where)]}})
    assert.equal((await library(undefined)).totalDocs,0)
    assert.equal((await library({status:{equals:'archived'}})).totalDocs,1)
    const restored = await payload.update({ collection: 'songs', id: song.id, user: manager, overrideAccess: false, data: { songbookVisibility: 'published', status: 'draft' } })
    assert.equal(restored.status, 'draft')
    assert.equal(restored.songbookVisibility, 'published')
    assert.equal((await library(undefined)).totalDocs,1)
    assert.equal((await library({status:{equals:'archived'}})).totalDocs,0)
    const { GET: content } = await import('../src/app/content/[type]/[id]/route')
    const getContent = (id: number, headers = {}) => content(new Request('http://127.0.0.1/content/songs/' + id, { headers }), { params: Promise.resolve({ type: 'songs', id: String(id) }) })
    const publicResponse = await getContent(song.id)
    assert.equal(publicResponse.status, 200)
    assert.doesNotMatch(JSON.stringify(await publicResponse.json()), /PRIVATE NOTE|rightsNotes|syncDocuments/)


    const foreign = await payload.create({ collection: 'communities', data: { name: 'Other rehearsal church', slug: prefix, joinPolicy: 'invite', calendarDefaultVisibility: 'members', timeZone: 'UTC', contentServerEnabled: true } })
    const foreignManager = await payload.create({ collection: 'users', data: { email: prefix + '-foreign@example.test', password: 'Test-song-editor-manager-2026', systemRole: 'member', displayName: 'Rehearsal manager', accountProtection: 'email', syncGeneration: 1 } })
    await payload.create({ collection: 'memberships', data: { community: foreign.id, user: foreignManager.id, role: 'admin', joinedAt: new Date().toISOString() } })
    await assert.rejects(payload.create({ collection: 'songs', user: foreignManager, overrideAccess: false, data: { title: 'Wrong church' } as never }), /permission/)
    const member = await payload.create({ collection: 'users', data: { email: prefix + '-member@example.test', password: 'Test-song-editor-member-2026', systemRole: 'member', displayName: 'Rehearsal member', accountProtection: 'email', syncGeneration: 1 } })
    await payload.create({ collection: 'memberships', data: { community: community.id, user: member.id, role: 'member', joinedAt: new Date().toISOString() } })
    await assert.rejects(payload.find({ collection: 'songs', user: member, overrideAccess: false }), /not allowed/)

    const privateSong = await payload.create({ collection: 'songs', data: { title: 'Private legacy ' + prefix, slug: 'private-' + prefix, lyrics: 'NEVER PUBLISH', songbookVisibility: 'private' } as never })
    const archivedSong = await payload.create({ collection: 'songs', data: { title: 'Archived legacy ' + prefix, slug: 'archived-' + prefix, lyrics: 'ARCHIVED WORDS', status: 'archived' } as never })
    assert.equal((await getContent(privateSong.id)).status, 404)
    const memberLogin = await payload.login({ collection: 'users', data: { email: member.email, password: 'Test-song-editor-member-2026' } })
    assert.equal((await getContent(privateSong.id, { cookie: `payload-token=${memberLogin.token}` })).status, 404)
    // Rehearse upgrading actual pre-retirement rows, then guarded rollback.
    await down({ db: migrationDB } as never)
    for (const id of [song.id, privateSong.id, archivedSong.id]) {
      await client.query(`UPDATE songs SET visibility='public', status=CASE WHEN status='archived' THEN status ELSE 'published' END,
        sync_version=10, member_share_receipt_id=$2, member_share_receipt_version=1,
        member_share_previous_song_sync_version=9, member_share_song_sync_version=10,
        member_share_family_revision=$3, member_share_review_revision=$3,
        member_share_visibility='public', member_share_time_zone='UTC',
        member_share_reviewed_at=now(), member_share_confirmed_at=now(),
        member_share_request_revision=$3, member_share_receipt_revision=$3 WHERE id=$1`, [id, 'receipt-' + id, 'a'.repeat(64)])
    }
    const ids = [song.id, privateSong.id, archivedSong.id]
    const before = (await client.query('SELECT * FROM songs WHERE id = ANY($1::int[]) ORDER BY id', [ids])).rows
    await up({ db: migrationDB } as never)
    const after = (await client.query('SELECT * FROM songs WHERE id = ANY($1::int[]) ORDER BY id', [ids])).rows
    for (let i = 0; i < before.length; i++) {
      const row = after[i]
      assert.equal(row.visibility, 'private')
      assert.equal(row.status, before[i].status === 'archived' ? 'archived' : 'draft')
      assert.equal(Number(row.sync_version), Number(before[i].sync_version) + 1)
      for (const key of Object.keys(row)) {
        if (key.startsWith('member_share_')) assert.equal(row[key], null)
        else if (!['visibility', 'status', 'sync_version', 'updated_at', 'publish_at'].includes(key)) assert.deepEqual(row[key], before[i][key], key)
      }
    }
    assert.equal(after.find(row => row.id === privateSong.id).songbook_visibility, 'private')
    assert.equal(after.find(row => row.id === privateSong.id).songbook_content, null)
    await assert.rejects(client.query("UPDATE songs SET visibility='public' WHERE id=$1", [song.id]), /songs_retired_member_visibility_check|songs_member_share_authority_check/)
    // Simulate a subsequent edit; rollback must leave it private and preserve it.
    await client.query("UPDATE songs SET lyrics='Edited after normalization', sync_version=sync_version+1, updated_at=now() WHERE id=$1", [privateSong.id])
    await down({ db: migrationDB } as never)
    const rollback = (await client.query('SELECT * FROM songs WHERE id = ANY($1::int[]) ORDER BY id', [ids])).rows
    assert.equal(rollback.find(row => row.id === song.id).visibility, 'public')
    assert.equal(rollback.find(row => row.id === privateSong.id).visibility, 'private')
    assert.equal(rollback.find(row => row.id === privateSong.id).lyrics, 'Edited after normalization')
    await up({ db: migrationDB } as never)
  } finally { await client.end(); await payload.destroy() }
})
