#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const SOURCE_XML_DIR = path.join(__dirname, 'calvin-xml')
const GENERATED_DIR = path.join(__dirname, '..', 'public', 'data', 'commentary', 'calvin')

const BOOK_TO_CCEL = {
  'Genesis': 'Gen',
  'Exodus': 'Exod',
  'Leviticus': 'Lev',
  'Numbers': 'Num',
  'Deuteronomy': 'Deut',
  'Joshua': 'Josh',
  'Judges': 'Judg',
  'Psalms': 'Ps',
  'Isaiah': 'Isa',
  'Jeremiah': 'Jer',
  'Lamentations': 'Lam',
  'Ezekiel': 'Ezek',
  'Daniel': 'Dan',
  'Hosea': 'Hos',
  'Joel': 'Joel',
  'Amos': 'Amos',
  'Obadiah': 'Obad',
  'Jonah': 'Jonah',
  'Micah': 'Mic',
  'Nahum': 'Nah',
  'Habakkuk': 'Hab',
  'Zephaniah': 'Zeph',
  'Haggai': 'Hag',
  'Zechariah': 'Zech',
  'Malachi': 'Mal',
  'Matthew': 'Matt',
  'Mark': 'Mark',
  'Luke': 'Luke',
  'John': 'John',
  'Acts': 'Acts',
  'Romans': 'Rom',
  '1 Corinthians': '1Cor',
  '2 Corinthians': '2Cor',
  'Galatians': 'Gal',
  'Ephesians': 'Eph',
  'Philippians': 'Phil',
  'Colossians': 'Col',
  '1 Thessalonians': '1Thess',
  '2 Thessalonians': '2Thess',
  '1 Timothy': '1Tim',
  '2 Timothy': '2Tim',
  'Titus': 'Titus',
  'Philemon': 'Phlm',
  'Hebrews': 'Heb',
  'James': 'Jas',
  '1 Peter': '1Pet',
  '2 Peter': '2Pet',
  '1 John': '1John',
  '2 John': '2John',
  '3 John': '3John',
  'Jude': 'Jude',
}

function refSort(a, b) {
  const [ac, av] = a.split(':').map(Number)
  const [bc, bv] = b.split(':').map(Number)
  return ac - bc || av - bv
}

function buildSourceRefMap() {
  const refMap = new Map() // abbrev -> Set("chapter:verse")
  const scripComPattern = /<scripCom\s+[^>]*type="Commentary"[^>]*\/>/g
  const xmlFiles = fs.readdirSync(SOURCE_XML_DIR).filter(name => /^calcom\d+\.xml$/i.test(name))

  for (const xmlFile of xmlFiles) {
    const xml = fs.readFileSync(path.join(SOURCE_XML_DIR, xmlFile), 'utf-8')
    let match
    while ((match = scripComPattern.exec(xml)) !== null) {
      const tag = match[0]
      const parsed = (tag.match(/parsed="([^"]*)"/) || [])[1]
      if (!parsed) continue
      const parts = parsed.split('|').filter(Boolean)
      if (parts.length < 3) continue

      const abbrev = parts[0]
      const chapter = Number(parts[1])
      const verseStart = Number(parts[2]) || 0
      const verseEnd = Number(parts[4]) || verseStart

      if (!refMap.has(abbrev)) refMap.set(abbrev, new Set())
      const set = refMap.get(abbrev)
      for (let verse = verseStart; verse <= verseEnd; verse += 1) {
        set.add(`${chapter}:${verse}`)
      }
    }
  }

  return refMap
}

function loadGeneratedRefsForBook(bookName) {
  const file = path.join(GENERATED_DIR, `${bookName.toLowerCase().replace(/\s+/g, '-')}.json`)
  if (!fs.existsSync(file)) return null

  const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
  const commentaries = Array.isArray(data) ? data : (data.commentaries || [])
  const refs = new Set()
  for (const commentary of commentaries) {
    for (const verse of (commentary.verses || [])) {
      if (Number.isInteger(verse.chapter) && Number.isInteger(verse.verse)) {
        refs.add(`${verse.chapter}:${verse.verse}`)
      }
    }
  }
  return refs
}

