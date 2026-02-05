import fs from 'fs'
import path from 'path'

// Read the markdown file
const mdPath = process.argv[2] || './Gavin_Ortlund_Revelation_Organized_PARAGRAPHED.md'
const content = fs.readFileSync(mdPath, 'utf-8')

// Parse the markdown sections
const sections = content.split(/^# \*\*/gm).filter(Boolean)

const commentaries = []
let idCounter = 0

// Helper to extract timestamp from header
function extractTimestamp(header) {
  const match = header.match(/\((\d{2}:\d{2}:\d{2})\)/)
  return match ? match[1] : null
}

// Helper to clean header text
function cleanHeader(header) {
  return header.replace(/\*\*/g, '').replace(/\s*\(\d{2}:\d{2}:\d{2}\)\s*/, '').trim()
}

// Helper to parse chapter number from header
function parseChapter(header) {
  const cleanedHeader = cleanHeader(header)
  
  // Check for "Chapter X" or "Chapters X-Y"
  const chapterMatch = cleanedHeader.match(/^Chapters?\s+(\d+)/)
  if (chapterMatch) {
    return parseInt(chapterMatch[1])
  }
  
  return 0 // Introduction/Book recommendation sections
}

// Helper to determine if this is introduction content (before chapter 1)
function isIntroduction(header) {
  const cleanedHeader = cleanHeader(header)
  return !cleanedHeader.startsWith('Chapter') && parseChapter(header) === 0
}

// Process each section
for (const section of sections) {
  const lines = section.split('\n')
  const headerLine = lines[0]
  const timestamp = extractTimestamp(headerLine)
  const title = cleanHeader(headerLine)
  const chapter = parseChapter(headerLine)
  
  // Get the content (everything after header)
  const textContent = lines.slice(1).join('\n').trim()
  
  if (!textContent) continue
  
  const commentary = {
    id: `ortlund_${idCounter++}`,
    reference: title,
    timestamp: timestamp || '00:00:00',
    chapter: chapter,
    isIntroduction: isIntroduction(headerLine),
    text: textContent
  }
  
  // For chapter sections, try to extract verse references
  if (chapter > 0) {
    // Check if the title contains verse references like "Revelation 1:1-3"
    const verseMatch = title.match(/Revelation\s+(\d+):(\d+)(?:-(\d+))?/)
    if (verseMatch) {
      const chNum = parseInt(verseMatch[1])
      const startVerse = parseInt(verseMatch[2])
      const endVerse = verseMatch[3] ? parseInt(verseMatch[3]) : startVerse
      
      commentary.verses = []
      for (let v = startVerse; v <= endVerse; v++) {
        commentary.verses.push({ chapter: chNum, verse: v })
      }
    } else {
      // No specific verses - this is a chapter-level commentary
      commentary.verses = null
    }
  } else {
    commentary.verses = null
  }
  
  commentaries.push(commentary)
}

// Group introduction sections together
const introductions = commentaries.filter(c => c.isIntroduction)
const chapterCommentaries = commentaries.filter(c => !c.isIntroduction)

// Create the final output
const output = {
  metadata: {
    author: "Gavin Ortlund",
    title: "Explaining Every Chapter of Revelation",
    type: "Video Commentary",
    year: 2024,
    source: "YouTube",
    originalUrl: "https://www.youtube.com/watch?v=YOUR_VIDEO_ID",
    audioUrl: null
  },
  introduction: introductions.map(intro => ({
    id: intro.id,
    title: intro.reference,
    timestamp: intro.timestamp,
    text: intro.text
  })),
  commentaries: chapterCommentaries.map(c => {
    const { isIntroduction, ...rest } = c
    return rest
  })
}

// Write output
const outputPath = path.join(process.cwd(), 'src', 'data', 'ortlund-commentary.json')
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))

console.log(`Parsed ${introductions.length} introduction sections`)
console.log(`Parsed ${chapterCommentaries.length} chapter commentaries`)
console.log(`Output written to ${outputPath}`)
