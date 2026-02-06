import { useState, useRef, useEffect } from 'react'
import { translations } from '../data/translations'

function Header({ onSearch, searchQuery, setSearchQuery, onBookmarkClick, onResourcesClick, bookmarkCount, isSidebarOpen = false, sidebarWidth = 540, textSize = 18, onTextSizeChange, commentaryTextSize = 14, onCommentaryTextSizeChange, translationId, onTranslationChange, translationLoading }) {
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showTranslations, setShowTranslations] = useState(false)
  const settingsRef = useRef(null)
  const translationsRef = useRef(null)

  const [isSmallScreen, setIsSmallScreen] = useState(false)

  // Track screen size for responsive placeholder
  useEffect(() => {
    const check = () => setIsSmallScreen(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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
      if (translationsRef.current && !translationsRef.current.contains(e.target)) {
        setShowTranslations(false)
      }
    }
    if (showSettings || showTranslations) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSettings, showTranslations])

  const clamp = (v) => Math.max(12, Math.min(64, parseInt(v) || 18))

  return (
    <header className="bg-primary text-white shadow-lg sticky top-0 z-40">
      <div
        className="px-4 sm:px-6 h-14 flex items-center transition-all duration-300"
        style={{ marginRight: isSidebarOpen ? `${sidebarWidth}px` : 0 }}
      >
        <div className="flex items-center gap-3 sm:gap-4 w-full">
          {/* Logo/Title - left aligned */}
          <div className="flex-shrink-0">
            <h1 className="heading-text text-base sm:text-xl font-bold leading-tight"><span className="sm:hidden">H</span><span className="hidden sm:inline">Heritage</span></h1>
            <p className="text-[10px] sm:text-xs text-blue-200 hidden sm:block">Study Bible</p>
          </div>

          {/* Search Bar - fills available space */}
          <form onSubmit={handleSubmit} className="flex-1 min-w-0 max-w-xl">
            <div className={`flex items-center bg-white/10 rounded-lg transition-all ${isSearchFocused ? 'ring-2 ring-white/50' : ''}`}>
              <input
                type="text"
                placeholder={isSmallScreen ? 'Find...' : 'Search or go to verse...'}
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

          {/* Translation Selector */}
          <div className="relative flex-shrink-0" ref={translationsRef}>
            <button
              onClick={() => setShowTranslations(!showTranslations)}
              className={`flex items-center px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors flex-shrink-0 ${
                translationLoading
                  ? 'bg-white/20 animate-pulse'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
              title="Change translation"
            >
              <span className="text-xs sm:text-sm font-bold tracking-wide">{translationId}</span>
            </button>

            {/* Translations Dropdown */}
            {showTranslations && (
              <div className="absolute right-0 sm:left-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 w-64 z-50">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 px-4">Translation</h4>
                {translations.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onTranslationChange(t.id)
                      setShowTranslations(false)
                    }}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      translationId === t.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`font-bold text-sm w-10 ${translationId === t.id ? 'text-primary' : 'text-gray-900'}`}>{t.abbr}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${translationId === t.id ? 'text-primary' : ''}`}>{t.name}</div>
                      <div className="text-xs text-gray-400">{t.description}</div>
                    </div>
                    {translationId === t.id && <span className="text-primary text-sm">✓</span>}
                  </button>
                ))}
                {/* Attribution for translations that require it */}
                {(() => {
                  const selected = translations.find(t => t.id === translationId)
                  return selected?.attribution ? (
                    <div className="px-4 pt-2 mt-1 border-t border-gray-100">
                      <p className="text-[10px] text-gray-400 leading-tight">{selected.attribution}</p>
                    </div>
                  ) : null
                })()}
              </div>
            )}
          </div>

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

          {/* Resources Button */}
          <button
            onClick={onResourcesClick}
            className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
            title="Resources"
          >
            <span className="text-sm sm:text-base">📚</span>
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
              <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 py-3 px-4 w-56 z-50">
                {/* Bible Text Size */}
                <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Bible Text</h4>
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-gray-400 text-[10px]">A</span>
                  <input
                    type="range"
                    min={12}
                    max={64}
                    value={textSize}
                    onChange={(e) => onTextSizeChange(clamp(e.target.value))}
                    className="flex-1 h-1.5 accent-primary cursor-pointer"
                  />
                  <span className="text-gray-400 text-xs font-bold">A</span>
                  <input
                    type="number"
                    min={12}
                    max={64}
                    value={textSize}
                    onChange={(e) => onTextSizeChange(clamp(e.target.value))}
                    className="w-10 text-center text-xs border border-gray-300 rounded py-0.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary no-spinners"
                  />
                </div>

                {/* Commentary Text Size */}
                <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Commentary</h4>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 text-[10px]">A</span>
                  <input
                    type="range"
                    min={12}
                    max={64}
                    value={commentaryTextSize}
                    onChange={(e) => onCommentaryTextSizeChange(clamp(e.target.value))}
                    className="flex-1 h-1.5 accent-primary cursor-pointer"
                  />
                  <span className="text-gray-400 text-xs font-bold">A</span>
                  <input
                    type="number"
                    min={12}
                    max={64}
                    value={commentaryTextSize}
                    onChange={(e) => onCommentaryTextSizeChange(clamp(e.target.value))}
                    className="w-10 text-center text-xs border border-gray-300 rounded py-0.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary no-spinners"
                  />
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
