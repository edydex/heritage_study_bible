import { RESOURCE_CATEGORIES } from '../data/resources'
import { authors as commentaryAuthors } from '../data/authors'
import { parseBookChapters } from './bookChapters'

const bookChaptersCache = new Map()
const commentaryWorkCache = new Map()

function normalizeQuery(query) {
  return String(query || '').trim().toLowerCase()
}

function splitChapterTitle(title) {
  const normalizedTitle = String(title || '').trim()
  const dividerIndex = normalizedTitle.indexOf(' - ')
  if (dividerIndex < 0) {
    return { groupKey: 'Front Matter', chapterLabel: title }
  }
  return {
    groupKey: normalizedTitle.slice(0, dividerIndex).trim(),
    chapterLabel: normalizedTitle.slice(dividerIndex + 3).trim(),
  }
}

export function makeSearchSnippet(text, query) {
  const source = String(text || '').replace(/\s+/g, ' ').trim()
  if (!source) return ''

  const lower = source.toLowerCase()
  const normalizedQuery = normalizeQuery(query)
  const idx = lower.indexOf(normalizedQuery)
  if (idx < 0) return source.slice(0, 160)

  const start = Math.max(0, idx - 45)
  const end = Math.min(source.length, idx + normalizedQuery.length + 85)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < source.length ? '...' : ''
  return `${prefix}${source.slice(start, end)}${suffix}`
}

function getBooksCatalog() {
  const category = RESOURCE_CATEGORIES.find(c => c.id === 'books')
  if (!category) return []
  return [...category.items]
    .filter(item => item.textPath)
    .sort((a, b) => {
      const ay = Number.isFinite(a.year) ? a.year : Number.POSITIVE_INFINITY
      const by = Number.isFinite(b.year) ? b.year : Number.POSITIVE_INFINITY
      if (ay !== by) return ay - by
      return a.title.localeCompare(b.title)
    })
}

async function loadBookChapters(book) {
  if (!book?.textPath) return []
  if (bookChaptersCache.has(book.id)) return bookChaptersCache.get(book.id)

  const response = await fetch(`${import.meta.env.BASE_URL}${book.textPath}`)
  if (!response.ok) {
    bookChaptersCache.set(book.id, [])
    return []
  }

  const rawText = await response.text()
  const chapters = parseBookChapters(rawText)
  bookChaptersCache.set(book.id, chapters)
  return chapters
}

function searchBookChapters(chapters, query, maxResults) {
  const normalizedQuery = normalizeQuery(query)
  if (!normalizedQuery) return []

  const results = []
  for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex += 1) {
    const chapter = chapters[chapterIndex]
    const split = splitChapterTitle(chapter.title)
    for (let paragraphIndex = 0; paragraphIndex < chapter.paragraphs.length; paragraphIndex += 1) {
      const paragraph = chapter.paragraphs[paragraphIndex]
      if (!paragraph || !paragraph.toLowerCase().includes(normalizedQuery)) continue

      results.push({
        chapterIndex,
        paragraphIndex,
        fullTitle: chapter.title,
        chapterLabel: split.chapterLabel,
        groupKey: split.groupKey,
        snippet: makeSearchSnippet(paragraph, normalizedQuery),
      })

      if (results.length >= maxResults) return results
    }
  }
  return results
}

export async function searchBookLibrary(query, options = {}) {
  const normalizedQuery = normalizeQuery(query)
  if (!normalizedQuery) {
    return { books: [], currentBook: [], otherBooks: [], capped: false }
  }

  const {
    currentBookId = null,
    maxResults = 200,
    maxPerBook = 80,
  } = options

  const allBooks = getBooksCatalog()
  const orderedBooks = currentBookId
    ? [
        ...allBooks.filter(book => book.id === currentBookId),
        ...allBooks.filter(book => book.id !== currentBookId),
      ]
    : allBooks

  const allResults = []
  const currentBookResults = []
  const otherBookResults = []
  let capped = false

  for (const book of orderedBooks) {
    if (allResults.length >= maxResults) {
      capped = true
      break
    }

    const chapters = await loadBookChapters(book)
    if (!chapters.length) continue

    const remaining = maxResults - allResults.length
    const perBookLimit = Math.min(maxPerBook, remaining)
    const matches = searchBookChapters(chapters, normalizedQuery, perBookLimit)
    if (!matches.length) continue

    for (const match of matches) {
      const enriched = {
        ...match,
        bookId: book.id,
        bookTitle: book.title,
        bookAuthor: book.author,
        bookYear: book.year,
      }
      allResults.push(enriched)
      if (book.id === currentBookId) currentBookResults.push(enriched)
      else otherBookResults.push(enriched)
    }
  }

  return {
    books: allResults,
    currentBook: currentBookResults,
    otherBooks: otherBookResults,
    capped,
  }
}

