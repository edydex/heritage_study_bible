import { bibleBooks } from '../data/bible-books.js'
import { resolveBookAliasPrefix } from './parseBibleReference.js'
import { localizeBookName } from './localizedBookNames.js'
import { translationDisplayAbbr, translationDisplayText } from './translationDisplay.js'
import {
  getVerseTextWithPsalmSuperscription,
  psalmComparisonVerseNumber,
  withPsalmSuperscriptionVerse,
} from './psalmSuperscriptions.js'

function normalizeInput(input) {
  return String(input || '')
    .replace(/[–—]/g, '-')
    .replace(/[;|\n\r]+/g, ',')
    .replace(/\s+/g, ' ')
    .trim()
}

function getBookMeta(bookName) {
  return bibleBooks.find(book => book.name === bookName) || null
}

function getBookData(bibleData, bookName) {
  return bibleData?.books?.find(book => book.name === bookName) || null
}

function getChapterData(bibleData, bookName, chapter, translationId = null) {
  const chapterData = getBookData(bibleData, bookName)?.chapters?.find(row => row.number === chapter) || null
  return withPsalmSuperscriptionVerse(chapterData, bookName, translationId)
}

function getVerseText(bibleData, bookName, chapter, verse, translationId = null) {
  return getVerseTextWithPsalmSuperscription(bibleData, bookName, chapter, verse, translationId)
}

function formatReference(bookName, startChapter, startVerse, endChapter, endVerse) {
  if (startVerse != null && endVerse != null) {
    if (startChapter === endChapter && startVerse === endVerse) {
      return `${bookName} ${startChapter}:${startVerse}`
    }
    if (startChapter === endChapter) {
      return `${bookName} ${startChapter}:${startVerse}-${endVerse}`
    }
    return `${bookName} ${startChapter}:${startVerse}-${endChapter}:${endVerse}`
  }

  if (startChapter === endChapter) {
    return `${bookName} ${startChapter}`
  }
  return `${bookName} ${startChapter}-${endChapter}`
}

function escapeMarkdownCell(value) {
  return String(value || '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br/>')
}

function expandVerses({
  bookName,
  startChapter,
  startVerse,
  endChapter,
  endVerse,
  bibleData,
  translationId,
}) {
  const verses = []
  for (let chapter = startChapter; chapter <= endChapter; chapter += 1) {
    const data = getChapterData(bibleData, bookName, chapter, translationId)
    const fromVerse = chapter === startChapter ? startVerse ?? 1 : 1
    const toVerse = chapter === endChapter ? endVerse ?? Infinity : Infinity
    for (const verse of data?.verses || []) {
      if (verse.number >= fromVerse && verse.number <= toVerse) {
        verses.push({ book: bookName, chapter, verse: verse.number })
      }
    }
  }

  return verses
}

function validateRange({
  bookName,
  startChapter,
  startVerse,
  endChapter,
  endVerse,
  bibleData,
  translationId,
}) {
  const meta = getBookMeta(bookName)
  if (!meta) return `Unknown book "${bookName}".`

  if (
    !Number.isInteger(startChapter) ||
    !Number.isInteger(endChapter) ||
    startChapter < 1 ||
    endChapter < 1 ||
    startChapter > meta.chapters ||
    endChapter > meta.chapters
  ) {
    return `${bookName} chapter is out of bounds.`
  }

  if (startChapter > endChapter) {
    return `${bookName} range is reversed (${startChapter}-${endChapter}).`
  }

  if (startVerse == null || endVerse == null) return null

  const first = getChapterData(bibleData, bookName, startChapter, translationId)
  const last = startChapter === endChapter ? first : getChapterData(bibleData, bookName, endChapter, translationId)
  if (!first?.verses?.length || !last?.verses?.length) {
    return `${bookName} has missing chapter data in selected translation.`
  }

  if (
    !first.verses.some(verse => verse.number === startVerse) ||
    !last.verses.some(verse => verse.number === endVerse)
  ) {
    return `${bookName} verse is out of bounds in ${startChapter === endChapter ? `chapter ${startChapter}` : `chapters ${startChapter}-${endChapter}`}.`
  }

  if (startChapter === endChapter && startVerse > endVerse) {
    return `${bookName} verse range is reversed (${startChapter}:${startVerse}-${endVerse}).`
  }

  return null
}

