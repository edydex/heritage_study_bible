// Script to parse the Gavin Ortlund DOCX file and generate commentary JSON
// Run with: npm run parse-docx

import fs from 'fs'
import path from 'path'
import mammoth from 'mammoth'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function parseDocx() {
  const docxPath = path.join(__dirname, '..', 'Gavin_Ortlund_Revelation_Organized_PARAGRAPHED.docx')
  const outputPath = path.join(__dirname, '..', 'src', 'data', 'ortlund-commentary.json')

  console.log('Reading DOCX file...')
  
  const result = await mammoth.extractRawText({ path: docxPath })
  const text = result.value
  
  console.log('Parsing content...')
  
  const commentaries = []
  const lines = text.split('\n').filter(line => line.trim())
  
  let currentChapter = 0
  let currentSection = null
  let currentContent = []
  let sectionId = 0

  // Regex patterns
  const chapterHeadingRegex = /^Chapter\s+(\d+)(?:\s*[-–]\s*(\d+))?\s*\((\d{2}:\d{2}:\d{2})\)/i
  const introHeadingRegex = /^Introduction\s*\((\d{2}:\d{2}:\d{2})\)/i
  const verseRefRegex = /^(?:Revelation\s+)?(\d+):(\d+)(?:\s*[-–]\s*(\d+))?/i

  function saveCurrentSection() {
    if (currentSection && currentContent.length > 0) {
      currentSection.text = currentContent.join('\n\n').trim()
      if (currentSection.text) {
        commentaries.push(currentSection)
      }
    }
    currentContent = []
  }

  for (const line of lines) {
    const trimmedLine = line.trim()
    
    // Check for Introduction heading
    const introMatch = trimmedLine.match(introHeadingRegex)
    if (introMatch) {
      saveCurrentSection()
      currentSection = {
        id: `intro_${sectionId++}`,
        reference: 'Introduction',
        timestamp: introMatch[1],
        verses: null,
        chapter: 0
      }
      continue
    }

    // Check for Chapter heading
    const chapterMatch = trimmedLine.match(chapterHeadingRegex)
    if (chapterMatch) {
      saveCurrentSection()
      const startChapter = parseInt(chapterMatch[1])
      const endChapter = chapterMatch[2] ? parseInt(chapterMatch[2]) : startChapter
      currentChapter = startChapter
      
      currentSection = {
        id: `chapter_${startChapter}_${endChapter}_${sectionId++}`,
        reference: endChapter !== startChapter 
          ? `Chapters ${startChapter}-${endChapter}` 
          : `Chapter ${startChapter}`,
        timestamp: chapterMatch[3],
        verses: null,
        chapter: startChapter
      }
      continue
    }

    // Check if this is a verse reference line (starts a new subsection)
    // Look for patterns like "1:1-3" or "Revelation 1:1-3"
    if (currentChapter > 0) {
      const verseMatch = trimmedLine.match(/^(\d+):(\d+)(?:\s*[-–]\s*(\d+))?(?:\s|$)/)
      if (verseMatch) {
        saveCurrentSection()
        const chapter = parseInt(verseMatch[1])
        const startVerse = parseInt(verseMatch[2])
        const endVerse = verseMatch[3] ? parseInt(verseMatch[3]) : startVerse
        
        const verses = []
        for (let v = startVerse; v <= endVerse; v++) {
          verses.push({ chapter, verse: v })
        }
        
        currentSection = {
          id: `rev_${chapter}_${startVerse}_${endVerse}_${sectionId++}`,
          reference: endVerse !== startVerse 
            ? `Revelation ${chapter}:${startVerse}-${endVerse}` 
            : `Revelation ${chapter}:${startVerse}`,
          timestamp: null,
          verses,
          chapter
        }
        
        // The rest of the line after the verse reference is content
        const restOfLine = trimmedLine.replace(/^(\d+):(\d+)(?:\s*[-–]\s*(\d+))?\s*/, '').trim()
        if (restOfLine) {
          currentContent.push(restOfLine)
        }
        continue
      }
    }

    // Regular paragraph - add to current content
    if (currentSection && trimmedLine) {
      currentContent.push(trimmedLine)
    }
  }

  // Save the last section
  saveCurrentSection()

  // Find chapter timestamps and apply to verse sections that don't have timestamps
  const chapterTimestamps = {}
  commentaries.forEach(c => {
    if (c.timestamp && c.reference.startsWith('Chapter')) {
      const match = c.reference.match(/Chapter\s+(\d+)/)
      if (match) {
        chapterTimestamps[parseInt(match[1])] = c.timestamp
      }
    }
  })
  
  commentaries.forEach(c => {
    if (!c.timestamp && c.chapter > 0) {
      c.timestamp = chapterTimestamps[c.chapter] || null
    }
  })

  const output = { commentaries }
  
  // Ensure output directory exists
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
  
  console.log(`Successfully parsed ${commentaries.length} commentary sections`)
  console.log(`Output saved to: ${outputPath}`)
}

parseDocx().catch(console.error)
