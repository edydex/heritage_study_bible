#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseUsfmVerseLayout } from './lib/usfmLayout.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceZip = resolve(process.argv[2] || '/tmp/engbsb_usfm.zip')
const outputPath = resolve(process.argv[3] || `${ROOT}/public/data/verse-layout/BSB.json`)

const files = execFileSync('unzip', ['-Z1', sourceZip], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(name => name.endsWith('.usfm'))

if (files.length !== 66) {
  throw new Error(`Expected 66 USFM books in ${sourceZip}; found ${files.length}`)
}

const verses = {}
for (const filename of files) {
  const usfm = execFileSync('unzip', ['-p', sourceZip, filename], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  })
  const sourceBookName = usfm.match(/^\\h\s+(.+?)\s*$/m)?.[1]?.trim()
  if (!sourceBookName) throw new Error(`Missing \\h book name in ${filename}`)

  // Heritage's canonical book label follows the traditional KJV name.
  const bookName = sourceBookName === 'Song' ? 'Song of Solomon' : sourceBookName
  Object.assign(verses, parseUsfmVerseLayout(usfm, bookName))
}

const payload = {
  schemaVersion: 1,
  translation: 'BSB',
  source: {
    format: 'USFM',
    provider: 'eBible.org',
    url: 'https://ebible.org/Scriptures/engbsb_usfm.zip',
  },
  verses,
}

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, `${JSON.stringify(payload)}\n`)
console.log(`Wrote ${Object.keys(verses).length} structured verse records to ${outputPath}`)
