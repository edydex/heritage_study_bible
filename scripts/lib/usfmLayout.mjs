const STRUCTURAL_MARKER = /^\\([a-z][a-z0-9]*)(?:\s+(.*))?$/i
const VERSE_MARKER = /^\\v\s+(\d+)(?:\s|$)/
const CHAPTER_MARKER = /^\\c\s+(\d+)(?:\s|$)/

function ensureVerse(layout, key) {
  if (!layout[key]) layout[key] = {}
  return layout[key]
}

/**
 * Extract the verse-level layout information that the compact reader JSON loses.
 *
 * USFM blank-line markers (\\b) can occur either between verses or inside a
 * verse. Only a break that reaches the next \\v marker belongs before that
 * verse; breaks consumed by intervening text are intentionally not guessed.
 */
export function parseUsfmVerseLayout(usfm, bookName) {
  const verses = {}
  let chapter = null
  let currentVerseKey = null
  let pendingBreak = false
  let currentFlow = 'prose'
  let pendingPoetryIndent = null

  for (const rawLine of String(usfm || '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const chapterMatch = line.match(CHAPTER_MARKER)
    if (chapterMatch) {
      chapter = Number(chapterMatch[1])
      currentVerseKey = null
      pendingBreak = false
      currentFlow = 'prose'
      pendingPoetryIndent = null
      continue
    }

    if (!chapter) continue

    const verseMatch = line.match(VERSE_MARKER)
    if (verseMatch) {
      const verse = Number(verseMatch[1])
      currentVerseKey = `${bookName}.${chapter}.${verse}`
      const metadata = ensureVerse(verses, currentVerseKey)

      if (pendingBreak) metadata.breakBefore = true
      if (currentFlow === 'poetry') {
        metadata.poetry = true
        if (pendingPoetryIndent) metadata.poetryIndent = pendingPoetryIndent
      }

      pendingBreak = false
      pendingPoetryIndent = null
      continue
    }

    const markerMatch = line.match(STRUCTURAL_MARKER)
    if (!markerMatch) {
      if (pendingBreak) pendingBreak = false
      continue
    }

    const marker = markerMatch[1].toLowerCase()
    const content = String(markerMatch[2] || '').trim()

    if (marker === 'b') {
      pendingBreak = true
      continue
    }

    if (/^q\d*$/.test(marker) || marker === 'qr' || marker === 'qc') {
      currentFlow = 'poetry'
      const indentMatch = marker.match(/^q(\d+)$/)
      pendingPoetryIndent = indentMatch ? Number(indentMatch[1]) : 1
      if (currentVerseKey) {
        const metadata = ensureVerse(verses, currentVerseKey)
        metadata.poetry = true
      }
    } else if (marker === 'm' || marker === 'p' || marker === 'pi') {
      currentFlow = 'prose'
      pendingPoetryIndent = null
    }

    // A blank line followed by actual content was consumed inside the current
    // verse, so it must not be attached to a later verse.
    if (pendingBreak && content) pendingBreak = false
  }

  for (const [key, metadata] of Object.entries(verses)) {
    if (Object.keys(metadata).length === 0) delete verses[key]
  }

  return verses
}
