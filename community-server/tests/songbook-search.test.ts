import assert from 'node:assert/strict'
import test from 'node:test'
import { groupSongbook, songbookLanguage } from '../src/lib/songbookSearch'
const songs = [
  { id: '1', slug: 'rock', title: 'O Lord, My Rock', russianTitle: 'Господь — скала', alternateTitles: ['Redeemer'], authors: ['Writer'] },
  { id: '2', slug: 'abide', title: 'Abide', russianTitle: '', alternateTitles: [], authors: [] },
  { id: '3', slug: 'rus', title: 'Ёлка', russianTitle: 'Ёлка', alternateTitles: [], authors: [] },
]
test('language chooses actual titles and alphabetical order', () => {
  assert.deepEqual(groupSongbook(songs, 'en', '').flatMap(g => g.songs.map(s => s.id)), ['2', '1'])
  assert.deepEqual(groupSongbook(songs, 'ru', '').flatMap(g => g.songs.map(s => s.id)), ['1', '3'])
  assert.equal(songbookLanguage('unknown'), 'en')
})
test('search matches both languages, alternate names, authors, and Russian yo', () => {
  for (const query of ['СКАЛА', 'my rock', 'Redeemer', 'writer']) assert.equal(groupSongbook(songs, 'en', query)[0].songs[0].id, '1')
  assert.equal(groupSongbook(songs, 'ru', 'елка')[0].songs[0].id, '3')
  assert.equal(groupSongbook(songs, 'en', 'not a song').length, 0)
})
