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

/** A slide may quote separated verses in one chapter; ordinary reader ranges stay unchanged. */
export function passageSelectionChoices(input) {
  const text = String(input || '').trim().replace(/[–—]/g, '-')
  if (!text.includes(',')) return passageReferenceChoices(text)
  const [first, ...rest] = text.split(',')
  return passageReferenceChoices(first).map(choice => {
    let invalidReason = choice.invalidReason
    const numbers = []
    const add = (a,b) => {
      if (a < 1 || b < a || b > 999 || numbers.length + b-a+1 > 200 || (numbers.length && a <= numbers.at(-1))) { invalidReason ||= 'List verses in order without repeating them.'; return }
      for (let n=a;n<=b;n++) numbers.push(n)
    }
    if (choice.startChapter !== choice.endChapter) invalidReason ||= 'Choose separated verses within one chapter.'
    add(choice.startVerse, choice.endVerse)
    for (const part of rest) {
      const m=part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
      if (!m) { invalidReason ||= 'Use a verse list such as John 8:31-32,44.'; continue }
      add(Number(m[1]), Number(m[2] || m[1]))
    }
    return {...choice,endVerse:numbers.at(-1) || choice.endVerse,verseNumbers:numbers,invalidReason}
  })
}
