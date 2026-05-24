import { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react'
import { HashRouter as Router, Routes, Route, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom'
import Header from './components/Header'
import BibleChapter from './components/BibleChapter'
import ParallelBibleChapter from './components/ParallelBibleChapter'
import CommentarySidebar from './components/CommentarySidebar'
import BookmarkManager from './components/BookmarkManager'
import SearchResults from './components/SearchResults'
import BottomNav from './components/BottomNav'
import TranscriptViewer from './components/TranscriptViewer'
import ResourcesModal from './components/ResourcesModal'
import ResourcePage from './components/ResourcePage'
import ConfessionViewer from './components/ConfessionViewer'
import BookViewer from './components/BookViewer'
import ReadingPlanViewer from './components/ReadingPlanViewer'
import ToolViewer from './components/ToolViewer'
import { useBookmarks } from './hooks/useBookmarks'
import { bibleBooks } from './data/bible-books.js'
import { translations, DEFAULT_TRANSLATION, loadTranslation } from './data/translations'
import { authors as initialAuthors, loadCommentaryForBook, getAuthorsForBook, hasAnyCommentary } from './data/authors'
import { parseBibleReference } from './utils/parseBibleReference'
import { searchBibleVerses, searchBookLibrary, searchCommentaryLibrary } from './utils/librarySearch'
import { addNativeBackListener, addNativeScrollListener, exitNativeApp, isNativeAndroid, setNativeSideButtonScrollEnabled } from './services/androidControls'
import { setStoredValue, STORAGE_KEYS } from './services/persistentStorage'
import { getReaderProgress, saveBibleProgress } from './services/readerProgress'
import { getActiveReadingPlan } from './services/readingPlanProgress'

const COMMENTARY_RETRY_DELAYS_MS = [300, 900]
const NATIVE_SCROLL_MARKER_ID = 'heritage-volume-scroll-marker'

function getPendingCommentaryLoadsForBook(bookName, authorsData) {
  const pending = []
  for (const author of authorsData) {
    for (const work of author.works) {
      if (work.book === bookName && !work.loaded && work.dataPath) {
        pending.push({
          authorId: author.id,
          workId: work.id,
        })
      }
    }
  }
  return pending
}

function hasLoadedCommentaryForBook(bookName, authorsData) {
  return authorsData.some(author =>
    author.works.some(work => work.book === bookName && work.loaded)
  )
}

function getUnresolvedCommentaryLoads(pendingLoads, authorsData) {
  if (!pendingLoads.length) return []
  const loadedKeys = new Set(
    authorsData.flatMap(author =>
      author.works
        .filter(work => work.loaded)
        .map(work => `${author.id}|||${work.id}`)
    )
  )

  return pendingLoads.filter(item => !loadedKeys.has(`${item.authorId}|||${item.workId}`))
}

async function wait(ms) {
  await new Promise(resolve => window.setTimeout(resolve, ms))
}

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

function forceScrollTop() {
  const docEl = document.documentElement
  const body = document.body
  const root = document.getElementById('root')

  const prevHtmlBehavior = docEl.style.scrollBehavior
  const prevBodyBehavior = body.style.scrollBehavior
  docEl.style.scrollBehavior = 'auto'
  body.style.scrollBehavior = 'auto'

  window.scrollTo(0, 0)
  docEl.scrollTop = 0
  body.scrollTop = 0
  if (root) root.scrollTop = 0

  docEl.style.scrollBehavior = prevHtmlBehavior
  body.style.scrollBehavior = prevBodyBehavior
}

function isEditableTarget(element) {
  if (!element) return false
  const tag = element.tagName?.toLowerCase()
  return element.isContentEditable || ['input', 'textarea', 'select', 'audio', 'video'].includes(tag)
}

function getBestScrollTarget() {
  const active = document.activeElement
  if (isEditableTarget(active)) return null

  const candidates = [
    document.querySelector('[data-reader-scroll-target="true"]'),
    document.scrollingElement,
    document.documentElement,
    document.body,
  ].filter(Boolean)

  return candidates.find(element => element.scrollHeight > element.clientHeight + 20) || document.scrollingElement
}

function getVerticalChromeHeight(position) {
  const selectors = position === 'top'
    ? ['header.sticky', '.fixed.top-0', '.sticky.top-0']
    : ['nav.fixed.bottom-0', '.fixed.bottom-0']

  const seen = new Set()
  return selectors.reduce((total, selector) => {
    return total + Array.from(document.querySelectorAll(selector)).reduce((sum, element) => {
      if (seen.has(element)) return sum
      seen.add(element)

      const rect = element.getBoundingClientRect()
      const styles = window.getComputedStyle(element)
      const isVisible = rect.height > 0 && styles.display !== 'none' && styles.visibility !== 'hidden'
      if (!isVisible) return sum

      const isRelevantTop = position === 'top' && rect.top <= 2 && rect.bottom > 0
      const isRelevantBottom = position === 'bottom' && rect.bottom >= window.innerHeight - 2 && rect.top < window.innerHeight
      return (isRelevantTop || isRelevantBottom) ? sum + rect.height : sum
    }, 0)
  }, 0)
}

function getReaderLineHeight() {
  const sample = document.querySelector('.verse-text') || document.querySelector('main') || document.body
  const computed = window.getComputedStyle(sample)
  const parsed = Number.parseFloat(computed.lineHeight)
  if (Number.isFinite(parsed)) return parsed

  const fontSize = Number.parseFloat(computed.fontSize)
  return Number.isFinite(fontSize) ? fontSize * 1.6 : 32
}

function getNativeReaderScrollDistance(target) {
  const viewport = window.innerHeight || target?.clientHeight || 700
  const targetViewport = target && target !== document.scrollingElement && target !== document.documentElement && target !== document.body
    ? target.clientHeight
    : viewport - getVerticalChromeHeight('top') - getVerticalChromeHeight('bottom')

  const readableHeight = Math.max(180, targetViewport || viewport)
  const overlap = Math.max(28, Math.min(72, getReaderLineHeight() * 1.25))
  return Math.max(160, Math.round(readableHeight - overlap))
}

function isDocumentScrollTarget(target) {
  return target === document.scrollingElement || target === document.documentElement || target === document.body
}

function removeNativeScrollMarker() {
  document.getElementById(NATIVE_SCROLL_MARKER_ID)?.remove()
}

function getReaderViewportBounds(target) {
  if (isDocumentScrollTarget(target)) {
    return {
      top: getVerticalChromeHeight('top') + 8,
      bottom: (window.innerHeight || 0) - getVerticalChromeHeight('bottom') - 8,
    }
  }

  const rect = target.getBoundingClientRect()
  return {
    top: Math.max(0, rect.top) + 8,
    bottom: Math.min(window.innerHeight || rect.bottom, rect.bottom) - 8,
  }
}

function getReaderContentRect() {
  const element = document.querySelector('[data-reader-scroll-target="true"]')
    || document.querySelector('main .container')
    || document.querySelector('main')
    || document.body
  return element.getBoundingClientRect()
}

function findLastFullyVisibleReaderLine(target) {
  const bounds = getReaderViewportBounds(target)
  if (bounds.bottom <= bounds.top) return null

  const lineRects = []
  for (const element of document.querySelectorAll('.verse-text')) {
    const range = document.createRange()
    try {
      range.selectNodeContents(element)
      for (const rect of range.getClientRects()) {
        if (rect.width < 16 || rect.height < 8) continue
        if (rect.top < bounds.top || rect.bottom > bounds.bottom) continue
        lineRects.push(rect)
      }
    } finally {
      range.detach?.()
    }
  }

  if (!lineRects.length) return null
  return lineRects.reduce((last, rect) => {
    if (!last) return rect
    if (rect.bottom > last.bottom + 1) return rect
    if (Math.abs(rect.bottom - last.bottom) <= 1 && rect.left > last.left) return rect
    return last
  }, null)
}

function placeNativeScrollMarker(target) {
  removeNativeScrollMarker()

  const lineRect = findLastFullyVisibleReaderLine(target)
  if (!lineRect) return

  const contentRect = getReaderContentRect()
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0
  const scrollLeft = window.scrollX || document.documentElement.scrollLeft || 0
  const marker = document.createElement('div')
  marker.id = NATIVE_SCROLL_MARKER_ID
  marker.setAttribute('aria-hidden', 'true')

  Object.assign(marker.style, {
    position: 'absolute',
    top: `${lineRect.bottom + scrollTop + 4}px`,
    left: `${Math.max(12, contentRect.left + scrollLeft + 12)}px`,
    width: `${Math.max(48, contentRect.width - 24)}px`,
    height: '0',
    borderTop: '1px dashed rgba(156, 163, 175, 0.78)',
    pointerEvents: 'none',
    zIndex: '30',
  })

  document.body.appendChild(marker)
}

function isReaderRoute(pathname) {
  if (!pathname) return false
  return (
    /^\/[a-z0-9-]+\/\d+/i.test(pathname) ||
    pathname.startsWith('/resources/books/') ||
    pathname.startsWith('/resources/confessions/') ||
    pathname.startsWith('/resources/tools/apocrypha') ||
    pathname.startsWith('/resources/tools/hymns')
  )
}

function AndroidReaderControls({ enabled }) {
  const location = useLocation()

  useEffect(() => {
    removeNativeScrollMarker()
    return removeNativeScrollMarker
  }, [location.pathname])

  useEffect(() => {
    setNativeSideButtonScrollEnabled(Boolean(enabled) && isReaderRoute(location.pathname)).catch(() => {})
  }, [enabled, location.pathname])

  useEffect(() => {
    return addNativeScrollListener(direction => {
      if (!enabled || !isReaderRoute(location.pathname)) return
      const target = getBestScrollTarget()
      if (!target) return

      const distance = getNativeReaderScrollDistance(target)
      const delta = direction === 'up' ? -distance : distance

      if (direction === 'down') placeNativeScrollMarker(target)
      else removeNativeScrollMarker()

      if (isDocumentScrollTarget(target)) {
        window.scrollBy({ top: delta, left: 0, behavior: 'auto' })
      } else {
        target.scrollTop += delta
      }
    })
  }, [enabled, location.pathname])

  return null
}

function ScrollToTopOnRouteChange() {
  const location = useLocation()

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

  useLayoutEffect(() => {
    forceScrollTop()
    const raf1 = window.requestAnimationFrame(() => forceScrollTop())
    const raf2 = window.requestAnimationFrame(() => window.requestAnimationFrame(() => forceScrollTop()))
    const timeout1 = window.setTimeout(() => forceScrollTop(), 0)
    const timeout2 = window.setTimeout(() => forceScrollTop(), 80)
    return () => {
      window.cancelAnimationFrame(raf1)
      window.cancelAnimationFrame(raf2)
      window.clearTimeout(timeout1)
      window.clearTimeout(timeout2)
    }
  }, [location.key])

  return null
}

function NativeBackNavigation() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    return addNativeBackListener(event => {
      window.setTimeout(() => {
        if (event?.defaultPrevented) return

        const resourceDetailMatch = location.pathname.match(/^\/resources\/([^/]+)\/[^/]+/)
        if (resourceDetailMatch) {
          navigate(`/resources/${resourceDetailMatch[1]}`)
          return
        }

        if (/^\/resources\/[^/]+$/.test(location.pathname)) {
          getReaderProgress()
            .then(progress => {
              const saved = progress?.bible
              const bookMeta = saved?.book ? bibleBooks.find(book => book.name === saved.book) : null
              const chapter = Number(saved?.chapter)
              const biblePath = bookMeta && Number.isInteger(chapter) && chapter >= 1 && chapter <= bookMeta.chapters
                ? `/${bookToSlug(bookMeta.name)}/${chapter}`
                : '/genesis/1'
              navigate(biblePath, { state: { openResources: true } })
            })
            .catch(() => navigate('/genesis/1', { state: { openResources: true } }))
          return
        }

        if (/^\/[a-z0-9-]+\/\d+/i.test(location.pathname)) {
          exitNativeApp().catch(() => {})
          return
        }

        navigate(-1)
      }, 0)
    })
  }, [location.pathname, navigate])

  return null
}

