#!/usr/bin/env node
/**
 * Parse Calvin's Commentary XML (ThML format from CCEL) into per-book JSON files.
 * 
 * Usage:
 *   node scripts/parse-calvin-xml.cjs <xml-file> <book-name> [output-dir]
 * 
 * Example:
 *   node scripts/parse-calvin-xml.cjs scripts/calcom38-sample.xml Romans public/data/commentary/calvin
 * 
 * Structure in ThML:
 *   <p id="..."><scripCom type="Commentary" passage="Ro 1:1" ... /></p>
 *   <div class="Commentary" id="Bible:Rom.1.1">
 *     <p>...commentary text...</p>
 *   </div>
 */

const fs = require('fs')
const path = require('path')

const PASSAGE_ABBREVS = {
  'Ge': 'Gen', 'Ex': 'Exod', 'Le': 'Lev', 'Nu': 'Num', 'De': 'Deut',
  'Jos': 'Josh', 'Jud': 'Judg', 'Ru': 'Ruth',
  '1Sa': '1Sam', '2Sa': '2Sam', '1Ki': '1Kgs', '2Ki': '2Kgs',
  '1Ch': '1Chr', '2Ch': '2Chr', 'Ezr': 'Ezra', 'Ne': 'Neh',
  'Es': 'Esther', 'Ps': 'Ps', 'Pr': 'Prov', 'Ec': 'Eccl',
  'So': 'Song', 'Isa': 'Isa', 'Jer': 'Jer', 'La': 'Lam',
  'Eze': 'Ezek', 'Da': 'Dan', 'Ho': 'Hos', 'Joe': 'Joel',
  'Am': 'Amos', 'Ob': 'Obad', 'Jon': 'Jonah', 'Mic': 'Mic',
  'Na': 'Nah', 'Hab': 'Hab', 'Zep': 'Zeph', 'Hag': 'Hag',
  'Zec': 'Zech', 'Mal': 'Mal',
  'Mt': 'Matt', 'Mr': 'Mark', 'Lu': 'Luke', 'Joh': 'John',
  'Ac': 'Acts', 'Ro': 'Rom', '1Co': '1Cor', '2Co': '2Cor',
  'Ga': 'Gal', 'Eph': 'Eph', 'Php': 'Phil', 'Col': 'Col',
  '1Th': '1Thess', '2Th': '2Thess', '1Ti': '1Tim', '2Ti': '2Tim',
  'Tit': 'Titus', 'Phm': 'Phlm', 'Heb': 'Heb',
  'Jam': 'Jas', '1Pe': '1Pet', '2Pe': '2Pet', '1Jo': '1John',
  '2Jo': '2John', '3Jo': '3John', 'Jude': 'Jude', 'Re': 'Rev',
  // Also accept full names and standard abbreviations
  'Romans': 'Rom', 'Genesis': 'Gen', 'Exodus': 'Exod', 'Psalms': 'Ps',
  'Isaiah': 'Isa', 'Jeremiah': 'Jer', 'Ezekiel': 'Ezek', 'Daniel': 'Dan',
  'Matthew': 'Matt', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John',
  'Acts': 'Acts', 'Hebrews': 'Heb', 'James': 'Jas', 'Jude': 'Jude',
  'Galatians': 'Gal', 'Ephesians': 'Eph', 'Philippians': 'Phil',
  'Colossians': 'Col', 'Titus': 'Titus', 'Philemon': 'Phlm',
  'Revelation': 'Rev'
}

// Normalize a book abbreviation found in the passage text
function normalizeBook(bookStr) {
  bookStr = bookStr.trim()
  return PASSAGE_ABBREVS[bookStr] || bookStr
}

/**
 * Strip HTML/XML tags and clean text for readable output
 */
