import { useState, useEffect, useRef } from 'react'

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
  selectedVerse,
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

  // Get works for current author on current chapter
  const currentAuthorData = authors.find(a => a.id === selectedAuthor)
  const authorWorks = currentAuthorData?.works || []
  const currentWorkData = authorWorks.find(w => w.id === selectedWork)
  
  // Only show commentary for Revelation (all current commentary is for Revelation)
  const isRevelation = bookName === 'Revelation'
  
  const worksWithCommentary = isRevelation ? authorWorks.filter(w => 
    w.commentaries.some(c => c.chapter === chapter)
  ) : []

  // Get commentaries for current chapter from current work (only for Revelation)
  const chapterCommentaries = (isRevelation && currentWorkData?.commentaries.filter(c => 
    c.chapter === chapter && c.verses
  )) || []

  // Get introduction sections (only for Revelation)
  const introductionSections = (isRevelation && currentWorkData?.introduction) || []
  const hasIntroduction = introductionSections.length > 0

  // Get work URLs
  const workOriginalUrl = currentWorkData?.originalUrl
  const workAudioUrl = currentWorkData?.audioUrl
  const hasWorkLinks = workOriginalUrl || workAudioUrl

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

  // Filter authors based on search
  const filteredAuthors = authors.filter(a => 
    a.name.toLowerCase().includes(authorSearchQuery.toLowerCase())
  )

  // Auto-expand commentary for selected verse
  useEffect(() => {
    if (selectedVerse) {
      const commentary = chapterCommentaries.find(c => 
        c.verses?.some(v => v.chapter === selectedVerse.chapter && v.verse === selectedVerse.verse)
      )
      if (commentary) {
        const verseKey = getVerseKey(commentary.verses)
        setExpandedVerses(prev => ({ ...prev, [verseKey]: true }))
      }
    }
  }, [selectedVerse, chapterCommentaries])

  const toggleExpand = (verseKey) => {
    setExpandedVerses(prev => ({
      ...prev,
      [verseKey]: !prev[verseKey]
    }))
  }

  const toggleIntroSection = (sectionId) => {
    setExpandedIntroSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  const getVerseKey = (verses) => {
    if (!verses || verses.length === 0) return null
    const first = verses[0]
    const last = verses[verses.length - 1]
    if (first.verse === last.verse) {
      return `${first.chapter}:${first.verse}`
    }
    return `${first.chapter}:${first.verse}-${last.verse}`
  }

  // Toolbar actions
  const handleCompare = () => {
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
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/30 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Sidebar - full screen on mobile, fixed width on desktop */}
      <aside 
        className="fixed top-0 right-0 bottom-0 w-full lg:w-96 flex flex-col bg-white border-l border-gray-200 shadow-lg z-50 lg:z-30 transform transition-transform duration-300 ease-out animate-slide-in-right"
        ref={sidebarRef}
      >
        {/* Top Bar with Close */}
        <div className="flex items-center justify-between px-4 py-3 bg-primary text-white">
          <h2 className="font-semibold text-lg">Commentary</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Toolbar Strip */}
        <div className="flex items-center justify-around px-1 py-1.5 bg-gray-100 border-b border-gray-200">
          <button
            onClick={handleCompare}
            className="flex flex-col items-center p-1.5 hover:bg-gray-200 rounded-lg transition-colors group min-w-[60px]"
            title="Compare translations"
          >
            <span className="text-lg">🔄</span>
            <span className="text-[10px] text-gray-600 group-hover:text-gray-800">Compare</span>
          </button>
          <button
            onClick={handleBookmarkVerse}
            className={`flex flex-col items-center p-1.5 hover:bg-gray-200 rounded-lg transition-colors group min-w-[60px] ${
              verseIsBookmarked ? 'text-secondary' : ''
            }`}
            title={verseIsBookmarked ? 'Remove bookmark' : 'Bookmark verse'}
          >
            <span className="text-lg">{verseIsBookmarked ? '★' : '☆'}</span>
            <span className="text-[10px] text-gray-600 group-hover:text-gray-800">Bookmark</span>
          </button>
          <button
            onClick={handleNotes}
            className="flex flex-col items-center p-1.5 hover:bg-gray-200 rounded-lg transition-colors group min-w-[60px]"
            title="Add notes"
          >
            <span className="text-lg">📝</span>
            <span className="text-[10px] text-gray-600 group-hover:text-gray-800">Notes</span>
          </button>
          <button
            onClick={handleCopy}
            className="flex flex-col items-center p-1.5 hover:bg-gray-200 rounded-lg transition-colors group min-w-[60px]"
            title="Copy verse"
          >
            <span className="text-lg">📋</span>
            <span className="text-[10px] text-gray-600 group-hover:text-gray-800">Copy</span>
          </button>
        </div>

        {/* Selected Verse Indicator */}
        {selectedVerse && (
          <div className="px-3 py-2 bg-blue-50 border-b border-blue-100">
            <p className="text-xs text-primary font-medium mb-1">
              📖 {bookName} {selectedVerse.chapter}:{selectedVerse.verse}
            </p>
            {/* Show full verse text on mobile */}
            {selectedVerse.text && (
              <p className="text-sm text-gray-700 lg:hidden leading-relaxed">
                {selectedVerse.text}
              </p>
            )}
          </div>
        )}

        {/* Author Selection */}
        <div className="p-3 border-b border-gray-200 bg-gray-50">
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
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                <div className="p-2 border-b">
                  <input
                    type="text"
                    placeholder="Search authors..."
                    value={authorSearchQuery}
                    onChange={(e) => setAuthorSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary text-sm"
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
                      className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${
                        author.id === selectedAuthor ? 'bg-blue-50 text-primary' : ''
                      }`}
                    >
                      <div className="font-medium text-sm">{author.name}</div>
                      <div className="text-xs text-gray-500">{author.works.length} work(s)</div>
                    </button>
                  ))}
                  {filteredAuthors.length === 0 && (
                    <div className="p-4 text-center text-gray-500 text-sm">
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
                  <p className="text-xs text-gray-500 uppercase tracking-wide">From:</p>
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
                        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[200px]">
                          <div className="p-2 border-b bg-gray-50">
                            <p className="text-xs text-gray-600 font-medium">Source Links</p>
                          </div>
                          <div className="py-1">
                            {workOriginalUrl && (
                              <a
                                href={workOriginalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 transition-colors text-sm"
                                onClick={() => setShowWorkLinksDropdown(false)}
                              >
                                <span>🎬</span>
                                <span>Go To Original</span>
                                <span className="text-gray-400 ml-auto">↗</span>
                              </a>
                            )}
                            {workAudioUrl && (
                              <a
                                href={workAudioUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 transition-colors text-sm"
                                onClick={() => setShowWorkLinksDropdown(false)}
                              >
                                <span>🎧</span>
                                <span>Listen to Audio</span>
                                <span className="text-gray-400 ml-auto">↗</span>
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="font-medium text-gray-800 truncate text-sm" title={currentWorkData.title}>
                      {currentWorkData.title}
                    </p>
                  )}
                  {currentWorkData.type && (
                    <p className="text-xs text-gray-500 flex items-center gap-1">
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
                      <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                        <div className="p-2 border-b bg-gray-50">
                          <p className="text-xs text-gray-600 font-medium">Other works on chapter {chapter}:</p>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {worksWithCommentary.map(work => (
                            <button
                              key={work.id}
                              onClick={() => {
                                onWorkChange(work.id)
                                setShowWorkDropdown(false)
                              }}
                              className={`w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors ${
                                work.id === selectedWork ? 'bg-blue-50 border-l-2 border-primary' : ''
                              }`}
                            >
                              <p className="font-medium text-sm truncate">{work.title}</p>
                              <p className="text-xs text-gray-500">{work.type}</p>
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
        <div className="flex-1 overflow-y-auto p-3">
          {/* Introduction Section - Only for Revelation with introduction data */}
          {hasIntroduction && (
            <div className="mb-4">
              <button
                onClick={() => setIntroductionExpanded(!introductionExpanded)}
                className={`w-full border-l-4 transition-all duration-200 rounded-r-lg ${
                  introductionExpanded 
                    ? 'border-accent bg-teal-50' 
                    : 'border-accent bg-teal-50/50 hover:bg-teal-100'
                }`}
              >
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📖</span>
                    <span className="font-semibold text-accent">Introduction</span>
                    <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
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
                <div className="ml-2 mt-2 space-y-2 border-l-2 border-teal-200 pl-3">
                  {introductionSections.map((section) => {
                    const isExpanded = expandedIntroSections[section.id]
                    return (
                      <div
                        key={section.id}
                        className={`rounded-lg transition-all duration-200 ${
                          isExpanded ? 'bg-white shadow-sm border border-teal-200' : 'bg-teal-50/50 hover:bg-teal-50'
                        }`}
                      >
                        <button
                          onClick={() => toggleIntroSection(section.id)}
                          className="w-full text-left p-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm text-gray-800">
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
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                              {section.text.substring(0, 100)}...
                            </p>
                          )}
                        </button>
                        
                        {isExpanded && (
                          <div className="px-2 pb-2">
                            <div className="border-t border-teal-100 pt-2">
                              {section.text.split('\n\n').map((paragraph, pIndex) => (
                                <p key={pIndex} className="text-gray-700 text-sm leading-relaxed mb-2 last:mb-0">
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

          {chapterCommentaries.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p className="text-4xl mb-3">📖</p>
              <p className="text-sm">No commentary available for <strong>{bookName} {chapter}</strong> from <strong>{currentAuthorData?.name}</strong>.</p>
              <p className="text-xs text-gray-400 mt-2">Commentary is currently only available for Revelation.</p>
              <button 
                onClick={() => setShowAuthorSearch(true)}
                className="mt-3 text-accent hover:text-teal-700 text-sm font-medium"
              >
                Try another author →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {chapterCommentaries.map((commentary) => {
                const verseKey = getVerseKey(commentary.verses)
                const isExpanded = expandedVerses[verseKey]
                const commentaryIsBookmarked = isCommentaryBookmarked?.(commentary.id)
                
                return (
                  <div
                    key={commentary.id}
                    className={`border-l-4 transition-all duration-200 rounded-r-lg ${
                      isExpanded 
                        ? 'border-primary bg-blue-50' 
                        : 'border-secondary bg-amber-50 hover:bg-amber-100'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-start">
                      <button
                        onClick={() => toggleExpand(verseKey)}
                        className="flex-1 text-left p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-primary text-sm">
                            {commentary.reference?.replace(`${bookName} `, '') || verseKey}
                          </span>
                          <span className="text-gray-400 text-xs transform transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : '' }}>
                            ▶
                          </span>
                        </div>
                        {!isExpanded && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {commentary.text.substring(0, 120)}...
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
                        <div className="border-t border-blue-200 pt-3">
                          {commentary.text.split('\n\n').map((paragraph, pIndex) => (
                            <p key={pIndex} className="text-gray-700 text-sm leading-relaxed mb-2 last:mb-0">
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

        {/* Footer */}
        <div className="p-2 border-t bg-gray-50 text-center">
          <p className="text-xs text-gray-500">
            {chapterCommentaries.length} section{chapterCommentaries.length !== 1 ? 's' : ''} • Click to expand
          </p>
        </div>
      </aside>

      {/* Compare Modal */}
      {showCompareModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCompareModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <button 
              onClick={() => setShowCompareModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
            <div className="text-center">
              <span className="text-5xl mb-4 block">🔧</span>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Coming Soon!</h3>
              <p className="text-gray-600">
                Translation comparison feature is currently in development. 
                Soon you'll be able to compare verses across multiple Bible translations!
              </p>
              <button
                onClick={() => setShowCompareModal(false)}
                className="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowNotesModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <button 
              onClick={() => setShowNotesModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-gray-800 mb-3">
              {selectedVerse ? `Notes for ${bookName} ${selectedVerse.chapter}:${selectedVerse.verse}` : 'Notes'}
            </h3>
            {!selectedVerse ? (
              <p className="text-gray-500 text-sm">Please select a verse to add notes.</p>
            ) : (
              <>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Write your notes here..."
                  className="w-full h-32 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 mb-3">
                  Notes are automatically saved to your bookmarks
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowNotesModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
