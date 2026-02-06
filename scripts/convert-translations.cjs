/**
 * Convert downloaded Bible translations (BSB, KJV, LSV) to our app's JSON format.
 * 
 * Output format matches bible-web.json:
 * { translation, name, books: [{ name, chapters: [{ number, verses: [{ number, text }] }] }] }
 */

const fs = require('fs')
const path = require('path')

const SOURCES_DIR = path.join(__dirname, 'bible-sources')
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data', 'translations')

// Our canonical book names (matching bible-books.js / bible-web.json)
const CANONICAL_NAMES = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles',
  'Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon',
  'Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel',
  'Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi',
  'Matthew','Mark','Luke','John','Acts','Romans',
  '1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians',
  '1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon',
  'Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation'
]

// Map source book names → canonical names
const NAME_MAP = {
  'I Samuel': '1 Samuel', 'II Samuel': '2 Samuel',
  'I Kings': '1 Kings', 'II Kings': '2 Kings',
  'I Chronicles': '1 Chronicles', 'II Chronicles': '2 Chronicles',
  'I Corinthians': '1 Corinthians', 'II Corinthians': '2 Corinthians',
  'I Thessalonians': '1 Thessalonians', 'II Thessalonians': '2 Thessalonians',
  'I Timothy': '1 Timothy', 'II Timothy': '2 Timothy',
  'I Peter': '1 Peter', 'II Peter': '2 Peter',
  'I John': '1 John', 'II John': '2 John', 'III John': '3 John',
  'Revelation of John': 'Revelation',
}

// VPL book abbreviation → canonical name
const VPL_BOOK_MAP = {
  'GEN': 'Genesis', 'EXO': 'Exodus', 'LEV': 'Leviticus', 'NUM': 'Numbers', 'DEU': 'Deuteronomy',
  'JOS': 'Joshua', 'JDG': 'Judges', 'RUT': 'Ruth',
  '1SA': '1 Samuel', '2SA': '2 Samuel', '1KI': '1 Kings', '2KI': '2 Kings',
  '1CH': '1 Chronicles', '2CH': '2 Chronicles', 'EZR': 'Ezra', 'NEH': 'Nehemiah',
  'EST': 'Esther', 'JOB': 'Job', 'PSA': 'Psalms', 'PRO': 'Proverbs',
  'ECC': 'Ecclesiastes', 'SNG': 'Song of Solomon', 'ISA': 'Isaiah', 'JER': 'Jeremiah',
  'LAM': 'Lamentations', 'EZK': 'Ezekiel', 'EZE': 'Ezekiel', 'DAN': 'Daniel',
  'HOS': 'Hosea', 'JOL': 'Joel', 'JOE': 'Joel', 'AMO': 'Amos', 'OBA': 'Obadiah', 'JON': 'Jonah',
  'MIC': 'Micah', 'NAM': 'Nahum', 'NAH': 'Nahum', 'HAB': 'Habakkuk', 'ZEP': 'Zephaniah',
  'HAG': 'Haggai', 'ZEC': 'Zechariah', 'MAL': 'Malachi',
  'MAT': 'Matthew', 'MRK': 'Mark', 'MAR': 'Mark', 'LUK': 'Luke', 'JHN': 'John', 'JOH': 'John', 'ACT': 'Acts',
  'ROM': 'Romans', '1CO': '1 Corinthians', '2CO': '2 Corinthians',
  'GAL': 'Galatians', 'EPH': 'Ephesians', 'PHP': 'Philippians', 'PHI': 'Philippians', 'COL': 'Colossians',
  '1TH': '1 Thessalonians', '2TH': '2 Thessalonians', '1TI': '1 Timothy', '2TI': '2 Timothy',
  'TIT': 'Titus', 'PHM': 'Philemon', 'HEB': 'Hebrews', 'JAS': 'James', 'JAM': 'James',
  '1PE': '1 Peter', '2PE': '2 Peter',
  '1JN': '1 John', '1JO': '1 John', '2JN': '2 John', '2JO': '2 John', '3JN': '3 John', '3JO': '3 John',
  'JUD': 'Jude', 'REV': 'Revelation',
  'SNG': 'Song of Solomon', 'SOL': 'Song of Solomon',
}

function normalizeBookName(name) {
  return NAME_MAP[name] || name
}

/**
 * Convert scrollmapper-format source JSON to our format
 */
function convertScrollmapper(sourceFile, translationId, translationName) {
  console.log(`Converting ${translationId} from ${sourceFile}...`)
  const raw = JSON.parse(fs.readFileSync(sourceFile, 'utf-8'))
  
  const output = {
    translation: translationId,
    name: translationName,
    books: []
  }

  for (const book of raw.books) {
    const canonName = normalizeBookName(book.name)
    if (!CANONICAL_NAMES.includes(canonName)) {
      console.warn(`  Skipping unknown book: ${book.name}`)
      continue
    }

    const bookData = { name: canonName, chapters: [] }
    for (const ch of book.chapters) {
      const chapterData = {
        number: typeof ch.chapter === 'number' ? ch.chapter : parseInt(ch.chapter, 10),
        verses: []
      }
      for (const v of ch.verses) {
        chapterData.verses.push({
          number: typeof v.verse === 'number' ? v.verse : parseInt(v.verse, 10),
          text: v.text.trim()
        })
      }
      bookData.chapters.push(chapterData)
    }
    output.books.push(bookData)
  }

  // Sort books to canonical order
  output.books.sort((a, b) => CANONICAL_NAMES.indexOf(a.name) - CANONICAL_NAMES.indexOf(b.name))
  
  return output
}

