function normalizeText(rawText) {
  if (!rawText) return ''
  return rawText
    .replace(/\uFEFF/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
}

function stripProjectGutenbergBoilerplate(rawText) {
  if (!rawText) return ''

  let content = normalizeText(rawText)

  const startMatch = content.match(/^\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*$/im)
  if (startMatch?.index != null) {
    content = content.slice(startMatch.index + startMatch[0].length)
  } else {
    const legacyStart = content.search(/^START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*$/im)
    if (legacyStart >= 0) {
      const nextLine = content.indexOf('\n', legacyStart)
      content = nextLine >= 0 ? content.slice(nextLine + 1) : content
    }
  }

  const endIndex = content.search(/^\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*$/im)
  if (endIndex >= 0) {
    content = content.slice(0, endIndex)
  } else {
    const legacyEnd = content.search(/^END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*$/im)
    if (legacyEnd >= 0) {
      content = content.slice(0, legacyEnd)
    }
  }

  return content.trim()
}

function toBlocks(text) {
  return normalizeText(text)
    .split(/\n{2,}/)
    .map(block => block.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function isLikelyTocHeading(block) {
  return /^contents?$/i.test(block.trim())
}

function isLikelyTocEntry(block) {
  const text = block.trim()
  if (/^(preface|introduction|prologue|appendix)\b/i.test(text)) return true
  if (/^footnotes?:?$/i.test(text)) return true
  return /^(book|part|chapter|section)\s+([ivxlcdm]+|\d+)\b/i.test(text)
}

function stripLeadingTableOfContents(blocks) {
  if (!blocks.length) return blocks

  // Gutenberg files often include a compact TOC near the top. If we parse it as
  // real headings, chapter grouping can start at the wrong book.
  const tocIndex = blocks.findIndex((block, index) => index < 60 && isLikelyTocHeading(block))
  if (tocIndex < 0) return blocks

  let cursor = tocIndex + 1
  while (cursor < blocks.length && isLikelyTocEntry(blocks[cursor])) {
    cursor += 1
  }

  const tocEntryCount = cursor - tocIndex - 1
  if (tocEntryCount < 8) return blocks

  return [...blocks.slice(0, tocIndex), ...blocks.slice(cursor)]
}

function makeChapter(title) {
  return { title, paragraphs: [] }
}

function hasChapterMarkers(blocks) {
  return blocks.some(block => /^chapter\s+([ivxlcdm]+|\d+)\b/i.test(block))
}

function getChapterTitle(block, currentMajorHeading) {
  if (!currentMajorHeading) return block
  return `${currentMajorHeading} - ${block}`
}

function parseUsingChapterMarkers(blocks) {
  const chapters = []
  let currentMajorHeading = null
  let currentChapter = null

  for (const block of blocks) {
    if (/^(book|part)\s+([ivxlcdm]+|\d+)\b/i.test(block)) {
      currentMajorHeading = block
      continue
    }

    if (/^chapter\s+([ivxlcdm]+|\d+)\b/i.test(block)) {
      currentChapter = makeChapter(getChapterTitle(block, currentMajorHeading))
      chapters.push(currentChapter)
      continue
    }

    if (!currentChapter) {
      currentChapter = makeChapter('Introduction')
      chapters.push(currentChapter)
    }
    currentChapter.paragraphs.push(block)
  }

  return chapters
}

function isLikelyHeading(block) {
  if (block.length < 4 || block.length > 110) return false
  if (/^(book|part|section|chapter|letter)\s+/i.test(block)) return true
  if (/^\d+[\.\)]\s+[A-Z]/.test(block)) return true

  const letters = block.replace(/[^A-Za-z]/g, '')
  if (letters.length < 5) return false
  const upper = letters.replace(/[^A-Z]/g, '').length
  return upper / letters.length >= 0.75
}

function parseUsingHeuristicHeadings(blocks) {
  const chapters = []
  let currentChapter = makeChapter('Text')
  chapters.push(currentChapter)

  for (const block of blocks) {
    if (isLikelyHeading(block)) {
      if (currentChapter.paragraphs.length === 0) {
        currentChapter.title = block
      } else {
        currentChapter = makeChapter(block)
        chapters.push(currentChapter)
      }
      continue
    }
    currentChapter.paragraphs.push(block)
  }

  return chapters
}

export function parseBookChapters(rawText) {
  if (!rawText) return []

  const stripped = stripProjectGutenbergBoilerplate(rawText)
  const blocks = stripLeadingTableOfContents(toBlocks(stripped))
  if (!blocks.length) return []

  const chapters = hasChapterMarkers(blocks)
    ? parseUsingChapterMarkers(blocks)
    : parseUsingHeuristicHeadings(blocks)

  return chapters.filter(chapter => chapter.paragraphs.length > 0)
}

export function extractChapterNumber(title) {
  if (!title) return null
  const match = title.match(/\bchapter\s+(\d+)\b/i)
  if (!match) return null
  return Number(match[1])
}
