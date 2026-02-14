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
  return /^contents?[\.:]?$/i.test(block.trim())
}

function isLikelyTocEntry(block) {
  const text = block.trim()
  if (!text) return false
  if (/^page$/i.test(text)) return true
  if (/^(preface|introduction|prologue|appendix)\b/i.test(text)) return true
  if (/^footnotes?:?$/i.test(text)) return true
  if (/^(book|part|chapter|section)\s+([ivxlcdm]+|\d+|[a-z-]+)\.?$/i.test(text)) return true
  if (/^\d+\.\s+_[^_]+_\.?$/i.test(text)) return true
  return /,\s*\d+\s*$/i.test(text)
}

function stripLeadingTableOfContents(blocks) {
  if (!blocks.length) return blocks

  // Gutenberg files often include a compact TOC near the top. If we parse it as
  // real headings, chapter grouping can start at the wrong book.
  const tocIndex = blocks.findIndex((block, index) => index < 60 && isLikelyTocHeading(block))
  if (tocIndex < 0) return blocks

  let cursor = tocIndex + 1
  let tocEntryCount = 0
  let toleratedNoise = 0
  const maxScan = Math.min(blocks.length, tocIndex + 500)

  while (cursor < maxScan) {
    const block = blocks[cursor]

    if (isLikelyTocEntry(block)) {
      tocEntryCount += 1
      toleratedNoise = 0
      cursor += 1
      continue
    }

    // Some TOCs contain a couple of unstructured lines mixed in with entries.
    if (tocEntryCount >= 8 && toleratedNoise < 2 && block.length <= 220) {
      toleratedNoise += 1
      cursor += 1
      continue
    }

    break
  }

  if (tocEntryCount < 8) return blocks

  return [...blocks.slice(0, tocIndex), ...blocks.slice(cursor)]
}

function makeChapter(title) {
  return { title, paragraphs: [] }
}

function parseMajorBookHeading(block) {
  const match = block.match(/^book\s+([ivxlcdm]+|\d+|[a-z-]+)\.?(?:\[\d+\])?$/i)
  if (!match) return null
  return `BOOK ${match[1].toUpperCase()}`
}

function hasChapterMarkers(blocks) {
  return blocks.some(block => /^chapter\s+([ivxlcdm]+|\d+)\b/i.test(block))
}

function hasNumberedSectionMarkers(blocks) {
  let count = 0
  for (const block of blocks) {
    if (/^\d+\.\s+['"_\(\[]*[A-Za-z]/.test(block)) {
      count += 1
      if (count >= 10) return true
    }
  }
  return false
}

function getChapterTitle(block, currentMajorHeading) {
  if (!currentMajorHeading) return block
  return `${currentMajorHeading} - ${block}`
}

function hasBookLikeMajorHeadings(blocks) {
  return blocks.some(block => parseMajorBookHeading(block))
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

function parseUsingNumberedSections(blocks, requireMajorHeading = false) {
  const chapters = []
  let currentMajorHeading = null
  let currentChapter = null

  for (const block of blocks) {
    const majorHeading = parseMajorBookHeading(block)
    if (majorHeading) {
      currentMajorHeading = majorHeading
      currentChapter = null
      continue
    }

    if (/^\d+\.\s+['"_\(\[]*[A-Za-z]/.test(block)) {
      if (requireMajorHeading && !currentMajorHeading) {
        if (!currentChapter) {
          currentChapter = makeChapter('Introduction')
          chapters.push(currentChapter)
        }
        currentChapter.paragraphs.push(block)
        continue
      }
      const title = currentMajorHeading ? `${currentMajorHeading} - ${block}` : block
      currentChapter = makeChapter(title)
      chapters.push(currentChapter)
      continue
    }

    if (!currentChapter) {
      const introTitle = currentMajorHeading ? `${currentMajorHeading} - Introduction` : 'Introduction'
      currentChapter = makeChapter(introTitle)
      chapters.push(currentChapter)
    }
    currentChapter.paragraphs.push(block)
  }

  return chapters
}

function isLikelyHeading(block) {
  if (/^\d+[\.\)]\s+['"_\(\[]*[A-Z]/.test(block)) return true
  if (block.length < 4 || block.length > 110) return false
  if (/^(book|part|section|chapter|letter)\s+/i.test(block)) return true
  if (/^(argument|preface|introduction|prologue|epilogue)\.?$/i.test(block)) return true

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

  const hasMajorHeadings = hasBookLikeMajorHeadings(blocks)

  const chapters = hasChapterMarkers(blocks)
    ? parseUsingChapterMarkers(blocks)
    : hasNumberedSectionMarkers(blocks)
      ? parseUsingNumberedSections(blocks, hasMajorHeadings)
      : parseUsingHeuristicHeadings(blocks)

  return chapters.filter(chapter => chapter.paragraphs.length > 0)
}

export function extractChapterNumber(title) {
  if (!title) return null
  const match = title.match(/\bchapter\s+(\d+)\b/i)
  if (match) return Number(match[1])

  const numberedMatch = title.match(/(?:^|\s-\s)(\d+)\./)
  if (numberedMatch) return Number(numberedMatch[1])

  return null
}
