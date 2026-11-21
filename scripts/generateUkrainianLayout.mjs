import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const dataDirectory = new URL('../public/data/', import.meta.url)
const publisherUrl = 'https://bereanbible.com/bsb_usfm.zip'

// These boundaries were checked directly against the Ukrainian wording.
const reviewedStarts = {
  'Matthew.5': [3, 13, 17, 21, 27, 31, 33, 38, 43],
  'John.3': [16, 22, 25, 31],
  'Romans.12': [3, 9, 14, 17],
  '3 John.1': [15],
}

// A window gives the first and last publisher verse, the offset to add for
// UKRK, and optionally the publisher chapter when it differs. A break that
// starts inside a combined Ukrainian verse has no transferable window.
const reviewedNumbering = {
  'Genesis.3': [[1, 1, 0], [3, 24, -1]],
  'Genesis.6': [[1, 20, 0], [22, 22, -1]],
  'Genesis.48': [[1, 21, 0]],
  'Leviticus.5': [[1, 19, 0], [1, 5, 19, 6], [6, 7, 20, 6]],
  'Leviticus.6': [[8, 29, -7]],
  'Leviticus.14': [[1, 55, 0]],
  'Leviticus.17': [[1, 15, 0]],
  'Leviticus.21': [[1, 23, 0]],
  'Numbers.8': [[1, 25, 0]],
  'Numbers.14': [[1, 44, 0]],
  'Numbers.15': [[1, 40, 0]],
  'Numbers.20': [[1, 28, 0]],
  'Numbers.23': [[1, 17, 0], [18, 20, 1], [22, 28, 1], [30, 30, 1]],
  'Numbers.25': [[1, 17, 0]],
  'Numbers.27': [[1, 18, 0], [20, 22, 0]],
  'Deuteronomy.16': [[1, 21, 0]],
  'Deuteronomy.24': [[1, 21, 0]],
  'Deuteronomy.28': [[1, 68, 0], [1, 1, 68, 29]],
  'Deuteronomy.29': [[2, 2, -1], [3, 29, 0]],
  'Deuteronomy.32': [[1, 45, 0], [47, 51, 0]],
  'Deuteronomy.34': [[1, 11, 0]],
  '1 Samuel.20': [[1, 42, 0]],
  '1 Samuel.23': [[1, 28, 0]],
  '1 Samuel.24': [[29, 29, -28, 23], [1, 22, 1]],
  '2 Samuel.2': [[1, 4, 0], [5, 32, 1]],
  '1 Kings.22': [[1, 43, 0], [44, 53, 1]],
  'Job.21': [[1, 32, 0], [34, 34, -1]],
  'Job.39': [[1, 30, 0], [1, 5, 30, 40]],
  'Job.40': [[6, 24, -5], [1, 8, 19, 41]],
  'Job.41': [[9, 34, -8]],
  'Psalms.13': [[1, 5, 0]],
  'Psalms.24': [[1, 9, 0]],
  'Psalms.29': [[1, 7, 0], [9, 11, -1]],
  'Psalms.54': [[1, 4, 0], [6, 7, -1]],
  'Psalms.60': [[1, 12, 2]],
  'Psalms.89': [[1, 51, 0]],
  'Psalms.106': [[1, 47, 0]],
  'Psalms.127': [[1, 5, 0]],
  'Psalms.148': [[1, 13, 0]],
  'Proverbs.30': [[1, 30, 0], [32, 33, -1]],
  'Ecclesiastes.4': [[1, 16, 0], [1, 1, 16, 5]],
  'Ecclesiastes.5': [[2, 20, -1]],
  'Song of Solomon.1': [[2, 17, -1]],
  'Song of Solomon.6': [[1, 5, 0], [7, 12, 0]],
  'Song of Solomon.7': [[13, 13, -12, 6], [1, 13, 1]],
  'Isaiah.9': [[1, 21, 0]],
  'Daniel.3': [[1, 30, 0], [1, 3, 30, 4]],
  'Daniel.4': [[4, 37, -3]],
  'Hosea.13': [[1, 15, 0]],
  'Hosea.14': [[16, 16, -15, 13], [1, 9, 1]],
  'Jonah.1': [[1, 16, 0]],
  'Jonah.2': [[17, 17, -16, 1], [1, 10, 1]],
  '2 Corinthians.13': [[1, 12, 0], [14, 14, -1]],
  'Philippians.3': [[1, 20, 0]],
  'Philemon.1': [[1, 11, 0], [13, 23, 0], [25, 25, -1]],
  '3 John.1': [[1, 14, 0]],
}

