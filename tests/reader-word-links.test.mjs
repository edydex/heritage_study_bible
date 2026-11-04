import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
const root = new URL('../public/data/', import.meta.url)
const read = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'))
const visible = text => text.replace(/^\s*¶\s*/, '').replace(/\s+¶\s+/g, '\n').replace(/\s*\|\|\s*/g, '\n').replace(/<\/?b>/g, '')
const corpus = id => new Map(read(id === 'ORIGINAL' ? 'original-languages/greek-nt-n1904.json' : `translations/${id}.json`).books.flatMap(b => b.chapters.flatMap(c => c.verses.map(v => [`${b.name}:${c.number}:${v.number}`,visible(v.text)]))))
test('reviewed publisher pronouns, number phrases and witness differences retain their actual source heads', () => {
  const result = spawnSync('python3', ['scripts/original-languages/test_publisher_semantic_reviews.py'], { cwd: new URL('../', import.meta.url), encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } })
  assert.equal(result.status, 0, result.stdout + result.stderr)
})
test('mapping progress counts individual words and preserves complete split phrases', () => {
  const result = spawnSync('python3', ['scripts/original-languages/test_word_link_accounting.py'], { cwd: new URL('../', import.meta.url), encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } })
  assert.equal(result.status, 0, result.stdout + result.stderr)
})
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
      const rawRef = entry.sourceReference ? `${entry.sourceReference.chapter}:${entry.sourceReference.verse}` : ref
      assert.equal(entry.sourceText, source.get(`${book}:${rawRef}`) ?? (entry.sourceAbsent ? '' : undefined))
      assert.equal(entry.targetText, target.get(`${book}:${ref}`) ?? (entry.targetAbsent ? '' : undefined))
      assert.equal(new Set(entry.groups.map(g => g.id)).size, entry.groups.length)
      for (const group of entry.groups) {
        for (const [start, end] of group.targetRanges || [group.target]) assert.ok(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= entry.targetText.length)
        if (group.sourceAnchors) {
          for (const anchor of group.sourceAnchors) {
            const text = source.get(`${book}:${anchor.chapter}:${anchor.verse}`)
            assert.ok(text && anchor.startOffset >= 0 && anchor.endOffset > anchor.startOffset && anchor.endOffset <= text.length)
            assert.equal(text.slice(anchor.startOffset, anchor.endOffset), anchor.text)
          }
          assert.deepEqual(group.source, [group.sourceAnchors[0].startOffset, group.sourceAnchors[0].endOffset])
        } else for (const [start, end] of group.sourceRanges || [group.source]) {
          assert.ok(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= entry.sourceText.length)
        }
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
    assert.equal(entry.sourceText.slice(...group.source).replace(/[^\p{L}\p{M}]+$/gu, ''), greek)
  }
})
for (const targetId of ['BSB','LSV']) test(`${targetId} Romans 1:3 and 1:12 link the displayed spelling variants`, () => {
  const romans = read(`original-languages/${targetId.toLowerCase()}-word-links/romans.json`)
  for (const [ref, id, greek, phrase] of [
    ['1:3',8,'Δαυεὶδ','of David'],
    ['1:12',3,'συνπαρακληθῆναι',targetId === 'BSB' ? 'may be mutually encouraged' : 'that I may be comforted together'],
    ['1:12',10,'πίστεως','faith'],
  ]) {
    const entry = romans.verses[ref], group = entry.groups.find(g => g.id === id)
    assert.equal(entry.sourceText.slice(...group.source), greek)
    assert.equal(entry.targetText.slice(...group.target), phrase)
    assert.equal(romans.unavailable[ref], undefined)
  }
})
