import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { RESOURCE_CATEGORIES, TAG_COLORS } from '../data/resources'
import { parseBookChapters, extractChapterNumber } from '../utils/bookChapters'
import fallbackBibleData from '../data/bible-lsv.json'
import { makeSearchSnippet, searchBibleVerses, searchBookLibrary, searchCommentaryLibrary } from '../utils/librarySearch'

function splitChapterTitle(title) {
  const match = title.match(/^(.+?)\s+-\s+(chapter\s+.+)$/i)
  if (!match) {
    return { bookLabel: null, chapterLabel: title }
  }
  return {
    bookLabel: match[1].trim(),
    chapterLabel: match[2].trim(),
  }
}

function romanToNumber(value) {
  if (!value) return null
  const roman = value.toUpperCase()
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
  let total = 0
  for (let i = 0; i < roman.length; i += 1) {
    const current = map[roman[i]]
    const next = map[roman[i + 1]]
    if (!current) return null
    if (next && current < next) total -= current
    else total += current
  }
  return total
}

function parseInternalBookNumber(groupLabel) {
  if (!groupLabel) return null
  const match = String(groupLabel).match(/^book\s+([ivxlcdm]+|\d+)\b/i)
  if (!match) return null
  if (/^\d+$/.test(match[1])) return Number(match[1])
  return romanToNumber(match[1])
}

function bookToSlug(bookName) {
  return String(bookName || '').toLowerCase().replace(/\s+/g, '-')
}

