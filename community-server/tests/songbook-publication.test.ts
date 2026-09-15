import assert from 'node:assert/strict'
import test from 'node:test'
import { createPublicSongContent, prepareSongPublication, publishedSongContent, songbookVisibility } from '../src/lib/songPublication'
const song = { title: 'A test song', russianTitle: 'Тестовая песня', lyrics: 'Original English words', russianLyrics: 'Русские слова', status: 'draft', visibility: 'private', rightsNotes: 'PRIVATE RIGHTS', sourceUrl: 'https://private.example.org/source', recordings: [{ url: 'PRIVATE AUDIO' }], authors: ['Writer'] }
async function save(data: Record<string, unknown>, originalDoc = {}) { return prepareSongPublication({ data, originalDoc, context: { songbookPublicationRequested: Object.hasOwn(data, 'songbookVisibility') } } as never) }

test('private by default; only an explicit publication saves the public words', async () => {
  assert.equal(songbookVisibility(song), 'private')
  assert.equal(publishedSongContent(song), null)
  const saved = await save({ ...song, songbookVisibility: 'published', songbookContent: { injected: true } })
  const content = publishedSongContent(saved)
  assert.equal(content?.lyrics, 'Original English words')
  assert.equal(content?.russianLyrics, 'Русские слова')
  assert.doesNotMatch(JSON.stringify(content), /PRIVATE|injected|syncDocuments|rightsNotes|sourceUrl/)
})
test('unlisted has a public copy; private and archived immediately stop serving it', async () => {
  const saved = await save({ ...song, songbookVisibility: 'unlisted' })
  assert.ok(publishedSongContent(saved))
  assert.equal(publishedSongContent(await save({ songbookVisibility: 'private' }, saved)), null)
  assert.equal(publishedSongContent({ ...saved, status: 'archived' }), null)
})
test('ordinary edits preserve the last published copy until explicitly republished', async () => {
  const saved = await save({ ...song, songbookVisibility: 'published' })
  const edited = await save({ lyrics: 'Unreviewed new words' }, saved)
  assert.equal(publishedSongContent({ ...saved, ...edited })?.lyrics, 'Original English words')
  const updated = await save({ ...song, lyrics: 'Reviewed new words', songbookVisibility: 'published' }, saved)
  assert.equal(publishedSongContent(updated)?.lyrics, 'Reviewed new words')
})
test('stored snapshots are reprojected and never expose newly added private fields', () => {
  const content = createPublicSongContent(song)
  assert.doesNotMatch(JSON.stringify(publishedSongContent({ songbookVisibility: 'published', songbookContent: { ...content, secret: 'PRIVATE' } })), /PRIVATE|secret/)
})
