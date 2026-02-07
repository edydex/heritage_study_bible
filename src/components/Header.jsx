import { useState, useRef, useEffect } from 'react'
import { translations } from '../data/translations'

function Header({ onSearch, searchQuery, setSearchQuery, onBookmarkClick, onResourcesClick, bookmarkCount, isSidebarOpen = false, sidebarWidth = 540, textSize = 18, onTextSizeChange, commentaryTextSize = 14, onCommentaryTextSizeChange, translationId, onTranslationChange, translationLoading, darkMode = false, onDarkModeChange }) {
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showTranslations, setShowTranslations] = useState(false)
  const settingsRef = useRef(null)
  const translationsRef = useRef(null)
  // Temporary input values allow typing any number; clamped on blur
  const [bibleInput, setBibleInput] = useState(String(textSize))
  const [commentaryInput, setCommentaryInput] = useState(String(commentaryTextSize))

  // Sync inputs when props change externally (e.g. from +/- buttons)
  useEffect(() => { setBibleInput(String(textSize)) }, [textSize])
  useEffect(() => { setCommentaryInput(String(commentaryTextSize)) }, [commentaryTextSize])

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
              <div className="absolute right-0 sm:left-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 w-64 z-50">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 px-4">Translation</h4>
                {translations.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onTranslationChange(t.id)
                      setShowTranslations(false)
                    }}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                      translationId === t.id
                        ? 'bg-primary/10 text-primary dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className={`font-bold text-sm w-10 ${translationId === t.id ? 'text-primary dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>{t.abbr}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${translationId === t.id ? 'text-primary dark:text-blue-400' : 'dark:text-gray-200'}`}>{t.name}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{t.description}</div>
                    </div>
                    {translationId === t.id && <span className="text-primary text-sm">✓</span>}
                  </button>
                ))}
                {/* Attribution for translations that require it */}
                {(() => {
                  const selected = translations.find(t => t.id === translationId)
                  return selected?.attribution ? (
                    <div className="px-4 pt-2 mt-1 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">{selected.attribution}</p>
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
              <div className="absolute right-0 top-full mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-3 px-4 w-64 z-50">
                {/* Bible Text Size */}
                <h4 className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Bible Text</h4>
                <div className="flex items-center gap-1.5 mb-3">
                  <button
                    type="button"
                    onClick={() => onTextSizeChange(Math.max(12, textSize - 1))}
                    className="flex-1 h-10 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xl transition-colors"
                  >−</button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={bibleInput}
                    onChange={(e) => setBibleInput(e.target.value.replace(/[^0-9]/g, ''))}
                    onBlur={() => {
                      const v = parseInt(bibleInput) || 18
                      const clamped = Math.max(12, Math.min(64, v))
                      onTextSizeChange(clamped)
                      setBibleInput(String(clamped))
                    }}
                    className="w-14 flex-shrink-0 text-center text-sm border border-gray-300 dark:border-gray-600 rounded-lg py-1.5 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary no-spinners"
                  />
                  <button
                    type="button"
                    onClick={() => onTextSizeChange(Math.min(64, textSize + 1))}
                    className="flex-1 h-10 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xl transition-colors"
                  >+</button>
                </div>

                {/* Commentary Text Size */}
                <h4 className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Commentary</h4>
                <div className="flex items-center gap-1.5 mb-3">
                  <button
                    type="button"
                    onClick={() => onCommentaryTextSizeChange(Math.max(12, commentaryTextSize - 1))}
                    className="flex-1 h-10 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xl transition-colors"
                  >−</button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={commentaryInput}
                    onChange={(e) => setCommentaryInput(e.target.value.replace(/[^0-9]/g, ''))}
                    onBlur={() => {
                      const v = parseInt(commentaryInput) || 14
                      const clamped = Math.max(12, Math.min(64, v))
                      onCommentaryTextSizeChange(clamped)
                      setCommentaryInput(String(clamped))
                    }}
                    className="w-14 flex-shrink-0 text-center text-sm border border-gray-300 dark:border-gray-600 rounded-lg py-1.5 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary no-spinners"
                  />
                  <button
                    type="button"
                    onClick={() => onCommentaryTextSizeChange(Math.min(64, commentaryTextSize + 1))}
                    className="flex-1 h-10 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-bold text-xl transition-colors"
                  >+</button>
                </div>

                {/* Dark Mode */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-2.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); if (onDarkModeChange) onDarkModeChange(!darkMode); }}
                    className="w-full flex items-center justify-between px-1 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-200 font-medium flex items-center gap-1.5">{darkMode ? '🌙' : '☀️'} {darkMode ? 'Dark Mode' : 'Light Mode'}</span>
                    <div className={`w-11 h-6 rounded-full transition-colors relative ${darkMode ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${darkMode ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </button>
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
