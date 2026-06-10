import { useState, useRef, useEffect, useMemo } from 'react'
import { translations } from '../data/translations'
import { isNativeAndroid, setNativeReaderChromeHidden } from '../services/androidControls'

const NATIVE_VOLUME_NEXT_EVENT = 'heritage:native-volume-next'
const READER_CHROME_SUPPRESS_EVENT = 'heritage:reader-chrome-suppress-show'
const READER_HEADER_HIDE_SCROLL_PX = 24
const READER_HEADER_SHOW_SCROLL_PX = 64
const READER_HEADER_MIN_SCROLL_DELTA_PX = 4
const READER_CHROME_SETTLE_MS = 700
const READER_VOLUME_NEXT_HEADER_SUPPRESS_MS = 1800

function Header({
  onSearch,
  isSearchLoading = false,
  searchQuery,
  setSearchQuery,
  onBookmarkClick,
  onResourcesClick,
  isSidebarOpen = false,
  sidebarWidth = 540,
  textSize = 18,
  onTextSizeChange,
  commentaryTextSize = 14,
  onCommentaryTextSizeChange,
  verseStacking = false,
  onVerseStackingChange,
  translationId,
  onTranslationChange,
  translationLoading,
  parallelMode = false,
  parallelLoading = false,
  parallelSecondaryId = null,
  onParallelEnable,
  onParallelDisable,
  darkMode = false,
  onDarkModeChange,
  sideButtonScroll = false,
  onSideButtonScrollChange,
  showVolumeScrollSetting = false,
  onSearchKeyboardCaptureChange,
  onAdvancedSettingsClick,
  hidden = false,
}) {
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showTranslations, setShowTranslations] = useState(false)
  const [showParallelModal, setShowParallelModal] = useState(false)
  const [autoHidden, setAutoHidden] = useState(false)
  const [selectedParallelLanguage, setSelectedParallelLanguage] = useState('')
  const settingsRef = useRef(null)
  const translationsRef = useRef(null)
  const suppressShowUntilRef = useRef(0)
  const chromeSettleUntilRef = useRef(0)
  const nativeChromeHiddenRef = useRef(null)
  // Temporary input values allow typing any number; clamped on blur
  const [bibleInput, setBibleInput] = useState(String(textSize))
  const [commentaryInput, setCommentaryInput] = useState(String(commentaryTextSize))

  // Sync inputs when props change externally (e.g. from +/- buttons)
  useEffect(() => { setBibleInput(String(textSize)) }, [textSize])
  useEffect(() => { setCommentaryInput(String(commentaryTextSize)) }, [commentaryTextSize])

  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const translationGroups = useMemo(() => {
    const groups = new Map()
    for (const translation of translations) {
      const language = translation.language || 'Other'
      if (!groups.has(language)) groups.set(language, [])
      groups.get(language).push(translation)
    }
    return [...groups.entries()].map(([language, entries]) => ({
      language,
      entries: entries.slice().sort((a, b) => a.name.localeCompare(b.name)),
    }))
  }, [])

  const availableParallelTranslations = useMemo(() => {
    return translations.filter(t => t.id !== translationId)
  }, [translationId])

  // Track screen size for responsive placeholder
  useEffect(() => {
    const check = () => setIsSmallScreen(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (!showParallelModal) return
    const preferred = availableParallelTranslations.find(t => t.id === parallelSecondaryId)
    const fallback = availableParallelTranslations[0]
    setSelectedParallelLanguage(preferred?.language || fallback?.language || '')
  }, [showParallelModal, availableParallelTranslations, parallelSecondaryId])

  const inputRef = useRef(null)

  const setSearchKeyboardCapture = (enabled) => {
    onSearchKeyboardCaptureChange?.(enabled)
  }

  useEffect(() => {
    return () => onSearchKeyboardCaptureChange?.(false)
  }, [onSearchKeyboardCaptureChange])

  useEffect(() => {
    if (!isNativeAndroid()) return undefined

    let lastScrollY = window.scrollY || document.documentElement.scrollTop || 0
    let upwardTravel = 0
    let downwardTravel = 0
    let frame = null

    const suppressHeaderShow = (durationMs = READER_VOLUME_NEXT_HEADER_SUPPRESS_MS) => {
      suppressShowUntilRef.current = Math.max(
        suppressShowUntilRef.current,
        performance.now() + durationMs
      )
      setAutoHidden(true)
    }

    const handleNativeVolumeNext = () => {
      suppressHeaderShow()
    }

    const handleReaderChromeSuppress = (event) => {
      const durationMs = Number(event.detail?.durationMs)
      suppressHeaderShow(Number.isFinite(durationMs) && durationMs > 0
        ? durationMs
        : READER_VOLUME_NEXT_HEADER_SUPPRESS_MS)
    }

    const handleScroll = () => {
      if (frame != null) return

      frame = window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0
        const delta = currentScrollY - lastScrollY
        const absDelta = Math.abs(delta)
        const now = performance.now()

        if (currentScrollY <= 2) {
          upwardTravel = 0
          downwardTravel = 0
          setAutoHidden(now < suppressShowUntilRef.current)
          lastScrollY = currentScrollY
          frame = null
          return
        }

        if (absDelta < READER_HEADER_MIN_SCROLL_DELTA_PX || now < chromeSettleUntilRef.current) {
          lastScrollY = currentScrollY
          frame = null
          return
        }

        if (delta > 0) {
          downwardTravel += delta
          upwardTravel = 0
          if (currentScrollY > READER_HEADER_HIDE_SCROLL_PX && downwardTravel >= READER_HEADER_HIDE_SCROLL_PX) {
            setAutoHidden(true)
            downwardTravel = 0
          }
        } else if (delta < 0) {
          upwardTravel += -delta
          downwardTravel = 0
          if (now >= suppressShowUntilRef.current && upwardTravel >= READER_HEADER_SHOW_SCROLL_PX) {
            setAutoHidden(false)
            upwardTravel = 0
          }
        }

        lastScrollY = currentScrollY
        frame = null
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener(NATIVE_VOLUME_NEXT_EVENT, handleNativeVolumeNext)
    window.addEventListener(READER_CHROME_SUPPRESS_EVENT, handleReaderChromeSuppress)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener(NATIVE_VOLUME_NEXT_EVENT, handleNativeVolumeNext)
      window.removeEventListener(READER_CHROME_SUPPRESS_EVENT, handleReaderChromeSuppress)
      if (frame != null) window.cancelAnimationFrame(frame)
      nativeChromeHiddenRef.current = false
      setNativeReaderChromeHidden(false).catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!isNativeAndroid()) return
    const shouldHide = (hidden || autoHidden) && !isSearchFocused && !showSettings && !showTranslations && !showParallelModal
    if (nativeChromeHiddenRef.current === shouldHide) return
    nativeChromeHiddenRef.current = shouldHide
    chromeSettleUntilRef.current = performance.now() + READER_CHROME_SETTLE_MS
    setNativeReaderChromeHidden(shouldHide).catch(() => {})
  }, [autoHidden, hidden, isSearchFocused, showSettings, showTranslations, showParallelModal])

  const handleSubmit = (e) => {
    e.preventDefault()
    // Use the actual DOM input value to avoid any browser autocomplete interference
    const input = inputRef.current
    const value = input ? input.value : searchQuery
    input?.blur()
    setIsSearchFocused(false)
    onSearch(value)
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

  const handleParallelButtonClick = () => {
    if (parallelMode) {
      onParallelDisable?.()
      return
    }
    setShowParallelModal(true)
  }

  const handleParallelSelect = (translationOptionId) => {
    if (!translationOptionId || translationOptionId === translationId) return
    onParallelEnable?.(translationOptionId)
    setShowParallelModal(false)
  }

  return (
    <header
      className={`reader-primary-header bg-primary text-white shadow-lg sticky top-0 z-40 transition-transform duration-200 ease-out will-change-transform ${
        (hidden || autoHidden) && !isSearchFocused && !showSettings && !showTranslations && !showParallelModal
          ? '-translate-y-full pointer-events-none shadow-none'
          : 'translate-y-0'
      }`}
    >
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
                ref={inputRef}
                type="text"
                name="hsb-search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                placeholder={isSmallScreen ? 'Find...' : 'Search or go to verse...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onPointerDown={() => setSearchKeyboardCapture(true)}
                onFocus={() => {
                  setSearchKeyboardCapture(true)
                  setIsSearchFocused(true)
                }}
                onBlur={() => {
                  setSearchKeyboardCapture(false)
                  setIsSearchFocused(false)
                }}
                className="flex-1 bg-transparent px-2 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base text-white placeholder-blue-200 focus:outline-none min-w-0"
              />
              <button 
                type="submit"
                disabled={isSearchLoading}
                aria-label={isSearchLoading ? 'Searching' : 'Search'}
                className="px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-white/10 rounded-r-lg transition-colors disabled:cursor-wait disabled:opacity-80 min-w-[2.25rem] flex items-center justify-center"
              >
                {isSearchLoading ? (
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                ) : (
                  '🔍'
                )}
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

          {/* Parallel Mode Button */}
          <button
            onClick={handleParallelButtonClick}
            className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors flex-shrink-0 ${
              parallelMode
                ? 'bg-emerald-500/80 hover:bg-emerald-500'
                : parallelLoading
                  ? 'bg-white/20 animate-pulse'
                  : 'bg-white/10 hover:bg-white/20'
            }`}
            title={parallelMode ? 'Disable parallel mode' : 'Enable parallel mode'}
          >
            <span className="text-xs sm:text-sm font-bold tracking-wide">| |</span>
            {parallelMode && (
              <span className="hidden sm:inline text-[11px] font-semibold tracking-wide">
                {parallelSecondaryId || 'ON'}
              </span>
            )}
          </button>

          {/* Bookmark Button */}
          <button 
            onClick={onBookmarkClick}
            className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
            title="View bookmarks"
          >
            <span className="text-sm sm:text-base">⭐</span>
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

                {/* Verse Layout */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-2.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onVerseStackingChange?.(!verseStacking) }}
                    className="w-full flex items-center justify-between px-1 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-200 font-medium flex items-center gap-1.5">
                      📜 Verse Stacking
                    </span>
                    <div className={`w-11 h-6 rounded-full transition-colors relative ${verseStacking ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${verseStacking ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </button>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 px-1 mt-1">
                    {verseStacking ? '1 text 2 text' : '1 text\n2 text'}
                  </p>
                </div>

                {showVolumeScrollSetting && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2.5">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onSideButtonScrollChange?.(!sideButtonScroll) }}
                      className="w-full flex items-center justify-between px-1 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-200 font-medium flex items-center gap-1.5">
                        🔊 Volume Scroll
                      </span>
                      <div className={`w-11 h-6 rounded-full transition-colors relative ${sideButtonScroll ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sideButtonScroll ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                    </button>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 px-1 mt-1">
                      Use volume keys to page-scroll reader screens
                    </p>
                  </div>
                )}

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

                <div className="border-t border-gray-200 dark:border-gray-700 pt-2.5">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setShowSettings(false)
                      onAdvancedSettingsClick?.()
                    }}
                    className="w-full flex items-center justify-between px-1 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-200 font-medium">More settings</span>
                    <span className="text-gray-400 dark:text-gray-500">›</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showParallelModal && (
        <div
          className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[1px] flex items-start justify-center p-4 sm:p-6"
          onClick={() => setShowParallelModal(false)}
        >
          <div
            className="w-full max-w-2xl mt-10 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="heading-text text-xl text-gray-900 dark:text-gray-100">Parallel Bible Mode</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Choose a secondary translation</p>
              </div>
              <button
                onClick={() => setShowParallelModal(false)}
                className="px-2 py-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="px-5 pt-4">
              <div className="flex flex-wrap gap-2">
                {translationGroups.map((group) => (
                  <button
                    key={group.language}
                    onClick={() => setSelectedParallelLanguage(group.language)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      selectedParallelLanguage === group.language
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {group.language}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                {(translationGroups.find(group => group.language === selectedParallelLanguage)?.entries || [])
                  .map((translationOption) => {
                    const isPrimary = translationOption.id === translationId
                    const isSelected = translationOption.id === parallelSecondaryId
                    return (
                      <button
                        key={translationOption.id}
                        onClick={() => handleParallelSelect(translationOption.id)}
                        disabled={isPrimary}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                          isPrimary
                            ? 'bg-gray-100 dark:bg-gray-700/80 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700'
                              : 'bg-gray-50 dark:bg-gray-700/60 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{translationOption.abbr}</span>
                              {isPrimary && <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-200">Primary</span>}
                              {!isPrimary && isSelected && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900">Selected</span>}
                            </div>
                            <div className="text-sm text-gray-700 dark:text-gray-300 truncate">{translationOption.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{translationOption.description}</div>
                          </div>
                          {!isPrimary && <span className="text-primary">→</span>}
                        </div>
                      </button>
                    )
                  })}
              </div>

              {availableParallelTranslations.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">No secondary translations available.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

export default Header
