function SearchResults({ results, query, onVerseClick, onCommentaryClick, onClose }) {
  const totalResults = results.verses.length + results.commentaries.length

  const highlightText = (text, query) => {
    if (!query) return text
    const regex = new RegExp(`(${query})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-700 dark:text-white px-0.5">{part}</mark> : part
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="heading-text text-2xl font-bold text-primary dark:text-blue-400">
            Search Results
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Found {totalResults} result{totalResults !== 1 ? 's' : ''} for "{query}"
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
          {/* Verse Results */}
          {results.verses.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <span>📖</span>
                Bible Verses ({results.verses.length})
              </h3>
              <div className="space-y-2">
                {results.verses.map((result, index) => (
                  <div 
                    key={index}
                    onClick={() => onVerseClick(result.book || 'Revelation', result.chapter, result.verse)}
                    className="p-4 bg-gray-50 dark:bg-gray-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-primary">
                        {result.book || 'Revelation'} {result.chapter}:{result.verse}
                      </span>
                      {result.hasCommentary && (
                        <span className="text-xs bg-secondary/20 text-amber-700 px-2 py-0.5 rounded">
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
          )}

          {/* Commentary Results */}
          {results.commentaries.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Commentary ({results.commentaries.length})
              </h3>
              <div className="space-y-2">
                {results.commentaries.map((result, index) => (
                  <div 
                    key={index}
                    onClick={() => onCommentaryClick(result)}
                    className="p-4 bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-primary">
                        {result.reference}
                      </span>
                      <span className="text-xs text-gray-500">
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
          )}
        </div>
      )}
    </div>
  )
}

export default SearchResults
