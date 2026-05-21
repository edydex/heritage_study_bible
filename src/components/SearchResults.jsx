function SearchResults({ results, query, onVerseClick, onCommentaryClick, onBookClick, onClose }) {
  const verses = results.verses || []
  const commentaries = results.commentaries || []
  const books = results.books || []
  const sectionOrder = results.sectionOrder || ['verses', 'commentaries', 'books']
  const totalResults = verses.length + commentaries.length + books.length

  const highlightText = (text, query) => {
    if (!query) return text
    try {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(${escaped})`, 'gi')
      const parts = text.split(regex)
      return parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? <mark key={i} className="bg-yellow-200 dark:bg-amber-600/70 dark:text-amber-50 px-0.5">{part}</mark> : part
      )
    } catch {
      return text
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="heading-text text-2xl font-bold text-primary dark:text-blue-400">
            Search Results
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            <>
              Found {totalResults} result{totalResults !== 1 ? 's' : ''} for "{query}"
              {(results.versesCapped || results.commentariesCapped || results.booksCapped) && (
                <span className="text-xs text-amber-600 dark:text-amber-400"> (results limited — try a more specific search)</span>
              )}
            </>
          </p>
        </div>
        <button 
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
        >
          Clear Search
        </button>
      </div>

      {totalResults === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-4xl mb-4">🔍</p>
          <p>No results found. Try a different search term.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sectionOrder.map((section) => {
            if (section === 'verses' && verses.length > 0) {
              return (
                <div key="verses">
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span>📖</span>
                    Bible Verses ({verses.length})
                  </h3>
                  <div className="space-y-2">
                    {verses.map((result, index) => (
                      <div
                        key={`verse-${index}`}
                        onClick={() => onVerseClick?.(result.book || 'Revelation', result.chapter, result.verse)}
                        className="p-4 bg-gray-50 dark:bg-gray-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-primary dark:text-blue-300">
                            {result.book || 'Revelation'} {result.chapter}:{result.verse}
                          </span>
                          {result.hasCommentary && (
                            <span className="text-xs bg-secondary/20 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                              Has Commentary
                            </span>
                          )}
                        </div>
                        <p className="verse-text text-gray-700 dark:text-gray-300">
                          {highlightText(result.text, query)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }

            if (section === 'commentaries' && commentaries.length > 0) {
              return (
                <div key="commentaries">
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Commentary ({commentaries.length})
                  </h3>
                  <div className="space-y-2">
                    {commentaries.map((result, index) => (
                      <div
                        key={`commentary-${index}`}
                        onClick={() => onCommentaryClick?.(result)}
                        className="p-4 bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-primary dark:text-blue-300">
                            {result.reference}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {result.timestamp}
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">
                          {highlightText(result.snippet, query)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }

            if (section === 'books' && books.length > 0) {
              return (
                <div key="books">
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <span>📚</span>
                    Books ({books.length})
                  </h3>
                  <div className="space-y-2">
                    {books.map((result, index) => (
                      <div
                        key={`book-${index}`}
                        onClick={() => onBookClick?.(result)}
                        className="p-4 bg-gray-50 dark:bg-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-primary dark:text-blue-300">
                            {result.bookTitle}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {result.groupKey !== 'Front Matter' ? `${result.groupKey} · ` : ''}{result.chapterLabel}
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">
                          {highlightText(result.snippet, query)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }

            return null
          })}
        </div>
      )}
    </div>
  )
}

export default SearchResults
