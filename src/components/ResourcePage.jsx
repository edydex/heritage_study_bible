import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RESOURCE_CATEGORIES, TAG_COLORS } from '../data/resources'
import fallbackBibleData from '../data/bible-lsv.json'
import { searchBibleVerses, searchBookLibrary, searchCommentaryLibrary } from '../utils/librarySearch'
import SearchResults from './SearchResults'

function ResourceTag({ tag }) {
  const colors = TAG_COLORS[tag]
  if (!colors) return null
  return (
    <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium ${colors.bg} ${colors.text}`}>
      {tag}
    </span>
  )
}

function YearBadge({ year }) {
  if (!year) return null
  const display = year < 100 ? `c. ${year} AD` : year < 1000 ? `${year} AD` : `${year}`
  return (
    <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
      {display}
    </span>
  )
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function hasAudiobook(item) {
  return Boolean(item?.librivox) || (Array.isArray(item?.librivoxVolumes) && item.librivoxVolumes.length > 0)
}

function toBookSlug(bookName) {
  return String(bookName || '').toLowerCase().replace(/\s+/g, '-')
}

function matchesCatalogQuery(item, query) {
  const q = normalizeText(query)
  if (!q) return true
  const haystack = `${item?.title || ''} ${item?.author || ''}`.toLowerCase()
  return haystack.includes(q)
}

function matchesFilters(item, filters) {
  const {
    selectedTags,
    selectedAuthor,
    audiobookOnly,
    yearMin,
    yearMax,
  } = filters

  if (selectedTags.length > 0 && !selectedTags.includes(item.tag)) return false
  if (selectedAuthor && item.author !== selectedAuthor) return false
  if (audiobookOnly && !hasAudiobook(item)) return false

  if (yearMin) {
    const min = Number(yearMin)
    if (Number.isFinite(min) && Number.isFinite(item.year) && item.year < min) return false
  }
  if (yearMax) {
    const max = Number(yearMax)
    if (Number.isFinite(max) && Number.isFinite(item.year) && item.year > max) return false
  }

  return true
}

const CLICKABLE_CATEGORIES = ['confessions', 'books', 'reading-plans']

function ResourcePage() {
  const { categoryId } = useParams()
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [useFullSearch, setUseFullSearch] = useState(false)

  const [selectedTags, setSelectedTags] = useState([])
  const [selectedAuthor, setSelectedAuthor] = useState('')
  const [audiobookOnly, setAudiobookOnly] = useState(false)
  const [yearMin, setYearMin] = useState('')
  const [yearMax, setYearMax] = useState('')

  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState(null)

  const category = RESOURCE_CATEGORIES.find(c => c.id === categoryId)
  if (!category) {
    return (
      <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">Category not found</h2>
          <button
            onClick={() => navigate('/genesis/1')}
            className="text-primary hover:underline"
          >
            Back to Bible
          </button>
        </div>
      </div>
    )
  }

  const isConfessions = categoryId === 'confessions'
  const isBooks = categoryId === 'books'
  const isClickable = CLICKABLE_CATEGORIES.includes(categoryId)
  const trimmedQuery = searchQuery.trim()

  const items = useMemo(() => {
    if (!isConfessions && !isBooks) return category.items
    return [...category.items].sort((a, b) => {
      const ay = Number.isFinite(a.year) ? a.year : Number.POSITIVE_INFINITY
      const by = Number.isFinite(b.year) ? b.year : Number.POSITIVE_INFINITY
      if (ay !== by) return ay - by
      return a.title.localeCompare(b.title)
    })
  }, [category.items, isBooks, isConfessions])

  const availableTags = useMemo(() => {
    if (!isBooks) return []
    return [...new Set(items.map(item => item.tag).filter(Boolean))]
  }, [isBooks, items])

  const availableAuthors = useMemo(() => {
    if (!isBooks) return []
    return [...new Set(items.map(item => item.author).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  }, [isBooks, items])

  const activeFilterCount = (
    selectedTags.length +
    (selectedAuthor ? 1 : 0) +
    (audiobookOnly ? 1 : 0) +
    (yearMin ? 1 : 0) +
    (yearMax ? 1 : 0)
  )

  const filteredBooks = useMemo(() => {
    if (!isBooks) return []
    return items.filter(item =>
      matchesCatalogQuery(item, trimmedQuery) &&
      matchesFilters(item, { selectedTags, selectedAuthor, audiobookOnly, yearMin, yearMax })
    )
  }, [isBooks, items, trimmedQuery, selectedTags, selectedAuthor, audiobookOnly, yearMin, yearMax])

  const isCatalogFiltered = isBooks && (trimmedQuery.length > 0 || activeFilterCount > 0)
  const isFullSearchMode = isBooks && useFullSearch && Boolean(trimmedQuery)

  useEffect(() => {
    let cancelled = false

    if (!isFullSearchMode) {
      setSearchResults(null)
      setSearchLoading(false)
      return () => { cancelled = true }
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true)

      const bibleMatches = searchBibleVerses(fallbackBibleData, trimmedQuery, { maxResults: 200 })
      let commentaryMatches = { items: [], capped: false }
      let bookMatches = { books: [], capped: false }

      try {
        ;[bookMatches, commentaryMatches] = await Promise.all([
          searchBookLibrary(trimmedQuery, { maxResults: 200, maxPerBook: 80 }),
          searchCommentaryLibrary(trimmedQuery, { maxResults: 200 }),
        ])
      } catch (error) {
        console.warn('Books full search failed', error)
      }

      if (cancelled) return

      const filteredBookMatches = bookMatches.books.filter(result => {
        const metadata = items.find(item => item.id === result.bookId)
        return metadata
          ? matchesFilters(metadata, { selectedTags, selectedAuthor, audiobookOnly, yearMin, yearMax })
          : true
      })

      setSearchResults({
        books: filteredBookMatches,
        booksCapped: bookMatches.capped,
        verses: bibleMatches.items,
        versesCapped: bibleMatches.capped,
        commentaries: commentaryMatches.items,
        commentariesCapped: commentaryMatches.capped,
        sectionOrder: ['books', 'verses', 'commentaries'],
      })
      setSearchLoading(false)
    }, 180)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [
    isFullSearchMode,
    trimmedQuery,
    items,
    selectedTags,
    selectedAuthor,
    audiobookOnly,
    yearMin,
    yearMax,
  ])

  const toggleTag = (tag) => {
    setSelectedTags(prev => (
      prev.includes(tag)
        ? prev.filter(value => value !== tag)
        : [...prev, tag]
    ))
  }

  const clearFilters = () => {
    setSelectedTags([])
    setSelectedAuthor('')
    setAudiobookOnly(false)
    setYearMin('')
    setYearMax('')
  }

  const handleItemClick = (item) => {
    if (isClickable) {
      navigate(`/resources/${categoryId}/${item.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-primary text-white shadow-lg sticky top-0 z-40">
        <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/genesis/1')}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <span className="text-lg">{'\u2190'}</span>
          </button>
          <h1 className="text-base sm:text-lg font-bold heading-text truncate">
            {category.title}
          </h1>

          {isBooks && (
            <>
              <form
                className="flex-1 min-w-0 max-w-xl"
                onSubmit={(event) => {
                  event.preventDefault()
                }}
              >
                <div className="flex items-center bg-white/10 rounded-lg">
                  <input
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value)
                      if (!event.target.value.trim()) setUseFullSearch(false)
                    }}
                    placeholder="Search title or author..."
                    className="flex-1 bg-transparent px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base text-white placeholder-blue-200 focus:outline-none min-w-0"
                  />
                  <button type="submit" className="px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-white/10 rounded-r-lg transition-colors">
                    🔍
                  </button>
                </div>
              </form>

              <button
                onClick={() => setShowFilters(prev => !prev)}
                className="px-3 py-1.5 sm:py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm"
              >
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
            </>
          )}
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-6">
        {isBooks && showFilters && (
          <div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Book Filters</h3>
              <button
                onClick={clearFilters}
                className="text-xs text-primary dark:text-blue-400 hover:underline"
              >
                Clear Filters
              </button>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {availableTags.map(tag => {
                  const active = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`text-xs px-2 py-1 rounded-full border ${
                        active
                          ? 'bg-primary text-white border-primary'
                          : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs text-gray-600 dark:text-gray-300">
                <span className="block mb-1 font-medium">Author</span>
                <select
                  value={selectedAuthor}
                  onChange={(event) => setSelectedAuthor(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
                >
                  <option value="">All authors</option>
                  {availableAuthors.map(author => (
                    <option key={author} value={author}>{author}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-gray-600 dark:text-gray-300">
                <span className="block mb-1 font-medium">Audiobook</span>
                <button
                  onClick={() => setAudiobookOnly(prev => !prev)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm text-left ${
                    audiobookOnly
                      ? 'bg-primary text-white border-primary'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {audiobookOnly ? 'Only books with audiobook' : 'Any (with or without audiobook)'}
                </button>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-gray-600 dark:text-gray-300">
                <span className="block mb-1 font-medium">Year from</span>
                <input
                  value={yearMin}
                  onChange={(event) => setYearMin(event.target.value.replace(/[^0-9-]/g, ''))}
                  placeholder="e.g. 1"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
                />
              </label>
              <label className="text-xs text-gray-600 dark:text-gray-300">
                <span className="block mb-1 font-medium">Year to</span>
                <input
                  value={yearMax}
                  onChange={(event) => setYearMax(event.target.value.replace(/[^0-9-]/g, ''))}
                  placeholder="e.g. 2000"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-200"
                />
              </label>
            </div>
          </div>
        )}

        {isFullSearchMode ? (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Full Search mode: books content + Bible + commentary
              </p>
              <button
                onClick={() => setUseFullSearch(false)}
                className="text-sm text-primary dark:text-blue-400 hover:underline"
              >
                Back to Catalog Search
              </button>
            </div>

            {searchLoading ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-sm text-gray-500 dark:text-gray-400 animate-pulse">
                Searching across books, Bible, and commentary...
              </div>
            ) : (
              <SearchResults
                results={searchResults || { books: [], verses: [], commentaries: [], sectionOrder: ['books', 'verses', 'commentaries'] }}
                query={trimmedQuery}
                onBookClick={(result) => {
                  navigate(`/resources/books/${result.bookId}`, {
                    state: {
                      searchQuery: trimmedQuery,
                      chapterIndex: result.chapterIndex,
                    },
                  })
                }}
                onVerseClick={(book, chapter) => {
                  navigate(`/${toBookSlug(book)}/${chapter}`)
                }}
                onCommentaryClick={(commentary) => {
                  const book = commentary.book || 'Revelation'
                  const chapter = commentary.verses?.[0]?.chapter || commentary.chapter || 1
                  navigate(`/${toBookSlug(book)}/${chapter}`)
                }}
                onClose={() => {
                  setSearchQuery('')
                  setSearchResults(null)
                  setUseFullSearch(false)
                }}
              />
            )}
          </div>
        ) : (
          <>
            {isBooks && (
              <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                {isCatalogFiltered
                  ? `Showing ${filteredBooks.length} matching books by title/author and filters.`
                  : `Showing all ${filteredBooks.length} books in chronological order.`}
              </div>
            )}

            <div className="space-y-3">
              {(isBooks ? filteredBooks : items).map(item => {
                const Wrapper = isClickable ? 'button' : 'div'
                return (
                  <Wrapper
                    key={item.id}
                    onClick={isClickable ? () => handleItemClick(item) : undefined}
                    className={`w-full text-left p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-all ${
                      isClickable
                        ? 'hover:border-primary/40 dark:hover:border-blue-400/40 hover:shadow-md active:scale-[0.99] cursor-pointer'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm sm:text-base">
                            {item.title}
                          </h3>
                          {(isConfessions || isBooks) && item.tag && <ResourceTag tag={item.tag} />}
                        </div>
                        {isBooks && item.author && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.author}</p>
                        )}
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {item.year && <YearBadge year={item.year} />}
                        {isClickable && (
                          <span className="text-gray-300 dark:text-gray-600 text-lg mt-1">›</span>
                        )}
                      </div>
                    </div>

                    {isBooks && hasAudiobook(item) && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                        <span>🎧</span>
                        <span>Free audiobook available</span>
                      </div>
                    )}
                  </Wrapper>
                )
              })}
            </div>

            {isBooks && (
              <div className="mt-5 text-center">
                <button
                  onClick={() => setUseFullSearch(true)}
                  disabled={!trimmedQuery}
                  className="px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                >
                  Full Search
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Full Search scans book content plus Bible and commentary.
                </p>
              </div>
            )}

            <div className="mt-8 text-center">
              <button
                onClick={() => navigate('/genesis/1')}
                className="text-sm text-primary hover:underline"
              >
                Back to Bible
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default ResourcePage