function highlightText(text, query) {
  if (!query?.trim()) return text
  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escaped})`, 'gi')
    const parts = String(text).split(regex)
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase()
        ? (
            <mark key={index} className="bg-yellow-200 dark:bg-yellow-700 dark:text-white px-0.5">
              {part}
            </mark>
          )
        : part
    )
  } catch {
    return text
  }
}

function BookViewer() {
  const { itemId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [bookText, setBookText] = useState('')
  const [textLoading, setTextLoading] = useState(false)
  const [textError, setTextError] = useState(null)
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0)
  const [showNavigator, setShowNavigator] = useState(false)
  const [navigatorGroup, setNavigatorGroup] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [otherBookResults, setOtherBookResults] = useState([])
  const [bibleResults, setBibleResults] = useState([])
  const [commentaryResults, setCommentaryResults] = useState([])
  const [crossSearchLoading, setCrossSearchLoading] = useState(false)
  const [crossSearchCapped, setCrossSearchCapped] = useState({
    books: false,
    bible: false,
    commentary: false,
  })
  const pendingChapterRef = useRef(null)
  const crossSearchRequestRef = useRef(0)

  const category = RESOURCE_CATEGORIES.find(c => c.id === 'books')
  const book = category?.items.find(i => i.id === itemId)

  useEffect(() => {
    let cancelled = false

    setSelectedChapterIndex(0)
    setShowNavigator(false)
    setNavigatorGroup(null)
    setSearchQuery('')
    setActiveSearchResultIndex(0)
    setBookText('')
    setTextError(null)

    if (!book?.textPath) return () => { cancelled = true }

    setTextLoading(true)
    fetch(`${import.meta.env.BASE_URL}${book.textPath}`)
      .then(res => {
        if (!res.ok) throw new Error('Book text not found')
        return res.text()
      })
      .then(raw => {
        if (!cancelled) setBookText(raw)
      })
      .catch(err => {
        if (!cancelled) setTextError(err.message)
      })
      .finally(() => {
        if (!cancelled) setTextLoading(false)
      })

    return () => { cancelled = true }
  }, [book?.textPath])

  useEffect(() => {
    const incomingQuery = location.state?.searchQuery
    if (typeof incomingQuery === 'string' && incomingQuery.trim()) {
      setSearchQuery(incomingQuery)
    }

    if (Number.isInteger(location.state?.chapterIndex)) {
      pendingChapterRef.current = location.state.chapterIndex
    }
  }, [itemId, location.key])

  const chapters = useMemo(() => parseBookChapters(bookText), [bookText])
  const selectedChapter = chapters[selectedChapterIndex] || null
  const selectedChapterNumber = extractChapterNumber(selectedChapter?.title || '')

  const chapterEntries = useMemo(
    () =>
      chapters.map((chapter, index) => {
        const { bookLabel, chapterLabel } = splitChapterTitle(chapter.title)
        return {
          index,
          fullTitle: chapter.title,
          chapterLabel,
          groupKey: bookLabel || 'Front Matter',
        }
      }),
    [chapters]
  )

  const bookGroups = useMemo(() => {
    const seen = new Set()
    const ordered = []
    for (const entry of chapterEntries) {
      if (!seen.has(entry.groupKey)) {
        seen.add(entry.groupKey)
        ordered.push(entry.groupKey)
      }
    }
    return ordered
  }, [chapterEntries])

  const selectedEntry = chapterEntries.find(entry => entry.index === selectedChapterIndex) || null
  const selectedBookGroup = selectedEntry?.groupKey || bookGroups[0] || null
  const shouldShowBookSelector = bookGroups.length > 1

  useEffect(() => {
    if (selectedChapterIndex > 0 && selectedChapterIndex >= chapters.length) {
      setSelectedChapterIndex(0)
    }
  }, [chapters.length, selectedChapterIndex])

  useEffect(() => {
    if (pendingChapterRef.current == null || chapters.length === 0) return
    const clamped = Math.max(0, Math.min(pendingChapterRef.current, chapters.length - 1))
    setSelectedChapterIndex(clamped)
    pendingChapterRef.current = null
  }, [chapters.length])

  useEffect(() => {
    if (!shouldShowBookSelector) {
      setNavigatorGroup(null)
      return
    }

    if (!navigatorGroup || !bookGroups.includes(navigatorGroup)) {
      setNavigatorGroup(selectedBookGroup || bookGroups[0] || null)
    }
  }, [bookGroups, navigatorGroup, selectedBookGroup, shouldShowBookSelector])

  const navigatorChapterEntries = shouldShowBookSelector
    ? chapterEntries.filter(entry => entry.groupKey === (navigatorGroup || selectedBookGroup))
    : chapterEntries

  const activeTrackLabel = useMemo(() => {
    if (!selectedChapterNumber || !Array.isArray(book?.librivoxChapterRanges)) return null
    const range = book.librivoxChapterRanges.find(
      item => selectedChapterNumber >= item.start && selectedChapterNumber <= item.end
    )
    return range?.label || null
  }, [book?.librivoxChapterRanges, selectedChapterNumber])

  const activeLibrivox = useMemo(() => {
    if (Array.isArray(book?.librivoxVolumes) && book.librivoxVolumes.length) {
      const internalBookNumber = parseInternalBookNumber(selectedBookGroup)
      if (internalBookNumber != null) {
        const matched = book.librivoxVolumes.find(
          volume =>
            internalBookNumber >= volume.startBook &&
            internalBookNumber <= volume.endBook
        )
        if (matched) return matched
      }
      return book.librivoxVolumes[0]
    }
    return book?.librivox || null
  }, [book?.librivox, book?.librivoxVolumes, selectedBookGroup])

  const searchState = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return { items: [], capped: false }
    const MAX_RESULTS = 200

    const results = []
    let capped = false

    outer:
    for (const chapter of chapterEntries) {
      const chapterData = chapters[chapter.index]
      if (!chapterData) continue

      for (let pIndex = 0; pIndex < chapterData.paragraphs.length; pIndex += 1) {
        const paragraph = chapterData.paragraphs[pIndex]
        if (!paragraph || !paragraph.toLowerCase().includes(query)) continue

        results.push({
          chapterIndex: chapter.index,
          chapterLabel: chapter.chapterLabel,
          groupKey: chapter.groupKey,
          paragraphIndex: pIndex,
          snippet: makeSearchSnippet(paragraph, query),
        })

        if (results.length >= MAX_RESULTS) {
          capped = true
          break outer
        }
      }
    }

    return { items: results, capped }
  }, [chapters, chapterEntries, searchQuery])
  const searchResults = searchState.items
  const searchCapped = searchState.capped

  useEffect(() => {
    const trimmedQuery = searchQuery.trim()
    const requestId = ++crossSearchRequestRef.current

    if (!trimmedQuery) {
      setOtherBookResults([])
      setBibleResults([])
      setCommentaryResults([])
      setCrossSearchLoading(false)
      setCrossSearchCapped({ books: false, bible: false, commentary: false })
      return
    }

    const timer = setTimeout(async () => {
      setCrossSearchLoading(true)
      let bookMatches = { otherBooks: [], capped: false }
      const bibleMatches = searchBibleVerses(fallbackBibleData, trimmedQuery, { maxResults: 200 })
      let commentaryMatches = { items: [], capped: false }
      try {
        ;[bookMatches, commentaryMatches] = await Promise.all([
          searchBookLibrary(trimmedQuery, { currentBookId: book?.id, maxResults: 200, maxPerBook: 80 }),
          searchCommentaryLibrary(trimmedQuery, { maxResults: 200 }),
        ])
      } catch (error) {
        console.warn('Cross-library search failed', error)
      }

      if (requestId !== crossSearchRequestRef.current) return

      setOtherBookResults(bookMatches.otherBooks)
      setBibleResults(bibleMatches.items)
      setCommentaryResults(commentaryMatches.items)
      setCrossSearchCapped({
        books: bookMatches.capped,
        bible: bibleMatches.capped,
        commentary: commentaryMatches.capped,
      })
      setCrossSearchLoading(false)
    }, 180)

    return () => clearTimeout(timer)
  }, [book?.id, searchQuery])

  useEffect(() => {
    setActiveSearchResultIndex(0)
  }, [searchQuery])

  const activeSearchResult = searchResults[activeSearchResultIndex] || null

  const jumpToSearchResult = (resultIndex) => {
    if (resultIndex < 0 || resultIndex >= searchResults.length) return
    const result = searchResults[resultIndex]
    setSelectedChapterIndex(result.chapterIndex)
    setActiveSearchResultIndex(resultIndex)
  }

  const moveSearchCursor = (delta) => {
    if (!searchResults.length) return
    const nextIndex = (activeSearchResultIndex + delta + searchResults.length) % searchResults.length
    jumpToSearchResult(nextIndex)
  }

  const clearSearch = () => {
    setSearchQuery('')
    setActiveSearchResultIndex(0)
  }

  const openOtherBookResult = (result) => {
    navigate(`/resources/books/${result.bookId}`, {
      state: {
        searchQuery,
        chapterIndex: result.chapterIndex,
      },
    })
  }

  const openBibleResult = (result) => {
    navigate(`/${bookToSlug(result.book)}/${result.chapter}`)
  }

  const openCommentaryResult = (result) => {
    const commentaryBook = result.book || 'Revelation'
    const commentaryChapter = result.verses?.[0]?.chapter || result.chapter || 1
    navigate(`/${bookToSlug(commentaryBook)}/${commentaryChapter}`)
  }

  const goToPreviousChapter = () => {
    setSelectedChapterIndex(prev => Math.max(prev - 1, 0))
  }

  const goToNextChapter = () => {
    setSelectedChapterIndex(prev => Math.min(prev + 1, chapters.length - 1))
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">📚</p>
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">Book not found</h2>
          <button
            onClick={() => navigate('/resources/books')}
            className="text-primary dark:text-blue-400 hover:underline"
          >
            Back to Books
          </button>
        </div>
      </div>
    )
  }

  const embedUrl = activeLibrivox
    ? `https://archive.org/embed/${activeLibrivox.archiveId}&playlist=1`
    : null

  const yearDisplay = book.year < 1000 ? `${book.year} AD` : `${book.year}`
  const sourceLabel = book.textUrl?.includes('gutenberg.org') ? 'Gutenberg ↗' : 'Source text ↗'
  const tagColors = book.tag ? TAG_COLORS[book.tag] : null
  const hasChapters = !textLoading && !textError && chapters.length > 0
  const totalSearchResults = searchResults.length + otherBookResults.length + bibleResults.length + commentaryResults.length
  const isSearchMode = Boolean(searchQuery.trim())
  const hasLimitedResults = searchCapped || crossSearchCapped.books || crossSearchCapped.bible || crossSearchCapped.commentary

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      {/* Header */}
      <header className="bg-primary text-white shadow-lg sticky top-0 z-40">
        <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/resources/books')}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
          >
            <span className="text-lg">{'\u2190'}</span>
          </button>

          <div className="min-w-0 flex-shrink-0">
            <h1 className="text-base sm:text-lg font-bold heading-text truncate max-w-[190px] sm:max-w-[260px]">
              {book.title}
            </h1>
          </div>

          {hasChapters && (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                if (searchResults.length) jumpToSearchResult(activeSearchResult ? activeSearchResultIndex : 0)
              }}
              className="flex-1 min-w-0 max-w-xl"
            >
              <div className={`flex items-center bg-white/10 rounded-lg transition-all ${isSearchFocused ? 'ring-2 ring-white/50' : ''}`}>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  placeholder="Search this entire work..."
                  className="flex-1 bg-transparent px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base text-white placeholder-blue-200 focus:outline-none min-w-0"
                />
                <button
                  type="submit"
                  className="px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-white/10 rounded-r-lg transition-colors"
                >
                  🔍
                </button>
              </div>
            </form>
          )}
        </div>
      </header>

      <main className={`container mx-auto ${isSearchMode ? 'max-w-3xl' : 'max-w-2xl'} px-4 sm:px-6 py-6 pb-28`}>
        {isSearchMode && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="heading-text text-2xl font-bold text-primary dark:text-blue-400">
                  Search Results
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {totalSearchResults === 0
                    ? <>No results found for "{searchQuery}"</>
                    : <>
                        Found {totalSearchResults} result{totalSearchResults === 1 ? '' : 's'} for "{searchQuery}"
                        {hasLimitedResults && (
                          <span className="text-xs text-amber-600 dark:text-amber-400"> (results limited — try a more specific search)</span>
                        )}
                      </>
                  }
                </p>
              </div>
              <button
                onClick={clearSearch}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
              >
                Clear Search
              </button>
            </div>

            {crossSearchLoading && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 animate-pulse">
                Searching other books, Bible, and commentary...
              </p>
            )}

            {totalSearchResults > 0 ? (
              <div className="space-y-2">
                {searchResults.length > 0 && (
                  <>
                    <div className="flex items-center justify-between mt-1 mb-1">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        This Book ({searchResults.length})
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveSearchCursor(-1)}
                          disabled={!searchResults.length}
                          className="px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-gray-800"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveSearchCursor(1)}
                          disabled={!searchResults.length}
                          className="px-2 py-1 text-xs rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-gray-800"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                    {searchResults.map((result, index) => (
                      <button
                        key={`${result.chapterIndex}-${result.paragraphIndex}-${index}`}
                        onClick={() => {
                          jumpToSearchResult(index)
                          setSearchQuery('')
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          index === activeSearchResultIndex
                            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                        }`}
                      >
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {result.groupKey !== 'Front Matter' ? `${result.groupKey} · ` : ''}{result.chapterLabel}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {highlightText(result.snippet, searchQuery)}
                        </p>
                      </button>
                    ))}
                  </>
                )}

                {otherBookResults.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-3 mb-1">
                      Other Books ({otherBookResults.length})
                    </p>
                    {otherBookResults.map((result, index) => (
                      <button
                        key={`other-book-${result.bookId}-${result.chapterIndex}-${result.paragraphIndex}-${index}`}
                        onClick={() => openOtherBookResult(result)}
                        className="w-full text-left p-3 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                      >
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {result.bookTitle} · {result.groupKey !== 'Front Matter' ? `${result.groupKey} · ` : ''}{result.chapterLabel}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {highlightText(result.snippet, searchQuery)}
                        </p>
                      </button>
                    ))}
                  </>
                )}

                {bibleResults.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-3 mb-1">
                      Bible ({bibleResults.length})
                    </p>
                    {bibleResults.map((result, index) => (
                      <button
                        key={`bible-${result.book}-${result.chapter}-${result.verse}-${index}`}
                        onClick={() => openBibleResult(result)}
                        className="w-full text-left p-3 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                      >
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {result.book} {result.chapter}:{result.verse}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {highlightText(result.text, searchQuery)}
                        </p>
                      </button>
                    ))}
                  </>
                )}

                {commentaryResults.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-3 mb-1">
                      Commentary ({commentaryResults.length})
                    </p>
                    {commentaryResults.map((result, index) => (
                      <button
                        key={`commentary-${result.id || index}`}
                        onClick={() => openCommentaryResult(result)}
                        className="w-full text-left p-3 rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {result.authorName ? `${result.authorName} · ` : ''}{result.reference}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                          {highlightText(result.snippet, searchQuery)}
                        </p>
                      </button>
                    ))}
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <p className="text-4xl mb-4">🔍</p>
                <p>No results found. Try a different search term.</p>
              </div>
            )}
          </section>
        )}

        {!isSearchMode && (
          <>
        {/* Book info */}
        <div className="text-center mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 heading-text">
            {book.title}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {book.author} · {yearDisplay}
          </p>
          {tagColors && (
            <div className="mt-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagColors.bg} ${tagColors.text}`}>
                {book.tag}
              </span>
            </div>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-3 max-w-md mx-auto">
            {book.description}
          </p>
        </div>

        <hr className="border-gray-200 dark:border-gray-700 mb-6" />

        {/* LibriVox Player */}
        {activeLibrivox && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎧</span>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">Listen Free</h3>
              </div>
              <a
                href={activeLibrivox.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary dark:text-blue-400 hover:underline"
              >
                LibriVox ↗
              </a>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{activeLibrivox.title}</p>
            <iframe
              src={embedUrl}
              width="100%"
              height="300"
              frameBorder="0"
              allowFullScreen
              className="rounded-lg bg-gray-100 dark:bg-gray-700"
              title={activeLibrivox.title}
            />
          </div>
        )}

        {/* In-app Book Text */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">📖</span>
              <h3 className="font-semibold text-gray-800 dark:text-gray-200">Read in App</h3>
            </div>
            {book.textUrl && (
              <a
                href={book.textUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary dark:text-blue-400 hover:underline whitespace-nowrap"
              >
                {sourceLabel}
              </a>
            )}
          </div>

          {textLoading && (
            <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">Loading book text…</p>
          )}

          {textError && !textLoading && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p>Could not load the local text for this book.</p>
              {book.textUrl && (
                <p className="mt-2">
                  Use the Gutenberg link above as a fallback.
                </p>
              )}
            </div>
          )}

          {!textLoading && !textError && chapters.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No local text is available for this book yet.</p>
          )}

          {!textLoading && !textError && chapters.length > 0 && (
            <>
              {selectedChapter && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    {shouldShowBookSelector && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                        {selectedBookGroup}
                      </span>
                    )}
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {selectedEntry?.chapterLabel || selectedChapter.title}
                    </h4>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">
                      {selectedChapterIndex + 1} / {chapters.length}
                    </span>
                    {activeTrackLabel && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-medium">
                        {activeTrackLabel}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {(selectedChapter?.paragraphs || []).map((paragraph, index) => (
                  <p key={index} className="text-[15px] text-gray-800 dark:text-gray-200 leading-[1.8]">
                    {highlightText(paragraph, searchQuery)}
                  </p>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer nav */}
        <div className="mt-12 text-center">
          <button
            onClick={() => navigate('/resources/books')}
            className="text-sm text-primary dark:text-blue-400 hover:underline"
          >
            {'\u2190'} Back to Books
          </button>
        </div>
          </>
        )}
      </main>

      {/* Bible-style bottom chapter navigation */}
      {hasChapters && !isSearchMode && (
        <>
          <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-40 safe-area-bottom">
            <div className="flex items-center justify-between h-14 px-2">
              <button
                onClick={goToPreviousChapter}
                disabled={selectedChapterIndex === 0}
                className="flex items-center justify-center w-14 h-full text-primary dark:text-blue-400 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
                aria-label="Previous chapter"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={() => setShowNavigator(true)}
                className="flex-1 flex items-center justify-center gap-2 h-full mx-2 rounded-lg active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
              >
                <span className="text-base font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[220px]">
                  {selectedEntry?.chapterLabel || selectedChapter?.title || 'Select chapter'}
                </span>
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <button
                onClick={goToNextChapter}
                disabled={selectedChapterIndex >= chapters.length - 1}
                className="flex items-center justify-center w-14 h-full text-primary dark:text-blue-400 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
                aria-label="Next chapter"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </nav>

          {showNavigator && (
            <div className="fixed inset-0 z-50">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setShowNavigator(false)}
              />

              <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl animate-slide-up safe-area-bottom max-h-[80vh] flex flex-col">
                <div className="flex justify-center py-3 flex-shrink-0">
                  <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                </div>

                <div className="px-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                  <h3 className="text-lg font-semibold text-center text-gray-800 dark:text-gray-200">Navigate Chapters</h3>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {shouldShowBookSelector && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Book Section</p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {bookGroups.map(group => (
                          <button
                            key={group}
                            onClick={() => setNavigatorGroup(group)}
                            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap border ${group === (navigatorGroup || selectedBookGroup) ? 'bg-primary text-white border-primary' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                          >
                            {group}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Chapter</p>
                    <div className="space-y-1.5">
                      {navigatorChapterEntries.map(entry => (
                        <button
                          key={`${entry.fullTitle}-${entry.index}`}
                          onClick={() => {
                            setSelectedChapterIndex(entry.index)
                            setShowNavigator(false)
                          }}
                          className={`w-full px-3 py-2.5 rounded-lg text-left text-sm leading-snug border ${entry.index === selectedChapterIndex ? 'bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-300 border-primary/40' : 'border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                        >
                          {entry.chapterLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
                  <button
                    onClick={() => setShowNavigator(false)}
                    className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium active:bg-gray-200 dark:active:bg-gray-600 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default BookViewer
