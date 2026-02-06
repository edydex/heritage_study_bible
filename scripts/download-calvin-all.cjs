#!/usr/bin/env node
/**
 * Download and parse all of Calvin's commentaries from CCEL.
 * 
 * Usage:
 *   node scripts/download-calvin-all.cjs [--skip-download]
 * 
 * This downloads each XML volume, then runs the parser to create per-book JSON files.
 */

const fs = require('fs')
const path = require('path')
const https = require('https')

// CCEL volume mapping: calcom## -> Bible book
// Some books span multiple volumes, which we'll combine
const VOLUME_MAP = [
  // Genesis
  { vol: 'calcom01', book: 'Genesis', ccelAbbrev: 'Gen' },
  { vol: 'calcom02', book: 'Genesis', ccelAbbrev: 'Gen' },
  // Harmony of the Law (Exodus-Deuteronomy) - thematic but has verse-level scripCom tags
  { vol: 'calcom03', book: 'Exodus', ccelAbbrev: 'Exod' },
  { vol: 'calcom04', book: 'Exodus', ccelAbbrev: 'Exod' },
  { vol: 'calcom05', book: 'Exodus', ccelAbbrev: 'Exod' },
  { vol: 'calcom06', book: 'Exodus', ccelAbbrev: 'Exod' },
  { vol: 'calcom03', book: 'Leviticus', ccelAbbrev: 'Lev' },
  { vol: 'calcom04', book: 'Leviticus', ccelAbbrev: 'Lev' },
  { vol: 'calcom05', book: 'Leviticus', ccelAbbrev: 'Lev' },
  { vol: 'calcom06', book: 'Leviticus', ccelAbbrev: 'Lev' },
  { vol: 'calcom03', book: 'Numbers', ccelAbbrev: 'Num' },
  { vol: 'calcom04', book: 'Numbers', ccelAbbrev: 'Num' },
  { vol: 'calcom05', book: 'Numbers', ccelAbbrev: 'Num' },
  { vol: 'calcom06', book: 'Numbers', ccelAbbrev: 'Num' },
  { vol: 'calcom03', book: 'Deuteronomy', ccelAbbrev: 'Deut' },
  { vol: 'calcom04', book: 'Deuteronomy', ccelAbbrev: 'Deut' },
  { vol: 'calcom05', book: 'Deuteronomy', ccelAbbrev: 'Deut' },
  { vol: 'calcom06', book: 'Deuteronomy', ccelAbbrev: 'Deut' },
  // Joshua
  { vol: 'calcom07', book: 'Joshua', ccelAbbrev: 'Josh' },
  // Psalms
  { vol: 'calcom08', book: 'Psalms', ccelAbbrev: 'Ps' },
  { vol: 'calcom09', book: 'Psalms', ccelAbbrev: 'Ps' },
  { vol: 'calcom10', book: 'Psalms', ccelAbbrev: 'Ps' },
  { vol: 'calcom11', book: 'Psalms', ccelAbbrev: 'Ps' },
  { vol: 'calcom12', book: 'Psalms', ccelAbbrev: 'Ps' },
  // Isaiah
  { vol: 'calcom13', book: 'Isaiah', ccelAbbrev: 'Isa' },
  { vol: 'calcom14', book: 'Isaiah', ccelAbbrev: 'Isa' },
  { vol: 'calcom15', book: 'Isaiah', ccelAbbrev: 'Isa' },
  { vol: 'calcom16', book: 'Isaiah', ccelAbbrev: 'Isa' },
  // Jeremiah & Lamentations
  { vol: 'calcom17', book: 'Jeremiah', ccelAbbrev: 'Jer' },
  { vol: 'calcom18', book: 'Jeremiah', ccelAbbrev: 'Jer' },
  { vol: 'calcom19', book: 'Jeremiah', ccelAbbrev: 'Jer' },
  { vol: 'calcom20', book: 'Jeremiah', ccelAbbrev: 'Jer' },
  { vol: 'calcom21', book: 'Lamentations', ccelAbbrev: 'Lam' },
  // Ezekiel (chapters 1-20)
  { vol: 'calcom22', book: 'Ezekiel', ccelAbbrev: 'Ezek' },
  { vol: 'calcom23', book: 'Ezekiel', ccelAbbrev: 'Ezek' },
  // Daniel
  { vol: 'calcom24', book: 'Daniel', ccelAbbrev: 'Dan' },
  { vol: 'calcom25', book: 'Daniel', ccelAbbrev: 'Dan' },
  // Minor Prophets
  { vol: 'calcom26', book: 'Hosea', ccelAbbrev: 'Hos' },
  { vol: 'calcom27', book: 'Joel', ccelAbbrev: 'Joel' }, // Joel, Amos, Obadiah
  { vol: 'calcom28', book: 'Jonah', ccelAbbrev: 'Jonah' }, // Jonah, Micah, Nahum
  { vol: 'calcom29', book: 'Habakkuk', ccelAbbrev: 'Hab' }, // Habakkuk, Zephaniah, Haggai  
  { vol: 'calcom30', book: 'Zechariah', ccelAbbrev: 'Zech' }, // Zechariah, Malachi
  // Harmony of Gospels (Matthew, Mark, Luke) - cross-referenced to all three
  { vol: 'calcom31', book: 'Matthew', ccelAbbrev: 'Matt' },
  { vol: 'calcom32', book: 'Matthew', ccelAbbrev: 'Matt' },
  { vol: 'calcom33', book: 'Matthew', ccelAbbrev: 'Matt' },
  { vol: 'calcom31', book: 'Mark', ccelAbbrev: 'Mark' },
  { vol: 'calcom32', book: 'Mark', ccelAbbrev: 'Mark' },
  { vol: 'calcom33', book: 'Mark', ccelAbbrev: 'Mark' },
  { vol: 'calcom31', book: 'Luke', ccelAbbrev: 'Luke' },
  { vol: 'calcom32', book: 'Luke', ccelAbbrev: 'Luke' },
  { vol: 'calcom33', book: 'Luke', ccelAbbrev: 'Luke' },
  // Gospel of John
  { vol: 'calcom34', book: 'John', ccelAbbrev: 'John' },
  { vol: 'calcom35', book: 'John', ccelAbbrev: 'John' },
  // Acts
  { vol: 'calcom36', book: 'Acts', ccelAbbrev: 'Acts' },
  { vol: 'calcom37', book: 'Acts', ccelAbbrev: 'Acts' },
  // Romans
  { vol: 'calcom38', book: 'Romans', ccelAbbrev: 'Rom' },
  // Corinthians
  { vol: 'calcom39', book: '1 Corinthians', ccelAbbrev: '1Cor' },
  { vol: 'calcom40', book: '2 Corinthians', ccelAbbrev: '2Cor' },
  // Galatians & Ephesians
  { vol: 'calcom41', book: 'Galatians', ccelAbbrev: 'Gal' },
  // Philippians, Colossians, Thessalonians
  { vol: 'calcom42', book: 'Philippians', ccelAbbrev: 'Phil' },
  // Timothy, Titus, Philemon
  { vol: 'calcom43', book: '1 Timothy', ccelAbbrev: '1Tim' },
  // Hebrews
  { vol: 'calcom44', book: 'Hebrews', ccelAbbrev: 'Heb' },
  // Catholic Epistles
  { vol: 'calcom45', book: 'James', ccelAbbrev: 'Jas' },
]

