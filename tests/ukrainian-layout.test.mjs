import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => JSON.parse(readFileSync(new URL(`../public/data/${path}`, import.meta.url), 'utf8'))
const layout = read('verse-layout/UKRK.json')

function startsIn(book, chapter) {
  const prefix = `${book}.${chapter}.`
  return Object.keys(layout.verses)
    .filter(key => key.startsWith(prefix))
    .map(key => Number(key.slice(prefix.length)))
}

test('UKRK-R displays the Berean paragraph starts throughout Romans 3', () => {
  assert.deepEqual(startsIn('Romans', 3), [3, 5, 9, 19, 21, 25, 27, 29, 31])
})

test('verse boundaries stay valid through omissions and Ukrainian verse merges', () => {
  assert.ok(startsIn('Matthew', 17).length > 0)
  assert.ok(startsIn('Philemon', 1).includes(24))
  assert.ok(!startsIn('Philemon', 1).includes(25))
  assert.ok(startsIn('2 Corinthians', 13).includes(13))
  assert.ok(startsIn('3 John', 1).includes(15))
  assert.ok(startsIn('Leviticus', 5).includes(20))
  assert.ok(startsIn('Job', 39).includes(31))
  assert.ok(startsIn('Hosea', 14).includes(2))
  assert.ok(startsIn('Jonah', 2).includes(2))
  assert.ok(startsIn('Deuteronomy', 28).includes(69))
})

test('editorial layout covers every book and attaches to existing written verses', () => {
  const corpus = read('translations/UKRK.json')
  const booksWithBreaks = new Set()
  const chaptersWithBreaks = new Set()
  const candidates = new Map()

  for (const book of corpus.books) {
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses.slice(1)) {
        if (verse.text.trim()) candidates.set(`${book.name}.${chapter.number}.${verse.number}`, [book.name, chapter.number])
      }
    }
  }

  for (const [key, marker] of Object.entries(layout.verses)) {
    const position = candidates.get(key)
    assert.ok(position, key)
    assert.deepEqual(marker, { breakBefore: true, editorialBreak: true }, key)
    booksWithBreaks.add(position[0])
    chaptersWithBreaks.add(position.join('.'))
  }

  assert.equal(booksWithBreaks.size, corpus.books.length)
  assert.equal(chaptersWithBreaks.size, layout.source.coveredChapters)
  assert.ok(startsIn('Psalms', 119).includes(57))
})
