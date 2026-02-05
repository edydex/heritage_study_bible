import { useState } from 'react'

function Header({ onSearch, searchQuery, setSearchQuery, onBookmarkClick, bookmarkCount }) {
  const [isSearchFocused, setIsSearchFocused] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSearch(searchQuery)
  }

  return (
    <header className="bg-primary text-white shadow-lg sticky top-0 z-40">
      <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-4 max-w-4xl">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo/Title */}
          <div className="flex-shrink-0">
            <h1 className="heading-text text-base sm:text-xl font-bold">Consensus</h1>
            <p className="text-[10px] sm:text-xs text-blue-200 hidden sm:block">Bible Study Tool</p>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSubmit} className="flex-1 max-w-md min-w-0">
            <div className={`flex items-center bg-white/10 rounded-lg transition-all ${isSearchFocused ? 'ring-2 ring-white/50' : ''}`}>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                className="flex-1 bg-transparent px-2 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base text-white placeholder-blue-200 focus:outline-none min-w-0"
              />
              <button 
                type="submit"
                className="px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-white/10 rounded-r-lg transition-colors"
              >
                🔍
              </button>
            </div>
          </form>

          {/* Bookmark Button */}
          <button 
            onClick={onBookmarkClick}
            className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
            title="View bookmarks"
          >
            <span className="text-sm sm:text-base">⭐</span>
            {bookmarkCount > 0 && (
              <span className="bg-secondary text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded-full text-gray-900 font-medium">
                {bookmarkCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
