// Transform the raw WEB Bible data into our app format
// Run with: node scripts/transform-bible.js

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Book number mapping from bolls.life format to our books
// Only 66 Protestant canon books
const bookMap = {
  1: 'Genesis',
  2: 'Exodus',
  3: 'Leviticus',
  4: 'Numbers',
  5: 'Deuteronomy',
  6: 'Joshua',
  7: 'Judges',
  8: 'Ruth',
  9: '1 Samuel',
  10: '2 Samuel',
  11: '1 Kings',
  12: '2 Kings',
  13: '1 Chronicles',
  14: '2 Chronicles',
  15: 'Ezra',
  16: 'Nehemiah',
  17: 'Esther',
  18: 'Job',
  19: 'Psalms',
  20: 'Proverbs',
  21: 'Ecclesiastes',
  22: 'Song of Solomon',
  23: 'Isaiah',
  24: 'Jeremiah',
  25: 'Lamentations',
  26: 'Ezekiel',
  27: 'Daniel',
  28: 'Hosea',
  29: 'Joel',
  30: 'Amos',
  31: 'Obadiah',
  32: 'Jonah',
  33: 'Micah',
  34: 'Nahum',
  35: 'Habakkuk',
  36: 'Zephaniah',
  37: 'Haggai',
  38: 'Zechariah',
  39: 'Malachi',
  40: 'Matthew',
  41: 'Mark',
  42: 'Luke',
  43: 'John',
  44: 'Acts',
  45: 'Romans',
  46: '1 Corinthians',
  47: '2 Corinthians',
  48: 'Galatians',
  49: 'Ephesians',
  50: 'Philippians',
  51: 'Colossians',
  52: '1 Thessalonians',
  53: '2 Thessalonians',
  54: '1 Timothy',
  55: '2 Timothy',
  56: 'Titus',
  57: 'Philemon',
  58: 'Hebrews',
  59: 'James',
  60: '1 Peter',
  61: '2 Peter',
  62: '1 John',
  63: '2 John',
  64: '3 John',
  65: 'Jude',
  66: 'Revelation'
}

async function transform() {
  console.log('Reading raw Bible data...')
  const rawPath = path.join(__dirname, '..', 'src', 'data', 'bible-web-raw.json')
  const rawData = JSON.parse(fs.readFileSync(rawPath, 'utf8'))
  
  console.log(`Total verses in raw: ${rawData.length}`)
  
  // Group by book then chapter
  const booksData = {}
  
  rawData.forEach(verse => {
    const bookName = bookMap[verse.book]
    if (!bookName) return // Skip apocryphal books
    
    if (!booksData[bookName]) {
      booksData[bookName] = {
        name: bookName,
        bookNum: verse.book,
        chapters: {}
      }
    }
    
    if (!booksData[bookName].chapters[verse.chapter]) {
      booksData[bookName].chapters[verse.chapter] = []
    }
    
    // Clean up the text
    let text = verse.text
      .replace(/<i>/g, '')
      .replace(/<\/i>/g, '')
      .replace(/\u2303/g, '') // Remove special chars
      .trim()
    
    booksData[bookName].chapters[verse.chapter].push({
      number: verse.verse,
      text: text
    })
  })
  
  // Convert to array format and sort
  const books = Object.values(booksData)
    .sort((a, b) => a.bookNum - b.bookNum)
    .map(book => ({
      name: book.name,
      chapters: Object.entries(book.chapters)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([chapterNum, verses]) => ({
          number: Number(chapterNum),
          verses: verses.sort((a, b) => a.number - b.number)
        }))
    }))
  
  const bible = {
    translation: 'WEB',
    name: 'World English Bible',
    books: books
  }
  
  // Save to file
  const outputPath = path.join(__dirname, '..', 'src', 'data', 'bible-web.json')
  fs.writeFileSync(outputPath, JSON.stringify(bible))
  
  // Calculate stats
  const totalChapters = books.reduce((sum, b) => sum + b.chapters.length, 0)
  const totalVerses = books.reduce((sum, b) => 
    sum + b.chapters.reduce((cSum, c) => cSum + c.verses.length, 0), 0)
  
  console.log(`\nTransformation complete!`)
  console.log(`Books: ${books.length}`)
  console.log(`Chapters: ${totalChapters}`)
  console.log(`Verses: ${totalVerses}`)
  console.log(`Saved to: ${outputPath}`)
  
  // Clean up raw file
  fs.unlinkSync(rawPath)
  console.log('Cleaned up raw file.')
}

transform().catch(console.error)