function HomeRedirect() {
  const [target, setTarget] = useState(null)

  useEffect(() => {
    let cancelled = false

    getReaderProgress()
      .then(progress => {
        if (cancelled) return

        const saved = progress?.bible
        const bookMeta = saved?.book ? bibleBooks.find(book => book.name === saved.book) : null
        const chapter = Number(saved?.chapter)
        if (bookMeta && Number.isInteger(chapter) && chapter >= 1 && chapter <= bookMeta.chapters) {
          setTarget(`/${bookToSlug(bookMeta.name)}/${chapter}`)
          return
        }

        setTarget('/genesis/1')
      })
      .catch(() => {
        if (!cancelled) setTarget('/genesis/1')
      })

    return () => { cancelled = true }
  }, [])

  if (!target) {
    return (
      <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center p-6">
        <p className="text-gray-500 dark:text-gray-400 animate-pulse">Opening last passage...</p>
      </div>
    )
  }

  return <Navigate to={target} replace />
}

function ReadingPlanInviteRedirect() {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const planId = params.get('plan') || params.get('planId') || 'chronological-bible'
  const groupId = params.get('group') || params.get('groupId') || ''
  const inviteToken = params.get('invite') || params.get('inviteToken') || ''
  const query = groupId && inviteToken
    ? `?group=${encodeURIComponent(groupId)}&invite=${encodeURIComponent(inviteToken)}`
    : ''

  return <Navigate to={`/resources/reading-plans/${planId}${query}`} replace />
}

