import { createHash } from 'node:crypto'
import path from 'node:path'
import JSZip from 'jszip'
import {
  CANONICAL_BIBLE_BOOKS,
  normalizeBibleRange,
} from './BibleRange.ts'

export const SERMON_SOURCE_EXTRACTION_SCHEMA_VERSION = 1
export const SERMON_SOURCE_EXTRACTOR = 'heritage-community-deterministic-v1'
export const MAX_SERMON_SOURCE_UPLOAD_BYTES = 32 * 1024 * 1024
export const MAX_SERMON_SOURCE_EXTRACTED_TEXT_BYTES = 2 * 1024 * 1024

const MAX_ARCHIVE_ENTRIES = 10_000
const MAX_XML_PART_BYTES = 16 * 1024 * 1024
const MAX_PDF_PAGES = 2_000
const PDF_STANDARD_FONT_PATH = `${path.join(
  process.cwd(),
  'node_modules',
  'pdfjs-dist',
  'standard_fonts',
)}${path.sep}`

type SourceFormat = 'pdf' | 'docx' | 'pptx' | 'markdown' | 'text'

type FormatContract = Readonly<{
  format: SourceFormat
  mediaType: string
  extensions: readonly string[]
  suggestedKind: 'manuscript' | 'slide-notes'
}>

const FORMATS: readonly FormatContract[] = Object.freeze([
  Object.freeze({
    format: 'pdf',
    mediaType: 'application/pdf',
    extensions: Object.freeze(['.pdf']),
    suggestedKind: 'manuscript',
  }),
  Object.freeze({
    format: 'docx',
    mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: Object.freeze(['.docx']),
    suggestedKind: 'manuscript',
  }),
  Object.freeze({
    format: 'pptx',
    mediaType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensions: Object.freeze(['.pptx']),
    suggestedKind: 'slide-notes',
  }),
  Object.freeze({
    format: 'markdown',
    mediaType: 'text/markdown; charset=utf-8',
    extensions: Object.freeze(['.md', '.markdown']),
    suggestedKind: 'manuscript',
  }),
  Object.freeze({
    format: 'text',
    mediaType: 'text/plain; charset=utf-8',
    extensions: Object.freeze(['.txt', '.text']),
    suggestedKind: 'manuscript',
  }),
])

export type SermonSourcePassageSuggestion = Readonly<{
  enteredText: string
  passage: Readonly<{
    bookId: string
    startChapter: number
    startVerse: number
    endChapter: number
    endVerse: number
  }>
}>

export type SermonSourceExtraction = Readonly<{
  schemaVersion: typeof SERMON_SOURCE_EXTRACTION_SCHEMA_VERSION
  extractor: typeof SERMON_SOURCE_EXTRACTOR
  fileName: string
  format: SourceFormat
  mediaType: string
  sizeBytes: number
  sha256: string
  extractedText: string
  extractedTextSha256: string
  suggestedKind: 'manuscript' | 'slide-notes'
  suggestedTitle: string | null
  suggestedReferences: readonly SermonSourcePassageSuggestion[]
}>

export class SermonSourceExtractionError extends Error {
  code: string
  status: number

  constructor(code: string, message: string, status = 422) {
    super(message)
    this.name = 'SermonSourceExtractionError'
    this.code = code
    this.status = status
  }
}

function fail(code: string, message: string, status = 422): never {
  throw new SermonSourceExtractionError(code, message, status)
}

function safeFileName(value: string) {
  const normalized = value.trim().normalize('NFC')
  if (
    !normalized
    || normalized.length > 255
    || normalized !== path.basename(normalized)
    || /[\u0000-\u001f\u007f/\\]/u.test(normalized)
  ) {
    fail('INVALID_FILE_NAME', 'The pastor source file name is invalid.')
  }
  return normalized
}

function formatForFileName(fileName: string) {
  const extension = path.extname(fileName).toLowerCase()
  const found = FORMATS.find(candidate => candidate.extensions.includes(extension))
  if (!found) {
    fail(
      'UNSUPPORTED_SOURCE_TYPE',
      'Choose a PDF, DOCX, PPTX, Markdown, or plain-text sermon source.',
      415,
    )
  }
  return found
}

function assertMagic(bytes: Uint8Array, format: SourceFormat) {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value)
  if (format === 'pdf' && !starts(0x25, 0x50, 0x44, 0x46, 0x2d)) {
    fail('INVALID_PDF', 'The selected PDF does not have a valid PDF signature.')
  }
  if (['docx', 'pptx'].includes(format) && !(
    starts(0x50, 0x4b, 0x03, 0x04)
    || starts(0x50, 0x4b, 0x05, 0x06)
    || starts(0x50, 0x4b, 0x07, 0x08)
  )) {
    fail('INVALID_OFFICE_FILE', 'The selected Office file is not a valid OOXML archive.')
  }
}

