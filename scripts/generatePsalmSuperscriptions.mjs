import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const webPsalmsPath = path.join(repoRoot, 'public/data/translations/WEB/psalms.json')
const lsvPsalmsPath = path.join(repoRoot, 'public/data/translations/LSV/psalms.json')
const outputPath = path.join(repoRoot, 'src/data/psalm-superscriptions.json')

const acrosticMarkers = new Set([
  'ALEPH',
  'BETH',
  'GIMEL',
  'DALETH',
  'HE',
  'WAW',
  'ZAYIN',
  'HETH',
  'TETH',
  'YOD',
  'KAPH',
  'LAMED',
  'MEM',
  'NUN',
  'SAMEKH',
  'AYIN',
  'PE',
  'TSADI',
  'QOPH',
  'RESH',
  'SIN AND SHIN',
  'TAW',
])

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function extractWebSuperscription(chapter) {
  const firstVerseText = chapter?.verses?.[0]?.text || ''
  const match = firstVerseText.match(/^<b>(.*?)<\/b>\s*/)
  if (!match) return null

  const text = match[1].replace(/\s+/g, ' ').trim()
  const normalized = text.replace(/[.\s]+$/g, '').toUpperCase()
  if (acrosticMarkers.has(normalized)) return null

  return text
}

function extractLsvPrefix(firstVerseText) {
  const source = String(firstVerseText || '')
  const lowerMatch = source.match(/[a-z]/)
  if (!lowerMatch) return ''

  const beforeFirstLowercase = source.slice(0, lowerMatch.index)
  const delimiterPattern = /[.!?:][”"]?\s+/g
  let cutIndex = 0
  let match

  while ((match = delimiterPattern.exec(beforeFirstLowercase)) !== null) {
    cutIndex = match.index + match[0].length
  }

  return cutIndex > 0 ? source.slice(0, cutIndex).replace(/\s+/g, ' ').trim() : ''
}

const webPsalms = readJson(webPsalmsPath)
const lsvPsalms = readJson(lsvPsalmsPath)
const lsvChapterMap = new Map(lsvPsalms.chapters.map(chapter => [chapter.number, chapter]))

const superscriptions = {}

for (const chapter of webPsalms.chapters) {
  if (chapter.number > 150) continue

  const text = extractWebSuperscription(chapter)
  if (!text) continue

  const lsvChapter = lsvChapterMap.get(chapter.number)
  const lsvPrefix = extractLsvPrefix(lsvChapter?.verses?.[0]?.text)

  superscriptions[String(chapter.number)] = {
    text,
    stripPrefixes: {
      ...(lsvPrefix ? { LSV: lsvPrefix } : {}),
    },
  }
}

fs.writeFileSync(outputPath, `${JSON.stringify(superscriptions, null, 2)}\n`)
console.log(`Wrote ${Object.keys(superscriptions).length} Psalm superscriptions to ${path.relative(repoRoot, outputPath)}`)
