/**
 * Convert Bible translation sources into app JSON format.
 *
 * Outputs:
 * - public/data/translations/<ID>.json
 * - public/data/translations/<ID>/<book>.json (+index.json)
 * - public/data/versification/* mapping artifacts for SYNO-W
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const SOURCES_DIR = path.join(__dirname, 'bible-sources')
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data', 'translations')
const VERSIFICATION_OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data', 'versification')

// Our canonical book names (matching bible-books.js)
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

const CANONICAL_BOOK_SET = new Set(CANONICAL_NAMES)
const BOOK_ORDER = new Map(CANONICAL_NAMES.map((name, index) => [name, index]))

// Map source book names -> canonical names
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

// VPL abbreviation -> canonical name
const VPL_BOOK_MAP = {
  'GEN': 'Genesis', 'EXO': 'Exodus', 'LEV': 'Leviticus', 'NUM': 'Numbers', 'DEU': 'Deuteronomy',
  'JOS': 'Joshua', 'JDG': 'Judges', 'RUT': 'Ruth',
  '1SA': '1 Samuel', '2SA': '2 Samuel', '1KI': '1 Kings', '2KI': '2 Kings',
  '1CH': '1 Chronicles', '2CH': '2 Chronicles', 'EZR': 'Ezra', 'NEH': 'Nehemiah',
  'EST': 'Esther', 'JOB': 'Job', 'PSA': 'Psalms', 'PRO': 'Proverbs',
  'ECC': 'Ecclesiastes', 'SNG': 'Song of Solomon', 'SOL': 'Song of Solomon',
  'ISA': 'Isaiah', 'JER': 'Jeremiah',
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
}

// JSword Synodal.properties shorthand -> canonical name
const JSWORD_BOOK_MAP = {
  Num: 'Numbers',
  Josh: 'Joshua',
  '1Sam': '1 Samuel',
  '1Kgs': '1 Kings',
  Job: 'Job',
  Ps: 'Psalms',
  Song: 'Song of Solomon',
  Eccl: 'Ecclesiastes',
  Isa: 'Isaiah',
  Dan: 'Daniel',
  Hos: 'Hosea',
  Jonah: 'Jonah',
  Rom: 'Romans',
  '2Cor': '2 Corinthians',
}

function normalizeBookName(name) {
  return NAME_MAP[name] || name
}

function countVerses(data) {
  return data.books.reduce((sum, book) => {
    return sum + book.chapters.reduce((chapterSum, chapter) => chapterSum + chapter.verses.length, 0)
  }, 0)
}

function readVplTextByBase(baseName) {
  const txtCandidates = [
    path.join(SOURCES_DIR, `${baseName}.txt`),
    path.join(SOURCES_DIR, baseName, `${baseName}.txt`),
  ]

  for (const filePath of txtCandidates) {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8')
    }
  }

  const zipPath = path.join(SOURCES_DIR, `${baseName}.zip`)
  if (fs.existsSync(zipPath)) {
    try {
      const command = `unzip -p "${zipPath}" "${baseName}.txt"`
      return execSync(command, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 300 })
    } catch (error) {
      throw new Error(`Found ${baseName}.zip but failed to extract ${baseName}.txt. Ensure unzip is installed and archive contains expected filename.`)
    }
  }

  throw new Error(
    `Missing VPL source for ${baseName}. Expected one of:\n` +
      txtCandidates.map(p => `  - ${p}`).join('\n') +
      `\n  - ${zipPath}`
  )
}

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
    if (!CANONICAL_BOOK_SET.has(canonName)) {
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
          text: String(v.text || '').trim(),
        })
      }
      bookData.chapters.push(chapterData)
    }
    output.books.push(bookData)
  }

  output.books.sort((a, b) => BOOK_ORDER.get(a.name) - BOOK_ORDER.get(b.name))
  return output
}

function convertVPLText(raw, translationId, translationName, options = {}) {
  const {
    strictCanonicalOnly = false,
    sourceLabel = translationId,
  } = options

  console.log(`Converting ${translationId} from ${sourceLabel}...`)

  const lines = raw.split('\n').filter(line => line.trim())
  const booksMap = new Map()
  const unknownAbbreviations = new Set()

  for (const line of lines) {
    const match = line.match(/^(\w+)\s+(\d+):(\d+)\s+(.+)$/)
    if (!match) continue

    const [, abbr, chapterStr, verseStr, text] = match
    const bookName = VPL_BOOK_MAP[abbr]
    if (!bookName) {
      unknownAbbreviations.add(abbr)
      continue
    }

    const chapter = parseInt(chapterStr, 10)
    const verse = parseInt(verseStr, 10)

    if (!booksMap.has(bookName)) booksMap.set(bookName, new Map())
    const chaptersMap = booksMap.get(bookName)
    if (!chaptersMap.has(chapter)) chaptersMap.set(chapter, [])
    chaptersMap.get(chapter).push({ number: verse, text: text.trim() })
  }

  if (strictCanonicalOnly && unknownAbbreviations.size > 0) {
    throw new Error(
      `${translationId}: non-canonical/unknown book abbreviations found: ${[...unknownAbbreviations].sort().join(', ')}`
    )
  }

  const output = {
    translation: translationId,
    name: translationName,
    books: []
  }

  for (const canonicalName of CANONICAL_NAMES) {
    const chaptersMap = booksMap.get(canonicalName)
    if (!chaptersMap) {
      console.warn(`  Missing book in ${translationId}: ${canonicalName}`)
      continue
    }

    const bookData = { name: canonicalName, chapters: [] }
    const sortedChapterNumbers = [...chaptersMap.keys()].sort((a, b) => a - b)

    for (const chapterNumber of sortedChapterNumbers) {
      const verses = chaptersMap
        .get(chapterNumber)
        .sort((a, b) => a.number - b.number)

      bookData.chapters.push({
        number: chapterNumber,
        verses,
      })
    }

    output.books.push(bookData)
  }

  return output
}

function convertVPLByBase(baseName, translationId, translationName, options = {}) {
  const raw = readVplTextByBase(baseName)
  return convertVPLText(raw, translationId, translationName, {
    ...options,
    sourceLabel: `${baseName}.txt|zip`,
  })
}

function writeTranslation(data, translationId) {
  const dir = path.join(OUTPUT_DIR, translationId)
  fs.mkdirSync(dir, { recursive: true })

  const combinedJson = JSON.stringify(data)
  fs.writeFileSync(path.join(OUTPUT_DIR, `${translationId}.json`), combinedJson)
  console.log(`  Combined file: ${(combinedJson.length / 1024 / 1024).toFixed(1)} MB`)

  const index = {
    translation: data.translation,
    name: data.name,
    books: data.books.map(book => ({
      name: book.name,
      chapters: book.chapters.length,
      file: `${book.name.toLowerCase().replace(/\s+/g, '-')}.json`,
    })),
  }

  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index))

  let totalSize = 0
  for (const book of data.books) {
    const slug = book.name.toLowerCase().replace(/\s+/g, '-')
    const bookJson = JSON.stringify(book)
    fs.writeFileSync(path.join(dir, `${slug}.json`), bookJson)
    totalSize += bookJson.length
  }

  console.log(`  Per-book files: ${data.books.length} files, ${(totalSize / 1024 / 1024).toFixed(1)} MB`)
}

function buildVerseCountMap(data) {
  const countMap = new Map()
  for (const book of data.books) {
    const chapterMap = new Map()
    for (const chapter of book.chapters) {
      const maxVerse = chapter.verses.reduce((max, verse) => Math.max(max, verse.number), 0)
      chapterMap.set(chapter.number, maxVerse)
    }
    countMap.set(book.name, chapterMap)
  }
  return countMap
}

function refKey(ref) {
  return `${ref.book}|${ref.chapter}|${ref.verse}`
}

function parseRefKey(key) {
  const [book, chapter, verse] = key.split('|')
  return { book, chapter: Number(chapter), verse: Number(verse) }
}

function compareRef(a, b) {
  const bookDelta = (BOOK_ORDER.get(a.book) || 0) - (BOOK_ORDER.get(b.book) || 0)
  if (bookDelta !== 0) return bookDelta
  if (a.chapter !== b.chapter) return a.chapter - b.chapter
  return a.verse - b.verse
}

function parseMappingReference(token) {
  const trimmed = token.trim()
  if (!trimmed || trimmed.startsWith('?') || trimmed.startsWith('#')) return null

  const match = trimmed.match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)(?:![A-Za-z0-9]+)?$/)
  if (!match) {
    throw new Error(`Unsupported mapping reference token: ${token}`)
  }

  const [, jswordBook, chapterStr, verseStr] = match
  const canonicalBook = JSWORD_BOOK_MAP[jswordBook]
  if (!canonicalBook) {
    throw new Error(`Unknown JSword book code in mapping: ${jswordBook}`)
  }

  return {
    book: canonicalBook,
    chapter: parseInt(chapterStr, 10),
    verse: parseInt(verseStr, 10),
    raw: trimmed,
  }
}

function getChapterMaxVerse(verseCountMap, book, chapter) {
  const chapterMap = verseCountMap.get(book)
  if (!chapterMap) return null
  return chapterMap.get(chapter) || null
}

function expandRange(startRef, endRef, verseCountMap) {
  if (startRef.book !== endRef.book) {
    return [startRef, endRef]
  }

  if (compareRef(startRef, endRef) > 0) {
    return [startRef, endRef]
  }

  const refs = []

  for (let chapter = startRef.chapter; chapter <= endRef.chapter; chapter += 1) {
    const chapterMax = getChapterMaxVerse(verseCountMap, startRef.book, chapter)
    const defaultStart = chapter === startRef.chapter ? startRef.verse : 1
    const defaultEnd = chapter === endRef.chapter ? endRef.verse : (chapterMax || endRef.verse)

    const verseStart = defaultStart
    const verseEnd = defaultEnd

    for (let verse = verseStart; verse <= verseEnd; verse += 1) {
      refs.push({ book: startRef.book, chapter, verse })
    }
  }

  return refs
}

function expandMappingExpression(sideExpression, verseCountMap) {
  const tokens = sideExpression.split('-').map(token => token.trim()).filter(Boolean)
  const parsed = tokens.map(parseMappingReference).filter(Boolean)

  if (parsed.length <= 1) return parsed

  if (parsed.length === 2) {
    const [startRef, endRef] = parsed
    return expandRange(startRef, endRef, verseCountMap)
  }

  return parsed
}

function parseSynodalMappingRules(filePath, nativeVerseCountMap, canonicalVerseCountMap) {
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/)
  const rules = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('#')) continue

    const parts = trimmed.split('=')
    if (parts.length !== 2) continue

    const [leftExpression, rightExpression] = parts
    const sourceRefs = expandMappingExpression(leftExpression, nativeVerseCountMap)
    const targetRefs = expandMappingExpression(rightExpression, canonicalVerseCountMap)

    if (sourceRefs.length === 0) continue

    rules.push({
      sourceRefs,
      targetRefs,
      raw: trimmed,
    })
  }

  return rules
}

function allocateTargetsToSources(sourceRefs, targetRefs) {
  if (sourceRefs.length === 0) return []
  if (targetRefs.length === 0) return sourceRefs.map(sourceRef => ({ sourceRef, targetRefs: [] }))

  if (sourceRefs.length === 1) {
    return [{ sourceRef: sourceRefs[0], targetRefs }]
  }

  if (targetRefs.length === 1) {
    return sourceRefs.map(sourceRef => ({ sourceRef, targetRefs: [targetRefs[0]] }))
  }

  const buckets = Array.from({ length: sourceRefs.length }, () => [])

  // First distribute all canonical refs to nearest source index to guarantee full target coverage.
  for (let targetIndex = 0; targetIndex < targetRefs.length; targetIndex += 1) {
    const sourceIndex = Math.round((targetIndex * (sourceRefs.length - 1)) / (targetRefs.length - 1))
    buckets[sourceIndex].push(targetRefs[targetIndex])
  }

  // Ensure every source maps to at least one target.
  for (let sourceIndex = 0; sourceIndex < sourceRefs.length; sourceIndex += 1) {
    if (buckets[sourceIndex].length > 0) continue
    const targetIndex = Math.round((sourceIndex * (targetRefs.length - 1)) / (sourceRefs.length - 1))
    buckets[sourceIndex].push(targetRefs[targetIndex])
  }

  return sourceRefs.map((sourceRef, index) => ({ sourceRef, targetRefs: buckets[index] }))
}

function buildSynodalWesternRemap({
  synodalNativeData,
  canonicalTemplateData,
  mappingRules,
}) {
  const canonicalRefSet = new Set()
  const canonicalChapterRefs = new Map()

  for (const book of canonicalTemplateData.books) {
    for (const chapter of book.chapters) {
      const chapterKey = `${book.name}|${chapter.number}`
      const chapterRefs = []
      for (const verse of chapter.verses) {
        const ref = { book: book.name, chapter: chapter.number, verse: verse.number }
        const key = refKey(ref)
        canonicalRefSet.add(key)
        chapterRefs.push(ref)
      }
      canonicalChapterRefs.set(chapterKey, chapterRefs)
    }
  }

  const nativeVerseMap = new Map()
  const nativeRefSet = new Set()
  const nativeChapterRefs = new Map()
  for (const book of synodalNativeData.books) {
    for (const chapter of book.chapters) {
      const chapterKey = `${book.name}|${chapter.number}`
      const chapterRefs = []
      for (const verse of chapter.verses) {
        const ref = { book: book.name, chapter: chapter.number, verse: verse.number }
        const key = refKey(ref)
        nativeRefSet.add(key)
        nativeVerseMap.set(key, verse.text)
        chapterRefs.push(ref)
      }
      nativeChapterRefs.set(chapterKey, chapterRefs)
    }
  }

  const nativeToCanonical = new Map()
  // Default chapter-level alignment (handles chapter verse-count drift).
  for (const [chapterKey, sourceRefs] of nativeChapterRefs.entries()) {
    const targetRefs = canonicalChapterRefs.get(chapterKey) || []
    const allocation = allocateTargetsToSources(sourceRefs, targetRefs)
    for (const pair of allocation) {
      nativeToCanonical.set(
        refKey(pair.sourceRef),
        new Set(pair.targetRefs.map(targetRef => refKey(targetRef)).filter(targetKey => canonicalRefSet.has(targetKey)))
      )
    }
  }

  const rulesApplied = []
  const ruleMissingSourceRefs = []

  for (const rule of mappingRules) {
    const allocation = allocateTargetsToSources(rule.sourceRefs, rule.targetRefs)

    let appliedForRule = false

    for (const pair of allocation) {
      const sourceKey = refKey(pair.sourceRef)
      if (!nativeRefSet.has(sourceKey)) {
        ruleMissingSourceRefs.push({ rule: rule.raw, source: sourceKey })
        continue
      }

      const filteredCanonicalTargets = pair.targetRefs
        .map(targetRef => refKey(targetRef))
        .filter(targetKey => canonicalRefSet.has(targetKey))

      nativeToCanonical.set(sourceKey, new Set(filteredCanonicalTargets))
      appliedForRule = true
    }

    if (appliedForRule) rulesApplied.push(rule.raw)
  }

  const canonicalToNative = new Map()
  for (const canonicalKey of canonicalRefSet) canonicalToNative.set(canonicalKey, new Set())

  const droppedNativeRefs = []

  for (const nativeKey of nativeRefSet) {
    const targets = nativeToCanonical.get(nativeKey) || new Set()
    if (targets.size === 0) {
      droppedNativeRefs.push(nativeKey)
      continue
    }
    for (const canonicalKey of targets) {
      if (!canonicalToNative.has(canonicalKey)) canonicalToNative.set(canonicalKey, new Set())
      canonicalToNative.get(canonicalKey).add(nativeKey)
    }
  }

  // Materialize SYNO-W text in canonical order.
  const canonicalTextBuckets = new Map()
  for (const canonicalKey of canonicalRefSet) canonicalTextBuckets.set(canonicalKey, [])

  for (const nativeKey of nativeRefSet) {
    const verseText = nativeVerseMap.get(nativeKey)
    const targets = nativeToCanonical.get(nativeKey) || new Set()
    for (const canonicalKey of targets) {
      canonicalTextBuckets.get(canonicalKey).push(verseText)
    }
  }

  const missingCanonicalRefs = []
  const fallbackIdentityRefs = []

  const synoWestern = {
    translation: 'SYNO-W',
    name: 'Russian Synodal (Western Aligned)',
    books: canonicalTemplateData.books.map(book => ({
      name: book.name,
      chapters: book.chapters.map(chapter => ({
        number: chapter.number,
        verses: chapter.verses.map(verse => {
          const key = refKey({ book: book.name, chapter: chapter.number, verse: verse.number })
          const bucket = canonicalTextBuckets.get(key) || []

          if (bucket.length === 0) {
            const identityFallbackText = nativeVerseMap.get(key)
            if (identityFallbackText) {
              fallbackIdentityRefs.push(key)
              return { number: verse.number, text: identityFallbackText }
            }

            missingCanonicalRefs.push(key)
            return { number: verse.number, text: '' }
          }

          const text = bucket.length === 1 ? bucket[0] : bucket.join(' ')
          return { number: verse.number, text }
        }),
      })),
    })),
  }

  const unresolvedNativeRefs = []
  for (const nativeKey of nativeRefSet) {
    const mapped = nativeToCanonical.get(nativeKey)
    if (!mapped || mapped.size > 0) continue
    unresolvedNativeRefs.push(nativeKey)
  }

  const emptyVersesInOutput = []
  for (const book of synoWestern.books) {
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        if (verse.text) continue
        emptyVersesInOutput.push(refKey({ book: book.name, chapter: chapter.number, verse: verse.number }))
      }
    }
  }

  const nativeToCanonicalObj = {}
  for (const [sourceKey, targetSet] of nativeToCanonical.entries()) {
    nativeToCanonicalObj[sourceKey] = [...targetSet]
  }

  const canonicalToNativeObj = {}
  for (const [canonicalKey, nativeSet] of canonicalToNative.entries()) {
    canonicalToNativeObj[canonicalKey] = [...nativeSet]
  }

  const report = {
    generatedAt: new Date().toISOString(),
    sourceVersification: 'Synodal',
    targetVersification: 'western',
    nativeVerseCount: nativeRefSet.size,
    canonicalVerseCount: canonicalRefSet.size,
    rulesProvided: mappingRules.length,
    rulesApplied: rulesApplied.length,
    ruleMissingSourceRefsCount: ruleMissingSourceRefs.length,
    unresolvedNativeRefsCount: unresolvedNativeRefs.length,
    droppedNativeRefsCount: droppedNativeRefs.length,
    missingCanonicalRefsCount: missingCanonicalRefs.length,
    emptyOutputVersesCount: emptyVersesInOutput.length,
    fallbackIdentityRefsCount: fallbackIdentityRefs.length,
    samples: {
      ruleMissingSourceRefs: ruleMissingSourceRefs.slice(0, 30),
      unresolvedNativeRefs: unresolvedNativeRefs.slice(0, 60),
      droppedNativeRefs: droppedNativeRefs.slice(0, 60),
      missingCanonicalRefs: missingCanonicalRefs.slice(0, 60),
      emptyOutputVerses: emptyVersesInOutput.slice(0, 60),
      fallbackIdentityRefs: fallbackIdentityRefs.slice(0, 30),
    },
  }

  const hasBlockingErrors =
    report.missingCanonicalRefsCount > 0 ||
    report.emptyOutputVersesCount > 0

  return {
    synoWestern,
    nativeToCanonical: nativeToCanonicalObj,
    canonicalToNative: canonicalToNativeObj,
    report,
    hasBlockingErrors,
  }
}

function ensureCanonical66Books(data, translationId) {
  const bookNames = data.books.map(book => book.name)
  const unknown = bookNames.filter(name => !CANONICAL_BOOK_SET.has(name))
  if (unknown.length > 0) {
    throw new Error(`${translationId}: contains non-canonical books: ${unknown.join(', ')}`)
  }
  if (bookNames.length !== 66) {
    throw new Error(`${translationId}: expected 66 books, got ${bookNames.length}`)
  }
}

function writeJsonFile(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(payload))
}

function logTranslationSummary(data, id) {
  console.log(`  ${id}: ${data.books.length} books, ${countVerses(data)} verses`)
}

// --- Main ---
fs.mkdirSync(OUTPUT_DIR, { recursive: true })
fs.mkdirSync(VERSIFICATION_OUTPUT_DIR, { recursive: true })

// 1. BSB
const bsb = convertScrollmapper(
  path.join(SOURCES_DIR, 'BSB-source.json'),
  'BSB',
  'Berean Standard Bible'
)
logTranslationSummary(bsb, 'BSB')
writeTranslation(bsb, 'BSB')

// 2. KJV
const kjv = convertScrollmapper(
  path.join(SOURCES_DIR, 'KJVPCE-source.json'),
  'KJV',
  'King James Version'
)
logTranslationSummary(kjv, 'KJV')
writeTranslation(kjv, 'KJV')

// 3. LSV
const lsv = convertVPLByBase('englsv_vpl', 'LSV', 'Literal Standard Version')
logTranslationSummary(lsv, 'LSV')
writeTranslation(lsv, 'LSV')

// 4. WEB (from source file if present, otherwise existing generated WEB.json)
const webSourceCandidates = [
  path.join(__dirname, '..', 'src', 'data', 'bible-web.json'),
  path.join(OUTPUT_DIR, 'WEB.json'),
]
const webSourceFile = webSourceCandidates.find(candidate => fs.existsSync(candidate))
if (!webSourceFile) {
  throw new Error(`Missing WEB source JSON. Checked: ${webSourceCandidates.join(', ')}`)
}
const webRaw = JSON.parse(fs.readFileSync(webSourceFile, 'utf-8'))
const webData = {
  translation: 'WEB',
  name: 'World English Bible',
  books: (webRaw.books || []).map(book => ({
    name: book.name,
    chapters: (book.chapters || []).map(chapter => ({
      number: chapter.number,
      verses: (chapter.verses || []).map(verse => ({ number: verse.number, text: verse.text })),
    })),
  })),
}
logTranslationSummary(webData, 'WEB')
writeTranslation(webData, 'WEB')

// 5. UKRK (ukr1871 source)
const ukrk = convertVPLByBase('ukr1871_vpl', 'UKRK', 'Ukrainian Kulish/Pulyui (ukr1871)', {
  strictCanonicalOnly: true,
})
ensureCanonical66Books(ukrk, 'UKRK')
logTranslationSummary(ukrk, 'UKRK')
writeTranslation(ukrk, 'UKRK')

// 6. SYNO native + SYNO-W remap
const synoNative = convertVPLByBase('russyn_vpl', 'SYNO-NATIVE', 'Russian Synodal (Native)', {
  strictCanonicalOnly: true,
})
ensureCanonical66Books(synoNative, 'SYNO-NATIVE')
logTranslationSummary(synoNative, 'SYNO-NATIVE')
writeJsonFile(path.join(OUTPUT_DIR, 'SYNO-W-native.json'), synoNative)

const mappingRules = parseSynodalMappingRules(
  path.join(SOURCES_DIR, 'Synodal.properties'),
  buildVerseCountMap(synoNative),
  buildVerseCountMap(lsv)
)

const remapResult = buildSynodalWesternRemap({
  synodalNativeData: synoNative,
  canonicalTemplateData: lsv,
  mappingRules,
})

const synoWestern = remapResult.synoWestern
ensureCanonical66Books(synoWestern, 'SYNO-W')
logTranslationSummary(synoWestern, 'SYNO-W')
writeTranslation(synoWestern, 'SYNO-W')

const nativeToCanonicalPayload = {
  translation: 'SYNO-W',
  sourceTranslation: 'SYNO-NATIVE',
  direction: 'native-to-canonical',
  versification: { from: 'Synodal', to: 'western' },
  map: remapResult.nativeToCanonical,
}

const canonicalToNativePayload = {
  translation: 'SYNO-W',
  sourceTranslation: 'SYNO-NATIVE',
  direction: 'canonical-to-native',
  versification: { from: 'western', to: 'Synodal' },
  map: remapResult.canonicalToNative,
}

writeJsonFile(path.join(VERSIFICATION_OUTPUT_DIR, 'SYNO-W.native-to-canonical.json'), nativeToCanonicalPayload)
writeJsonFile(path.join(VERSIFICATION_OUTPUT_DIR, 'SYNO-W.canonical-to-native.json'), canonicalToNativePayload)
writeJsonFile(path.join(VERSIFICATION_OUTPUT_DIR, 'SYNO-W.validation-report.json'), remapResult.report)

console.log(`  SYNO-W mapping: ${Object.keys(remapResult.nativeToCanonical).length} native refs`) 
console.log(`  SYNO-W validation: missingCanonical=${remapResult.report.missingCanonicalRefsCount}, droppedNative=${remapResult.report.droppedNativeRefsCount}`)

if (remapResult.hasBlockingErrors) {
  throw new Error(
    `SYNO-W remap validation failed. See ${path.join(VERSIFICATION_OUTPUT_DIR, 'SYNO-W.validation-report.json')}`
  )
}

console.log('\nDone! All translations converted.')