/**
 * Convert LSV VPL text to our format
 */
function convertVPL(vplFile, translationId, translationName) {
  console.log(`Converting ${translationId} from ${vplFile}...`)
  const raw = fs.readFileSync(vplFile, 'utf-8')
  const lines = raw.split('\n').filter(l => l.trim())

  const booksMap = new Map()

  for (const line of lines) {
    const match = line.match(/^(\w+)\s+(\d+):(\d+)\s+(.+)$/)
    if (!match) continue

    const [, abbr, chStr, vStr, text] = match
    const bookName = VPL_BOOK_MAP[abbr]
    if (!bookName) continue

    const ch = parseInt(chStr, 10)
    const v = parseInt(vStr, 10)

    if (!booksMap.has(bookName)) booksMap.set(bookName, new Map())
    const chaptersMap = booksMap.get(bookName)
    if (!chaptersMap.has(ch)) chaptersMap.set(ch, [])
    chaptersMap.get(ch).push({ number: v, text: text.trim() })
  }

  const output = {
    translation: translationId,
    name: translationName,
    books: []
  }

  for (const canonName of CANONICAL_NAMES) {
    const chaptersMap = booksMap.get(canonName)
    if (!chaptersMap) {
      console.warn(`  Missing book: ${canonName}`)
      continue
    }

    const bookData = { name: canonName, chapters: [] }
    const sortedChs = [...chaptersMap.keys()].sort((a, b) => a - b)
    for (const chNum of sortedChs) {
      bookData.chapters.push({
        number: chNum,
        verses: chaptersMap.get(chNum).sort((a, b) => a.number - b.number)
      })
    }
    output.books.push(bookData)
  }

  return output
}

/**
 * Write a single combined JSON file for the translation (used by lazy-fetch)
 * and also per-book files for potential future optimization.
 */
function writeTranslation(data, translationId) {
  const dir = path.join(OUTPUT_DIR, translationId)
  fs.mkdirSync(dir, { recursive: true })

  // Write combined file
  const combinedJson = JSON.stringify(data)
  fs.writeFileSync(path.join(OUTPUT_DIR, `${translationId}.json`), combinedJson)
  console.log(`  Combined file: ${(combinedJson.length / 1024 / 1024).toFixed(1)} MB`)

  // Write per-book files + index
  const index = {
    translation: data.translation,
    name: data.name,
    books: data.books.map(b => ({
      name: b.name,
      chapters: b.chapters.length,
      file: `${b.name.toLowerCase().replace(/\s+/g, '-')}.json`
    }))
  }
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index))
  
  let totalSize = 0
  for (const book of data.books) {
    const slug = book.name.toLowerCase().replace(/\s+/g, '-')
    const bookFile = path.join(dir, `${slug}.json`)
    const bookJson = JSON.stringify(book)
    fs.writeFileSync(bookFile, bookJson)
    totalSize += bookJson.length
  }

  console.log(`  Per-book files: ${data.books.length} files, ${(totalSize / 1024 / 1024).toFixed(1)} MB`)
}

// --- Main ---
fs.mkdirSync(OUTPUT_DIR, { recursive: true })

// 1. BSB
const bsb = convertScrollmapper(
  path.join(SOURCES_DIR, 'BSB-source.json'),
  'BSB', 'Berean Standard Bible'
)
console.log(`  BSB: ${bsb.books.length} books, ${bsb.books.reduce((s, b) => s + b.chapters.reduce((s2, c) => s2 + c.verses.length, 0), 0)} verses`)
writeTranslation(bsb, 'BSB')

// 2. KJV
const kjv = convertScrollmapper(
  path.join(SOURCES_DIR, 'KJVPCE-source.json'),
  'KJV', 'King James Version'
)
console.log(`  KJV: ${kjv.books.length} books, ${kjv.books.reduce((s, b) => s + b.chapters.reduce((s2, c) => s2 + c.verses.length, 0), 0)} verses`)
writeTranslation(kjv, 'KJV')

// 3. LSV
const lsv = convertVPL(
  path.join(SOURCES_DIR, 'englsv_vpl', 'englsv_vpl.txt'),
  'LSV', 'Literal Standard Version'
)
console.log(`  LSV: ${lsv.books.length} books, ${lsv.books.reduce((s, b) => s + b.chapters.reduce((s2, c) => s2 + c.verses.length, 0), 0)} verses`)
writeTranslation(lsv, 'LSV')

// 4. WEB — convert existing bundled file to lazy-loadable format
const web = require('../src/data/bible-web.json')
const webData = {
  translation: 'WEB',
  name: 'World English Bible',
  books: web.books.map(b => ({
    name: b.name,
    chapters: b.chapters.map(c => ({
      number: c.number,
      verses: c.verses.map(v => ({ number: v.number, text: v.text }))
    }))
  }))
}
console.log(`  WEB: ${webData.books.length} books, ${webData.books.reduce((s, b) => s + b.chapters.reduce((s2, c) => s2 + c.verses.length, 0), 0)} verses`)
writeTranslation(webData, 'WEB')

console.log('\nDone! All translations converted.')
