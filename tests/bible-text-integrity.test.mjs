import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { applyTranslationWhitespaceRepairs } from '../scripts/lib/translationWhitespaceRepairs.cjs'

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const repairs = read('../scripts/bible-sources/BSB-spacing-repairs.json')
const bsb = read('../public/data/translations/BSB.json')
const source = read('../scripts/bible-sources/BSB-source.json')
const canonical = name => name.replace(/^(III|II|I) /, (_, numeral) => `${{ I: 1, II: 2, III: 3 }[numeral]} `).replace(/^Revelation of John$/, 'Revelation')
const verses = data => new Map(data.books.flatMap(book => book.chapters.flatMap(chapter => chapter.verses.map(verse => [
  `${canonical(book.name)} ${chapter.number ?? chapter.chapter}:${verse.number ?? verse.verse}`, verse.text.trim(),
]))))

test('the complete BSB corpus preserves its edition and includes all reviewed spacing repairs in both download formats', () => {
  const original = verses(source), actual = verses(bsb)
  const corrected = new Map(repairs.repairs.map(repair => [`${repair.book} ${repair.chapter}:${repair.verse}`, repair]))
  assert.equal(original.size, 31102)
  assert.equal(actual.size, original.size)
  assert.equal(corrected.size, 37)
  assert.equal(repairs.audit.insertedSpaces, 127)
  for (const [reference, text] of original) {
    const repair = corrected.get(reference)
    if (repair) {
      assert.equal(repair.sourceText, text, reference)
      assert.equal(repair.correctedText.replace(/\s/g, ''), text.replace(/\s/g, ''), reference)
    }
    assert.equal(actual.get(reference), repair?.correctedText ?? text, reference)
  }
  for (const book of bsb.books) {
    const slug = book.name.toLowerCase().replace(/\s+/g, '-')
    assert.deepEqual(read(`../public/data/translations/BSB/${slug}.json`), book)
  }
  assert.match(actual.get('Zechariah 9:1'), /LORD against.*Hadrach and.*men and.*Israel are/)
  assert.match(actual.get('Zechariah 13:9'), /silver and test.*gold\. They/)
  assert.match(actual.get('Judges 16:14'), /web\. Then/)
})

test('English Bible text contains no joined sentence punctuation or lower-to-uppercase word boundaries', () => {
  const errors = []
  for (const id of ['BSB', 'KJV', 'LSV']) {
    for (const [reference, text] of verses(read(`../public/data/translations/${id}.json`))) {
      if (/[a-z][A-Z]|[A-Za-z][,;:.!?][A-Za-z]/.test(text)) errors.push(`${id} ${reference}`)
    }
  }
  assert.deepEqual(errors, [])
})

test('spacing imports reject changed source wording and remain safe to run twice', () => {
  const repair = repairs.repairs.find(item => item.book === 'Zechariah' && item.chapter === 9 && item.verse === 1)
  const manifest = { translation: 'BSB', repairs: [repair] }
  const data = { translation: 'BSB', books: [{ name: 'Zechariah', chapters: [{ number: 9, verses: [{ number: 1, text: repair.sourceText }] }] }] }
  applyTranslationWhitespaceRepairs(data, manifest)
  applyTranslationWhitespaceRepairs(data, manifest)
  assert.equal(data.books[0].chapters[0].verses[0].text, repair.correctedText)
  const changed = structuredClone(data)
  changed.books[0].chapters[0].verses[0].text += ' changed'
  assert.throws(() => applyTranslationWhitespaceRepairs(changed, manifest), /source changed/)
  assert.throws(() => applyTranslationWhitespaceRepairs(data, { ...manifest, repairs: [{ ...repair, correctedText: 'Different wording' }] }), /changes wording/)
})

test('audio text corrections pin their source and retain the previously accepted verse boundaries', () => {
  const receipt = read('../scripts/bible-audio/spacing-repair-audit.json')
  const manifest = readFileSync(new URL('../scripts/bible-sources/BSB-spacing-repairs.json', import.meta.url))
  assert.equal(receipt.sourceManifestSha256, createHash('sha256').update(manifest).digest('hex'))
  assert.equal(receipt.corrections.length, 20)
  const normalize = text => (text.toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g) || []).join(' ')
  for (const correction of receipt.corrections) {
    const repair = repairs.repairs.find(item => item.book === correction.book && item.chapter === correction.chapter && item.verse === correction.verse)
    assert.equal(correction.beforeText, normalize(repair.sourceText))
    assert.equal(correction.afterText, normalize(repair.correctedText))
    const slug = correction.book.toLowerCase().replace(/\s+/g, '-')
    const span = read(`../public/data/audio/bsb-hays/${slug}.json`).chapters[correction.chapter].verses.find(item => item.verse === correction.verse)
    assert.deepEqual(span, { verse: correction.verse, start: correction.start, end: correction.end, text: correction.afterText })
  }
})
