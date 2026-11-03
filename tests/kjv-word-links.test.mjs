import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const root = new URL('../', import.meta.url)
const bytes = path => readFileSync(new URL(path, root))
const read = path => JSON.parse(bytes(path))
const visible = text => text.replace(/^\s*¶\s*/, '').replace(/\s+¶\s+/g, '\n').replace(/<\/?b>/g, '')
const corpus = path => new Map(read(path).books.flatMap(book => book.chapters.flatMap(chapter => chapter.verses.map(verse => [`${book.name} ${chapter.number}:${verse.number}`, visible(verse.text)]))))

test('all 27 KJV NT mapping books pin both displayed editions and every split phrase offset', () => {
  const base = 'public/data/original-languages/kjv-word-links/'
  const index = read(`${base}index.json`)
  const greek = corpus('public/data/original-languages/greek-nt-n1904.json')
  const english = corpus('public/data/translations/KJV.json')
  assert.equal(Object.keys(index.books).length, 27)
  assert.equal(index.provenance.sourceSha256, '4bcbfe45722fca396adbeac9c81025bbb173cb1e30296da90864f0400cb0e3f5')
  assert.equal(index.provenance.targetSha256, createHash('sha256').update(bytes('public/data/translations/KJV.json')).digest('hex'))
  let verses = 0, groups = 0, split = 0, unavailable = 0
  for (const [book, metadata] of Object.entries(index.books)) {
    const data = read(base + metadata.file)
    assert.equal(createHash('sha256').update(bytes(base + metadata.file)).digest('hex'), metadata.sha256)
    assert.equal(data.targetId, 'KJV')
    assert.deepEqual(data.provenance, index.provenance)
    assert.equal(Object.keys(data.verses).length, metadata.linkedVerses)
    assert.equal(Object.keys(data.unavailable).length, metadata.unlinkedVerses)
    for (const [reference, entry] of Object.entries(data.verses)) {
      assert.equal(entry.sourceText, greek.get(`${book} ${reference}`))
      assert.equal(entry.targetText, english.get(`${book} ${reference}`))
      assert.equal(new Set(entry.groups.map(group => group.id)).size, entry.groups.length)
      for (const group of entry.groups) {
        for (const [column, ranges] of [['sourceText', group.sourceRanges || [group.source]], ['targetText', group.targetRanges || [group.target]]]) {
          for (const [start, end] of ranges) {
            assert.ok(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= entry[column].length)
            assert.ok(entry[column].slice(start, end).trim())
          }
        }
        assert.deepEqual(group.target, (group.targetRanges || [group.target])[0])
        assert.deepEqual(group.source, (group.sourceRanges || [group.source])[0])
        split += Number((group.targetRanges || [group.target]).length > 1)
      }
      verses++; groups += entry.groups.length
    }
    for (const [reference, reason] of Object.entries(data.unavailable)) {
      assert.ok(greek.has(`${book} ${reference}`))
      assert.equal(data.verses[reference], undefined)
      assert.ok(reason)
      unavailable++
    }
  }
  assert.equal(verses + unavailable, 7943)
  assert.ok(verses >= 7900 && groups >= 100000 && split >= 2500)
})

test('the reviewed KJV His in Philippians 3:21 anchors the actual genitive pronoun, not the variant-only it', () => {
  const entry = read('public/data/original-languages/kjv-word-links/philippians.json').verses['3:21']
  const his = entry.groups.find(group => entry.targetText.slice(...group.target) === 'his')
  assert.ok(his)
  assert.equal(entry.sourceText.slice(...his.source).replace(/[^\p{L}\p{M}]+$/gu, ''), 'αὐτοῦ')
  assert.ok(entry.review.targetNotes.some(note => entry.targetText.slice(note.startOffset, note.endOffset) === 'that it may be' && /absent/.test(note.reason)))
  assert.ok(!entry.groups.some(group => (group.targetRanges || [group.target]).some(range => entry.targetText.slice(...range) === 'it')))
})

test('KJV publisher sequence alignment rejects ambiguous repetitions and mismatched witnesses', () => {
  const result = spawnSync('python3', ['scripts/original-languages/test_kjv_links.py'], { cwd: new URL('../', import.meta.url), encoding: 'utf8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } })
  assert.equal(result.status, 0, result.stdout + result.stderr)
})

test('Romans 8:1 repair survives regeneration while OT source gaps remain explicitly audited', () => {
  const audit = read('scripts/bible-sources/KJV-text-repairs.json')
  const repair = audit.repairs[0]
  const combined = read('public/data/translations/KJV.json').books.find(book => book.name === 'Romans')
  const split = read('public/data/translations/KJV/romans.json')
  const vendor = read('scripts/bible-sources/KJVPCE-source.json').books.find(book => book.name === 'Romans')
  assert.equal(combined.chapters.find(chapter => chapter.number === 8).verses[0].text, repair.correctedText)
  assert.equal(split.chapters.find(chapter => chapter.number === 8).verses[0].text, repair.correctedText)
  assert.equal(vendor.chapters.find(chapter => chapter.chapter === 8).verses[0].text.trim(), repair.correctedText)
  assert.deepEqual(audit.remainingOldTestamentEmptyVerses, ['Joshua 15:1', 'Job 7:1', 'Hosea 8:1'])
})