function normalizeExtractedText(value: string) {
  if (value.includes('\0')) fail('INVALID_SOURCE_TEXT', 'The sermon source contains a null character.')
  const normalized = value
    .replace(/^\uFEFF/u, '')
    .replace(/\r\n?/gu, '\n')
    .normalize('NFC')
    .split('\n')
    .map(line => line.replace(/[\t ]+$/u, ''))
    .join('\n')
    .replace(/\n{4,}/gu, '\n\n\n')
    .trim()
  if (!normalized) fail('NO_EXTRACTABLE_TEXT', 'No reviewable sermon text was found in that file.')
  if (Buffer.byteLength(normalized, 'utf8') > MAX_SERMON_SOURCE_EXTRACTED_TEXT_BYTES) {
    fail('EXTRACTED_TEXT_TOO_LARGE', 'The extracted sermon text is too large to review safely.')
  }
  return normalized
}

function decodeXml(value: string) {
  return value.replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|amp|lt|gt|quot|apos);/giu,
    token => {
      if (token === '&amp;') return '&'
      if (token === '&lt;') return '<'
      if (token === '&gt;') return '>'
      if (token === '&quot;') return '"'
      if (token === '&apos;') return "'"
      const decimal = /^&#(\d+);$/u.exec(token)?.[1]
      const hexadecimal = /^&#x([0-9a-f]+);$/iu.exec(token)?.[1]
      const codePoint = Number.parseInt(decimal || hexadecimal || '', decimal ? 10 : 16)
      return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : token
    },
  )
}

function textFromOfficeXml(xml: string) {
  if (Buffer.byteLength(xml, 'utf8') > MAX_XML_PART_BYTES) {
    fail('OFFICE_PART_TOO_LARGE', 'An Office document text part is too large.')
  }
  return decodeXml(xml
    .replace(/<(?:w:tab|a:tab)\b[^>]*\/?\s*>/giu, '\t')
    .replace(/<(?:w:br|a:br)\b[^>]*\/?\s*>/giu, '\n')
    .replace(/<\/(?:w:p|a:p)>/giu, '\n')
    .replace(/<[^>]+>/gu, ''))
}

async function officeArchive(bytes: Uint8Array) {
  let archive: JSZip
  try {
    archive = await JSZip.loadAsync(bytes, { checkCRC32: true })
  } catch {
    fail('INVALID_OFFICE_FILE', 'The Office archive could not be read safely.')
  }
  const entries = Object.values(archive.files)
  if (entries.length > MAX_ARCHIVE_ENTRIES) {
    fail('OFFICE_ARCHIVE_TOO_LARGE', 'The Office file contains too many internal parts.')
  }
  if (entries.some(entry => (
    entry.name.startsWith('/')
    || entry.name.includes('\\')
    || entry.name.split('/').some(part => part === '..')
  ))) {
    fail('INVALID_OFFICE_FILE', 'The Office archive contains an unsafe part name.')
  }
  return archive
}

async function extractDocx(bytes: Uint8Array) {
  const archive = await officeArchive(bytes)
  const entry = archive.file('word/document.xml')
  if (!entry) fail('INVALID_DOCX', 'The DOCX does not contain a main document.')
  return normalizeExtractedText(textFromOfficeXml(await entry.async('string')))
}

function numberedOfficeParts(archive: JSZip, expression: RegExp) {
  return Object.values(archive.files)
    .map(entry => ({ entry, match: expression.exec(entry.name) }))
    .filter((value): value is { entry: JSZip.JSZipObject; match: RegExpExecArray } => (
      !value.entry.dir && value.match !== null
    ))
    .sort((left, right) => Number(left.match[1]) - Number(right.match[1]))
}

async function extractPptx(bytes: Uint8Array) {
  const archive = await officeArchive(bytes)
  const slides = numberedOfficeParts(archive, /^ppt\/slides\/slide(\d+)\.xml$/u)
  if (!slides.length) fail('INVALID_PPTX', 'The PPTX does not contain any slides.')
  const units: string[] = []
  for (const { entry, match } of slides) {
    const text = textFromOfficeXml(await entry.async('string')).trim()
    units.push(
      text
        ? `Slide ${Number(match[1])}\n${text}`
        : `Slide ${Number(match[1])}\n[Blank slide]`,
    )
  }
  const notes = numberedOfficeParts(
    archive,
    /^ppt\/notesSlides\/notesSlide(\d+)\.xml$/u,
  )
  for (const { entry, match } of notes) {
    const text = textFromOfficeXml(await entry.async('string')).trim()
    if (text) units.push(`Speaker notes ${Number(match[1])}\n${text}`)
  }
  return normalizeExtractedText(units.join('\n\n'))
}

async function extractPdf(bytes: Uint8Array) {
  let loadingTask: { promise: Promise<any>; destroy: () => Promise<void> } | null = null
  let document: any = null
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    loadingTask = pdfjs.getDocument({
      data: new Uint8Array(bytes),
      disableFontFace: true,
      standardFontDataUrl: PDF_STANDARD_FONT_PATH,
      useSystemFonts: false,
    })
    document = await loadingTask.promise
    if (!Number.isSafeInteger(document.numPages) || document.numPages < 1 || document.numPages > MAX_PDF_PAGES) {
      fail('INVALID_PDF', 'The PDF page count is invalid.')
    }
    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      let text = ''
      for (const item of content.items as Array<Record<string, unknown>>) {
        if (typeof item.str !== 'string') continue
        text += `${item.str}${item.hasEOL ? '\n' : ' '}`
      }
      pages.push(`Page ${pageNumber}\n${text.trim()}`)
      page.cleanup()
    }
    return normalizeExtractedText(pages.join('\n\n'))
  } catch (error) {
    if (error instanceof SermonSourceExtractionError) throw error
    fail('INVALID_PDF', 'The PDF text could not be extracted safely.')
  } finally {
    await document?.destroy?.().catch(() => undefined)
    await loadingTask?.destroy?.().catch(() => undefined)
  }
}

