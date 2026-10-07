import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const root = new URL('../public/data/', import.meta.url)
const read = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
const visible = text => text.replace(/^\s*¶\s*/, '').replace(/\s+¶\s+/g, '\n').replace(/\s*\|\|\s*/g, '\n').replace(/<\/?b>/g, '')
const corpus = id => new Map(read(id === 'ORIGINAL' ? 'original-languages/greek-nt-n1904.json' : `translations/${id}.json`).books.flatMap(b => b.chapters.flatMap(c => c.verses.map(v => [`${b.name}:${c.number}:${v.number}`,visible(v.text)]))))
for (const targetId of ['BSB','LSV']) test(`${targetId} maps pin the displayed edition and have valid paired offsets`, () => {
  const index = read(`original-languages/${targetId.toLowerCase()}-word-links/index.json`), source = corpus('ORIGINAL'), target = corpus(targetId)
  assert.equal(Object.keys(index.books).length, 27)
  for (const [book, metadata] of Object.entries(index.books)) {
    const path = `original-languages/${targetId.toLowerCase()}-word-links/${metadata.file}`
    const raw = readFileSync(new URL(path, root)), item = JSON.parse(raw)
    assert.equal(createHash('sha256').update(raw).digest('hex'), metadata.sha256)
    assert.equal(item.targetId, targetId)
    assert.equal(Object.keys(item.verses).length, metadata.linkedVerses)
    for (const [ref, entry] of Object.entries(item.verses)) {
      assert.equal(entry.sourceText, source.get(`${book}:${ref}`))
      assert.equal(entry.targetText, target.get(`${book}:${ref}`))
      assert.equal(new Set(entry.groups.map(g => g.id)).size, entry.groups.length)
      for (const group of entry.groups) for (const column of ['source','target']) {
        const [start,end] = group[column]
        assert.ok(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= entry[`${column}Text`].length)
      }
    }
  }
  const phil = read(`original-languages/${targetId.toLowerCase()}-word-links/philippians.json`)
  assert.ok(phil.verses['4:12'].groups.length >= 16)
  assert.ok(phil.verses['4:12'].review)
  assert.equal(phil.unavailable['4:12'], undefined)
})
test('reviewed LSV phrases for full, initiated and in want point to the correct Greek words', () => {
  const entry = read('original-languages/lsv-word-links/philippians.json').verses['4:12']
  for (const [phrase, greek] of [['to be full','χορτάζεσθαι'],['I have been initiated','μεμύημαι'],['to be in want','ὑστερεῖσθαι']]) {
    const group = entry.groups.find(g => entry.targetText.slice(...g.target) === phrase)
    assert.equal(entry.sourceText.slice(...group.source), greek)
  }
})
