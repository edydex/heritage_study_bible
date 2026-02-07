import { useState, useEffect, useRef, useCallback } from 'react'
import CompareModal from './CompareModal'

// Regex fallback for entries without <vq> markup (older data or books CCEL didn't tag)
const CALVIN_QUOTE_RE1 = /^(\s*\d+\.?\s+\S+(?:\s+\S+){0,12}?(?:\betc\b\.?\s*(?:[\u2014-]\s*)?|[.]))\s+/
const CALVIN_QUOTE_RE2 = /^(\s*\d+\.?\s+\S+(?:\s+\S+){1,8}?)\s+(?=[A-Z][a-z])/
function regexSplitQuote(text) {
  const m1 = text.match(CALVIN_QUOTE_RE1)
  if (m1) return [m1[1].trim(), text.substring(m1[0].length)]
  const m2 = text.match(CALVIN_QUOTE_RE2)
  if (m2) return [m2[1].trim(), text.substring(m2[0].length)]
  return [null, text]
}

/**
 * Render a Calvin commentary paragraph with structural markup:
 *   <vq>...</vq>  → bold verse quote
 *   <sq>...</sq>  → indented scripture block quote
 *   plain text    → normal paragraph (regex fallback for verse-quote detection)
 */
function renderCalvinParagraph(paragraph, pIndex) {
  // Scripture block quote
  const sqMatch = paragraph.match(/^<sq>([\s\S]*)<\/sq>$/)
  if (sqMatch) {
    return (
      <blockquote key={pIndex} className="text-gray-600 dark:text-gray-400 leading-relaxed mb-2 last:mb-0 border-l-2 border-blue-300 dark:border-blue-600 pl-3 italic">
        {sqMatch[1]}
      </blockquote>
    )
  }

  // Paragraph with <vq> verse-quote marker(s)
  if (paragraph.includes('<vq>')) {
    const parts = paragraph.split(/(<vq>[\s\S]*?<\/vq>)/g)
    return (
      <p key={pIndex} className="text-gray-700 dark:text-gray-100 leading-relaxed mb-2 last:mb-0">
        {parts.map((part, i) => {
          const vqMatch = part.match(/^<vq>([\s\S]*)<\/vq>$/)
          if (vqMatch) {
            return <strong key={i} className="text-gray-900 dark:text-white">{vqMatch[1]}</strong>
          }
          return part ? <span key={i}>{part}</span> : null
        })}
      </p>
    )
  }

  // No markup — try regex fallback for first paragraph
  if (pIndex === 0) {
    const [quote, rest] = regexSplitQuote(paragraph)
    if (quote) {
      return (
        <p key={pIndex} className="text-gray-700 dark:text-gray-100 leading-relaxed mb-2 last:mb-0">
          <strong className="text-gray-900 dark:text-white">{quote}</strong>{' '}{rest}
        </p>
      )
    }
  }

  return (
    <p key={pIndex} className="text-gray-700 dark:text-gray-100 leading-relaxed mb-2 last:mb-0">
      {paragraph}
    </p>
  )
}

/**
 * Get a plain-text preview of Calvin commentary for collapsed view.
 * Strips <vq>/<sq> markers and bolds the verse quote portion.
 */
function calvinPreview(text, maxLen = 120) {
  // Check for <vq> marker in the text
  const vqMatch = text.match(/<vq>([\s\S]*?)<\/vq>/)
  if (vqMatch) {
    const quote = vqMatch[1]
    const afterVq = text.substring(text.indexOf('</vq>') + 5).replace(/<\/?[vs]q>/g, '').trim()
    const preview = afterVq.substring(0, maxLen - quote.length)
    return <><strong className="text-gray-800 dark:text-gray-200">{quote}</strong>{' '}{preview}...</>
  }
  // Regex fallback
  const [quote, rest] = regexSplitQuote(text)
  if (quote) {
    const preview = rest.substring(0, maxLen - quote.length)
    return <><strong className="text-gray-800 dark:text-gray-200">{quote}</strong>{' '}{preview}...</>
  }
  return <>{text.replace(/<\/?[vs]q>/g, '').substring(0, maxLen)}...</>
}

