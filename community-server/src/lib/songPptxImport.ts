import JSZip from 'jszip'
import { songSectionMarker } from './songSourceSyntax'

const DRAWING = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const PRESENTATION = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const RELATIONSHIP = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PACKAGE = 'http://schemas.openxmlformats.org/package/2006/relationships'
const MAX_FILE = 32 * 1024 * 1024
const MAX_XML = 2 * 1024 * 1024
const MAX_TOTAL_XML = 8 * 1024 * 1024
export type SongPptxLine = { text: string; language: 'ru' | 'en' | 'unknown' }
export type SongPptxSlide = { number: number; lines: SongPptxLine[] }
export type SongPptxInspection = { fileName: string; slides: SongPptxSlide[]; firstSlideIsTitle: boolean }
export type SongPptxDraft = {
  russianTitle: string; title: string; russianLyrics: string; lyrics: string; authors: string[]
  defaultSongLanguage: 'ru' | 'en'; lyricSlides: number; blankSlides: number[]
  unresolved: { slide: number; text: string }[]; missingLanguages: { slide: number; language: 'ru' | 'en' }[]
  titleFallback: boolean
  sectionLabels: string[]
}

export class SongPptxImportError extends Error {}
const fail = (message: string): never => { throw new SongPptxImportError(message) }

/** Check the directory before inflating anything. Images/media are never read. */
function checkArchive(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_FILE) fail('Choose a PowerPoint file smaller than 32 MB.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break }
  }
  if (end < 0) fail('This file is not a readable PPTX. Save it as PowerPoint (.pptx) and try again.')
  const count = view.getUint16(end + 10, true), start = view.getUint32(end + 16, true)
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)
    || count !== view.getUint16(end + 8, true) || count > 2000
    || start + view.getUint32(end + 12, true) !== end) fail('This PowerPoint package is too large or uses an unsupported ZIP format.')
  const names = new Set<string>(); let offset = start, xmlBytes = 0
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) fail('This PowerPoint package is damaged.')
    const nameLength = view.getUint16(offset + 28, true)
    const next = offset + 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true)
    if (next > end || view.getUint16(offset + 34, true) || view.getUint16(offset + 8, true) & 1) fail('This PowerPoint package is damaged or password protected.')
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    if (names.has(name) || name.startsWith('/') || name.includes('\\') || name.split('/').includes('..')) fail('This PowerPoint package has invalid file paths.')
    names.add(name)
    if (/^ppt\/(?:presentation\.xml|_rels\/presentation\.xml\.rels|slides\/[^/]+\.xml)$/.test(name)) {
      const size = view.getUint32(offset + 24, true)
      xmlBytes += size
      if (size > MAX_XML || xmlBytes > MAX_TOTAL_XML) fail('This PowerPoint has too much slide text. Import one song at a time.')
    }
    offset = next
  }
  if (offset !== end) fail('This PowerPoint package is damaged.')
}

function splitLanguageLine(text: string): SongPptxLine[] {
  const letters = [...text.matchAll(/\p{L}/gu)]
  const ru = letters.filter(match => /\p{Script=Cyrillic}/u.test(match[0])).length
  const en = letters.filter(match => /\p{Script=Latin}/u.test(match[0])).length
  if (letters.length !== ru + en) return [{text, language: 'unknown'}]
  if (!ru && !en) return [{text, language: 'unknown'}]
  if (!ru) return [{text, language: 'en'}]
  if (!en) return [{text, language: 'ru'}]
  // A Latin lookalike inside a Russian word (e.g. Tвое) is still Russian.
  // Preserve the exact spelling; do not silently normalize people's lyrics.
  const tokens = text.match(/\p{L}+/gu) || []
  if (en <= 2 && ru > en * 4 && tokens.filter(token => /\p{Script=Latin}/u.test(token)).every(token => /\p{Script=Cyrillic}/u.test(token))) return [{text, language: 'ru'}]
  if (ru <= 2 && en > ru * 4 && tokens.filter(token => /\p{Script=Cyrillic}/u.test(token)).every(token => /\p{Script=Latin}/u.test(token))) return [{text, language: 'en'}]
  const pieces: SongPptxLine[] = []
  let start = 0, language = /\p{Script=Cyrillic}/u.test(letters[0][0]) ? 'ru' as const : 'en' as const
  for (const match of letters) {
    const nextLanguage = /\p{Script=Cyrillic}/u.test(match[0]) ? 'ru' : 'en'
    if (nextLanguage !== language) {
      const boundary = match.index!
      // Keep sentence punctuation with the preceding language, and trim only
      // boundary whitespace. Runs can switch languages without a space.
      const value = text.slice(start, boundary).trim()
      if (value) pieces.push({text: value, language})
      start = boundary; language = nextLanguage
    }
  }
  const tail = text.slice(start).trim()
  if (tail) pieces.push({text: tail, language})
  // Short alternating fragments are ambiguous, not safe language boundaries.
  if (pieces.some(piece => (piece.text.match(/\p{L}/gu) || []).length < 3)) return [{text, language: 'unknown'}]
  return pieces
}

