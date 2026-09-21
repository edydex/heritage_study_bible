import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { BibleImportError, parseBibleImport, importedBiblePassage } from '../packages/bible-import/index.js'
import { CANONICAL_BIBLE_BOOKS } from '../src/lib/syncshow/BibleRange.ts'
import { loadHeritageServiceBiblePassage } from '../src/lib/syncshow/HeritageServiceBibleLookup.ts'
import { importedBibleDigest } from '../src/lib/bible/InstalledBibles.ts'
const sample = JSON.parse(readFileSync(new URL('../public/bible-import-example.json', import.meta.url), 'utf8'))
const parse = (value: unknown) => parseBibleImport(JSON.stringify(value), CANONICAL_BIBLE_BOOKS)
const range = { schemaVersion: 1 as const, bookId: 'Rom', start: { chapter: 1, verse: 1 }, end: { chapter: 1, verse: 3 } }
test('import preserves exact Unicode, punctuation and whitespace; canonical order has stable digest', () => {
  const input = structuredClone(sample)
  input.books[0].chapters[0].verses[0].text = '  Yahweh — «Слово»\nSecond line.  '
  const parsed = parse(input)
  assert.equal(parsed.summary.verseCount, 3)
  assert.equal(parsed.summary.chapterCount, 1)
  assert.equal(parsed.document.books[0].chapters[0].verses[0].text, input.books[0].chapters[0].verses[0].text)
  input.books[0].chapters[0].verses.reverse()
  assert.equal(importedBibleDigest(parse(input).source), importedBibleDigest(parsed.source))
  assert.equal(parseBibleImport('\uFEFF' + JSON.stringify(input), CANONICAL_BIBLE_BOOKS).source, parsed.source)
})
test('duplicate identities, invalid chapter numbers, reserved IDs, unknown fields and unsafe URLs fail', () => {
  const changes = [
    (v: any) => v.books.push(structuredClone(v.books[0])),
    (v: any) => v.books[0].chapters.push(structuredClone(v.books[0].chapters[0])),
    (v: any) => v.books[0].chapters[0].verses.push(structuredClone(v.books[0].chapters[0].verses[0])),
    (v: any) => v.books[0].chapters[0].number = 17,
    (v: any) => v.translation.id = 'BSB',
    (v: any) => v.translation.id = '../LSB',
    (v: any) => v.translation.sourceUrl = 'javascript:alert(1)',
    (v: any) => v.translation.sourceUrl = 'https://secret:password@example.com',
    (v: any) => v.books[0].chapters[0].verses[0].text = '\u0000',
    (v: any) => v.books[0].chapters[0].verses[0].markup = '<b>x</b>',
  ]
  for (const change of changes) { const v = structuredClone(sample); change(v); assert.throws(() => parse(v), BibleImportError) }
})
test('a partial import never fills omitted verses from another translation', () => {
  const parsed = parse(sample)
  assert.deepEqual(importedBiblePassage(parsed.document, range, 'Romans 1:1-3').verses, sample.books[0].chapters[0].verses)
  assert.throws(() => importedBiblePassage(parsed.document, { ...range, end: { chapter: 1, verse: 4 } }, 'Romans 1:1-4'), /verse 4/)
})
test('mixed built-in and imported passage selection pins exact edition and attribution', async () => {
  const parsed = parse(sample); const fetched: string[] = []
  const result = await loadHeritageServiceBiblePassage(range, {
    translations: { english: parsed.summary.id, russian: 'SYNO-W' },
    importedPassage: async (id, canonical) => { assert.equal(id, 'BSB-DEMO'); return { passage: importedBiblePassage(parsed.document, canonical, 'Romans 1:1-3'), sourceUrl: parsed.summary.sourceUrl } },
    fetchImpl: async url => { fetched.push(String(url)); return Response.json({ name: 'Romans', chapters: [{ number: 1, verses: [1, 2, 3].map(number => ({ number, text: `Русский ${number}` })) }] }) },
  })
  assert.equal(fetched.length, 1); assert.match(fetched[0], /SYNO-W/)
  assert.equal(result.passagesByChannel.english.translationId, 'BSB-DEMO')
  assert.equal(result.passagesByChannel.english.attribution, parsed.summary.attribution)
  assert.deepEqual(result.passagesByChannel.english.verses, sample.books[0].chapters[0].verses)
  assert.deepEqual(result.passagesByChannel.media, result.passagesByChannel.russian)
})