function BibleStudyApp({ sideButtonScroll, onSideButtonScrollChange }) {
  const { bookSlug, chapterNum } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  
  // Parse URL params into book and chapter
  const urlBook = slugToBook(bookSlug)
  const urlChapter = chapterNum ? parseInt(chapterNum, 10) : null

  const [currentBook, setCurrentBook] = useState(urlBook || 'Genesis')
  const [currentChapter, setCurrentChapter] = useState(urlChapter || 1)
  const [showBookmarkManager, setShowBookmarkManager] = useState(false)
  const [showResources, setShowResources] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // Start closed
  const [showGoToPassageButton, setShowGoToPassageButton] = useState(false)
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const [versePositions, setVersePositions] = useState({})
  const [selectedVerse, setSelectedVerse] = useState(null) // Track selected verse
  const [selectedVerses, setSelectedVerses] = useState([])
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const bibleContainerRef = useRef(null)
  const searchRequestRef = useRef(0)
  const [activeReadingPlan, setActiveReadingPlan] = useState(() => getActiveReadingPlan())
  
  // Translation state
  const [translationId, setTranslationId] = useState(() => {
    try {
      const saved = localStorage.getItem('heritage-translation')
      const migrated = localStorage.getItem('heritage-default-translation-v2') === 'done'
      if (!migrated && (!saved || saved === 'LSV')) return DEFAULT_TRANSLATION
      return saved || DEFAULT_TRANSLATION
    } catch { return DEFAULT_TRANSLATION }
  })
  const [bibleData, setBibleData] = useState(null)
  const [translationLoading, setTranslationLoading] = useState(false)
  const [translationLoadError, setTranslationLoadError] = useState('')
  const [translationReloadToken, setTranslationReloadToken] = useState(0)
  const [parallelMode, setParallelMode] = useState(false)
  const [parallelTranslationId, setParallelTranslationId] = useState(() => {
    try {
      const saved = localStorage.getItem('heritage-parallel-translation')
      if (saved && translations.some(t => t.id === saved)) return saved
    } catch {}
    return translations.find(t => t.id !== DEFAULT_TRANSLATION)?.id || null
  })
  const [parallelBibleData, setParallelBibleData] = useState(null)
  const [parallelLoading, setParallelLoading] = useState(false)

  // Load translation data when translationId changes
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setTranslationLoading(true)
      setTranslationLoadError('')
      setBibleData(null)
      try {
        const data = await loadTranslation(translationId)
        if (!cancelled) {
          setBibleData(data)
        }
      } catch (err) {
        console.error('Failed to load translation:', err)
        if (!cancelled) {
          setBibleData(null)
          setTranslationLoadError(`Failed to load ${translationId}. Please retry.`)
        }
      } finally {
        if (!cancelled) setTranslationLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [translationId, translationReloadToken])

  // Persist translation choice
  useEffect(() => {
    setStoredValue(STORAGE_KEYS.translation, translationId).catch(() => {})
    try { localStorage.setItem('heritage-default-translation-v2', 'done') } catch {}
  }, [translationId])

  // Keep secondary translation distinct from primary.
  useEffect(() => {
    if (!parallelTranslationId) return
    if (parallelTranslationId !== translationId) return

    const fallbackSecondary = translations.find(t => t.id !== translationId)?.id || null
    setParallelTranslationId(fallbackSecondary)
    setParallelMode(false)
  }, [translationId, parallelTranslationId])

  // Persist selected secondary translation (mode intentionally defaults OFF on fresh load).
  useEffect(() => {
    if (!parallelTranslationId) return
    setStoredValue(STORAGE_KEYS.parallelTranslation, parallelTranslationId).catch(() => {})
  }, [parallelTranslationId])

  // Lazy-load secondary translation only when parallel mode is enabled.
  useEffect(() => {
    let cancelled = false

    const loadParallel = async () => {
      if (!parallelMode || !parallelTranslationId) {
        setParallelBibleData(null)
        setParallelLoading(false)
        return
      }

      setParallelLoading(true)
      try {
        const data = await loadTranslation(parallelTranslationId)
        if (!cancelled) {
          setParallelBibleData(data)
        }
      } catch (error) {
        console.error('Failed to load parallel translation:', error)
        if (!cancelled) {
          setParallelMode(false)
          setParallelBibleData(null)
        }
      } finally {
        if (!cancelled) setParallelLoading(false)
      }
    }

    loadParallel()
    return () => { cancelled = true }
  }, [parallelMode, parallelTranslationId])

  // Author/Work state
  const [authorsData, setAuthorsData] = useState(initialAuthors)
  const [selectedAuthor, setSelectedAuthor] = useState(null)
  const [selectedWork, setSelectedWork] = useState(null)
  const [commentaryLoadStatus, setCommentaryLoadStatus] = useState('idle')
  const [commentaryLoadError, setCommentaryLoadError] = useState('')
  const [commentaryRetryToken, setCommentaryRetryToken] = useState(0)
  
  // Text size settings (persisted in localStorage, in px)
  const [textSize, setTextSize] = useState(() => {
    try { const v = parseInt(localStorage.getItem('heritage-text-size')); return v >= 12 && v <= 64 ? v : 18 } catch { return 18 }
  })
  const [commentaryTextSize, setCommentaryTextSize] = useState(() => {
    try { const v = parseInt(localStorage.getItem('heritage-commentary-text-size')); return v >= 12 && v <= 64 ? v : 14 } catch { return 14 }
  })
  const [verseStacking, setVerseStacking] = useState(() => {
    try { return localStorage.getItem('heritage-verse-stacking') === 'true' } catch { return false }
  })

  // Dark mode state (persisted)
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('heritage-dark-mode') === 'true' } catch { return false }
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    setStoredValue(STORAGE_KEYS.darkMode, String(darkMode)).catch(() => {})
  }, [darkMode])
  
  useEffect(() => {
    setStoredValue(STORAGE_KEYS.textSize, String(textSize)).catch(() => {})
  }, [textSize])
  useEffect(() => {
    setStoredValue(STORAGE_KEYS.commentaryTextSize, String(commentaryTextSize)).catch(() => {})
  }, [commentaryTextSize])
  useEffect(() => {
    setStoredValue(STORAGE_KEYS.verseStacking, String(verseStacking)).catch(() => {})
  }, [verseStacking])

  // Sidebar width state (persisted, px)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try { const v = parseInt(localStorage.getItem('heritage-sidebar-width')); return v >= 320 && v <= 1200 ? v : 540 } catch { return 540 }
  })
  useEffect(() => {
    setStoredValue(STORAGE_KEYS.sidebarWidth, String(sidebarWidth)).catch(() => {})
  }, [sidebarWidth])

  const retryCommentaryLoad = useCallback(() => {
    setCommentaryRetryToken(prev => prev + 1)
  }, [])

  const retryTranslationLoad = useCallback(() => {
    setTranslationReloadToken(prev => prev + 1)
  }, [])

  useEffect(() => {
    const handleActivePlanChange = (event) => {
      setActiveReadingPlan(event.detail || getActiveReadingPlan())
    }
    const handleStorage = (event) => {
      if (event.key === STORAGE_KEYS.activeReadingPlan) setActiveReadingPlan(getActiveReadingPlan())
    }

    window.addEventListener('heritage-active-plan-change', handleActivePlanChange)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('heritage-active-plan-change', handleActivePlanChange)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  useEffect(() => {
    return addNativeBackListener(event => {
      if (showBookmarkManager) {
        event?.preventDefault?.()
        setShowBookmarkManager(false)
        return
      }

      if (showResources) {
        event?.preventDefault?.()
        setShowResources(false)
        return
      }

      if (searchResults) {
        event?.preventDefault?.()
        setSearchResults(null)
        return
      }

      if (multiSelectMode) {
        event?.preventDefault?.()
        setMultiSelectMode(false)
        setSelectedVerses(selectedVerse ? [selectedVerse] : [])
      }
    })
  }, [multiSelectMode, searchResults, selectedVerse, showBookmarkManager, showResources])

  // Lazy-load commentary data when book changes
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const pendingLoads = getPendingCommentaryLoadsForBook(currentBook, authorsData)
      if (pendingLoads.length === 0) {
        if (!cancelled) {
          setCommentaryLoadStatus('ready')
          setCommentaryLoadError('')
          autoSelectAuthor(currentBook)
        }
        return
      }

      setCommentaryLoadStatus('loading')
      setCommentaryLoadError('')

      let updated = authorsData
      let unresolved = pendingLoads

      for (let attempt = 0; attempt <= COMMENTARY_RETRY_DELAYS_MS.length; attempt += 1) {
        updated = await loadCommentaryForBook(currentBook, updated)
        unresolved = getUnresolvedCommentaryLoads(pendingLoads, updated)
        if (!unresolved.length) break

        if (attempt < COMMENTARY_RETRY_DELAYS_MS.length) {
          await wait(COMMENTARY_RETRY_DELAYS_MS[attempt])
        }
      }

      if (cancelled) return

      setAuthorsData(updated)
      autoSelectAuthor(currentBook, updated)

      if (unresolved.length && !hasLoadedCommentaryForBook(currentBook, updated)) {
        setCommentaryLoadStatus('failed')
        setCommentaryLoadError('Failed to load commentary data for this book.')
      } else {
        setCommentaryLoadStatus('ready')
        setCommentaryLoadError('')
      }
    }

    load()
    return () => { cancelled = true }
  }, [currentBook, commentaryRetryToken])

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
    notes, saveNote, deleteNote
  } = useBookmarks()

  useEffect(() => {
    saveBibleProgress(currentBook, currentChapter).catch(() => {})
  }, [currentBook, currentChapter])

  useEffect(() => {
    if (!location.state?.openResources) return
    setShowResources(true)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  // Sync URL to state when URL changes
  useEffect(() => {
    if (urlBook && urlBook !== currentBook) {
      setCurrentBook(urlBook)
    }
    if (urlChapter && urlChapter !== currentChapter) {
      setCurrentChapter(urlChapter)
    }
  }, [urlBook, urlChapter])

  // Handle external deep links that should open commentary at a specific verse
  useEffect(() => {
    const incoming = location.state?.openCommentaryVerse
    if (!incoming?.book || !incoming?.chapter || !incoming?.verse) return

    const incomingBook = incoming.book
    const incomingChapter = Number(incoming.chapter)
    const incomingVerse = Number(incoming.verse)

    if (!incomingBook || !incomingChapter || !incomingVerse) return

    const verseText = bibleData?.books
      ?.find(b => b.name === incomingBook)
      ?.chapters?.find(c => c.number === incomingChapter)
      ?.verses?.find(v => v.number === incomingVerse)
      ?.text || ''

    const incomingSelection = { book: incomingBook, chapter: incomingChapter, verse: incomingVerse, text: verseText }
    setCurrentBook(incomingBook)
    setCurrentChapter(incomingChapter)
    setSelectedVerse(incomingSelection)
    setSelectedVerses([incomingSelection])
    setMultiSelectMode(false)
    setIsSidebarOpen(true)
    setShowGoToPassageButton(true)
  }, [location.key, bibleData])

  useEffect(() => {
    setSelectedVerses(prev =>
      prev.filter(v => (v.book || currentBook) === currentBook && v.chapter === currentChapter)
    )
    setSelectedVerse(prev => {
      if (!prev) return null
      if ((prev.book || currentBook) === currentBook && prev.chapter === currentChapter) return prev
      return null
    })
  }, [currentBook, currentChapter])

  useEffect(() => {
    if (multiSelectMode && selectedVerses.length === 0) {
      setMultiSelectMode(false)
    }
  }, [multiSelectMode, selectedVerses.length])

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
    return bibleData?.books?.find(b => b.name === currentBook) || null
  }, [currentBook, bibleData])

  // Get current chapter data
  const currentChapterData = useMemo(() => {
    if (!currentBookData) return null
    return currentBookData.chapters.find(c => c.number === currentChapter)
  }, [currentBookData, currentChapter])

  const secondaryChapterData = useMemo(() => {
    if (!parallelBibleData || !parallelMode) return null
    const bookData = parallelBibleData.books?.find(b => b.name === currentBook)
    if (!bookData) return null
    return bookData.chapters.find(c => c.number === currentChapter) || null
  }, [parallelBibleData, parallelMode, currentBook, currentChapter])

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
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      if (currentChapter > 1) {
        setCurrentChapter(currentChapter - 1)
      } else if (bookIndex > 0) {
        const prevBook = bibleBooks[bookIndex - 1]
        setCurrentBook(prevBook.name)
        setCurrentChapter(prevBook.chapters)
      }
    }
    
    const goNxt = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
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
    const clickedVerse = { book: currentBook, chapter, verse, text: verseText }

    if (multiSelectMode) {
      setSelectedVerses(prev => {
        const exists = prev.some(v => v.book === currentBook && v.chapter === chapter && v.verse === verse)
        if (exists) {
          const next = prev.filter(v => !(v.book === currentBook && v.chapter === chapter && v.verse === verse))
          setSelectedVerse(next[next.length - 1] || null)
          return next
        }
        const next = [...prev, clickedVerse]
        setSelectedVerse(clickedVerse)
        return next
      })
    } else {
      setSelectedVerse(clickedVerse)
      setSelectedVerses([clickedVerse])
    }

    setIsSidebarOpen(true)
    setShowGoToPassageButton(false)
  }

  const toggleMultiSelectMode = () => {
    const nextMode = !multiSelectMode
    setMultiSelectMode(nextMode)

    if (nextMode) {
      if (selectedVerses.length === 0 && selectedVerse) {
        setSelectedVerses([selectedVerse])
      }
      return
    }

    if (selectedVerse) {
      setSelectedVerses([selectedVerse])
    } else if (selectedVerses.length > 0) {
      const last = selectedVerses[selectedVerses.length - 1]
      setSelectedVerse(last)
      setSelectedVerses([last])
    } else {
      setSelectedVerses([])
    }
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

  const handleBookmarkMultiple = (verses) => {
    if (!Array.isArray(verses) || verses.length === 0) {
      showToast('Select at least one verse first')
      return
    }

    const normalized = verses.map(v => ({
      book: v.book || currentBook,
      chapter: v.chapter,
      verse: v.verse,
      text: v.text || '',
    }))

    const allBookmarked = normalized.every(v => isBookmarked(v.book, v.chapter, v.verse))

    if (allBookmarked) {
      normalized.forEach(v => removeBookmark(v.book, v.chapter, v.verse))
      showToast(`Removed ${normalized.length} bookmark${normalized.length === 1 ? '' : 's'}`)
      return
    }

    let addedCount = 0
    normalized.forEach(v => {
      if (isBookmarked(v.book, v.chapter, v.verse)) return
      const verseText = v.text || bibleData?.books
        ?.find(b => b.name === v.book)
        ?.chapters?.find(c => c.number === v.chapter)
        ?.verses?.find(row => row.number === v.verse)
        ?.text || ''
      addBookmark({
        book: v.book,
        chapter: v.chapter,
        verse: v.verse,
        verseText: verseText.substring(0, 100),
        hasCommentary: hasAnyCommentary(v.book, v.chapter, v.verse, authorsData),
        userNote: ''
      })
      addedCount += 1
    })
    showToast(`Bookmarked ${addedCount} verse${addedCount === 1 ? '' : 's'}`)
  }

  const handleSaveNotesForVerses = (verses, text) => {
    if (!Array.isArray(verses) || verses.length === 0) {
      showToast('Select at least one verse first')
      return
    }

    verses.forEach(v => {
      const verseBook = v.book || currentBook
      const verseText = v.text || bibleData?.books
        ?.find(b => b.name === verseBook)
        ?.chapters?.find(c => c.number === v.chapter)
        ?.verses?.find(row => row.number === v.verse)
        ?.text || ''
      saveNote(verseBook, v.chapter, v.verse, text, verseText)
    })

    if (text.trim()) {
      showToast(`Saved note to ${verses.length} verse${verses.length === 1 ? '' : 's'}`)
    } else {
      showToast(`Deleted note from ${verses.length} verse${verses.length === 1 ? '' : 's'}`)
    }
  }

  // Show toast notification
  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  // Search functionality
  const handleSearch = async (query) => {
    const requestId = ++searchRequestRef.current
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      setSearchResults(null)
      setSearchLoading(false)
      return
    }

    // Only try to parse as a Bible reference if the query contains a number
    // (e.g. "Ps 23", "Rom 8:28"). Plain words like "husband" always do text search.
    if (/\d/.test(trimmedQuery)) {
      const ref = parseBibleReference(trimmedQuery, currentBook)
      if (ref) {
        setSearchQuery('')
        setSearchResults(null)
        setSearchLoading(false)
        if (ref.verse) {
          navigateToVerse(ref.book, ref.chapter, ref.verse)
        } else {
          handleNavigate(ref.book, ref.chapter)
        }
        return
      }
    }

    setSearchLoading(true)

    try {
      const bibleMatches = searchBibleVerses(bibleData, trimmedQuery, {
        maxResults: 200,
        hasCommentary: (book, chapter, verse) => hasAnyCommentary(book, chapter, verse, authorsData),
      })
      let commentaryMatches = { items: [], capped: false }
      let bookMatches = { books: [], capped: false }

      try {
        ;[commentaryMatches, bookMatches] = await Promise.all([
          searchCommentaryLibrary(trimmedQuery, { maxResults: 200 }),
          searchBookLibrary(trimmedQuery, { maxResults: 200, maxPerBook: 80 }),
        ])
      } catch (error) {
        console.warn('Cross-library search failed', error)
        if (commentaryMatches.items.length === 0) {
          try {
            commentaryMatches = await searchCommentaryLibrary(trimmedQuery, { maxResults: 200 })
          } catch {
            commentaryMatches = { items: [], capped: false }
          }
        }
      }

      if (requestId !== searchRequestRef.current) return

      setSearchResults({
        verses: bibleMatches.items,
        versesCapped: bibleMatches.capped,
        commentaries: commentaryMatches.items,
        commentariesCapped: commentaryMatches.capped,
        books: bookMatches.books,
        booksCapped: bookMatches.capped,
        sectionOrder: ['verses', 'commentaries', 'books'],
      })
    } finally {
      if (requestId === searchRequestRef.current) setSearchLoading(false)
    }
  }

  // Navigate to verse from search or bookmark
  const navigateToVerse = (book, chapter, verse) => {
    if (book) setCurrentBook(book)
    setCurrentChapter(chapter)
    setSearchResults(null)
    setShowBookmarkManager(false)
    setShowGoToPassageButton(false)
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
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }

  const handlePlanNavigate = (bookName, chapter, path) => {
    if (path) {
      navigate(path)
      return
    }
    if (!bookName || !chapter) return
    handleNavigate(bookName, chapter)
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

  const bibleReady = Boolean(bibleData?.books?.length)

  return (
    <>
      <div className={`min-h-screen ${darkMode ? 'dark bg-black' : 'bg-background'}`}>
        <Header 
          onSearch={handleSearch}
          isSearchLoading={searchLoading}
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
          verseStacking={verseStacking}
          onVerseStackingChange={setVerseStacking}
          translationId={translationId}
          onTranslationChange={setTranslationId}
          translationLoading={translationLoading}
          parallelMode={parallelMode}
          parallelLoading={parallelLoading}
          parallelSecondaryId={parallelTranslationId}
          onParallelEnable={(secondaryId) => {
            if (!secondaryId || secondaryId === translationId) return
            setParallelTranslationId(secondaryId)
            setParallelMode(true)
          }}
          onParallelDisable={() => setParallelMode(false)}
          darkMode={darkMode}
          onDarkModeChange={setDarkMode}
          sideButtonScroll={sideButtonScroll}
          onSideButtonScrollChange={onSideButtonScrollChange}
          showVolumeScrollSetting={isNativeAndroid()}
        />
        
        <div className="flex">
          {/* Main Content */}
          <main
            className="flex-1 px-0 sm:px-4 py-2 sm:py-6 pb-20 transition-all duration-300"
            style={{ marginRight: isLargeScreen && isSidebarOpen ? `${sidebarWidth}px` : 0 }}
          >
            <div className="container mx-auto max-w-3xl" ref={bibleContainerRef}>
              {!bibleReady ? (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center mt-6">
                  {translationLoadError ? (
                    <>
                      <p className="text-gray-700 dark:text-gray-200 font-semibold mb-2">Failed to load Bible text</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{translationLoadError}</p>
                      <button
                        onClick={retryTranslationLoad}
                        className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-blue-700 transition-colors"
                      >
                        Retry
                      </button>
                    </>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 animate-pulse">Loading Bible text...</p>
                  )}
                </div>
              ) : searchResults ? (
                <SearchResults 
                  results={searchResults}
                  query={searchQuery}
                  onVerseClick={navigateToVerse}
                  onBookClick={(bookResult) => {
                    navigate(`/resources/books/${bookResult.bookId}`, {
                      state: {
                        searchQuery,
                        chapterIndex: bookResult.chapterIndex,
                      },
                    })
                  }}
                  onCommentaryClick={(commentary) => {
                    // Navigate to the chapter and open sidebar
                    if (commentary.verses && commentary.verses.length > 0) {
                      const firstVerse = commentary.verses[0]
                      if (commentary.book) setCurrentBook(commentary.book)
                      setCurrentChapter(firstVerse.chapter)
                      const selected = {
                        book: commentary.book || currentBook,
                        chapter: firstVerse.chapter, 
                        verse: firstVerse.verse,
                        text: ''
                      }
                      setSelectedVerse(selected)
                      setSelectedVerses([selected])
                      setMultiSelectMode(false)
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
                  {(translationLoading || (parallelMode && parallelLoading)) && (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400 animate-pulse">
                      Loading translation...
                    </div>
                  )}

                  {/* Bible Chapter Display */}
                  {!translationLoading && (!parallelMode || !parallelLoading) && currentChapterData && (
                    parallelMode ? (
                      <ParallelBibleChapter
                        primaryChapter={currentChapterData}
                        secondaryChapter={secondaryChapterData}
                        primaryTranslationId={translationId}
                        secondaryTranslationId={parallelTranslationId}
                        hasCommentary={hasCommentary}
                        onVerseClick={(ch, v, text) => handleVerseClick(ch, v, text)}
                        isVerseSelected={(ch, v) =>
                          selectedVerses.some(row => row.book === currentBook && row.chapter === ch && row.verse === v)
                        }
                        isBookmarked={(verse) => isBookmarked(currentBook, currentChapter, verse)}
                        onBookmarkToggle={handleBookmarkToggle}
                        onVersePosition={updateVersePosition}
                        textSize={textSize}
                      />
                    ) : (
                      <BibleChapter 
                        chapter={currentChapterData}
                        bookName={currentBook}
                        hasCommentary={hasCommentary}
                        onVerseClick={(ch, v, text) => handleVerseClick(ch, v, text)}
                        isVerseSelected={(ch, v) =>
                          selectedVerses.some(row => row.book === currentBook && row.chapter === ch && row.verse === v)
                        }
                        isBookmarked={(verse) => isBookmarked(currentBook, currentChapter, verse)}
                        onBookmarkToggle={handleBookmarkToggle}
                        onVersePosition={updateVersePosition}
                        textSize={textSize}
                        verseStacking={verseStacking}
                      />
                    )
                  )}

                  {!translationLoading && currentChapterData == null && (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      Unable to find chapter data for <strong>{currentBook} {currentChapter}</strong> in <strong>{translationId}</strong>.
                    </div>
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
              loading={commentaryLoadStatus === 'loading'}
              commentaryLoadStatus={commentaryLoadStatus}
              commentaryLoadError={commentaryLoadError}
              onRetryCommentaryLoad={retryCommentaryLoad}
              versePositions={versePositions}
              selectedVerse={selectedVerse}
              selectedVerses={selectedVerses}
              multiSelectMode={multiSelectMode}
              onToggleMultiSelect={toggleMultiSelectMode}
              translationId={translationId}
              bibleData={bibleData}
              parallelMode={parallelMode}
              parallelTranslationId={parallelTranslationId}
              parallelBibleData={parallelBibleData}
              commentaryTextSize={commentaryTextSize}
              sidebarWidth={sidebarWidth}
              onSidebarWidthChange={setSidebarWidth}
              isBookmarked={(ch, v) => isBookmarked(currentBook, ch, v)}
              onBookmarkVerse={(ch, v) => {
                const verseData = currentChapterData?.verses.find(verse => verse.number === v)
                handleBookmarkToggle(ch, v, verseData?.text || '')
              }}
              onBookmarkVerses={handleBookmarkMultiple}
              isCommentaryBookmarked={isCommentaryBookmarked}
              onBookmarkCommentary={(commentary) => {
                const author = authorsData.find(a => a.id === selectedAuthor)
                const work = author?.works.find(w => w.id === selectedWork)
                const added = toggleCommentaryBookmark(commentary, author?.name, work?.title)
                showToast(added ? 'Commentary bookmarked!' : 'Bookmark removed')
              }}
              notes={notes}
              onSaveNote={saveNote}
              onSaveNotes={handleSaveNotesForVerses}
              onShowToast={showToast}
              onClose={() => {
                setIsSidebarOpen(false)
                setSelectedVerse(null)
                setSelectedVerses([])
                setMultiSelectMode(false)
                setShowGoToPassageButton(false)
              }}
              showGoToButton={showGoToPassageButton}
              onGoToVerse={() => {
                if (!selectedVerse) return
                navigateToVerse(selectedVerse.book || currentBook, selectedVerse.chapter, selectedVerse.verse)
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
            onPlanNavigate={handlePlanNavigate}
            onPrevious={goToPrevious}
            onNext={goToNext}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            isSidebarOpen={isLargeScreen && isSidebarOpen}
            sidebarWidth={sidebarWidth}
            activePlan={activeReadingPlan}
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
  const [sideButtonScroll, setSideButtonScrollState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.sideButtonScroll)
      if (saved != null) return saved === 'true'
    } catch {}
    return isNativeAndroid()
  })

  const setSideButtonScroll = useCallback((enabled) => {
    const next = Boolean(enabled)
    setSideButtonScrollState(next)
    setStoredValue(STORAGE_KEYS.sideButtonScroll, String(next)).catch(() => {})
  }, [])

  return (
    <Router>
      <ScrollToTopOnRouteChange />
      <NativeBackNavigation />
      <AndroidReaderControls enabled={sideButtonScroll} />
      <Routes>
        <Route path="/transcript/:transcriptId" element={<TranscriptViewer />} />
        <Route path="/resources/confessions/:itemId" element={<ConfessionViewer />} />
        <Route path="/resources/books/:itemId" element={<BookViewer />} />
        <Route path="/reading-plan-join" element={<ReadingPlanInviteRedirect />} />
        <Route path="/resources/reading-plans/:itemId" element={<ReadingPlanViewer />} />
        <Route path="/resources/tools/:itemId" element={<ToolViewer />} />
        <Route path="/resources/:categoryId" element={<ResourcePage />} />
        <Route path="/:bookSlug/:chapterNum" element={<BibleStudyApp sideButtonScroll={sideButtonScroll} onSideButtonScrollChange={setSideButtonScroll} />} />
        <Route path="/:bookSlug" element={<BibleStudyApp sideButtonScroll={sideButtonScroll} onSideButtonScrollChange={setSideButtonScroll} />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<Navigate to="/genesis/1" replace />} />
      </Routes>
    </Router>
  )
}

export default App