// Additional books contained in shared volumes
// (minor prophets and epistles where one volume has multiple books)
const MULTI_BOOK_VOLUMES = {
  'calcom03': ['Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'],
  'calcom04': ['Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'],
  'calcom05': ['Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'],
  'calcom06': ['Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'],
  'calcom27': ['Joel', 'Amos', 'Obadiah'],
  'calcom28': ['Jonah', 'Micah', 'Nahum'],
  'calcom29': ['Habakkuk', 'Zephaniah', 'Haggai'],
  'calcom30': ['Zechariah', 'Malachi'],
  'calcom31': ['Matthew', 'Mark', 'Luke'],
  'calcom32': ['Matthew', 'Mark', 'Luke'],
  'calcom33': ['Matthew', 'Mark', 'Luke'],
  'calcom39': ['1 Corinthians'],
  'calcom40': ['2 Corinthians'],
  'calcom41': ['Galatians', 'Ephesians'],
  'calcom42': ['Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians'],
  'calcom43': ['1 Timothy', '2 Timothy', 'Titus', 'Philemon'],
  'calcom45': ['James', '1 Peter', '2 Peter', '1 John', 'Jude'],
}

const BOOK_TO_CCEL = {
  'Genesis': 'Gen', 'Exodus': 'Exod', 'Leviticus': 'Lev', 'Numbers': 'Num',
  'Deuteronomy': 'Deut', 'Joshua': 'Josh', 'Judges': 'Judg',
  'Psalms': 'Ps', 'Isaiah': 'Isa', 'Jeremiah': 'Jer', 'Lamentations': 'Lam',
  'Ezekiel': 'Ezek', 'Daniel': 'Dan', 'Hosea': 'Hos', 'Joel': 'Joel',
  'Amos': 'Amos', 'Obadiah': 'Obad', 'Jonah': 'Jonah', 'Micah': 'Mic',
  'Nahum': 'Nah', 'Habakkuk': 'Hab', 'Zephaniah': 'Zeph', 'Haggai': 'Hag',
  'Zechariah': 'Zech', 'Malachi': 'Mal',
  'Matthew': 'Matt', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John',
  'Acts': 'Acts', 'Romans': 'Rom', '1 Corinthians': '1Cor', '2 Corinthians': '2Cor',
  'Galatians': 'Gal', 'Ephesians': 'Eph', 'Philippians': 'Phil', 'Colossians': 'Col',
  '1 Thessalonians': '1Thess', '2 Thessalonians': '2Thess',
  '1 Timothy': '1Tim', '2 Timothy': '2Tim', 'Titus': 'Titus', 'Philemon': 'Phlm',
  'Hebrews': 'Heb', 'James': 'Jas', '1 Peter': '1Pet', '2 Peter': '2Pet',
  '1 John': '1John', '2 John': '2John', '3 John': '3John', 'Jude': 'Jude'
}