function CommentarySidebar({ 
  chapter, 
  bookName = 'Revelation',
  versePositions = {}, 
  selectedAuthor,
  selectedWork,
  authors = [],
  onAuthorChange,
  onWorkChange,
  onClose,
  loading = false,
  selectedVerse,
  translationId,
  bibleData,
  commentaryTextSize = 14,
  sidebarWidth = 540,
  onSidebarWidthChange,
  isBookmarked,
  onBookmarkVerse,
  isCommentaryBookmarked,
  onBookmarkCommentary,
  onShowToast,
  onSaveNote,
  notes = []
}) {
  const [expandedVerses, setExpandedVerses] = useState({})
  const [showAuthorSearch, setShowAuthorSearch] = useState(false)
  const [showWorkDropdown, setShowWorkDropdown] = useState(false)
  const [showWorkLinksDropdown, setShowWorkLinksDropdown] = useState(false)
  const [authorSearchQuery, setAuthorSearchQuery] = useState('')
  const [showCompareModal, setShowCompareModal] = useState(false)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [introductionExpanded, setIntroductionExpanded] = useState(false)
  const [expandedIntroSections, setExpandedIntroSections] = useState({})
  const sidebarRef = useRef(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  // Track which verse keys user has manually collapsed (so auto-expand won't reopen)
  const userCollapsed = useRef(new Set())
  // Ref to the scrollable content div and to each commentary tile
  const contentRef = useRef(null)
  const commentaryRefs = useRef({})
  // Track previous selectedVerse so we only auto-scroll on *change*
  const prevSelectedVerse = useRef(null)

  // Drag-to-resize handler
  const handleDragStart = useCallback((e) => {
    e.preventDefault()
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleDragMove = (ev) => {
      if (!isDragging.current) return
      const delta = dragStartX.current - ev.clientX
      const newWidth = Math.max(320, Math.min(window.innerWidth * 0.7, dragStartWidth.current + delta))
      onSidebarWidthChange?.(Math.round(newWidth))
    }
    const handleDragEnd = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleDragMove)
      document.removeEventListener('mouseup', handleDragEnd)
    }
    document.addEventListener('mousemove', handleDragMove)
    document.addEventListener('mouseup', handleDragEnd)
  }, [sidebarWidth, onSidebarWidthChange])

  // Get works for current author on current chapter
  const currentAuthorData = authors.find(a => a.id === selectedAuthor)
  const authorWorks = currentAuthorData?.works || []
  const currentWorkData = authorWorks.find(w => w.id === selectedWork)
  
  // Filter works that have commentary for the current book and chapter
  const worksWithCommentary = authorWorks.filter(w => 
    w.book === bookName && w.commentaries.some(c => c.chapter === chapter)
  )

  // Get commentaries for current chapter from current work
  const chapterCommentaries = (currentWorkData?.book === bookName && currentWorkData?.commentaries.filter(c => 
    c.chapter === chapter
  )) || []

  // Get introduction sections
  const introductionSections = (currentWorkData?.book === bookName && currentWorkData?.introduction) || []
  const hasIntroduction = introductionSections.length > 0

  // Get work URLs
  const workOriginalUrl = currentWorkData?.originalUrl
  const workAudioUrl = currentWorkData?.audioUrl
  const workTranscriptUrl = currentWorkData?.transcriptUrl
  const hasWorkLinks = workOriginalUrl || workAudioUrl || workTranscriptUrl

  // Load existing note for selected verse
  useEffect(() => {
    if (selectedVerse) {
      const existingNote = notes.find(n => 
        n.book === bookName && 
        n.chapter === selectedVerse.chapter && 
        n.verse === selectedVerse.verse
      )
      setNoteText(existingNote?.text || '')
    }
  }, [selectedVerse, notes, bookName])

  // Filter authors based on search, prioritize those with content for this book
  const filteredAuthors = authors
    .filter(a => a.name.toLowerCase().includes(authorSearchQuery.toLowerCase()))
    .sort((a, b) => {
      const aHasBook = a.works.some(w => w.book === bookName) ? 0 : 1
      const bHasBook = b.works.some(w => w.book === bookName) ? 0 : 1
      return aHasBook - bHasBook
    })

  // Auto-expand commentary for selected verse (respects user collapse) + scroll
  useEffect(() => {
    if (!selectedVerse) return
    const prev = prevSelectedVerse.current
    const isNewClick =
      !prev ||
      prev.chapter !== selectedVerse.chapter ||
      prev.verse !== selectedVerse.verse
    prevSelectedVerse.current = selectedVerse

    const commentary = chapterCommentaries.find(c =>
      c.verses?.some(v => v.chapter === selectedVerse.chapter && v.verse === selectedVerse.verse)
    )
    if (!commentary) return
    const verseKey = getVerseKey(commentary.verses, commentary.reference)

    if (isNewClick) {
      // New verse click — clear collapsed flag and expand
      userCollapsed.current.delete(verseKey)
      setExpandedVerses(prev => ({ ...prev, [verseKey]: true }))

      // Scroll the commentary tile into view
      requestAnimationFrame(() => {
        const el = commentaryRefs.current[verseKey]
        const container = contentRef.current
        if (el && container) {
          const elTop = el.offsetTop - container.offsetTop
          container.scrollTo({ top: elTop, behavior: 'smooth' })
        }
      })
    } else {
      // Same verse re-selected — only expand if user hasn't collapsed it
      if (!userCollapsed.current.has(verseKey)) {
        setExpandedVerses(prev => ({ ...prev, [verseKey]: true }))
      }
    }
  }, [selectedVerse, chapterCommentaries])

  const toggleExpand = (verseKey) => {
    setExpandedVerses(prev => {
      const willCollapse = prev[verseKey]
      if (willCollapse) {
        userCollapsed.current.add(verseKey)
      } else {
        userCollapsed.current.delete(verseKey)
      }
      return { ...prev, [verseKey]: !prev[verseKey] }
    })
  }

  const toggleIntroSection = (sectionId) => {
    setExpandedIntroSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  const getVerseKey = (verses, reference) => {
    if (!verses || verses.length === 0) {
      // Use reference as key for chapter-level commentaries
      return reference || 'chapter'
    }
    const first = verses[0]
    const last = verses[verses.length - 1]
    if (first.verse === last.verse) {
      return `${first.chapter}:${first.verse}`
    }
    return `${first.chapter}:${first.verse}-${last.verse}`
  }

  // Toolbar actions
  const handleCompare = () => {
    if (!selectedVerse) {
      onShowToast?.('Select a verse first')
      return
    }
    setShowCompareModal(true)
  }

  const handleBookmarkVerse = () => {
    if (selectedVerse && onBookmarkVerse) {
      onBookmarkVerse(selectedVerse.chapter, selectedVerse.verse)
    } else {
      onShowToast?.('Select a verse first')
    }
  }

  const handleNotes = () => {
    setShowNotesModal(true)
  }

  const handleCopy = async () => {
    if (selectedVerse) {
      try {
        const text = `${bookName} ${selectedVerse.chapter}:${selectedVerse.verse} - ${selectedVerse.text || ''}`
        await navigator.clipboard.writeText(text)
        onShowToast?.('Copied to clipboard!')
      } catch (e) {
        onShowToast?.('Failed to copy')
      }
    } else {
      onShowToast?.('Select a verse first')
    }
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setShowAuthorSearch(false)
        setShowWorkDropdown(false)
        setShowWorkLinksDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (showCompareModal) setShowCompareModal(false)
        else if (showNotesModal) setShowNotesModal(false)
        else if (showAuthorSearch) setShowAuthorSearch(false)
        else if (showWorkDropdown) setShowWorkDropdown(false)
        else if (showWorkLinksDropdown) setShowWorkLinksDropdown(false)
        else onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [showCompareModal, showNotesModal, showAuthorSearch, showWorkDropdown, showWorkLinksDropdown, onClose])

  const verseIsBookmarked = selectedVerse && isBookmarked?.(selectedVerse.chapter, selectedVerse.verse)

  return (
    <>
      {/* Backdrop - dark overlay on mobile only */}
      <div 
        className="fixed inset-0 bg-black/30 z-30 lg:hidden"
        onClick={onClose}
      />

      {/* Sidebar - full screen on mobile, dynamic width on desktop */}
      <aside 
        className="fixed top-0 right-0 bottom-0 w-full lg:w-auto flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-lg z-50 lg:z-40 transform transition-[width] duration-100 ease-out animate-slide-in-right"
        style={{ width: window.innerWidth >= 1024 ? `${sidebarWidth}px` : undefined }}
        ref={sidebarRef}
      >
        {/* Drag handle - desktop only */}
        <div
          onMouseDown={handleDragStart}
          className="hidden lg:flex absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize items-center z-10 group hover:bg-primary/20 active:bg-primary/30 transition-colors"
          title="Drag to resize"
        >
          <div className="w-0.5 h-8 bg-gray-300 dark:bg-gray-600 group-hover:bg-primary rounded-full mx-auto transition-colors" />
        </div>
        {/* Top Bar with Close - height matches Header */}
        <div className="flex items-center justify-between px-4 h-14 bg-primary text-white">
          <h2 className="font-semibold text-lg leading-tight">Commentary</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Toolbar Strip */}
        <div className="grid grid-cols-4 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
          <button
            onClick={handleCompare}
            className="flex flex-col items-center justify-center py-3 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group border-r border-gray-300 dark:border-gray-600"
            title="Compare translations"
          >
            <span className="text-xl">🔄</span>
            <span className="text-[11px] text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 mt-0.5">Compare</span>
          </button>
          <button
            onClick={handleBookmarkVerse}
            className={`flex flex-col items-center justify-center py-3 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group border-r border-gray-300 dark:border-gray-600 ${
              verseIsBookmarked ? 'text-secondary' : ''
            }`}
            title={verseIsBookmarked ? 'Remove bookmark' : 'Bookmark verse'}
          >
            <span className="text-xl">{verseIsBookmarked ? '★' : '☆'}</span>
            <span className="text-[11px] text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 mt-0.5">Bookmark</span>
          </button>
          <button
            onClick={handleNotes}
            className="flex flex-col items-center justify-center py-3 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group border-r border-gray-300 dark:border-gray-600"
            title="Add notes"
          >
            <span className="text-xl">📝</span>
            <span className="text-[11px] text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 mt-0.5">Notes</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex flex-col items-center justify-center py-3 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors group"
            title="Copy verse"
          >
            <span className="text-xl">📋</span>
            <span className="text-[11px] text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200 mt-0.5">Copy</span>
          </button>
        </div>

        {/* Selected Verse Indicator */}
        {selectedVerse && (
          <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800">
            <p className="text-primary dark:text-blue-400 font-medium mb-1" style={{ fontSize: `${Math.max(12, commentaryTextSize)}px` }}>
              📖 {bookName} {selectedVerse.chapter}:{selectedVerse.verse}
            </p>
            {/* Show full verse text on mobile */}
            {selectedVerse.text && (
              <p className="text-sm text-gray-700 dark:text-gray-300 lg:hidden leading-relaxed">
                {selectedVerse.text}
              </p>
            )}
          </div>
        )}

        {/* Author Selection */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          {/* Author Button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowAuthorSearch(!showAuthorSearch)
                setShowWorkDropdown(false)
              }}
              className="w-full text-left px-3 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{currentAuthorData?.name || 'Select Author'}</span>
                <span className="text-blue-200 text-sm">🔍</span>
              </div>
            </button>
            
            {/* Author Search Dropdown */}
            {showAuthorSearch && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                <div className="p-2 border-b dark:border-gray-700">
                  <input
                    type="text"
                    placeholder="Search authors..."
                    value={authorSearchQuery}
                    onChange={(e) => setAuthorSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    autoFocus
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredAuthors.map(author => (
                    <button
                      key={author.id}
                      onClick={() => {
                        onAuthorChange(author.id)
                        setShowAuthorSearch(false)
                        setAuthorSearchQuery('')
                      }}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                        author.id === selectedAuthor ? 'bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-blue-400' : 'dark:text-gray-200'
                      }`}
                    >
                      <div className="font-medium text-sm">{author.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {author.works.some(w => w.book === bookName)
                          ? `${author.works.filter(w => w.book === bookName).length} work(s) on ${bookName}`
                          : <span className="text-gray-400 italic">No {bookName} commentary</span>
                        }
                      </div>
                    </button>
                  ))}
                  {filteredAuthors.length === 0 && (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                      No authors found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Work Selection */}
          {currentWorkData && (
            <div className="mt-3 relative">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">From:</p>
                  {/* Work Title - Clickable if has links */}
                  {hasWorkLinks ? (
                    <div className="relative">
                      <button
                        onClick={() => {
                          setShowWorkLinksDropdown(!showWorkLinksDropdown)
                          setShowWorkDropdown(false)
                          setShowAuthorSearch(false)
                        }}
                        className="font-medium text-primary hover:text-blue-700 underline decoration-dotted truncate text-sm text-left flex items-center gap-1"
                        title="Click for source links"
                      >
                        {currentWorkData.title}
                        <span className="text-xs">▼</span>
                      </button>
                      
                      {/* Work Links Dropdown */}
                      {showWorkLinksDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 min-w-[200px]">
                          <div className="p-2 border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Source Links</p>
                          </div>
                          <div className="py-1">
                            {workOriginalUrl && (
                              <a
                                href={workOriginalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm dark:text-gray-200"
                                onClick={() => setShowWorkLinksDropdown(false)}
                              >
                                <span>🎬</span>
                                <span>Go To Original</span>
                                <span className="text-gray-400 dark:text-gray-500 ml-auto">↗</span>
                              </a>
                            )}
                            {workAudioUrl && (
                              <a
                                href={workAudioUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm dark:text-gray-200"
                                onClick={() => setShowWorkLinksDropdown(false)}
                              >
                                <span>🎧</span>
                                <span>Listen to Audio</span>
                                <span className="text-gray-400 dark:text-gray-500 ml-auto">↗</span>
                              </a>
                            )}
                            {workTranscriptUrl && (
                              <a
                                href={workTranscriptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm dark:text-gray-200"
                                onClick={() => setShowWorkLinksDropdown(false)}
                              >
                                <span>📝</span>
                                <span>View Transcript</span>
                                <span className="text-gray-400 dark:text-gray-500 ml-auto">↗</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="font-medium text-gray-800 dark:text-gray-200 truncate text-sm" title={currentWorkData.title}>
                      {currentWorkData.title}
                    </p>
                  )}
                  {currentWorkData.type && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <span>📚</span> {currentWorkData.type}
                      {currentWorkData.year && ` (${currentWorkData.year})`}
                    </p>
                  )}
                </div>
                
                {/* Multiple Works Indicator */}
                {worksWithCommentary.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowWorkDropdown(!showWorkDropdown)
                        setShowAuthorSearch(false)
                      }}
                      className="px-2 py-1 bg-secondary text-gray-900 rounded-full text-sm font-bold hover:bg-amber-400 transition-colors min-w-[28px]"
                      title={`${worksWithCommentary.length} works available`}
                    >
                      {worksWithCommentary.length}
                    </button>
                    
                    {/* Works Dropdown */}
                    {showWorkDropdown && (
                      <div className="absolute top-full right-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                        <div className="p-2 border-b bg-gray-50 dark:bg-gray-700 dark:border-gray-600">
                          <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Other works on chapter {chapter}:</p>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {worksWithCommentary.map(work => (
                            <button
                              key={work.id}
                              onClick={() => {
                                onWorkChange(work.id)
                                setShowWorkDropdown(false)
                              }}
                              className={`w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                                work.id === selectedWork ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-primary' : 'dark:text-gray-200'
                              }`}
                            >
                              <p className="font-medium text-sm truncate">{work.title}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{work.type}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Commentary Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-3" ref={contentRef}>
          {/* Introduction Section - Only for Revelation with introduction data */}
          {hasIntroduction && (
            <div className="mb-4">
              <button
                onClick={() => setIntroductionExpanded(!introductionExpanded)}
                className={`w-full border-l-4 transition-all duration-200 rounded-r-lg ${
                  introductionExpanded 
                    ? 'border-accent bg-teal-50 dark:bg-teal-900/30' 
                    : 'border-accent bg-teal-50/50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40'
                }`}
              >
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📖</span>
                    <span className="font-semibold text-accent">Introduction</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                      {introductionSections.length} section{introductionSections.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-gray-400 text-xs transform transition-transform duration-200" style={{ transform: introductionExpanded ? 'rotate(90deg)' : '' }}>
                    ▶
                  </span>
                </div>
              </button>
              
              {/* Expanded Introduction Sections */}
              {introductionExpanded && (
                <div className="ml-2 mt-2 space-y-2 border-l-2 border-teal-200 dark:border-teal-700 pl-3">
                  {introductionSections.map((section) => {
                    const isExpanded = expandedIntroSections[section.id]
                    return (
                      <div
                        key={section.id}
                        className={`rounded-lg transition-all duration-200 ${
                          isExpanded ? 'bg-white dark:bg-gray-700 shadow-sm border border-teal-200 dark:border-teal-700' : 'bg-teal-50/50 dark:bg-teal-900/20 hover:bg-teal-50 dark:hover:bg-teal-900/30'
                        }`}
                      >
                        <button
                          onClick={() => toggleIntroSection(section.id)}
                          className="w-full text-left p-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-800 dark:text-gray-200" style={{ fontSize: `${Math.max(12, commentaryTextSize)}px` }}>
                              {section.title?.replace(/^#\s*\**/, '').replace(/\*+$/, '') || 'Introduction'}
                            </span>
                            <div className="flex items-center gap-2">
                              {section.timestamp && (
                                <span className="text-xs text-gray-400">{section.timestamp}</span>
                              )}
                              <span className="text-gray-400 text-xs transform transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : '' }}>
                                ▶
                              </span>
                            </div>
                          </div>
                          {!isExpanded && (
                            <p className="text-gray-600 dark:text-gray-400 mt-1 line-clamp-2" style={{ fontSize: `${Math.max(11, commentaryTextSize - 1)}px` }}>
                              {section.text.substring(0, 100)}...
                            </p>
                          )}
                        </button>
                        
                        {isExpanded && (
                          <div className="px-2 pb-2">
                            <div className="border-t border-teal-100 dark:border-teal-700 pt-2" style={{ fontSize: `${commentaryTextSize}px` }}>
                              {section.text.split('\n\n').map((paragraph, pIndex) => (
                                <p key={pIndex} className="text-gray-700 dark:text-gray-100 leading-relaxed mb-2 last:mb-0">
                                  {paragraph}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <p className="text-4xl mb-3 animate-pulse">📖</p>
              <p className="text-sm">Loading commentary for <strong>{bookName}</strong>...</p>
            </div>
          ) : chapterCommentaries.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              <p className="text-4xl mb-3">📖</p>
              <p className="text-sm">No commentary available for <strong>{bookName} {chapter}</strong>{currentAuthorData ? <> from <strong>{currentAuthorData.name}</strong></> : null}.</p>
              {authors.some(a => a.works.some(w => w.book === bookName && w.id !== selectedWork)) && (
                <button 
                  onClick={() => setShowAuthorSearch(true)}
                  className="mt-3 text-accent hover:text-teal-700 text-sm font-medium"
                >
                  Try another author →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {chapterCommentaries.map((commentary) => {
                const verseKey = getVerseKey(commentary.verses, commentary.reference)
                const isExpanded = expandedVerses[verseKey]
                const commentaryIsBookmarked = isCommentaryBookmarked?.(commentary.id)
                
                return (
                  <div
                    key={commentary.id}
                    ref={(el) => { commentaryRefs.current[verseKey] = el }}
                    className={`border-l-4 transition-all duration-200 rounded-r-lg ${
                      isExpanded 
                        ? 'border-primary bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-secondary bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start">
                      <button
                        onClick={() => toggleExpand(verseKey)}
                        className="flex-1 text-left p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-primary dark:text-blue-400" style={{ fontSize: `${Math.max(12, commentaryTextSize)}px` }}>
                            {commentary.reference?.replace(`${bookName} `, '') || verseKey}
                          </span>
                          <span className="text-gray-400 text-xs transform transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : '' }}>
                            ▶
                          </span>
                        </div>
                        {!isExpanded && (
                          <p className="text-gray-600 dark:text-gray-200 mt-1 line-clamp-2" style={{ fontSize: `${Math.max(11, commentaryTextSize - 1)}px` }}>
                            {selectedAuthor === 'john-calvin'
                              ? calvinPreview(commentary.text)
                              : <>{commentary.text.substring(0, 120)}...</>}
                          </p>
                        )}
                      </button>
                      
                      {/* Commentary Bookmark Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onBookmarkCommentary?.(commentary)
                        }}
                        className={`p-2 mr-1 mt-1 rounded transition-colors ${
                          commentaryIsBookmarked 
                            ? 'text-secondary' 
                            : 'text-gray-400 hover:text-secondary'
                        }`}
                        title={commentaryIsBookmarked ? 'Remove bookmark' : 'Bookmark commentary'}
                      >
                        {commentaryIsBookmarked ? '★' : '☆'}
                      </button>
                    </div>
                    
                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="px-3 pb-3">
                        <div className="border-t border-blue-200 dark:border-blue-800 pt-3" style={{ fontSize: `${commentaryTextSize}px` }}>
                          {commentary.text.split('\n\n').map((paragraph, pIndex) => {
                            if (selectedAuthor === 'john-calvin') {
                              return renderCalvinParagraph(paragraph, pIndex)
                            }
                            return (
                              <p key={pIndex} className="text-gray-700 dark:text-gray-100 leading-relaxed mb-2 last:mb-0">
                                {paragraph}
                              </p>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {chapterCommentaries.length} section{chapterCommentaries.length !== 1 ? 's' : ''} • Click to expand
          </p>
        </div>
      </aside>

      {/* Compare Modal */}
      {showCompareModal && selectedVerse && (() => {
        const chData = bibleData?.books?.find(b => b.name === bookName)?.chapters?.find(c => c.number === selectedVerse.chapter)
        const vText = chData?.verses?.find(v => v.number === selectedVerse.verse)?.text || selectedVerse.text || ''
        return (
          <CompareModal
            bookName={bookName}
            chapter={selectedVerse.chapter}
            verse={selectedVerse.verse}
            verseText={vText}
            translationId={translationId}
            onClose={() => setShowCompareModal(false)}
          />
        )
      })()}

      {/* Notes Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNotesModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <button 
              onClick={() => setShowNotesModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-3">
              {selectedVerse ? `Notes for ${bookName} ${selectedVerse.chapter}:${selectedVerse.verse}` : 'Notes'}
            </h3>
            {!selectedVerse ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">Please select a verse to add notes.</p>
            ) : (
              <>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Write your notes here..."
                  className="w-full h-32 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-3">
                  Notes are automatically saved to your bookmarks
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowNotesModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (selectedVerse && onSaveNote) {
                        onSaveNote(
                          bookName,
                          selectedVerse.chapter,
                          selectedVerse.verse,
                          noteText,
                          selectedVerse.text || ''
                        )
                        if (noteText.trim()) {
                          onShowToast?.('Note saved!')
                        } else {
                          onShowToast?.('Note deleted')
                        }
                      }
                      setShowNotesModal(false)
                    }}
                    className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {noteText.trim() ? 'Save Note' : 'Delete Note'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default CommentarySidebar