type ParseXml = (source: string) => Document
/** Parser injection keeps the browser implementation identical to fixture tests. */
export async function inspectSongPptx(bytes: Uint8Array, fileName: string, parseXml: ParseXml = source => new DOMParser().parseFromString(source, 'application/xml')): Promise<SongPptxInspection> {
  if (!/\.pptx$/i.test(fileName)) fail('Choose a PowerPoint (.pptx) file.')
  checkArchive(bytes)
  let zip: JSZip
  try { zip = await JSZip.loadAsync(bytes) } catch { return fail('This file is not a readable PPTX. Save it as PowerPoint (.pptx) and try again.') }
  let total = 0
  const readXml = async (path: string) => {
    const entry = zip.file(path)
    if (!entry) return fail('The PowerPoint is missing a slide or its presentation order.')
    // Bound actual decompression as well as the declared directory sizes.
    const parts = await new Promise<Uint8Array[]>((resolve, reject) => {
      const chunks: Uint8Array[] = []; let size = 0
      // JSZip's documented per-entry stream API is omitted from its types.
      const stream = (entry as typeof entry & {internalStream: (type: 'uint8array') => JSZip.JSZipStreamHelper<Uint8Array>}).internalStream('uint8array')
      stream.on('data', (chunk: Uint8Array) => {
        size += chunk.length; total += chunk.length
        if (size > MAX_XML || total > MAX_TOTAL_XML) { stream.pause(); reject(new SongPptxImportError('This PowerPoint has too much slide text. Import one song at a time.')); return }
        chunks.push(chunk)
      }).on('error', reject).on('end', () => resolve(chunks)).resume()
    })
    const data = new Uint8Array(parts.reduce((size, part) => size + part.length, 0))
    let offset = 0; for (const part of parts) { data.set(part, offset); offset += part.length }
    const source = new TextDecoder('utf-8', {fatal: true}).decode(data)
    if (/<!DOCTYPE|<!ENTITY/i.test(source)) fail('This PowerPoint contains unsupported XML declarations.')
    let document: Document
    try { document = parseXml(source) } catch { return fail('This PowerPoint contains damaged slide text.') }
    if (!document?.documentElement || document.getElementsByTagName('parsererror').length) fail('This PowerPoint contains damaged slide text.')
    return document
  }
  const presentation = await readXml('ppt/presentation.xml'), rels = await readXml('ppt/_rels/presentation.xml.rels')
  const targets = new Map<string, string>()
  for (const rel of Array.from(rels.getElementsByTagNameNS(PACKAGE, 'Relationship'))) {
    if (!rel.getAttribute('Type')?.endsWith('/slide') || rel.getAttribute('TargetMode') === 'External') continue
    const target = rel.getAttribute('Target') || ''
    const path = target.startsWith('/ppt/') ? target.slice(1) : `ppt/${target}`
    if (!/^ppt\/slides\/[^/]+\.xml$/.test(path) || path.includes('..') || path.includes('\\')) fail('This PowerPoint has an unsupported slide reference.')
    targets.set(rel.getAttribute('Id') || '', path)
  }
  const slideIds = Array.from(presentation.getElementsByTagNameNS(PRESENTATION, 'sldId'))
  if (!slideIds.length || slideIds.length > 200) fail('Import a PowerPoint with 1 to 200 slides, containing one song.')
  const slides: SongPptxSlide[] = []
  for (const [index, slideId] of slideIds.entries()) {
    const path = targets.get(slideId.getAttributeNS(RELATIONSHIP, 'id') || '')
    if (!path) fail('The PowerPoint is missing a slide or its presentation order.')
    const document = await readXml(path!)
    const regions = Array.from(document.getElementsByTagNameNS(PRESENTATION, 'spTree'))[0]
    if (!regions) fail('This PowerPoint contains damaged slide text.')
    const raw: string[] = []
    const visit = (element: Element) => {
      const properties = element.getElementsByTagNameNS(PRESENTATION, 'cNvPr')[0]
      if (properties?.getAttribute('hidden') === '1') return
      const placeholder = element.getElementsByTagNameNS(PRESENTATION, 'ph')[0]?.getAttribute('type')
      if (placeholder && ['ftr', 'dt', 'sldNum'].includes(placeholder)) return
      for (const child of Array.from(element.childNodes)) {
        if (child.nodeType !== 1) continue
        const node = child as Element
        if (node.namespaceURI === DRAWING && node.localName === 'p') {
          let text = ''
          const collect = (part: Element) => {
            if (part.namespaceURI === DRAWING && part.localName === 't') { text += part.textContent || ''; return }
            if (part.namespaceURI === DRAWING && part.localName === 'br') { text += '\n'; return }
            for (const child of Array.from(part.childNodes)) if (child.nodeType === 1) collect(child as Element)
          }
          collect(node); raw.push(...text.split('\n').map(line => line.trim()).filter(Boolean))
        } else visit(node)
      }
    }
    // Top-to-bottom/left-to-right shape order handles separate bilingual boxes.
    // Keep paragraph/run order inside a box; XML run boundaries are not lines.
    const shapes = Array.from(regions.childNodes).filter(node => node.nodeType === 1) as Element[]
    const position = (shape: Element) => {
      const off = shape.getElementsByTagNameNS(DRAWING, 'off')[0]
      return {y: Number(off?.getAttribute('y') || 0), x: Number(off?.getAttribute('x') || 0)}
    }
    shapes.sort((a, b) => position(a).y - position(b).y || position(a).x - position(b).x).forEach(visit)
    if (raw.join('\n').length > 32000) fail('A slide has too much text. Import one song at a time.')
    const lines = raw.flatMap(splitLanguageLine)
    // Numbers and punctuation-only lines belong to their surrounding language.
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].language === 'unknown' && !/\p{L}/u.test(lines[i].text)) {
        const neighbor = lines[i - 1] || lines[i + 1]
        if (neighbor && neighbor.language !== 'unknown') lines[i].language = neighbor.language
      }
    }
    slides.push({number: index + 1, lines})
  }
  if (!slides.some(slide => slide.lines.length)) fail('No editable text was found. Slides made only of pictures need editable text or pasted lyrics.')
  const first = slides[0].lines
  const firstSlideIsTitle = first.length > 0 && first.length <= 6
    && first.filter(line => line.language === 'ru').length <= 2
    && first.filter(line => line.language === 'en').length <= 4
    && first.every(line => line.text.length <= 160)
    && slides.slice(1).some(slide => slide.lines.length)
    && (first.length <= 2 || first.some(line => creditPrefix.test(line.text) || /©|copyright|\bCCLI\b/iu.test(line.text))
      || (first.filter(line => line.language === 'ru').length === 1 && first[0]?.language === 'ru' && first[1]?.language === 'en'))
  return {fileName, slides, firstSlideIsTitle}
}