function suggestedTitle(text: string) {
  const candidate = text.split('\n').map(line => line.trim()).find(Boolean) || ''
  const cleaned = candidate
    .replace(/^(?:title|sermon)\s*:\s*/iu, '')
    .replace(/^(?:page|slide)\s+\d+\s*$/iu, '')
    .trim()
  return cleaned && cleaned.length <= 300 ? cleaned : null
}

function referenceSuggestions(text: string): readonly SermonSourcePassageSuggestion[] {
  const aliases = CANONICAL_BIBLE_BOOKS.flatMap(book => [
    { token: book.name, bookId: book.id },
    { token: book.id, bookId: book.id },
  ]).sort((left, right) => right.token.length - left.token.length)
  const tokenPattern = aliases
    .map(value => value.token.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
    .join('|')
  const expression = new RegExp(
    `(?<![\\p{L}\\p{N}_])(?<book>${tokenPattern})\\.?\\s+`
      + '(?<startChapter>\\d{1,3}):(?<startVerse>\\d{1,3})'
      + '(?:\\s*[–—-]\\s*(?:(?<endChapter>\\d{1,3}):)?(?<endVerse>\\d{1,3}))?',
    'giu',
  )
  const aliasMap = new Map(aliases.map(value => [
    value.token.toLocaleLowerCase().replace(/[.\s]+/gu, ''),
    value.bookId,
  ]))
  const found: SermonSourcePassageSuggestion[] = []
  const seen = new Set<string>()
  for (const match of text.matchAll(expression)) {
    const groups = match.groups || {}
    const bookId = aliasMap.get(
      String(groups.book || '').toLocaleLowerCase().replace(/[.\s]+/gu, ''),
    )
    if (!bookId) continue
    const startChapter = Number(groups.startChapter)
    const startVerse = Number(groups.startVerse)
    const endChapter = Number(groups.endChapter || startChapter)
    const endVerse = Number(groups.endVerse || startVerse)
    try {
      normalizeBibleRange({
        bookId,
        start: { chapter: startChapter, verse: startVerse },
        end: { chapter: endChapter, verse: endVerse },
      })
    } catch {
      continue
    }
    const key = `${bookId}:${startChapter}:${startVerse}:${endChapter}:${endVerse}`
    if (seen.has(key)) continue
    seen.add(key)
    found.push(Object.freeze({
      enteredText: String(match[0]).trim(),
      passage: Object.freeze({
        bookId,
        startChapter,
        startVerse,
        endChapter,
        endVerse,
      }),
    }))
    if (found.length >= 32) break
  }
  return Object.freeze(found)
}

export async function extractSermonSource(
  bytes: Uint8Array,
  rawFileName: string,
): Promise<SermonSourceExtraction> {
  if (
    !(bytes instanceof Uint8Array)
    || bytes.byteLength < 1
    || bytes.byteLength > MAX_SERMON_SOURCE_UPLOAD_BYTES
  ) {
    fail(
      'SOURCE_TOO_LARGE',
      `Pastor sources must be between 1 byte and ${MAX_SERMON_SOURCE_UPLOAD_BYTES / (1024 * 1024)} MB.`,
      413,
    )
  }
  const fileName = safeFileName(rawFileName)
  const contract = formatForFileName(fileName)
  assertMagic(bytes, contract.format)
  let extractedText: string
  if (contract.format === 'docx') extractedText = await extractDocx(bytes)
  else if (contract.format === 'pptx') extractedText = await extractPptx(bytes)
  else if (contract.format === 'pdf') extractedText = await extractPdf(bytes)
  else {
    try {
      extractedText = normalizeExtractedText(
        new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      )
    } catch (error) {
      if (error instanceof SermonSourceExtractionError) throw error
      fail('INVALID_SOURCE_TEXT', 'Markdown and text sources must use valid UTF-8.')
    }
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const extractedTextSha256 = createHash('sha256')
    .update(extractedText, 'utf8')
    .digest('hex')
  return Object.freeze({
    schemaVersion: SERMON_SOURCE_EXTRACTION_SCHEMA_VERSION,
    extractor: SERMON_SOURCE_EXTRACTOR,
    fileName,
    format: contract.format,
    mediaType: contract.mediaType,
    sizeBytes: bytes.byteLength,
    sha256,
    extractedText,
    extractedTextSha256,
    suggestedKind: contract.suggestedKind,
    suggestedTitle: suggestedTitle(extractedText),
    suggestedReferences: referenceSuggestions(extractedText),
  })
}
