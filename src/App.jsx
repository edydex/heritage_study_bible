import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { HashRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom'
import Header from './components/Header'
import BibleChapter from './components/BibleChapter'
import CommentarySidebar from './components/CommentarySidebar'
import BookmarkManager from './components/BookmarkManager'
import SearchResults from './components/SearchResults'
import BottomNav from './components/BottomNav'
import TranscriptViewer from './components/TranscriptViewer'
import ResourcesModal from './components/ResourcesModal'
import ResourcePage from './components/ResourcePage'
import { useBookmarks } from './hooks/useBookmarks'
import fallbackBibleData from './data/bible-web.json'
import { bibleBooks } from './data/bible-books.js'
import { translations, DEFAULT_TRANSLATION, loadTranslation, seedTranslationCache } from './data/translations'
import { authors as initialAuthors, loadCommentaryForBook, getAuthorsForBook, getCommentaryForVerse as getCommentaryFromAuthor, hasAnyCommentary } from './data/authors'
import { parseBibleReference } from './utils/parseBibleReference'

// Seed the WEB translation into the cache since it's bundled
seedTranslationCache('WEB', fallbackBibleData)

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
  const [showResources, setShowResources] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [toast, setToast] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // Start closed
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const [versePositions, setVersePositions] = useState({})
  const [selectedVerse, setSelectedVerse] = useState(null) // Track selected verse
  const bibleContainerRef = useRef(null)
  
  // Translation state
  const [translationId, setTranslationId] = useState(() => {
    try { return localStorage.getItem('heritage-translation') || DEFAULT_TRANSLATION } catch { return DEFAULT_TRANSLATION }
  })
  const [bibleData, setBibleData] = useState(fallbackBibleData) // Start with bundled WEB
  const [translationLoading, setTranslationLoading] = useState(false)

  // Load translation data when translationId changes
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setTranslationLoading(true)
      try {
        const data = await loadTranslation(translationId)
        if (!cancelled) {
          setBibleData(data)
        }
      } catch (err) {
        console.error('Failed to load translation:', err)
        // Fall back to WEB
        if (!cancelled) {
          setBibleData(fallbackBibleData)
        }
      } finally {
        if (!cancelled) setTranslationLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [translationId])

  // Persist translation choice
  useEffect(() => {
    try { localStorage.setItem('heritage-translation', translationId) } catch {}
  }, [translationId])

  // Author/Work state
  const [authorsData, setAuthorsData] = useState(initialAuthors)
  const [selectedAuthor, setSelectedAuthor] = useState(null)
  const [selectedWork, setSelectedWork] = useState(null)
  const [commentaryLoading, setCommentaryLoading] = useState(false)
  
  // Text size settings (persisted in localStorage, in px)
  const [textSize, setTextSize] = useState(() => {
    try { const v = parseInt(localStorage.getItem('heritage-text-size')); return v >= 12 && v <= 64 ? v : 18 } catch { return 18 }
  })
  const [commentaryTextSize, setCommentaryTextSize] = useState(() => {
    try { const v = parseInt(localStorage.getItem('heritage-commentary-text-size')); return v >= 12 && v <= 64 ? v : 14 } catch { return 14 }
  })

  // Dark mode state (persisted)
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('heritage-dark-mode') === 'true' } catch { return false }
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    try { localStorage.setItem('heritage-dark-mode', String(darkMode)) } catch {}
  }, [darkMode])
  
  useEffect(() => {
    try { localStorage.setItem('heritage-text-size', String(textSize)) } catch {}
  }, [textSize])
  useEffect(() => {
    try { localStorage.setItem('heritage-commentary-text-size', String(commentaryTextSize)) } catch {}
  }, [commentaryTextSize])

  // Sidebar width state (persisted, px)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try { const v = parseInt(localStorage.getItem('heritage-sidebar-width')); return v >= 320 && v <= 1200 ? v : 540 } catch { return 540 }
  })
  useEffect(() => {
    try { localStorage.setItem('heritage-sidebar-width', String(sidebarWidth)) } catch {}
  }, [sidebarWidth])

  // Lazy-load commentary data when book changes
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      // Check if any works for this book need loading
      const needsLoad = authorsData.some(a =>
        a.works.some(w => w.book === currentBook && !w.loaded && w.dataPath)
      )
      if (!needsLoad) {
        // Still auto-select an author for this book
        autoSelectAuthor(currentBook)
        return
      }
      setCommentaryLoading(true)
      const updated = await loadCommentaryForBook(currentBook, authorsData)
      if (!cancelled) {
        setAuthorsData(updated)
        setCommentaryLoading(false)
        autoSelectAuthor(currentBook, updated)
      }
    }
    load()
    return () => { cancelled = true }
  }, [currentBook])

  // Auto-select the best author/work for the current book
  const autoSelectAuthor = (book, data) => {
    const d = data || authorsData
    const bookAuthors = getAuthorsForBook(book, d)
    if (bookAuthors.length > 0) {
      // Prefer the currently selected author if they have content for this book
      const currentHasContent = bookAuthors.find(a => a.id === selectedAuthor)
      if (!currentHasContent) {
        const first = bookAuthors[0]
        setSelectedAuthor(first.id)
        const bookWork = first.works.find(w => w.book === book)
        if (bookWork) setSelectedWork(bookWork.id)
      } else {
        // Make sure selectedWork matches the book
        const bookWork = currentHasContent.works.find(w => w.book === book)
        if (bookWork && bookWork.id !== selectedWork) {
          setSelectedWork(bookWork.id)
        }
      }
    }
  }
  
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

  // Get commentary for a specific verse or chapter (for any book with loaded commentary)
  const getCommentaryForVerse = (chapter, verse) => {
    // Search all loaded authors for commentary on this book/chapter/verse
    for (const author of authorsData) {
      for (const work of author.works) {
        if (work.book !== currentBook || !work.loaded) continue
        const found = work.commentaries.find(c =>
          c.verses && c.verses.some(v => v.chapter === chapter && v.verse === verse)
        ) || work.commentaries.find(c => c.chapter === chapter && !c.verses)
        if (found) return found
      }
    }
    return null
  }

  // Check if verse has commentary from any loaded author
  const hasCommentary = (chapter, verse) => {
    return hasAnyCommentary(currentBook, chapter, verse, authorsData)
  }

  // Get current book data from Bible
  const currentBookData = useMemo(() => {
    return bibleData.books.find(b => b.name === currentBook)
  }, [currentBook, bibleData])

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

    // Try to parse as a Bible reference (e.g. "Ps 23", "Rom 8:28")
    const ref = parseBibleReference(query)
    if (ref) {
      setSearchQuery('')
      setSearchResults(null)
      if (ref.verse) {
        navigateToVerse(ref.book, ref.chapter, ref.verse)
      } else {
        handleNavigate(ref.book, ref.chapter)
      }
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

    // Search commentary across all loaded authors/works
    authorsData.forEach(author => {
      author.works.forEach(work => {
        if (!work.loaded && work.commentaries.length === 0) return
        work.commentaries.forEach(c => {
          if (c.text.toLowerCase().includes(lowerQuery)) {
            results.commentaries.push({
              ...c,
              book: work.book,
              authorName: author.name,
              workTitle: work.title,
              snippet: getSnippet(c.text, lowerQuery)
            })
          }
        })
      })
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
      // Prefer a work for the current book with commentary for current chapter
      const workForBook = author.works.find(w =>
        w.book === currentBook && w.commentaries.some(c => c.chapter === currentChapter)
      ) || author.works.find(w => w.book === currentBook) || author.works[0]
      setSelectedWork(workForBook.id)
    }
  }

  // Handle work change
  const handleWorkChange = (workId) => {
    setSelectedWork(workId)
  }

  return (
    <>
      <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900' : 'bg-background'}`}>
        <Header 
          onSearch={handleSearch}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onBookmarkClick={() => setShowBookmarkManager(true)}
          onResourcesClick={() => setShowResources(true)}
          bookmarkCount={bookmarks.length}
          isSidebarOpen={isLargeScreen && isSidebarOpen}
          sidebarWidth={sidebarWidth}
          textSize={textSize}
          onTextSizeChange={setTextSize}
          commentaryTextSize={commentaryTextSize}
          onCommentaryTextSizeChange={setCommentaryTextSize}
          translationId={translationId}
          onTranslationChange={setTranslationId}
          translationLoading={translationLoading}
          darkMode={darkMode}
          onDarkModeChange={setDarkMode}
        />
        
        <div className="flex">
          {/* Main Content */}
          <main
            className="flex-1 px-0 sm:px-4 py-2 sm:py-6 pb-20 transition-all duration-300"
            style={{ marginRight: isLargeScreen && isSidebarOpen ? `${sidebarWidth}px` : 0 }}
          >
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
                  <h2 className="text-center text-xl font-bold text-primary dark:text-blue-400 mb-4 heading-text">
                    {currentBook} {currentChapter}
                  </h2>

                  {/* Translation loading overlay */}
                  {translationLoading && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400 animate-pulse">
                      Loading translation...
                    </div>
                  )}

                  {/* Bible Chapter Display */}
                  {!translationLoading && currentChapterData && (
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

                  {/* Toggle Sidebar Button (desktop only — phones use verse tap) */}
                  {!isSidebarOpen && (
                    <button 
                      onClick={() => setIsSidebarOpen(true)}
                      className="hidden lg:block fixed bottom-20 right-4 sm:right-6 p-3 bg-secondary text-white rounded-full shadow-lg hover:bg-amber-600 transition-all duration-300 z-40"
                      title="Show Commentary"
                    >
                      📖
                    </button>
                  )}

                  {/* Back to Top (desktop only) */}
                  <button 
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className={`hidden lg:block fixed bottom-20 p-3 bg-primary text-white rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 ${
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
              loading={commentaryLoading}
              versePositions={versePositions}
              selectedVerse={selectedVerse}
              translationId={translationId}
              bibleData={bibleData}
              commentaryTextSize={commentaryTextSize}
              sidebarWidth={sidebarWidth}
              onSidebarWidthChange={setSidebarWidth}
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
            onNavigateToCommentary={(chapter, commentaryId, book) => {
              if (book) setCurrentBook(book)
              setCurrentChapter(chapter)
              setShowBookmarkManager(false)
              setIsSidebarOpen(true)
            }}
          />
        )}

        {/* Resources Modal */}
        {showResources && (
          <ResourcesModal
            onClose={() => setShowResources(false)}
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
            sidebarWidth={sidebarWidth}
          />
        )}

        {/* Toast Notification */}
        {toast && (
          <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
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
        <Route path="/resources/:categoryId" element={<ResourcePage />} />
        <Route path="/:bookSlug/:chapterNum" element={<BibleStudyApp />} />
        <Route path="/:bookSlug" element={<BibleStudyApp />} />
        <Route path="/" element={<Navigate to="/genesis/1" replace />} />
        <Route path="*" element={<Navigate to="/genesis/1" replace />} />
      </Routes>
    </Router>
  )
}

export default App