function readBookLayout(usfm) {
  const chapters = new Map()
  let chapter = null
  let startsParagraph = false
  const tokens = usfm.split(/\\([a-z][a-z0-9]*\*?)/gi)

  for (let index = 1; index < tokens.length; index += 2) {
    const marker = tokens[index]
    const contents = tokens[index + 1].trim()

    if (marker === 'c') {
      const number = Number(contents.split(/\s+/, 1)[0])
      chapter = { verses: [], starts: [] }
      chapters.set(number, chapter)
      startsParagraph = false
    } else if (!chapter) {
      continue
    } else if (marker === 'v') {
      const number = contents.match(/^(\d+)(?:\s|$)/)?.[1]
      if (number) {
        chapter.verses.push(Number(number))
        if (startsParagraph) chapter.starts.push(Number(number))
      }
      startsParagraph = false
    } else if (/^s\d*$/.test(marker) || marker === 'qa') {
      startsParagraph = true
    } else if (marker === 'p' || marker === 'b') {
      startsParagraph = !contents
    } else if (contents && !['r', 'd', 'sp'].includes(marker)) {
      // A paragraph or stanza that begins inside a verse must not move to the
      // next verse. Empty q markers preserve a pending stanza boundary.
      startsParagraph = false
    }
  }

  return chapters
}

function readPublisherLayout(archive) {
  const files = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(file => file.toLowerCase().endsWith('.usfm'))
  if (files.length !== 66) throw new Error(`Expected 66 Berean USFM books, found ${files.length}.`)

  const aliases = { Psalm: 'Psalms', Song: 'Song of Solomon', 'Song of Songs': 'Song of Solomon' }
  return new Map(files.map(file => {
    const usfm = execFileSync('unzip', ['-p', archive, file], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })
    const heading = usfm.match(/^\\h[ \t]+([^\r\n]+)/m)?.[1]?.trim()
    if (!heading) throw new Error(`Missing book name in ${file}.`)
    return [aliases[heading] || heading, readBookLayout(usfm)]
  }))
}

const [archive, output = fileURLToPath(new URL('verse-layout/UKRK.json', dataDirectory))] = process.argv.slice(2)
if (!archive) throw new Error(`Pass the publisher USFM archive from ${publisherUrl}.`)

const publisher = readPublisherLayout(resolve(archive))
const ukrainian = JSON.parse(readFileSync(new URL('translations/UKRK.json', dataDirectory), 'utf8'))
const installedBsb = JSON.parse(readFileSync(new URL('translations/BSB.json', dataDirectory), 'utf8'))
const installedBsbBooks = new Map(installedBsb.books.map(book => [book.name, book.chapters]))

function sameNumbering(verses, numbers) {
  return verses.length === numbers.length && verses.every((verse, index) => verse.number === numbers[index])
}

const verses = {}
const unaligned = []
let coveredChapters = 0

for (const book of ukrainian.books) {
  const source = publisher.get(book.name)
  if (!source) throw new Error(`Missing Berean layout for ${book.name}.`)
  const installedChapters = new Map(installedBsbBooks.get(book.name).map(chapter => [chapter.number, chapter.verses]))

  for (const chapter of book.chapters) {
    const key = `${book.name}.${chapter.number}`
    const sourceChapter = source.get(chapter.number)
    const installedVerses = installedChapters.get(chapter.number) || []
    // The publisher skips some traditional verse numbers. The reader's BSB
    // stores explicit empty placeholders at those numbers.
    const matches = sourceChapter && (
      sameNumbering(chapter.verses, sourceChapter.verses)
      || (sameNumbering(chapter.verses, installedVerses.map(verse => verse.number))
        && sameNumbering(installedVerses.filter(verse => verse.text.trim()), sourceChapter.verses))
    )
    const starts = new Set(reviewedStarts[key] || [])

    if (reviewedNumbering[key]) {
      for (const [first, last, offset, publisherChapter = chapter.number] of reviewedNumbering[key]) {
        const upstream = source.get(publisherChapter)
        for (const start of [upstream.verses[0], ...upstream.starts]) {
          if (start >= first && start <= last) starts.add(start + offset)
        }
      }
    } else if (matches) {
      for (const start of sourceChapter.starts) starts.add(start)
    } else {
      unaligned.push(key)
    }

    let hasBreak = false
    for (const [index, verse] of chapter.verses.entries()) {
      if (index === 0 || !verse.text.trim() || !starts.has(verse.number)) continue
      verses[`${key}.${verse.number}`] = { breakBefore: true, editorialBreak: true }
      hasBreak = true
    }
    if (hasBreak) coveredChapters += 1
  }
}

const payload = {
  schemaVersion: 1,
  translation: 'UKRK',
  source: {
    format: 'Editorial paragraphs and stanzas',
    provider: 'Heritage Study Bible',
    basis: 'Berean Standard Bible verse-aligned paragraphs, section starts and stanzas, with reviewed Ukrainian boundaries',
    url: publisherUrl,
    archiveSha256: createHash('sha256').update(readFileSync(archive)).digest('hex'),
    wordingSource: 'https://ebible.org/find/details.php?id=ukr1871',
    coveredChapters,
    reviewedNumberingChapters: Object.keys(reviewedNumbering),
    unalignedChapters: unaligned,
  },
  verses,
}

writeFileSync(resolve(output), `${JSON.stringify(payload)}\n`)
console.log(`Wrote ${Object.keys(verses).length} Ukrainian reading breaks across ${coveredChapters} chapters. ${unaligned.length} chapters await numbering review.`)