function main() {
  const sourceRefMap = buildSourceRefMap()
  const abbrevToBook = new Map(Object.entries(BOOK_TO_CCEL).map(([book, abbrev]) => [abbrev, book]))

  let totalMissingVerseRefs = 0
  let totalMissingIntroRefs = 0
  let totalExtraRefs = 0
  let booksWithIssues = 0

  console.log('Calvin Commentary Source-vs-Generated Audit')
  console.log('===========================================\n')

  const sourceBooks = [...sourceRefMap.keys()].sort((a, b) => {
    const bookA = abbrevToBook.get(a) || a
    const bookB = abbrevToBook.get(b) || b
    return bookA.localeCompare(bookB)
  })

  for (const abbrev of sourceBooks) {
    const sourceRefs = sourceRefMap.get(abbrev) || new Set()
    const bookName = abbrevToBook.get(abbrev) || abbrev
    const generatedRefs = loadGeneratedRefsForBook(bookName)

    if (!generatedRefs) {
      booksWithIssues += 1
      totalMissingVerseRefs += [...sourceRefs].filter(ref => !ref.endsWith(':0')).length
      totalMissingIntroRefs += [...sourceRefs].filter(ref => ref.endsWith(':0')).length
      console.log(`✗ ${bookName}: generated JSON missing (${sourceRefs.size} source refs)`)
      continue
    }

    const missing = [...sourceRefs].filter(ref => !generatedRefs.has(ref)).sort(refSort)
    const extra = [...generatedRefs].filter(ref => !sourceRefs.has(ref)).sort(refSort)
    const missingIntro = missing.filter(ref => ref.endsWith(':0'))
    const missingVerse = missing.filter(ref => !ref.endsWith(':0'))

    totalMissingIntroRefs += missingIntro.length
    totalMissingVerseRefs += missingVerse.length
    totalExtraRefs += extra.length

    if (missingIntro.length || missingVerse.length || extra.length) {
      booksWithIssues += 1
      console.log(`- ${bookName}: missingVerse=${missingVerse.length} missingIntro=${missingIntro.length} extra=${extra.length}`)
      if (missingVerse.length) console.log(`  missingVerse sample: ${missingVerse.slice(0, 8).join(', ')}`)
      if (missingIntro.length) console.log(`  missingIntro sample: ${missingIntro.slice(0, 8).join(', ')}`)
      if (extra.length) console.log(`  extra sample: ${extra.slice(0, 8).join(', ')}`)
    }
  }

  const mattSource = sourceRefMap.get('Matt') || new Set()
  const mattGenerated = loadGeneratedRefsForBook('Matthew') || new Set()
  const matt247Source = mattSource.has('24:7')
  const matt247Generated = mattGenerated.has('24:7')
  const matt2114Source = mattSource.has('21:14')
  const matt2114Generated = mattGenerated.has('21:14')

  console.log('\nKey checks:')
  console.log(`  Matthew 24:7 source=${matt247Source} generated=${matt247Generated}`)
  console.log(`  Matthew 21:14 source=${matt2114Source} generated=${matt2114Generated}`)

  console.log('\nSummary:')
  console.log(`  Books with issues: ${booksWithIssues}`)
  console.log(`  Missing verse refs (fails): ${totalMissingVerseRefs}`)
  console.log(`  Missing intro refs (reported): ${totalMissingIntroRefs}`)
  console.log(`  Extra refs (reported): ${totalExtraRefs}`)

  if (totalMissingVerseRefs > 0) {
    console.error('\nAudit failed: non-intro source refs missing from generated output.')
    process.exit(1)
  }
}

main()
