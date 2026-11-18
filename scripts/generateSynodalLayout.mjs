import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const dataDir = fileURLToPath(new URL('../public/data/', import.meta.url))
const revision = '00ae4ffbd7a4ac1fb70ebb941109439316e4f5c9'
const readJson = path => JSON.parse(readFileSync(join(dataDir, path), 'utf8'))
const reference = (book, chapter, verse) => `${book}|${chapter}|${verse}`

function indexTranslation(translation) {
  const texts = new Map()
  const chapterStarts = new Set()
  const books = readJson(`translations/${translation}.json`).books
  for (const book of books) {
    for (const chapter of book.chapters) {
      const first = chapter.verses.find(verse => verse.text.trim())
      if (first) chapterStarts.add(reference(book.name, chapter.number, first.number))
      for (const verse of chapter.verses) {
        texts.set(reference(book.name, chapter.number, verse.number), verse.text)
      }
    }
  }
  return { books, texts, chapterStarts }
}

function matchableWords(text) {
  return text
    .replace(/\\(f|x)\s.*?\\\1\*/g, '')
    .replace(/\\\+?[a-z][a-z\d]*\*?/gi, '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/\u0301/g, '')
    .replace(/ё/g, 'е')
    .match(/\p{Script=Cyrillic}+/gu) || []
}

function startsWithSameWords(sourceText, nativeText) {
  const source = matchableWords(sourceText)
  const native = matchableWords(nativeText)
  if (source.length >= 5 && native.length >= 5) {
    return source.slice(0, 5).every((word, index) => word === native[index])
  }
  return source.length > 0 && source.join(' ') === native.join(' ')
}

function findDisplayStart(nativeRef, nativeText, nativeToDisplay, displayToNative, displayTexts) {
  const pieces = nativeToDisplay.sourcePieces[nativeRef]
  const starts = pieces?.filter(piece => piece.startOffset === 0)
    .map(piece => piece.canonicalReference) ?? nativeToDisplay.map[nativeRef]
  if (starts?.length !== 1) return null

  const [displayRef] = starts
  const firstPiece = displayToNative.sourcePieces[displayRef]?.[0]
  if (pieces) {
    if (firstPiece?.nativeReference !== nativeRef || firstPiece.startOffset !== 0) return null
    nativeText = nativeText.slice(0, firstPiece.endOffset).trim()
  } else if (displayToNative.map[displayRef]?.[0] !== nativeRef) {
    return null
  }

  const displayText = displayTexts.get(displayRef)
  return nativeText && (displayText === nativeText || displayText?.startsWith(`${nativeText} `))
    ? displayRef
    : null
}

const [sourceDir, output = join(dataDir, 'verse-layout/SYNO-W.json')] = process.argv.slice(2)
if (!sourceDir) throw new Error('Usage: node scripts/generateSynodalLayout.mjs <upstream usfm/rst66 directory> [output]')

const native = indexTranslation('SYNO-W-native')
const display = indexTranslation('SYNO-W')
const nativeToDisplay = readJson('versification/SYNO-W.native-to-canonical.json')
const displayToNative = readJson('versification/SYNO-W.canonical-to-native.json')
const files = readdirSync(sourceDir).filter(file => file.endsWith('.usfm')).sort()
const filesByBook = new Map(files.map(file => [file.replace(/^\d+-|\.usfm$/g, ''), file]))
if (files.length !== native.books.length || filesByBook.size !== files.length) {
  throw new Error(`Expected ${native.books.length} distinct Synodal USFM books in ${sourceDir}`)
}

const paragraphStarts = new Set()
const coverage = { placed: 0, displayChapterStarts: 0, unverified: 0 }
for (const { name } of native.books) {
  const file = filesByBook.get(name.toLowerCase().replaceAll(' ', ''))
  if (!file) throw new Error(`Missing Synodal USFM for ${name}`)

  let chapter = 0
  let sawVerse = false
  for (const line of readFileSync(join(sourceDir, file), 'utf8').split(/\r?\n/)) {
    const chapterMarker = line.match(/^\\c\s+(\d+)\s*$/)
    if (chapterMarker) {
      chapter = Number(chapterMarker[1])
      sawVerse = false
      continue
    }

    // In this edition an inline \p \v opens a paragraph. Its other text
    // layout markers can occur inside a verse and are outside this import.
    const verseMarker = line.match(/^(\\p\s+)?\\v\s+(\d+)\s+(.*)$/)
    if (!chapter || !verseMarker) continue
    const [, paragraph, verse, sourceText] = verseMarker
    const startsParagraph = sawVerse && paragraph
    sawVerse = true
    if (!startsParagraph) continue

    const nativeRef = reference(name, chapter, verse)
    const nativeText = native.texts.get(nativeRef)
    const displayRef = nativeText && startsWithSameWords(sourceText, nativeText)
      ? findDisplayStart(nativeRef, nativeText, nativeToDisplay, displayToNative, display.texts)
      : null

    if (!displayRef) coverage.unverified++
    else if (display.chapterStarts.has(displayRef)) coverage.displayChapterStarts++
    else paragraphStarts.add(displayRef)
  }
}

const verses = {}
for (const displayRef of display.texts.keys()) {
  if (paragraphStarts.has(displayRef)) verses[displayRef.replaceAll('|', '.')] = { breakBefore: true }
}
coverage.placed = paragraphStarts.size
const payload = {
  schemaVersion: 1,
  translation: 'SYNO-W',
  source: {
    format: 'USFM',
    provider: 'Only.Bible',
    edition: 'Russian Bible Society 1995, 66-book digital edition',
    url: `https://github.com/onlydotbible/rst/tree/${revision}/usfm/rst66`,
    coverage,
  },
  verses,
}

writeFileSync(resolve(output), `${JSON.stringify(payload)}\n`)
console.log(`Wrote ${coverage.placed} paragraph starts to ${resolve(output)}; ${coverage.unverified} source internal breaks could not be verified and ${coverage.displayChapterStarts} coincide with displayed chapter starts.`)