const DOWNLOAD_DIR = path.join(__dirname, 'calvin-xml')
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data', 'commentary', 'calvin')

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath)
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close()
        fs.unlinkSync(filepath)
        return downloadFile(response.headers.location, filepath).then(resolve).catch(reject)
      }
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
    }).on('error', (err) => {
      file.close()
      fs.unlinkSync(filepath)
      reject(err)
    })
  })
}

/**
 * Strip HTML/XML tags and decode entities, but preserve nothing structural.
 * Used for inner content after we've already extracted structural markers.
 */
function stripTags(html) {
  if (!html) return ''
  return html
    .replace(/<note[^>]*>[\s\S]*?<\/note>/gi, '')
    .replace(/<scripRef[^>]*>([\s\S]*?)<\/scripRef>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#\d+;/g, (match) => {
      const code = parseInt(match.slice(2, -1))
      return String.fromCharCode(code)
    })
    .replace(/â€œ/g, '\u201C')
    .replace(/â€\u009D/g, '\u201D')
    .replace(/â€™/g, '\u2019')
    .replace(/â€˜/g, '\u2018')
    .replace(/â€"/g, '\u2014')
    .replace(/â€"/g, '\u2013')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Process a paragraph from a Commentary div, preserving structural markup:
 * 
 * 1. Leading "<b>N.</b> <i>quote text</i>" → wrapped in <vq>...</vq>
 * 2. Leading "<i>quote text</i>" (subsequent paragraphs) → wrapped in <vq>...</vq>
 * 3. <p class="SCRIPTURE"> → entire content wrapped in <sq>...</sq>
 * 
 * Everything else is stripped to plain text.
 */
function processCommentaryParagraph(pTag, pContent, isScripture) {
  // Step 1: Remove footnotes first (they contain nested <p> and confuse things)
  let html = pContent.replace(/<note[^>]*>[\s\S]*?<\/note>/gi, '')

  // Step 2: If this is a SCRIPTURE paragraph, wrap the whole thing
  if (isScripture) {
    return '<sq>' + stripTags(html) + '</sq>'
  }

  // Step 3: Detect leading verse-quote pattern
  // Pattern A: <b>N.</b> <i>quote text</i> (first paragraph of an entry)
  // Pattern B: <i>quote text</i> at the very start (subsequent paragraphs)
  // Note: some entries have <a id="..."/> anchor tags before <b>, so we skip those
  
  // Try Pattern A: bold verse number + italic quote
  const patternA = /^(\s*(?:<a[^>]*\/?>)?\s*<b>([\d,.\s-]+\.?)<\/b>\s*<i>([\s\S]*?)<\/i>)/i
  const matchA = html.match(patternA)
  if (matchA) {
    const verseNum = stripTags(matchA[2]).trim()
    const quoteText = stripTags(matchA[3]).trim()
    const remainder = html.substring(matchA[0].length)
    const cleanRemainder = stripTags(remainder).trim()
    const vqPart = '<vq>' + verseNum + ' ' + quoteText + '</vq>'
    return cleanRemainder ? vqPart + ' ' + cleanRemainder : vqPart
  }

  // Try Pattern B: italic quote at the start (no bold number)
  const patternB = /^(\s*(?:<a[^>]*\/?>)?\s*<i>([\s\S]*?)<\/i>)/i
  const matchB = html.match(patternB)
  if (matchB) {
    const quoteText = stripTags(matchB[2]).trim()
    // Only treat it as a verse quote if it's short-ish and looks like a quote
    // (avoid marking long italic passages that are emphasis, not verse quotes)
    if (quoteText.length > 0 && quoteText.length < 200) {
      const remainder = html.substring(matchB[0].length)
      const cleanRemainder = stripTags(remainder).trim()
      const vqPart = '<vq>' + quoteText + '</vq>'
      return cleanRemainder ? vqPart + ' ' + cleanRemainder : vqPart
    }
  }

  // No structural pattern detected — just strip tags
  return stripTags(html)
}

function parsePassage(passage, parsedAttr) {
  if (parsedAttr) {
    const parts = parsedAttr.split('|').filter(Boolean)
    if (parts.length >= 3) {
      const book = parts[0]
      const chapter = parseInt(parts[1])
      const verseStart = parseInt(parts[2]) || 0
      const endVerse = parseInt(parts[4]) || verseStart
      return { book, chapter, verseStart, verseEnd: endVerse || verseStart }
    }
  }
  return null
}

/**
 * Parse commentary from XML for a specific CCEL book abbreviation.
 * Handles both attribute orders:
 *   <scripCom type="Commentary" passage="Ro 1:1" ... parsed="..." />
 *   <scripCom id="..." osisRef="..." parsed="..." passage="..." type="Commentary" />
 */
function parseForBook(xmlContent, targetAbbrev, bookName) {
  const commentaries = []
  
  // Match any scripCom with type="Commentary" regardless of attribute order
  const scripComPattern = /<scripCom\s+[^>]*type="Commentary"[^>]*\/>/g
  const markers = []
  let m
  while ((m = scripComPattern.exec(xmlContent)) !== null) {
    const tag = m[0]
    const passageMatch = tag.match(/passage="([^"]+)"/)
    const parsedMatch = tag.match(/parsed="([^"]*)"/)
    if (!passageMatch) continue
    markers.push({
      passage: passageMatch[1],
      parsed: parsedMatch ? parsedMatch[1] : '',
      index: m.index,
      endIndex: m.index + m[0].length
    })
  }

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i]
    const parsed = parsePassage(marker.passage, marker.parsed)
    if (!parsed) continue
    if (parsed.book !== targetAbbrev) continue

    const isChapterIntro = parsed.verseStart === 0
    const searchStart = marker.endIndex
    const searchEnd = (i < markers.length - 1) ? markers[i + 1].index : xmlContent.length
    const segment = xmlContent.substring(searchStart, searchEnd)

    const divMatch = segment.match(/<div\s+class="Commentary"[^>]*>([\s\S]*?)<\/div>/)
    if (!divMatch) continue

    const paragraphs = []
    const pPattern = /<p([^>]*)>([\s\S]*?)<\/p>/g
    let pMatch
    while ((pMatch = pPattern.exec(divMatch[1])) !== null) {
      const pAttrs = pMatch[1]
      const pContent = pMatch[2]
      const isScripture = /class="SCRIPTURE"/i.test(pAttrs)
      // Skip footnote-only paragraphs (class="Footnote" or class="Super")
      if (/class="Footnote"|class="Super"/i.test(pAttrs)) continue
      const text = processCommentaryParagraph(pAttrs, pContent, isScripture)
      if (text && text.replace(/<\/?[vs]q>/g, '').trim().length > 5) paragraphs.push(text)
    }
    if (paragraphs.length === 0) continue

    const verses = []
    if (isChapterIntro) {
      verses.push({ chapter: parsed.chapter, verse: 0 })
    } else {
      for (let v = parsed.verseStart; v <= parsed.verseEnd; v++) {
        verses.push({ chapter: parsed.chapter, verse: v })
      }
    }

    const slug = bookName.toLowerCase().replace(/\s+/g, '')
    const verseRef = isChapterIntro
      ? `${parsed.chapter} (Introduction)`
      : parsed.verseStart === parsed.verseEnd
        ? `${parsed.chapter}:${parsed.verseStart}`
        : `${parsed.chapter}:${parsed.verseStart}-${parsed.verseEnd}`

    commentaries.push({
      id: `calvin_${slug}_${parsed.chapter}_${parsed.verseStart}`,
      reference: `${bookName} ${verseRef}`,
      chapter: parsed.chapter,
      verses,
      text: paragraphs.join('\n\n'),
      ...(isChapterIntro ? { isIntro: true } : {})
    })
  }

  return commentaries
}