function parseNumericPart({
  numericPart,
  explicitBook,
  context,
  bookName,
}) {
  const cleaned = String(numericPart || '')
    .replace(/^[.,\s]+|[.,\s]+$/g, '')
    .replace(/\s+/g, '')

  if (!cleaned) return null

  const crossChapter = cleaned.match(/^(\d+):(\d+)-(\d+):(\d+)$/)
  if (crossChapter) {
    const startChapter = Number(crossChapter[1])
    const startVerse = Number(crossChapter[2])
    const endChapter = Number(crossChapter[3])
    const endVerse = Number(crossChapter[4])
    return {
      bookName,
      startChapter,
      startVerse,
      endChapter,
      endVerse,
      mode: 'verse',
      contextChapter: endChapter,
    }
  }

  const sameChapterRange = cleaned.match(/^(\d+):(\d+)-(\d+)$/)
  if (sameChapterRange) {
    const chapter = Number(sameChapterRange[1])
    const startVerse = Number(sameChapterRange[2])
    const endVerse = Number(sameChapterRange[3])
    return {
      bookName,
      startChapter: chapter,
      startVerse,
      endChapter: chapter,
      endVerse,
      mode: 'verse',
      contextChapter: chapter,
    }
  }

  const singleVerse = cleaned.match(/^(\d+):(\d+)$/)
  if (singleVerse) {
    const chapter = Number(singleVerse[1])
    const verse = Number(singleVerse[2])
    return {
      bookName,
      startChapter: chapter,
      startVerse: verse,
      endChapter: chapter,
      endVerse: verse,
      mode: 'verse',
      contextChapter: chapter,
    }
  }

  const plainRange = cleaned.match(/^(\d+)-(\d+)$/)
  if (plainRange) {
    const from = Number(plainRange[1])
    const to = Number(plainRange[2])
    const treatAsVerseRange = !explicitBook && context?.mode === 'verse' && Number.isInteger(context?.chapter)
    if (treatAsVerseRange) {
      return {
        bookName,
        startChapter: context.chapter,
        startVerse: from,
        endChapter: context.chapter,
        endVerse: to,
        mode: 'verse',
        contextChapter: context.chapter,
      }
    }

    return {
      bookName,
      startChapter: from,
      startVerse: null,
      endChapter: to,
      endVerse: null,
      mode: 'chapter',
      contextChapter: to,
    }
  }

  const plainSingle = cleaned.match(/^(\d+)$/)
  if (plainSingle) {
    const value = Number(plainSingle[1])
    const treatAsVerse = !explicitBook && context?.mode === 'verse' && Number.isInteger(context?.chapter)
    if (treatAsVerse) {
      return {
        bookName,
        startChapter: context.chapter,
        startVerse: value,
        endChapter: context.chapter,
        endVerse: value,
        mode: 'verse',
        contextChapter: context.chapter,
      }
    }

    return {
      bookName,
      startChapter: value,
      startVerse: null,
      endChapter: value,
      endVerse: null,
      mode: 'chapter',
      contextChapter: value,
    }
  }

  // A lenient fallback for inputs like "1:1-2:3."
  const fallback = cleaned.match(/^(\d+):(\d+)-(\d+):(\d+)\.?$/)
  if (fallback) {
    const startChapter = Number(fallback[1])
    const startVerse = Number(fallback[2])
    const endChapter = Number(fallback[3])
    const endVerse = Number(fallback[4])
    return {
      bookName,
      startChapter,
      startVerse,
      endChapter,
      endVerse,
      mode: 'verse',
      contextChapter: endChapter,
    }
  }

  // Keep parser permissive for chapter references with trailing punctuation.
  const punctuationChapter = cleaned.match(/^(\d+)\.?$/)
  if (punctuationChapter) {
    const chapter = Number(punctuationChapter[1])
    return {
      bookName,
      startChapter: chapter,
      startVerse: null,
      endChapter: chapter,
      endVerse: null,
      mode: 'chapter',
      contextChapter: chapter,
    }
  }

  return null
}

function parseReferenceChunk(chunk, context, bibleData, translationId) {
  const normalized = String(chunk || '').trim().replace(/\s+/g, ' ')
  if (!normalized) return null

  const aliasMatch = resolveBookAliasPrefix(normalized)
  const explicitBook = Boolean(aliasMatch?.book)
  const bookName = explicitBook ? aliasMatch.book : context?.book || null
  const numericPart = explicitBook ? aliasMatch.rest : normalized

  if (!bookName) {
    return { warning: `Could not determine book for "${normalized}".` }
  }

  const parsed = parseNumericPart({
    numericPart,
    explicitBook,
    context,
    bookName,
  })

  if (!parsed) {
    return { warning: `Could not parse "${normalized}".` }
  }

  const validationError = validateRange({
    bookName: parsed.bookName,
    startChapter: parsed.startChapter,
    startVerse: parsed.startVerse,
    endChapter: parsed.endChapter,
    endVerse: parsed.endVerse,
    bibleData,
    translationId,
  })

  if (validationError) {
    return { warning: `${validationError} Skipped "${normalized}".` }
  }

  const verses = expandVerses({
    bookName: parsed.bookName,
    startChapter: parsed.startChapter,
    startVerse: parsed.startVerse,
    endChapter: parsed.endChapter,
    endVerse: parsed.endVerse,
    bibleData,
    translationId,
  })

  if (verses.length === 0) {
    return { warning: `No verses found for "${normalized}" in loaded data.` }
  }

  return {
    entry: {
      book: parsed.bookName,
      translationId,
      startChapter: parsed.startChapter,
      startVerse: parsed.startVerse,
      endChapter: parsed.endChapter,
      endVerse: parsed.endVerse,
      englishRef: formatReference(
        parsed.bookName,
        parsed.startChapter,
        parsed.startVerse,
        parsed.endChapter,
        parsed.endVerse
      ),
      verses,
      source: normalized,
    },
    nextContext: {
      book: parsed.bookName,
      chapter: parsed.contextChapter,
      mode: parsed.mode,
    },
  }
}