export function searchBibleVerses(bibleData, query, options = {}) {
  const normalizedQuery = normalizeQuery(query)
  if (!normalizedQuery || !Array.isArray(bibleData?.books)) {
    return { items: [], capped: false }
  }

  const { maxResults = 200, hasCommentary } = options
  const items = []
  let capped = false

  outer:
  for (const book of bibleData.books) {
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        if (!verse.text?.toLowerCase().includes(normalizedQuery)) continue
        items.push({
          book: book.name,
          chapter: chapter.number,
          verse: verse.number,
          text: verse.text,
          hasCommentary: typeof hasCommentary === 'function'
            ? hasCommentary(book.name, chapter.number, verse.number)
            : false,
        })
        if (items.length >= maxResults) {
          capped = true
          break outer
        }
      }
    }
  }

  return { items, capped }
}

export function searchLoadedCommentaries(authorsData, query, options = {}) {
  const normalizedQuery = normalizeQuery(query)
  if (!normalizedQuery || !Array.isArray(authorsData)) {
    return { items: [], capped: false }
  }

  const { maxResults = 200 } = options
  const items = []
  let capped = false

  outer:
  for (const author of authorsData) {
    for (const work of author.works || []) {
      if (!work.loaded && (!Array.isArray(work.commentaries) || work.commentaries.length === 0)) continue
      for (const commentary of work.commentaries || []) {
        if (!commentary.text?.toLowerCase().includes(normalizedQuery)) continue
        items.push({
          ...commentary,
          book: work.book,
          authorName: author.name,
          workTitle: work.title,
          snippet: makeSearchSnippet(commentary.text, normalizedQuery),
        })
        if (items.length >= maxResults) {
          capped = true
          break outer
        }
      }
    }
  }

  return { items, capped }
}

function normalizeDataPath(path) {
  if (!path) return null
  return path.startsWith('/') ? path.slice(1) : path
}

async function loadCommentariesForWork(author, work) {
  const cacheKey = `${author.id}:${work.id}`
  if (commentaryWorkCache.has(cacheKey)) {
    return commentaryWorkCache.get(cacheKey)
  }

  let bookName = work.book
  let commentaries = []

  if (Array.isArray(work.commentaries) && work.commentaries.length > 0) {
    commentaries = work.commentaries
  } else if (work.dataPath) {
    const normalizedPath = normalizeDataPath(work.dataPath)
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}${normalizedPath}`)
      if (response.ok) {
        const payload = await response.json()
        if (Array.isArray(payload?.commentaries)) commentaries = payload.commentaries
        if (payload?.metadata?.book) bookName = payload.metadata.book
      }
    } catch {
      commentaries = []
    }
  }

  const value = { bookName, commentaries }
  commentaryWorkCache.set(cacheKey, value)
  return value
}

export async function searchCommentaryLibrary(query, options = {}) {
  const normalizedQuery = normalizeQuery(query)
  if (!normalizedQuery) return { items: [], capped: false }

  const { maxResults = 200 } = options
  const items = []
  let capped = false

  outer:
  for (const author of commentaryAuthors) {
    for (const work of author.works || []) {
      const loaded = await loadCommentariesForWork(author, work)
      for (const commentary of loaded.commentaries || []) {
        if (!commentary.text?.toLowerCase().includes(normalizedQuery)) continue
        items.push({
          ...commentary,
          book: loaded.bookName || work.book,
          authorName: author.name,
          workTitle: work.title,
          snippet: makeSearchSnippet(commentary.text, normalizedQuery),
        })
        if (items.length >= maxResults) {
          capped = true
          break outer
        }
      }
    }
  }

  return { items, capped }
}
