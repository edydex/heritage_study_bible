#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourcePath = process.argv[2]
if (!sourcePath) throw new Error('Usage: node scripts/auditBsbSpacing.mjs <official-bsb.txt> [output-manifest.json]')

const officialBytes = readFileSync(sourcePath)
const official = new Map()
for (const line of officialBytes.toString('utf8').split(/\r?\n/)) {
  const [reference, text] = line.split('\t')
  if (!/^.+ \d+:\d+$/.test(reference)) continue
  const canonical = reference.replace(/^Psalm /, 'Psalms ')
  if (official.has(canonical)) throw new Error(`Duplicate official verse: ${canonical}`)
  official.set(canonical, text.trim())
}
if (official.size !== 31102) throw new Error(`Expected 31,102 official verses, found ${official.size}`)

const bundled = JSON.parse(readFileSync(new URL('./bible-sources/BSB-source.json', import.meta.url), 'utf8'))
const withoutSpaces = text => text.replace(/\s/g, '')
const repairs = []
const audit = { comparedVerses: 0, identicalVerses: 0, whitespaceOnlyVerses: 0, editionDiffersVerses: 0, repairedVerses: 0, insertedSpaces: 0 }
const bookName = name => name.replace(/^(III|II|I) /, (_, numeral) => `${{ I: 1, II: 2, III: 3 }[numeral]} `).replace(/^Revelation of John$/, 'Revelation')
for (const book of bundled.books) for (const chapter of book.chapters) for (const verse of chapter.verses) {
  const canonicalBook = bookName(book.name)
  const reference = `${canonicalBook} ${chapter.chapter}:${verse.verse}`
  const sourceText = verse.text.trim()
  const expected = official.get(reference)
  if (expected == null) throw new Error(`Official verse missing: ${reference}`)
  audit.comparedVerses++
  if (sourceText === expected) { audit.identicalVerses++; continue }
  if (withoutSpaces(sourceText) !== withoutSpaces(expected)) { audit.editionDiffersVerses++; continue }
  audit.whitespaceOnlyVerses++

  // Only insert whitespace at boundaries independently present in the official
  // text. Preserve the installed edition and its existing spacing elsewhere.
  let sourceIndex = 0, expectedIndex = 0
  const insertions = []
  while (sourceIndex < sourceText.length && expectedIndex < expected.length) {
    if (/\s/.test(sourceText[sourceIndex])) { sourceIndex++; continue }
    if (/\s/.test(expected[expectedIndex])) {
      if (sourceIndex > 0 && !/\s/.test(sourceText[sourceIndex - 1])) insertions.push(sourceIndex)
      expectedIndex++
      continue
    }
    sourceIndex++; expectedIndex++
  }
  if (!insertions.length) continue
  let correctedText = sourceText
  for (const offset of insertions.reverse()) correctedText = `${correctedText.slice(0, offset)} ${correctedText.slice(offset)}`
  repairs.push({ book: canonicalBook, chapter: Number(chapter.chapter), verse: Number(verse.verse), sourceText, correctedText })
  audit.repairedVerses++
  audit.insertedSpaces += insertions.length
}
if (audit.comparedVerses !== 31102) throw new Error(`Expected 31,102 installed verses, found ${audit.comparedVerses}`)

const manifest = {
  schemaVersion: 1,
  translation: 'BSB',
  source: { provider: 'Berean Standard Bible', url: 'https://bereanbible.com/bsb.txt', sha256: createHash('sha256').update(officialBytes).digest('hex') },
  policy: 'Restore missing whitespace only when every non-whitespace character matches the official text. Preserve the bundled edition and existing spacing elsewhere.',
  audit,
  repairs,
}
if (process.argv[3]) writeFileSync(process.argv[3], `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ officialSource: resolve(sourcePath), sha256: manifest.source.sha256, ...audit }, null, 2))