function parseSegment(segment, context, bibleData, translationId) {
  const tokens = String(segment || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const entries = []
  const warnings = []
  let index = 0
  let activeContext = context

  while (index < tokens.length) {
    let matched = false

    for (let end = tokens.length; end > index; end -= 1) {
      const candidate = tokens.slice(index, end).join(' ')
      const parsed = parseReferenceChunk(candidate, activeContext, bibleData, translationId)
      if (!parsed || (!parsed.entry && !parsed.warning)) continue

      if (parsed.entry) {
        entries.push(parsed.entry)
        activeContext = parsed.nextContext || activeContext
        index = end
        matched = true
        break
      }

      if (end === index + 1) {
        warnings.push(parsed.warning)
      }
    }

    if (!matched) index += 1
  }

  return { entries, warnings, context: activeContext }
}

export function parseMassVerseInput(input, options = {}) {
  const {
    bibleData,
    translationId = null,
    defaultBook = null,
    defaultChapter = null,
    defaultMode = 'chapter',
  } = options

  const normalized = normalizeInput(input)
  if (!normalized) {
    return {
      entries: [],
      warnings: [],
    }
  }

  const segments = normalized.split(',').map(item => item.trim()).filter(Boolean)
  const warnings = []
  const entries = []
  let context = {
    book: defaultBook,
    chapter: defaultChapter,
    mode: defaultMode,
  }

  for (const segment of segments) {
    const parsed = parseSegment(segment, context, bibleData, translationId)
    entries.push(...parsed.entries)
    warnings.push(...parsed.warnings)
    context = parsed.context || context
  }

  return { entries, warnings }
}

function localizedReference(entry, translationId) {
  const localizedBook = localizeBookName(entry.book, translationId)
  const start = psalmComparisonVerseNumber(entry.book, entry.startChapter, entry.startVerse, entry.translationId, translationId)
  const end = psalmComparisonVerseNumber(entry.book, entry.endChapter, entry.endVerse, entry.translationId, translationId)
  return `${translationDisplayAbbr(translationId)}: ${formatReference(localizedBook, entry.startChapter, start, entry.endChapter, end)}`
}

export function buildMassExportRows(entries, translationIds, translationDataById) {
  if (!Array.isArray(entries) || entries.length === 0) return []

  return entries.map(entry => {
    const translationCells = {}

    for (const translationId of translationIds) {
      const bibleData = translationDataById?.[translationId] || null
      const lines = entry.verses.map(verseRef => {
        const number = psalmComparisonVerseNumber(verseRef.book, verseRef.chapter, verseRef.verse, entry.translationId, translationId)
        const verseText = getVerseText(
          bibleData,
          verseRef.book,
          verseRef.chapter,
          number,
          translationId
        )
        return `(${number}) ${translationDisplayText(translationId, verseText) || '[Verse unavailable]'}`
      })
      translationCells[translationId] = lines
    }

    return {
      ...entry,
      localizedLine: translationIds.map(id => localizedReference(entry, id)).join(' • '),
      translationCells,
    }
  })
}

export function formatMassExportPlain(rows, translationIds) {
  if (!Array.isArray(rows) || rows.length === 0) return ''

  return rows
    .map(row => {
      const sections = [`${row.englishRef}`, `${row.localizedLine}`]
      for (const translationId of translationIds) {
        const verseLines = row.translationCells[translationId] || ['[Verse unavailable]']
        sections.push(localizedReference(row, translationId))
        sections.push(verseLines.join('\n'))
      }
      return sections.join('\n')
    })
    .join('\n\n')
}

export function formatMassExportMarkdown(rows, translationIds) {
  if (!Array.isArray(rows) || rows.length === 0) return ''

  const header = ['Reference', ...translationIds.map(translationDisplayAbbr)].join(' | ')
  const separator = ['---', ...translationIds.map(() => '---')].join(' | ')

  const body = rows.map(row => {
    const refCell = escapeMarkdownCell(`${row.englishRef}\n${row.localizedLine}`)
    const translationCells = translationIds.map(translationId => {
      const lines = row.translationCells[translationId] || ['[Verse unavailable]']
      return escapeMarkdownCell(lines.join('\n'))
    })
    return `| ${refCell} | ${translationCells.join(' | ')} |`
  })

  return [header, separator, ...body].join('\n')
}