async function main() {
  const skipDownload = process.argv.includes('--skip-download')
  
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  // Get unique volume IDs
  const uniqueVols = [...new Set(VOLUME_MAP.map(v => v.vol))]
  
  // Step 1: Download XML files
  if (!skipDownload) {
    console.log(`\n📥 Downloading ${uniqueVols.length} Calvin commentary volumes from CCEL...\n`)
    for (const vol of uniqueVols) {
      const xmlPath = path.join(DOWNLOAD_DIR, `${vol}.xml`)
      if (fs.existsSync(xmlPath)) {
        console.log(`  ✓ ${vol}.xml (cached)`)
        continue
      }
      const url = `https://ccel.org/ccel/c/calvin/${vol}.xml`
      console.log(`  ↓ Downloading ${vol}.xml...`)
      try {
        await downloadFile(url, xmlPath)
        const size = (fs.statSync(xmlPath).size / 1024 / 1024).toFixed(1)
        console.log(`    ✓ ${size} MB`)
      } catch (err) {
        console.error(`    ✗ Failed: ${err.message}`)
      }
    }
  }

  // Step 2: Parse each book
  console.log(`\n📖 Parsing commentary for each Bible book...\n`)
  
  // Build the list of all books to extract, handling multi-book volumes
  const booksToExtract = new Map() // bookName -> [{ vol, ccelAbbrev }]
  
  for (const entry of VOLUME_MAP) {
    const multiBooks = MULTI_BOOK_VOLUMES[entry.vol]
    if (multiBooks) {
      for (const book of multiBooks) {
        if (!booksToExtract.has(book)) booksToExtract.set(book, [])
        booksToExtract.get(book).push({ vol: entry.vol, ccelAbbrev: BOOK_TO_CCEL[book] })
      }
    } else {
      if (!booksToExtract.has(entry.book)) booksToExtract.set(entry.book, [])
      booksToExtract.get(entry.book).push({ vol: entry.vol, ccelAbbrev: entry.ccelAbbrev })
    }
  }

  const results = []
  
  for (const [bookName, volumes] of booksToExtract) {
    const ccelAbbrev = BOOK_TO_CCEL[bookName]
    if (!ccelAbbrev) {
      console.log(`  ⚠ No CCEL abbreviation for ${bookName}, skipping`)
      continue
    }

    let allCommentaries = []
    const uniqueVolIds = [...new Set(volumes.map(v => v.vol))]
    
    for (const vol of uniqueVolIds) {
      const xmlPath = path.join(DOWNLOAD_DIR, `${vol}.xml`)
      if (!fs.existsSync(xmlPath)) {
        console.log(`  ⚠ ${vol}.xml not found, skipping`)
        continue
      }
      const xml = fs.readFileSync(xmlPath, 'utf-8')
      const commentaries = parseForBook(xml, ccelAbbrev, bookName)
      allCommentaries.push(...commentaries)
    }

    if (allCommentaries.length === 0) {
      console.log(`  - ${bookName}: 0 entries (skipping)`)
      continue
    }

    // Deduplicate by id
    const seen = new Set()
    allCommentaries = allCommentaries.filter(c => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })

    // Sort by chapter, then verse
    allCommentaries.sort((a, b) => {
      if (a.chapter !== b.chapter) return a.chapter - b.chapter
      return (a.verses[0]?.verse || 0) - (b.verses[0]?.verse || 0)
    })

    const outputData = {
      metadata: {
        author: 'John Calvin',
        authorId: 'john-calvin',
        workId: `calvin-${bookName.toLowerCase().replace(/\s+/g, '-')}`,
        title: `Commentary on ${bookName}`,
        type: 'Written Commentary',
        year: '1540s-1560s',
        translation: 'Calvin Translation Society (1840s)',
        source: 'Christian Classics Ethereal Library (CCEL)',
        sourceUrl: `https://ccel.org/ccel/calvin/${uniqueVolIds[0]}`,
        license: 'Public Domain',
        book: bookName
      },
      commentaries: allCommentaries
    }

    const outputFile = path.join(OUTPUT_DIR, `${bookName.toLowerCase().replace(/\s+/g, '-')}.json`)
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2))
    const size = (fs.statSync(outputFile).size / 1024).toFixed(0)
    
    // Chapter breakdown
    const chapters = {}
    allCommentaries.forEach(c => { chapters[c.chapter] = (chapters[c.chapter] || 0) + 1 })
    const chapterCount = Object.keys(chapters).length
    
    console.log(`  ✓ ${bookName}: ${allCommentaries.length} entries across ${chapterCount} chapters (${size} KB)`)
    results.push({ book: bookName, entries: allCommentaries.length, chapters: chapterCount, sizeKB: parseInt(size) })
  }

  // Summary
  console.log(`\n📊 Summary:`)
  console.log(`  Books: ${results.length}`)
  console.log(`  Total entries: ${results.reduce((s, r) => s + r.entries, 0)}`)
  console.log(`  Total size: ${(results.reduce((s, r) => s + r.sizeKB, 0) / 1024).toFixed(1)} MB`)
  console.log(`\n  Output directory: ${OUTPUT_DIR}`)
}

main().catch(console.error)