const creditPrefix = /^(?:(?:words?\s*(?:and|&)\s*music|words?|music|written)\s+by\s*|(?:слова\s*и\s*музыка|слова|музыка|автор(?:ы)?)\s*:?\s*)/iu
export function draftSongPptx(inspection: SongPptxInspection, firstSlideIsTitle = inspection.firstSlideIsTitle): SongPptxDraft {
  const titleLines = firstSlideIsTitle ? inspection.slides[0].lines : []
  const titleIndex = {ru: -1, en: -1}
  for (const [index, line] of titleLines.entries()) {
    if (creditPrefix.test(line.text) || /©|copyright|\bCCLI\b/iu.test(line.text)) break
    if (line.language !== 'unknown' && titleIndex[line.language] < 0) titleIndex[line.language] = index
  }
  const russianTitle = titleLines[titleIndex.ru]?.text || ''
  const englishTitle = titleLines[titleIndex.en]?.text || ''
  const credits = titleLines.filter((_, i) => i !== titleIndex.ru && i !== titleIndex.en).map(line => line.text.replace(creditPrefix, '').trim()).filter(Boolean)
  const authors = credits.filter(line => !/©|copyright|\bCCLI\b|все права/iu.test(line)).flatMap(line => line.split(/\s+\/\s+/).map(value => value.trim()).filter(Boolean))
  const remaining = inspection.slides.slice(firstSlideIsTitle ? 1 : 0)
  const sectionLabels: string[] = []
  const lyricSlides = remaining.map(slide => ({...slide, lines: slide.lines.filter(line => {
    if (!songSectionMarker(line.text)) return true
    sectionLabels.push(`${slide.number}: ${line.text}`)
    return false
  })}))
  const nonempty = lyricSlides.filter(slide => slide.lines.length)
  const hasRussian = nonempty.some(slide => slide.lines.some(line => line.language === 'ru'))
  const hasEnglish = nonempty.some(slide => slide.lines.some(line => line.language === 'en'))
  const unresolved = inspection.slides.flatMap(slide => slide.lines.filter(line => line.language === 'unknown').map(line => ({slide: slide.number, text: line.text})))
  const missingLanguages = nonempty.flatMap(slide => (['ru', 'en'] as const).filter(language => (language === 'ru' ? hasRussian : hasEnglish) && !slide.lines.some(line => line.language === language)).map(language => ({slide: slide.number, language})))
  // Explicit matching IDs prevent a missing translation from shifting all
  // subsequent slides. Repeated slides remain separate, editable occurrences.
  const lyricsFor = (language: 'ru' | 'en') => nonempty.map(slide => {
    const text = slide.lines.filter(line => line.language === language).map(line => line.text.startsWith('^') ? `^${line.text}` : line.text).join('\n')
    return text ? `^slide-${slide.number}\n${text}` : ''
  }).filter(Boolean).join('\n\n')
  return {
    russianTitle, title: englishTitle || russianTitle || inspection.fileName.replace(/\.pptx$/i, ''),
    russianLyrics: lyricsFor('ru'), lyrics: lyricsFor('en'), authors: [...new Set(authors)],
    defaultSongLanguage: hasRussian ? 'ru' : 'en', lyricSlides: nonempty.length,
    blankSlides: remaining.filter(slide => !slide.lines.length).map(slide => slide.number),
    unresolved, missingLanguages, titleFallback: !englishTitle, sectionLabels,
  }
}
