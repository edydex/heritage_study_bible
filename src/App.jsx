import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Header from './components/Header'
import BibleChapter from './components/BibleChapter'
import CommentarySidebar from './components/CommentarySidebar'
import BookmarkManager from './components/BookmarkManager'
import SearchResults from './components/SearchResults'
import MobileBottomNav from './components/MobileBottomNav'
import { useBookmarks } from './hooks/useBookmarks'
import bibleData from './data/bible-web.json'
import { bibleBooks } from './data/bible-books.js'
import commentaryData from './data/ortlund-commentary.json'
import { authors as initialAuthors, loadOrtlundCommentaries, getCommentaryForVerse as getCommentaryFromAuthor, hasAnyCommentary } from './data/authors'

function App() {
  const [currentBook, setCurrentBook] = useState('Genesis')
  const [currentChapter, setCurrentChapter] = useState(1)
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
  
  const { 
    bookmarks, addBookmark, removeBookmark, updateBookmark, isBookmarked,
    commentaryBookmarks, isCommentaryBookmarked, toggleCommentaryBookmark
  } = useBookmarks()

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

  // Get commentary for a specific verse (legacy for mobile modal)
  const getCommentaryForVerse = (chapter, verse) => {
    // Commentary only available for Revelation
    if (currentBook !== 'Revelation') return null
    return commentaryData.commentaries.find(c => 
      c.verses && c.verses.some(v => v.chapter === chapter && v.verse === verse)
    )
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
    <Router>
      <div className="min-h-screen bg-background">
        <Header 
          onSearch={handleSearch}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onBookmarkClick={() => setShowBookmarkManager(true)}
          bookmarkCount={bookmarks.length}
        />
        
        <div className="flex">
          {/* Main Content */}
          <main className={`flex-1 px-3 sm:px-4 py-4 sm:py-6 pb-20 lg:pb-6 transition-all duration-300 ${
            isLargeScreen && isSidebarOpen ? 'mr-96' : ''
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
                  {/* Chapter Navigation - Desktop only */}
                  <div className="hidden lg:flex items-center justify-between mb-6">
                    <button 
                      onClick={goToPrevious}
                      disabled={!hasPrevious}
                      className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                    >
                      ← Previous
                    </button>
                    
                    <div className="flex items-center gap-2">
                      <select 
                        value={currentBook}
                        onChange={(e) => {
                          setCurrentBook(e.target.value)
                          setCurrentChapter(1)
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <optgroup label="Old Testament">
                          {bibleBooks.filter(b => b.testament === 'OT').map(b => (
                            <option key={b.name} value={b.name}>
                              {b.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="New Testament">
                          {bibleBooks.filter(b => b.testament === 'NT').map(b => (
                            <option key={b.name} value={b.name}>
                              {b.name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      <select 
                        value={currentChapter}
                        onChange={(e) => setCurrentChapter(Number(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        {currentBookData?.chapters.map(c => (
                          <option key={c.number} value={c.number}>
                            {c.number}
                          </option>
                        ))}
                      </select>
                      <span className="text-gray-600">of {currentBookMeta?.chapters || 0}</span>
                    </div>
                    
                    <button 
                      onClick={goToNext}
                      disabled={!hasNext}
                      className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
                    >
                      Next →
                    </button>
                  </div>

                  {/* Mobile Chapter Title */}
                  <h2 className="lg:hidden text-center text-xl font-bold text-primary mb-4 heading-text">
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
                    />
                  )}

                  {/* Toggle Sidebar Button */}
                  {!isSidebarOpen && (
                    <button 
                      onClick={() => setIsSidebarOpen(true)}
                      className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 p-3 bg-secondary text-white rounded-full shadow-lg hover:bg-amber-600 transition-all duration-300 z-40"
                      title="Show Commentary"
                    >
                      📖
                    </button>
                  )}

                  {/* Back to Top */}
                  <button 
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className={`fixed bottom-20 lg:bottom-6 p-3 bg-primary text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 ${
                      isLargeScreen && isSidebarOpen ? 'right-[26rem]' : isSidebarOpen ? 'right-4 sm:right-6' : 'left-4 sm:left-6'
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
            onNavigateToCommentary={(chapter, commentaryId) => {
              setCurrentBook('Revelation')
              setCurrentChapter(chapter)
              setShowBookmarkManager(false)
              setIsSidebarOpen(true)
            }}
          />
        )}

        {/* Mobile Bottom Navigation */}
        {!searchResults && !showBookmarkManager && (
          <MobileBottomNav
            currentBook={currentBook}
            currentChapter={currentChapter}
            books={bibleBooks}
            onNavigate={handleNavigate}
            onPrevious={goToPrevious}
            onNext={goToNext}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
          />
        )}

        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-20 lg:bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
            {toast}
          </div>
        )}
      </div>
    </Router>
  )
}

export default App
