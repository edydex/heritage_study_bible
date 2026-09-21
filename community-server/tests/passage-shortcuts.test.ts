import assert from 'node:assert/strict'
import test from 'node:test'
import { passageReferenceChoices } from '../packages/bible-reference/range.js'
import { firstSongSections } from '../packages/song-text/index.js'

test('Heritage shortcuts retain the complete exact passage range', () => {
  assert.deepEqual(passageReferenceChoices('1 chr 3 7-10'), [{ book:'1 Chronicles',startChapter:3,startVerse:7,endChapter:3,endVerse:10,invalidReason:'' }])
  for (const [reference, book] of [['Joh 3:16','John'],['Luk 12 34','Luke'],['1chro3.7–10','1 Chronicles'],['2 pet 1:3','2 Peter']]) {
    assert.equal(passageReferenceChoices(reference)[0]?.book,book)
  }
  assert.equal(passageReferenceChoices('John 3:16-4:2')[0].endChapter,4)
  for (const reference of ['John 3:16 junk','John 3:16-','John 3','John 3:16-4:2 garbage']) assert.deepEqual(passageReferenceChoices(reference),[])
  for (const reference of ['John 3:20-16','John 3:0-2','John 22:1','John 3:16-25:2']) assert.ok(passageReferenceChoices(reference)[0]?.invalidReason)
})

test('ambiguous shortcuts preserve choices and explain impossible chapters', () => {
  const ma=passageReferenceChoices('Ma 5 3-9')
  assert.deepEqual(ma.map(value=>value.book),['Malachi','Matthew','Mark'])
  assert.equal(ma[0].invalidReason,'Malachi has 4 chapters.')
  assert.equal(ma[1].endVerse,9)
  assert.deepEqual(passageReferenceChoices('Jo 3 2').map(value=>value.book),['Joshua','Job','Joel','Jonah','John'])
})

test('song preview keeps only the first readable section in each language', () => {
  const song={lyrics:'^1\nFirst line\n---\nNext paragraph\n\n^2\nSecond section',russianLyrics:'^1\nПервая строка\n^2\nДругой куплет'}
  assert.deepEqual(firstSongSections(song),[
    {label:'Verse 1',lines:['First line','','Next paragraph'],language:'en'},
    {label:'Куплет 1',lines:['Первая строка'],language:'ru'},
  ])
  assert.equal(firstSongSections(song,'ru').length,1)
  assert.deepEqual(firstSongSections({title:'Metadata only'}),[])
})
