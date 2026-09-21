import { getBookReferenceChoices } from './index.js'
import { bibleBooks } from './books.js'

// Whole-input parsing is intentional: never silently drop a range or typo.
export function passageReferenceChoices(input) {
  const text = String(input || '').trim().replace(/[–—]/g, '-')
  const match = text.match(/^(.+?\d+(?:[\s:.]+\d+))(?:\s*-\s*(?:(\d+)[:.]\s*)?(\d+))?$/)
  if (!match) return []
  return getBookReferenceChoices(match[1]).filter(choice => choice.verse !== null).map(choice => {
    const endChapter = match[2] ? Number(match[2]) : choice.chapter
    const endVerse = match[3] ? Number(match[3]) : choice.verse
    const book = bibleBooks.find(book => book.name === choice.book)
    const invalidReason = choice.invalidReason || (endChapter > book.chapters ? `${book.name} has ${book.chapters} chapters.`
      : endChapter < choice.chapter || endVerse < 1 || (endChapter === choice.chapter && endVerse < choice.verse) ? 'The end must follow the start of the passage.' : '')
    return { book: choice.book, startChapter: choice.chapter, startVerse: choice.verse, endChapter, endVerse, invalidReason }
  })
}
