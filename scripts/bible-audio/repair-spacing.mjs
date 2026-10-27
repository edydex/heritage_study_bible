#!/usr/bin/env node

// A displayed-text whitespace repair does not change the recording or its verse
// boundaries. Keep the original alignment receipts and record this text-only
// post-import operation separately.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const hash = value => createHash('sha256').update(value).digest('hex')
const normalized = text => (text.toLowerCase().replace(/[’']/g, '').match(/[a-z0-9]+/g) || []).join(' ')
const manifestPath = 'scripts/bible-sources/BSB-spacing-repairs.json'
const manifestBytes = read(manifestPath)
const manifest = JSON.parse(manifestBytes)
const books = new Map(), corrections = []
for (const repair of manifest.repairs) {
  const beforeText = normalized(repair.sourceText), afterText = normalized(repair.correctedText)
  if (beforeText === afterText) continue
  const slug = repair.book.toLowerCase().replace(/\s+/g, '-')
  if (!books.has(slug)) books.set(slug, JSON.parse(read(`public/data/audio/bsb-hays/${slug}.json`)))
  const span = books.get(slug).chapters[repair.chapter]?.verses.find(item => item.verse === repair.verse)
  if (!span) continue // Do not manufacture timings for previously rejected verses.
  if (![beforeText, afterText].includes(span.text)) throw new Error(`Timing source text changed: ${repair.book} ${repair.chapter}:${repair.verse}`)
  corrections.push({ book: repair.book, chapter: repair.chapter, verse: repair.verse, start: span.start, end: span.end, beforeText, afterText })
  span.text = afterText
}
for (const [slug, data] of books) {
  writeFileSync(new URL(`public/data/audio/bsb-hays/${slug}.json`, root), `${JSON.stringify(data)}\n`)
}
const receipt = {
  schemaVersion: 1,
  operation: 'Post-import BSB whitespace repair; accepted verse timings and recording identities unchanged',
  sourceManifest: manifestPath,
  sourceManifestSha256: hash(manifestBytes),
  corrections,
}
writeFileSync(new URL('scripts/bible-audio/spacing-repair-audit.json', root), `${JSON.stringify(receipt, null, 2)}\n`)
console.log(`Updated normalized text for ${corrections.length} accepted verse spans; no timestamp changes.`)