function stripTags(html) {
  if (!html) return ''
  return html
    // Remove footnote blocks
    .replace(/<note[^>]*>[\s\S]*?<\/note>/gi, '')
    // Keep scripture reference text
    .replace(/<scripRef[^>]*>([\s\S]*?)<\/scripRef>/gi, '$1')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#8220;/g, '\u201C')
    .replace(/&#8221;/g, '\u201D')
    .replace(/&#8216;/g, '\u2018')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8212;/g, '\u2014')
    .replace(/&#8211;/g, '\u2013')
    // Fix common UTF-8 mojibake from CCEL files
    .replace(/â€œ/g, '\u201C')
    .replace(/â€\u009D/g, '\u201D')
    .replace(/â€™/g, '\u2019')
    .replace(/â€˜/g, '\u2018')
    .replace(/â€"/g, '\u2014')
    .replace(/â€"/g, '\u2013')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

function stripTagsForNote(html) {
  if (!html) return ''
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#8220;/g, '\u201C')
    .replace(/&#8221;/g, '\u201D')
    .replace(/&#8216;/g, '\u2018')
    .replace(/&#8217;/g, '\u2019')
    .replace(/&#8212;/g, '\u2014')
    .replace(/&#8211;/g, '\u2013')
    .replace(/â€œ/g, '\u201C')
    .replace(/â€\u009D/g, '\u201D')
    .replace(/â€™/g, '\u2019')
    .replace(/â€˜/g, '\u2018')
    .replace(/â€"/g, '\u2014')
    .replace(/â€"/g, '\u2013')
    .replace(/\s+/g, ' ')
    .trim()
}

function encodeInlineNoteText(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function applyInlineNotes(text, notesByIndex) {
  if (!text) return ''
  return text
    .replace(/__NOTE_BLOCK_(\d+)__/g, (_, rawIndex) => {
      const noteIndex = Number(rawIndex)
      const noteText = notesByIndex[noteIndex]
      if (!noteText) return ''
      return ` <fn n='${noteIndex}'>${encodeInlineNoteText(noteText)}</fn> `
    })
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parse the passage attribute to extract chapter and verse info.
 * Handles: "Ro 1:1", "Ro 1:1-7", "Romans 1", "Ro 1:1, 2"
 */
function parsePassage(passage, parsedAttr) {
  if (!passage) return null

  // Try the parsed attribute first: parsed="|Rom|1|1|0|0" or "|Rom|1|1|1|7"
  if (parsedAttr) {
    const parts = parsedAttr.split('|').filter(Boolean)
    if (parts.length >= 3) {
      const book = parts[0]
      const chapter = parseInt(parts[1])
      const verseStart = parseInt(parts[2]) || 0
      // parts[3] and parts[4] might be end chapter/verse for ranges
      const endVerse = parseInt(parts[4]) || verseStart
      return { book, chapter, verseStart, verseEnd: endVerse || verseStart }
    }
  }

  // Fallback: parse the passage text
  // Match "Ro 1:1" or "Ro 1:1-7" or "Romans 1"
  const match = passage.match(/^(\d?\s*\w+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?/)
  if (!match) return null

  const bookAbbrev = normalizeBook(match[1])
  const chapter = parseInt(match[2])
  const verseStart = match[3] ? parseInt(match[3]) : 0
  const verseEnd = match[4] ? parseInt(match[4]) : verseStart

  return { book: bookAbbrev, chapter, verseStart, verseEnd }
}

/**
 * Extract commentary sections using the actual ThML structure:
 * 
 *   <p><scripCom type="Commentary" passage="Ro 1:1" parsed="..." /></p>
 *   <div class="Commentary" id="...">
 *     <p>...text...</p>
 *     <p>...text...</p>
 *   </div>
 * 
 * Strategy: Find each scripCom marker, then extract the <div class="Commentary"> 
 * that follows it, and get all <p> text within that div.
 */
function parseCalvinXML(xmlContent, targetBookAbbrev) {
  const commentaries = []

  // Step 1: Find all scripCom Commentary markers with their positions
  const scripComPattern = /<scripCom\s+type="Commentary"\s+passage="([^"]+)"[^>]*parsed="([^"]*)"[^>]*\/>/g
  const markers = []
  let m
  while ((m = scripComPattern.exec(xmlContent)) !== null) {
    markers.push({
      passage: m[1],
      parsed: m[2],
      index: m.index,
      endIndex: m.index + m[0].length
    })
  }

  console.log(`Found ${markers.length} scripCom Commentary markers`)

  // Step 2: For each marker, find the Commentary div that follows
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i]
    const parsed = parsePassage(marker.passage, marker.parsed)
    if (!parsed) continue

    // Check if this is for our target book
    if (parsed.book !== targetBookAbbrev) continue

    // Skip chapter-level entries (verse 0 = chapter intro)
    // We'll still include them but mark them as chapter intros
    const isChapterIntro = parsed.verseStart === 0

    // Find the <div class="Commentary"> that follows this marker
    const searchStart = marker.endIndex
    const searchEnd = (i < markers.length - 1) ? markers[i + 1].index : xmlContent.length
    const segment = xmlContent.substring(searchStart, searchEnd)

    // Find the Commentary div
    const divMatch = segment.match(/<div\s+class="Commentary"[^>]*>([\s\S]*?)<\/div>/)
    if (!divMatch) continue

    // Replace inline note blocks with placeholders before paragraph extraction,
    // because CCEL note payload can contain nested <p> tags.
    const notesByIndex = {}
    let nextNoteIndex = 1
    const divContent = divMatch[1].replace(/<note\b[^>]*>[\s\S]*?<\/note>/gi, (noteBlock) => {
      const noteText = stripTagsForNote(noteBlock)
      if (!noteText) return ' '
      const noteIndex = nextNoteIndex++
      notesByIndex[noteIndex] = noteText
      return ` __NOTE_BLOCK_${noteIndex}__ `
    })

    // Extract paragraphs
    const paragraphs = []
    const pPattern = /<p[^>]*>([\s\S]*?)<\/p>/g
    let pMatch
    while ((pMatch = pPattern.exec(divContent)) !== null) {
      const text = stripTags(pMatch[1])
      if (text && text.length > 5) {
        paragraphs.push(applyInlineNotes(text, notesByIndex))
      }
    }

    if (paragraphs.length === 0) continue

    const fullText = paragraphs.join('\n\n')

    // Build verse references
    const verses = []
    if (isChapterIntro) {
      // Chapter intro applies to the whole chapter
      verses.push({ chapter: parsed.chapter, verse: 0 })
    } else {
      for (let v = parsed.verseStart; v <= parsed.verseEnd; v++) {
        verses.push({ chapter: parsed.chapter, verse: v })
      }
    }

    const verseRef = isChapterIntro
      ? `${parsed.chapter} (Introduction)`
      : parsed.verseStart === parsed.verseEnd
        ? `${parsed.chapter}:${parsed.verseStart}`
        : `${parsed.chapter}:${parsed.verseStart}-${parsed.verseEnd}`

    commentaries.push({
      id: `calvin_rom_${parsed.chapter}_${parsed.verseStart}`,
      reference: `Romans ${verseRef}`,
      chapter: parsed.chapter,
      verses,
      text: fullText,
      ...(isChapterIntro ? { isIntro: true } : {})
    })
  }

  return commentaries
}

// --- Main ---
const args = process.argv.slice(2)
if (args.length < 2) {
  console.log('Usage: node parse-calvin-xml.cjs <xml-file> <book-name> [output-dir]')
  console.log('Example: node parse-calvin-xml.cjs scripts/calcom38-sample.xml Romans public/data/commentary/calvin')
  process.exit(1)
}

const xmlFile = args[0]
const bookName = args[1]
const outputDir = args[2] || 'public/data/commentary/calvin'

// Map book name to the abbreviation used in CCEL's parsed attribute
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

const targetAbbrev = BOOK_TO_CCEL[bookName]
if (!targetAbbrev) {
  console.error(`Unknown book: ${bookName}. Supported: ${Object.keys(BOOK_TO_CCEL).join(', ')}`)
  process.exit(1)
}

if (!fs.existsSync(xmlFile)) {
  console.error(`File not found: ${xmlFile}`)
  process.exit(1)
}

console.log(`Parsing Calvin's commentary on ${bookName} (looking for ${targetAbbrev})...`)
const xmlContent = fs.readFileSync(xmlFile, 'utf-8')
const commentaries = parseCalvinXML(xmlContent, targetAbbrev)

console.log(`\nExtracted ${commentaries.length} commentary entries`)

// Show chapter breakdown
const chapters = {}
commentaries.forEach(c => {
  chapters[c.chapter] = (chapters[c.chapter] || 0) + 1
})
console.log('Chapter breakdown:')
Object.entries(chapters).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([ch, count]) => {
  console.log(`  Chapter ${ch}: ${count} entries`)
})

// Show a sample entry
if (commentaries.length > 0) {
  const sample = commentaries.find(c => !c.isIntro) || commentaries[0]
  console.log(`\nSample entry (${sample.reference}):`)
  console.log(`  Text preview: ${sample.text.substring(0, 200)}...`)
}

// Create output
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
    sourceUrl: 'https://ccel.org/ccel/calvin',
    license: 'Public Domain',
    book: bookName
  },
  commentaries
}

// Ensure output dir exists
fs.mkdirSync(outputDir, { recursive: true })

const outputFile = path.join(outputDir, `${bookName.toLowerCase().replace(/\s+/g, '-')}.json`)
fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2))

console.log(`\nWritten to: ${outputFile}`)
console.log(`File size: ${(fs.statSync(outputFile).size / 1024).toFixed(1)} KB`)
