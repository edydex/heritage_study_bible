import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { HashRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import Header from './components/Header'
import BibleChapter from './components/BibleChapter'
import CommentarySidebar from './components/CommentarySidebar'
import BookmarkManager from './components/BookmarkManager'
import SearchResults from './components/SearchResults'
import BottomNav from './components/BottomNav'
import TranscriptViewer from './components/TranscriptViewer'
import { useBookmarks } from './hooks/useBookmarks'
import bibleData from './data/bible-web.json'
import { bibleBooks } from './data/bible-books.js'
import commentaryData from './data/ortlund-commentary.json'
import { authors as initialAuthors, loadOrtlundCommentaries, getCommentaryForVerse as getCommentaryFromAuthor, hasAnyCommentary } from './data/authors'

// Helper to convert book name to URL slug
function bookToSlug(bookName) {
  return bookName.toLowerCase().replace(/\s+/g, '-')
}

// Helper to convert URL slug back to book name
function slugToBook(slug) {
  if (!slug) return null
  const normalized = slug.toLowerCase().replace(/-/g, ' ')
  const book = bibleBooks.find(b => b.name.toLowerCase() === normalized)
  return book?.name || null
}

function BibleStudyApp() {
  const { bookSlug, chapterNum } = useParams()
  const navigate = useNavigate()
  
  // Parse URL params into book and chapter
  const urlBook = slugToBook(bookSlug)
  const urlChapter = chapterNum ? parseInt(chapterNum, 10) : null

  const [currentBook, setCurrentBook] = useState(urlBook || 'Genesis')
  const [currentChapter, setCurrentChapter] = useState(urlChapter || 1)
  const [showBookmarkManager, setShowBookmarkManager] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [toast, setToast] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // Start closed
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const [versePositions, setVersePositions] = useState({})
  const [selectedVerse, setSelectedVerse] = useState(null) // Track selected verse
  const bibleContainerRef = useRef(null)
  
  // Author/Work state
  const [authorsData, setAuthorsData] = useState(() => loadOrtlundCommentaries(commentaryData))
  const [selectedAuthor, setSelectedAuthor] = useState('gavin-ortlund')
  const [selectedWork, setSelectedWork] = useState('ortlund-every-chapter')
  
  // Text size setting (persisted in localStorage)
  const [textSize, setTextSize] = useState(() => {
    try { return localStorage.getItem('heritage-text-size') || 'medium' } catch { return 'medium' }
  })
  
  useEffect(() => {
    try { localStorage.setItem('heritage-text-size', textSize) } catch {}
  }, [textSize])
  
  const { 
    bookmarks, addBookmark, removeBookmark, updateBookmark, isBookmarked,
    commentaryBookmarks, isCommentaryBookmarked, toggleCommentaryBookmark,
    notes, saveNote, deleteNote, hasNote
  } = useBookmarks()

  // Sync URL to state when URL changes
  useEffect(() => {
    if (urlBook && urlBook !== currentBook) {
      setCurrentBook(urlBook)
    }
    if (urlChapter && urlChapter !== currentChapter) {
      setCurrentChapter(urlChapter)
    }
  }, [urlBook, urlChapter])

  // Update URL when book/chapter changes (but avoid loops)
  useEffect(() => {
    const expectedSlug = bookToSlug(currentBook)
    const currentPath = `/${expectedSlug}/${currentChapter}`
    
    // Only navigate if URL doesn't match current state
    if (bookSlug !== expectedSlug || parseInt(chapterNum) !== currentChapter) {
      navigate(currentPath, { replace: true })
    }
  }, [currentBook, currentChapter, navigate])

  // Check screen size for responsive behavior
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 1024) // lg breakpoint
    }
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Track verse positions for sidebar alignment
  const updateVersePosition = useCallback((verseKey, position) => {
    setVersePositions(prev => ({
      ...prev,
      [verseKey]: position
    }))
  }, [])

  // Get commentary for a specific verse or chapter (legacy for mobile modal)
  const getCommentaryForVerse = (chapter, verse) => {
    // Commentary only available for Revelation
    if (currentBook !== 'Revelation') return null
    // First try verse-specific, then fall back to chapter-level
    return commentaryData.commentaries.find(c => 
      c.verses && c.verses.some(v => v.chapter === chapter && v.verse === verse)
    ) || commentaryData.commentaries.find(c => c.chapter === chapter && !c.verses)
  }

  // Check if verse has commentary (from any author) - only Revelation has commentary
  const hasCommentary = (chapter, verse) => {
    if (currentBook !== 'Revelation') return false
    return hasAnyCommentary(chapter, verse, authorsData)
  }

  // Get current book data from Bible
  const currentBookData = useMemo(() => {
    return bibleData.books.find(b => b.name === currentBook)
  }, [currentBook])

  // Get current chapter data
  const currentChapterData = useMemo(() => {
    if (!currentBookData) return null
    return currentBookData.chapters.find(c => c.number === currentChapter)
  }, [currentBookData, currentChapter])

  // Get book metadata (chapters count, etc.)
  const currentBookMeta = useMemo(() => {
    return bibleBooks.find(b => b.name === currentBook)
  }, [currentBook])

  // Calculate previous/next navigation
  const { hasPrevious, hasNext, goToPrevious, goToNext } = useMemo(() => {
    const bookIndex = bibleBooks.findIndex(b => b.name === currentBook)
    const chapterCount = currentBookMeta?.chapters || 1
    
    const hasPrev = !(bookIndex === 0 && currentChapter === 1)
    const hasNxt = !(bookIndex === bibleBooks.length - 1 && currentChapter === chapterCount)
    
    const goPrev = () => {
      if (currentChapter > 1) {
        setCurrentChapter(currentChapter - 1)
      } else if (bookIndex > 0) {
        const prevBook = bibleBooks[bookIndex - 1]
        setCurrentBook(prevBook.name)
        setCurrentChapter(prevBook.chapters)
      }
    }
    
    const goNxt = () => {
      if (currentChapter < chapterCount) {
        setCurrentChapter(currentChapter + 1)
      } else if (bookIndex < bibleBooks.length - 1) {
        const nextBook = bibleBooks[bookIndex + 1]
        setCurrentBook(nextBook.name)
        setCurrentChapter(1)
      }
    }
    
    return { hasPrevious: hasPrev, hasNext: hasNxt, goToPrevious: goPrev, goToNext: goNxt }
  }, [currentBook, currentChapter, currentBookMeta])

  // Handle verse click - opens sidebar panel
  const handleVerseClick = (chapter, verse, verseText) => {
    setSelectedVerse({ chapter, verse, text: verseText })
    setIsSidebarOpen(true)
  }

  // Handle bookmark toggle
  const handleBookmarkToggle = (chapter, verse, verseText) => {
    if (isBookmarked(currentBook, chapter, verse)) {
      removeBookmark(currentBook, chapter, verse)
      showToast('Bookmark removed')
    } else {
      addBookmark({
        book: currentBook,
        chapter,
        verse,
        verseText: verseText.substring(0, 100),
        hasCommentary: hasCommentary(chapter, verse),
        userNote: ''
      })
      showToast('Verse bookmarked!')
    }
  }

  // Show toast notification
  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  // Search functionality
  const handleSearch = (query) => {
    if (!query.trim()) {
      setSearchResults(null)
      return
    }

    const results = { verses: [], commentaries: [] }
    const lowerQuery = query.toLowerCase()

    // Search Bible verses across all books
    bibleData.books.forEach(book => {
      book.chapters.forEach(chapter => {
        chapter.verses.forEach(verse => {
          if (verse.text.toLowerCase().includes(lowerQuery)) {
            results.verses.push({
              book: book.name,
              chapter: chapter.number,
              verse: verse.number,
              text: verse.text,
              hasCommentary: book.name === 'Revelation' && hasAnyCommentary(chapter.number, verse.number, authorsData)
            })
          }
        })
      })
    })

    // Search commentary (Revelation only)
    commentaryData.commentaries.forEach(c => {
      if (c.text.toLowerCase().includes(lowerQuery)) {
        results.commentaries.push({
          ...c,
          book: 'Revelation',
          snippet: getSnippet(c.text, lowerQuery)
        })
      }
    })

    setSearchResults(results)
  }

  // Get text snippet around search term
  const getSnippet = (text, query) => {
    const index = text.toLowerCase().indexOf(query)
    const start = Math.max(0, index - 50)
    const end = Math.min(text.length, index + query.length + 50)
    let snippet = text.substring(start, end)
    if (start > 0) snippet = '...' + snippet
    if (end < text.length) snippet = snippet + '...'
    return snippet
  }

  // Navigate to verse from search or bookmark
  const navigateToVerse = (book, chapter, verse) => {
    if (book) setCurrentBook(book)
    setCurrentChapter(chapter)
    setSearchResults(null)
    setShowBookmarkManager(false)
    // Scroll to verse after render
    setTimeout(() => {
      const element = document.getElementById(`verse-${chapter}-${verse}`)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        element.classList.add('bg-yellow-100')
        setTimeout(() => element.classList.remove('bg-yellow-100'), 2000)
      }
    }, 100)
  }

  // Navigate to book and chapter
  const handleNavigate = (bookName, chapter) => {
    setCurrentBook(bookName)
    setCurrentChapter(chapter)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  
  // Get current author's works count for the current chapter
  const getCurrentAuthorCommentaryCount = () => {
    const author = authorsData.find(a => a.id === selectedAuthor)
    if (!author) return 0
    return author.works.filter(w => 
      w.commentaries.some(c => c.chapter === currentChapter)
    ).length
  }

  // Handle author change
  const handleAuthorChange = (authorId) => {
    setSelectedAuthor(authorId)
    const author = authorsData.find(a => a.id === authorId)
    if (author && author.works.length > 0) {
      // Find a work that has commentary for current chapter, or default to first
      const workWithCommentary = author.works.find(w =>
        w.commentaries.some(c => c.chapter === currentChapter)
      )
      setSelectedWork(workWithCommentary?.id || author.works[0].id)
    }
  }

  // Handle work change
  const handleWorkChange = (workId) => {
    setSelectedWork(workId)
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        <Header 
          onSearch={handleSearch}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onBookmarkClick={() => setShowBookmarkManager(true)}
          bookmarkCount={bookmarks.length}
          isSidebarOpen={isLargeScreen && isSidebarOpen}
          textSize={textSize}
          onTextSizeChange={setTextSize}
        />
        
        <div className="flex">
          {/* Main Content */}
          <main className={`flex-1 px-0 sm:px-4 py-2 sm:py-6 pb-20 transition-all duration-300 ${
            isLargeScreen && isSidebarOpen ? 'lg:mr-[420px] xl:mr-[560px] 2xl:mr-[672px]' : ''
          }`}>
            <div className="container mx-auto max-w-3xl" ref={bibleContainerRef}>
              {searchResults ? (
                <SearchResults 
                  results={searchResults}
                  query={searchQuery}
                  onVerseClick={navigateToVerse}
                  onCommentaryClick={(commentary) => {
                    // Navigate to the chapter and open sidebar
                    if (commentary.verses && commentary.verses.length > 0) {
                      const firstVerse = commentary.verses[0]
                      setCurrentChapter(firstVerse.chapter)
                      setSelectedVerse({ 
                        chapter: firstVerse.chapter, 
                        verse: firstVerse.verse,
                        text: ''
                      })
                      setSearchResults(null)
                      setIsSidebarOpen(true)
                    }
                  }}
                  onClose={() => setSearchResults(null)}
                />
              ) : (
                <>
                  {/* Chapter Title */}
                  <h2 className="text-center text-xl font-bold text-primary mb-4 heading-text">
                    {currentBook} {currentChapter}
                  </h2>

                  {/* Bible Chapter Display */}
                  {currentChapterData && (
                    <BibleChapter 
                      chapter={currentChapterData}
                      bookName={currentBook}
                      hasCommentary={hasCommentary}
                      onVerseClick={(ch, v, text) => handleVerseClick(ch, v, text)}
                      isBookmarked={(verse) => isBookmarked(currentBook, currentChapter, verse)}
                      onBookmarkToggle={handleBookmarkToggle}
                      onVersePosition={updateVersePosition}
                      textSize={textSize}
                    />
                  )}

                  {/* Toggle Sidebar Button */}
                  {!isSidebarOpen && (
                    <button 
                      onClick={() => setIsSidebarOpen(true)}
                      className="fixed bottom-20 right-4 sm:right-6 p-3 bg-secondary text-white rounded-full shadow-lg hover:bg-amber-600 transition-all duration-300 z-40"
                      title="Show Commentary"
                    >
                      📖
                    </button>
                  )}

                  {/* Back to Top */}
                  <button 
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className={`fixed bottom-20 p-3 bg-primary text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 ${
                      isLargeScreen && isSidebarOpen ? 'right-[26rem] xl:right-[36rem] 2xl:right-[44rem]' : isSidebarOpen ? 'right-4 sm:right-6' : 'left-4 sm:left-6'
                    }`}
                    title="Back to top"
                  >
                    ↑
                  </button>
                </>
              )}
            </div>
          </main>

          {/* Commentary Sidebar - All Screens */}
          {isSidebarOpen && !searchResults && (
            <CommentarySidebar
              bookName={currentBook}
              authors={authorsData}
              selectedAuthor={selectedAuthor}
              selectedWork={selectedWork}
              onAuthorChange={handleAuthorChange}
              onWorkChange={handleWorkChange}
              chapter={currentChapter}
              versePositions={versePositions}
              selectedVerse={selectedVerse}
              isBookmarked={(ch, v) => isBookmarked(currentBook, ch, v)}
              onBookmarkVerse={(ch, v) => {
                const verseData = currentChapterData?.verses.find(verse => verse.number === v)
                handleBookmarkToggle(ch, v, verseData?.text || '')
              }}
              isCommentaryBookmarked={isCommentaryBookmarked}
              onBookmarkCommentary={(commentary) => {
                const author = authorsData.find(a => a.id === selectedAuthor)
                const work = author?.works.find(w => w.id === selectedWork)
                const added = toggleCommentaryBookmark(commentary, author?.name, work?.title)
                showToast(added ? 'Commentary bookmarked!' : 'Bookmark removed')
              }}
              notes={notes}
              onSaveNote={saveNote}
              onShowToast={showToast}
              onClose={() => {
                setIsSidebarOpen(false)
                setSelectedVerse(null)
              }}
            />
          )}
        </div>

        {/* Bookmark Manager */}
        {showBookmarkManager && (
          <BookmarkManager 
            bookmarks={bookmarks}
            commentaryBookmarks={commentaryBookmarks}
            notes={notes}
            onClose={() => setShowBookmarkManager(false)}
            onNavigate={(book, chapter, verse) => navigateToVerse(book, chapter, verse)}
            onDelete={(id) => {
              const bookmark = bookmarks.find(b => b.id === id)
              if (bookmark) {
                removeBookmark(bookmark.book, bookmark.chapter, bookmark.verse)
                showToast('Bookmark deleted')
              }
            }}
            onUpdateNote={(id, note) => updateBookmark(id, { userNote: note })}
            onDeleteCommentary={(commentaryId) => {
              toggleCommentaryBookmark({ id: commentaryId })
              showToast('Commentary bookmark removed')
            }}
            onDeleteNote={(book, chapter, verse) => {
              deleteNote(book, chapter, verse)
              showToast('Note deleted')
            }}
            onNavigateToCommentary={(chapter, commentaryId) => {
              setCurrentBook('Revelation')
              setCurrentChapter(chapter)
              setShowBookmarkManager(false)
              setIsSidebarOpen(true)
            }}
          />
        )}

        {/* Bottom Navigation */}
        {!searchResults && !showBookmarkManager && (
          <BottomNav
            currentBook={currentBook}
            currentChapter={currentChapter}
            books={bibleBooks}
            onNavigate={handleNavigate}
            onPrevious={goToPrevious}
            onNext={goToNext}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            isSidebarOpen={isLargeScreen && isSidebarOpen}
          />
        )}

        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
            {toast}
          </div>
        )}
      </div>
    </>
  )
}

// Main App with Router
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/transcript/:transcriptId" element={<TranscriptViewer />} />
        <Route path="/:bookSlug/:chapterNum" element={<BibleStudyApp />} />
        <Route path="/:bookSlug" element={<BibleStudyApp />} />
        <Route path="/" element={<Navigate to="/genesis/1" replace />} />
        <Route path="*" element={<Navigate to="/genesis/1" replace />} />
      </Routes>
    </Router>
  )
}

export default App
