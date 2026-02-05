import { useState, useRef, useEffect } from 'react'

function Header({ onSearch, searchQuery, setSearchQuery, onBookmarkClick, bookmarkCount, isSidebarOpen = false, textSize = 'medium', onTextSizeChange }) {
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSearch(searchQuery)
  }

  // Close settings dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setShowSettings(false)
      }
    }
    if (showSettings) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSettings])

  const textSizes = [
    { id: 'small', label: 'Small', icon: 'A' },
    { id: 'medium', label: 'Medium', icon: 'A' },
    { id: 'large', label: 'Large', icon: 'A' },
  ]

  return (
    <header className="bg-primary text-white shadow-lg sticky top-0 z-40">
      <div className={`px-4 sm:px-6 h-14 flex items-center transition-all duration-300 ${
        isSidebarOpen ? 'lg:mr-[420px] xl:mr-[560px] 2xl:mr-[672px]' : ''
      }`}>
        <div className="flex items-center gap-3 sm:gap-4 w-full">
          {/* Logo/Title - left aligned */}
          <div className="flex-shrink-0">
            <h1 className="heading-text text-base sm:text-xl font-bold leading-tight">Heritage</h1>
            <p className="text-[10px] sm:text-xs text-blue-200 hidden sm:block">Study Bible</p>
          </div>

          {/* Search Bar - fills available space */}
          <form onSubmit={handleSubmit} className="flex-1 min-w-0 max-w-xl">
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

          {/* Settings Button */}
          <div className="relative flex-shrink-0" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
              title="Text size settings"
            >
              <span className="text-sm sm:text-base">⚙️</span>
            </button>

            {/* Settings Dropdown */}
            {showSettings && (
              <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 py-3 px-4 w-48 z-50">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Text Size</h4>
                <div className="flex gap-1">
                  {textSizes.map((size) => (
                    <button
                      key={size.id}
                      onClick={() => {
                        onTextSizeChange(size.id)
                        setShowSettings(false)
                      }}
                      className={`flex-1 flex flex-col items-center py-2 rounded-lg transition-all ${
                        textSize === size.id
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span className={`font-serif ${
                        size.id === 'small' ? 'text-sm' : size.id === 'medium' ? 'text-base' : 'text-xl'
                      }`}>{size.icon}</span>
                      <span className="text-[10px] mt-0.5">{size.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
