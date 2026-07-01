import { bibleBooks } from '../data/bible-books.js'

// Convert a book name to a URL slug, e.g. "1 Samuel" -> "1-samuel".
export function bookToSlug(bookName) {
  return bookName.toLowerCase().replace(/\s+/g, '-')
}

// Convert a URL slug back to a canonical book name, or null if unknown.
export function slugToBook(slug) {
  if (!slug) return null
  const normalized = slug.toLowerCase().replace(/-/g, ' ')
  const book = bibleBooks.find(b => b.name.toLowerCase() === normalized)
  return book?.name || null
}
