import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { assertDisposableLiveDatabase } from './lib/disposableLiveDatabase'

const databaseUrl = process.env.HERITAGE_SONGBOOK_TEST_DATABASE
test('real songbook publishing, serving, withdrawal, and tenant boundaries', { skip: !databaseUrl }, async () => {
  assertDisposableLiveDatabase({ databaseUrl, expectedDatabase: 'songbook_ci', expectedMarker: 'songbook-publication', variableName: 'HERITAGE_SONGBOOK_TEST_DATABASE' })
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })
  const { GET: catalog } = await import('../src/app/catalogs/[type]/route')
  const { GET: content } = await import('../src/app/content/[type]/[id]/route')
  const { effectiveSyncDocuments } = await import('../src/lib/syncShowProtocol')
  const { buildSongPublicLinkSnapshot } = await import('../src/lib/syncshow/SongPublicLink')
  const { loadActiveSongPublicLinkSnapshot } = await import('../src/lib/syncshow/SongPublicLinkStore')
  const { loadPublicSongs, loadPublicSong } = await import('../src/lib/publicSite')
  const prefix = `songbook-check-${randomUUID()}`
  const community = (await payload.find({ collection: 'communities', where: { slug: { equals: 'songbook-ci' } } })).docs[0]
  const admin = (await payload.find({ collection: 'users', where: { email: { equals: 'songbook-ci@example.org' } } })).docs[0]
  assert.ok(community && admin)
  const getContent = (id: number) => content(new Request('http://127.0.0.1/content/songs/' + id), { params: Promise.resolve({ type: 'songs', id: String(id) }) })
  const getCatalog = async (headers = {}) => (await catalog(new Request('http://127.0.0.1/catalogs/songs', { headers }), { params: Promise.resolve({ type: 'songs' }) })).json()
  const login = await payload.login({ collection: 'users', data: { email: admin.email, password: process.env.BOOTSTRAP_ADMIN_PASSWORD! } })
  const managerHeaders = { cookie: `payload-token=${login.token}` }
  try {
    const song = await payload.create({ collection: 'songs', user: admin, overrideAccess: false, data: {
      community: community.id, title: 'A songbook test', russianTitle: 'Песня для проверки', slug: prefix,
      lyrics: 'English rehearsal words', russianLyrics: 'Русские слова для проверки', rightsNotes: 'PRIVATE_NOTES_SENTINEL',
    } as never })
    assert.equal(song.songbookVisibility, 'private')
    assert.equal(await loadPublicSong(prefix), null)
    assert.equal((await getContent(song.id)).status, 404)
    assert.ok(!(await getCatalog(managerHeaders)).items.some((item: { id: string }) => item.id === String(song.id)))
    await assert.rejects(payload.update({ collection: 'songs', id: song.id, overrideAccess: false, data: { songbookVisibility: 'published' } }))

    // The admin may submit the old member-sharing value alongside the new
    // publication choice. It must not demand another member-sharing review.
    await payload.update({ collection: 'songs', id: song.id, user: admin, overrideAccess: false,
      data: { visibility: 'public', songbookVisibility: 'published' } })
    const publication = await payload.findByID({ collection: 'songs', id: song.id, showHiddenFields: true })
    assert.equal(publication.visibility, 'private')
    assert.equal(publication.memberShareReceiptId, null)
    assert.ok((await getCatalog()).items.some((item: { id: string }) => item.id === String(song.id)))
    assert.ok((await loadPublicSongs()).some(item => item.id === String(song.id)))
    let served = await getContent(song.id)
    assert.match(served.headers.get('cache-control') || '', /no-store/)
    let words = await served.json()
    assert.equal(words.lyrics, 'English rehearsal words')
    assert.equal(words.russianLyrics, 'Русские слова для проверки')
    assert.ok(words.publicPageUrl.endsWith('/songs/' + prefix))
    assert.doesNotMatch(JSON.stringify(words), /PRIVATE_NOTES_SENTINEL|rightsNotes|syncDocuments|songbookContent/)

    await payload.update({ collection: 'songs', id: song.id, user: admin, overrideAccess: false, data: { lyrics: 'Unpublished edit' } })
    assert.equal((await (await getContent(song.id)).json()).lyrics, 'English rehearsal words')
    await payload.update({ collection: 'songs', id: song.id, user: admin, overrideAccess: false, data: { songbookVisibility: 'unlisted' } })
    assert.ok(!(await getCatalog(managerHeaders)).items.some((item: { id: string }) => item.id === String(song.id)))
    assert.equal((await (await getContent(song.id)).json()).lyrics, 'Unpublished edit')
    assert.ok(!(await getCatalog()).items.some((item: { id: string }) => item.id === String(song.id)))
    assert.ok(!(await loadPublicSongs()).some(item => item.id === String(song.id)))
    assert.ok(await loadPublicSong(prefix))

    // An older SyncShow sharing link is withdrawn by the same Private save.
    const current = await payload.findByID({ collection: 'songs', id: song.id, showHiddenFields: true })
    const snapshot = buildSongPublicLinkSnapshot({ songSyncId: current.syncId, songSyncVersion: current.syncVersion, documents: effectiveSyncDocuments(current as unknown as Record<string, unknown>) })
    const linkId = randomUUID().replaceAll('-', '')
    const link = await payload.create({ collection: 'syncshow-song-public-links', data: {
      community: community.id, song: song.id, schemaVersion: 1, linkId, linkVersion: 1,
      songSyncId: current.syncId, songSyncVersion: current.syncVersion,
      familyRevision: snapshot.snapshot.familyRevision, reviewRevision: 'a'.repeat(64), issuedAt: new Date().toISOString(),
      snapshotSource: snapshot.source, snapshotChecksum: snapshot.checksum, reviewSource: '{}',
      auditSource: JSON.stringify({ schemaVersion: 1, events: [{ type: 'created' }] }),
      createIdempotencyKeyHash: randomUUID(), createRequestHash: 'b'.repeat(64),
    } })
    assert.ok(await loadActiveSongPublicLinkSnapshot(payload as never, linkId))
    await payload.update({ collection: 'songs', id: song.id, user: admin, overrideAccess: false, data: { songbookVisibility: 'private' } })
    assert.equal(await loadActiveSongPublicLinkSnapshot(payload as never, linkId), null)
    const revoked = await payload.findByID({ collection: 'syncshow-song-public-links', id: link.id, showHiddenFields: true })
    assert.equal(revoked.linkVersion, 2)
    assert.ok(revoked.revokedAt)

    assert.equal((await getContent(song.id)).status, 404)
    assert.equal(await loadPublicSong(prefix), null)
    await payload.update({ collection: 'songs', id: song.id, user: admin, overrideAccess: false, data: { songbookVisibility: 'published' } })
    await payload.update({ collection: 'songs', id: song.id, user: admin, overrideAccess: false, data: { status: 'archived' } })
    assert.equal((await getContent(song.id)).status, 404)
    assert.equal(await loadPublicSong(prefix), null)

    const other = await payload.create({ collection: 'communities', data: { name: 'Other test tenant', slug: prefix + '-tenant', joinPolicy: 'invite', calendarDefaultVisibility: 'members', timeZone: 'UTC', contentServerEnabled: true } })
    const foreign = await payload.create({ collection: 'songs', data: { community: other.id, title: 'Foreign private tenant', slug: prefix + '-foreign', songbookVisibility: 'published', lyrics: 'Other tenant text' } as never })
    assert.equal((await getContent(foreign.id)).status, 404)
    assert.equal(await loadPublicSong(prefix + '-foreign'), null)
    assert.ok(!(await getCatalog()).items.some((item: { id: string }) => item.id === String(foreign.id)))
  } finally { await payload.destroy() }
})
