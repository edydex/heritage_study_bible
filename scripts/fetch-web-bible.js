// This script fetches the World English Bible (WEB) from a public API
// and saves it as a local JSON file for offline use.
// Run with: node scripts/fetch-web-bible.js

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const bibleBooks = [
  { name: 'Genesis', abbr: 'GEN', chapters: 50 },
  { name: 'Exodus', abbr: 'EXO', chapters: 40 },
  { name: 'Leviticus', abbr: 'LEV', chapters: 27 },
  { name: 'Numbers', abbr: 'NUM', chapters: 36 },
  { name: 'Deuteronomy', abbr: 'DEU', chapters: 34 },
  { name: 'Joshua', abbr: 'JOS', chapters: 24 },
  { name: 'Judges', abbr: 'JDG', chapters: 21 },
  { name: 'Ruth', abbr: 'RUT', chapters: 4 },
  { name: '1 Samuel', abbr: '1SA', chapters: 31 },
  { name: '2 Samuel', abbr: '2SA', chapters: 24 },
  { name: '1 Kings', abbr: '1KI', chapters: 22 },
  { name: '2 Kings', abbr: '2KI', chapters: 25 },
  { name: '1 Chronicles', abbr: '1CH', chapters: 29 },
  { name: '2 Chronicles', abbr: '2CH', chapters: 36 },
  { name: 'Ezra', abbr: 'EZR', chapters: 10 },
  { name: 'Nehemiah', abbr: 'NEH', chapters: 13 },
  { name: 'Esther', abbr: 'EST', chapters: 10 },
  { name: 'Job', abbr: 'JOB', chapters: 42 },
  { name: 'Psalms', abbr: 'PSA', chapters: 150 },
  { name: 'Proverbs', abbr: 'PRO', chapters: 31 },
  { name: 'Ecclesiastes', abbr: 'ECC', chapters: 12 },
  { name: 'Song of Solomon', abbr: 'SNG', chapters: 8 },
  { name: 'Isaiah', abbr: 'ISA', chapters: 66 },
  { name: 'Jeremiah', abbr: 'JER', chapters: 52 },
  { name: 'Lamentations', abbr: 'LAM', chapters: 5 },
  { name: 'Ezekiel', abbr: 'EZK', chapters: 48 },
  { name: 'Daniel', abbr: 'DAN', chapters: 12 },
  { name: 'Hosea', abbr: 'HOS', chapters: 14 },
  { name: 'Joel', abbr: 'JOL', chapters: 3 },
  { name: 'Amos', abbr: 'AMO', chapters: 9 },
  { name: 'Obadiah', abbr: 'OBA', chapters: 1 },
  { name: 'Jonah', abbr: 'JON', chapters: 4 },
  { name: 'Micah', abbr: 'MIC', chapters: 7 },
  { name: 'Nahum', abbr: 'NAM', chapters: 3 },
  { name: 'Habakkuk', abbr: 'HAB', chapters: 3 },
  { name: 'Zephaniah', abbr: 'ZEP', chapters: 3 },
  { name: 'Haggai', abbr: 'HAG', chapters: 2 },
  { name: 'Zechariah', abbr: 'ZEC', chapters: 14 },
  { name: 'Malachi', abbr: 'MAL', chapters: 4 },
  { name: 'Matthew', abbr: 'MAT', chapters: 28 },
  { name: 'Mark', abbr: 'MRK', chapters: 16 },
  { name: 'Luke', abbr: 'LUK', chapters: 24 },
  { name: 'John', abbr: 'JHN', chapters: 21 },
  { name: 'Acts', abbr: 'ACT', chapters: 28 },
  { name: 'Romans', abbr: 'ROM', chapters: 16 },
  { name: '1 Corinthians', abbr: '1CO', chapters: 16 },
  { name: '2 Corinthians', abbr: '2CO', chapters: 13 },
  { name: 'Galatians', abbr: 'GAL', chapters: 6 },
  { name: 'Ephesians', abbr: 'EPH', chapters: 6 },
  { name: 'Philippians', abbr: 'PHP', chapters: 4 },
  { name: 'Colossians', abbr: 'COL', chapters: 4 },
  { name: '1 Thessalonians', abbr: '1TH', chapters: 5 },
  { name: '2 Thessalonians', abbr: '2TH', chapters: 3 },
  { name: '1 Timothy', abbr: '1TI', chapters: 6 },
  { name: '2 Timothy', abbr: '2TI', chapters: 4 },
  { name: 'Titus', abbr: 'TIT', chapters: 3 },
  { name: 'Philemon', abbr: 'PHM', chapters: 1 },
  { name: 'Hebrews', abbr: 'HEB', chapters: 13 },
  { name: 'James', abbr: 'JAS', chapters: 5 },
  { name: '1 Peter', abbr: '1PE', chapters: 5 },
  { name: '2 Peter', abbr: '2PE', chapters: 3 },
  { name: '1 John', abbr: '1JN', chapters: 5 },
  { name: '2 John', abbr: '2JN', chapters: 1 },
  { name: '3 John', abbr: '3JN', chapters: 1 },
  { name: 'Jude', abbr: 'JUD', chapters: 1 },
  { name: 'Revelation', abbr: 'REV', chapters: 22 },
]

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function fetchChapter(bookAbbr, chapter) {
  // Using Bible API (bible-api.com) which has WEB translation
  const url = `https://bible-api.com/${bookAbbr}+${chapter}?translation=web`
  
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const data = await response.json()
    
    // Parse verses from the response
    const verses = data.verses.map(v => ({
      number: v.verse,
      text: v.text.trim()
    }))
    
    return { number: chapter, verses }
  } catch (error) {
    console.error(`Error fetching ${bookAbbr} ${chapter}:`, error.message)
    return null
  }
}

async function fetchBook(book) {
  console.log(`Fetching ${book.name}...`)
  const chapters = []
  
  for (let i = 1; i <= book.chapters; i++) {
    const chapter = await fetchChapter(book.abbr, i)
    if (chapter) {
      chapters.push(chapter)
      process.stdout.write(`  Chapter ${i}/${book.chapters}\r`)
    }
    // Rate limiting - be nice to the API
    await delay(200)
  }
  
  console.log(`  ${book.name} complete (${chapters.length} chapters)`)
  return {
    name: book.name,
    chapters
  }
}

async function main() {
  console.log('Fetching World English Bible (WEB)...')
  console.log('This will take a while due to rate limiting.\n')
  
  const bible = {
    translation: 'WEB',
    name: 'World English Bible',
    books: []
  }
  
  for (const book of bibleBooks) {
    const bookData = await fetchBook(book)
    bible.books.push(bookData)
    
    // Save progress after each book
    const outputPath = path.join(__dirname, '..', 'src', 'data', 'bible-web.json')
    fs.writeFileSync(outputPath, JSON.stringify(bible, null, 2))
  }
  
  console.log('\nDone! Bible saved to src/data/bible-web.json')
  console.log(`Total books: ${bible.books.length}`)
  
  const totalChapters = bible.books.reduce((sum, b) => sum + b.chapters.length, 0)
  const totalVerses = bible.books.reduce((sum, b) => 
    sum + b.chapters.reduce((cSum, c) => cSum + c.verses.length, 0), 0)
  
  console.log(`Total chapters: ${totalChapters}`)
  console.log(`Total verses: ${totalVerses}`)
}

main().catch(console.error)
