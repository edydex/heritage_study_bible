import fs from 'node:fs'
import path from 'node:path'
import { bibleBooks } from '../src/data/bible-books.js'

const totalDays = 365

const chronologicalOrder = [
  'Genesis',
  'Job',
  'Exodus',
  'Leviticus',
  'Numbers',
  'Deuteronomy',
  'Joshua',
  'Judges',
  'Ruth',
  '1 Samuel',
  '2 Samuel',
  '1 Chronicles',
  'Psalms',
  'Song of Solomon',
  'Proverbs',
  'Ecclesiastes',
  '1 Kings',
  '2 Kings',
  '2 Chronicles',
  'Jonah',
  'Amos',
  'Hosea',
  'Isaiah',
  'Micah',
  'Nahum',
  'Zephaniah',
  'Jeremiah',
  'Habakkuk',
  'Lamentations',
  'Ezekiel',
  'Daniel',
  'Obadiah',
  'Joel',
  'Ezra',
  'Haggai',
  'Zechariah',
  'Esther',
  'Nehemiah',
  'Malachi',
  'Matthew',
  'Mark',
  'Luke',
  'John',
  'Acts',
  'James',
  'Galatians',
  '1 Thessalonians',
  '2 Thessalonians',
  '1 Corinthians',
  '2 Corinthians',
  'Romans',
  'Colossians',
  'Philemon',
  'Ephesians',
  'Philippians',
  '1 Timothy',
  'Titus',
  '1 Peter',
  '2 Timothy',
  '2 Peter',
  'Hebrews',
  'Jude',
  '1 John',
  '2 John',
  '3 John',
  'Revelation',
]

const chapterByBook = new Map(bibleBooks.map(book => [book.name, book.chapters]))

const canonicalSet = new Set(bibleBooks.map(book => book.name))
const planSet = new Set(chronologicalOrder)

const missing = [...canonicalSet].filter(name => !planSet.has(name))
if (missing.length) {
  throw new Error(`Missing books in chronological order: ${missing.join(', ')}`)
}

const unknown = [...planSet].filter(name => !canonicalSet.has(name))
if (unknown.length) {
  throw new Error(`Unknown books in chronological order: ${unknown.join(', ')}`)
}

const chapters = []
for (const book of chronologicalOrder) {
  const count = chapterByBook.get(book)
  for (let chapter = 1; chapter <= count; chapter += 1) {
    chapters.push({ book, chapter })
  }
}

const totalChapters = chapters.length
const basePerDay = Math.floor(totalChapters / totalDays)
const extraTotal = totalChapters - (basePerDay * totalDays)

let cursor = 0
let extrasTaken = 0
const readings = []

function monthLabel(day) {
  const monthIndex = Math.floor((day - 1) / 31) + 1
  return `Month ${monthIndex}`
}

function toPassages(dayChapters) {
  const segments = []
  for (const item of dayChapters) {
    const last = segments[segments.length - 1]
    if (!last || last.book !== item.book || item.chapter !== last.end + 1) {
      segments.push({ book: item.book, start: item.chapter, end: item.chapter })
    } else {
      last.end = item.chapter
    }
  }

  return segments.map(seg => {
    if (seg.start === seg.end) return `${seg.book} ${seg.start}`
    return `${seg.book} ${seg.start}-${seg.end}`
  })
}

for (let day = 1; day <= totalDays; day += 1) {
  const remainingDays = totalDays - day + 1
  const remainingChapters = totalChapters - cursor

  let count
  if (remainingDays === 1) {
    count = remainingChapters
  } else {
    const expectedExtrasByDay = Math.round((day * extraTotal) / totalDays)
    const shouldTakeExtra = expectedExtrasByDay > extrasTaken ? 1 : 0
    count = basePerDay + shouldTakeExtra

    const maxAllowed = remainingChapters - (remainingDays - 1)
    if (count > maxAllowed) count = maxAllowed
    if (count < 1) count = 1

    if (shouldTakeExtra) extrasTaken += 1
  }

  const dayChapters = chapters.slice(cursor, cursor + count)
  cursor += count

  readings.push({
    day,
    month: monthLabel(day),
    passages: toPassages(dayChapters),
  })
}

if (cursor !== totalChapters) {
  throw new Error(`Did not consume all chapters. Consumed ${cursor}, total ${totalChapters}`)
}

const output = {
  id: 'chronological-bible',
  title: 'Chronological Bible in 365 Days',
  description: 'A chapter-by-chapter plan arranged by broad historical sequence to help you follow the unfolding story of Scripture from Genesis to Revelation.',
  attribution: 'Generated for this app from biblical chronology assumptions and canonical chapter counts (not copied from a proprietary schedule).',
  totalDays,
  totalChapters,
  readings,
}

const outPath = path.join(process.cwd(), 'public/data/reading-plans/chronological-bible.json')
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`)

console.log(`Wrote ${outPath}`)
console.log(`Days: ${output.totalDays}, chapters: ${output.totalChapters}`)
console.log(`Sample day 1: ${output.readings[0].passages.join(', ')}`)
console.log(`Sample day 365: ${output.readings[364].passages.join(', ')}`)
