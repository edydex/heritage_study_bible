import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react'
import { HashRouter as Router, Routes, Route, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom'
import Header from './components/Header'
import BibleChapter from './components/BibleChapter'
import ParallelBibleChapter from './components/ParallelBibleChapter'
import CommentarySidebar from './components/CommentarySidebar'
import BookmarkManager from './components/BookmarkManager'
import SearchResults from './components/SearchResults'
import BottomNav from './components/BottomNav'
import VerseSelectionBar from './components/VerseSelectionBar'
import TextSelectionBar from './components/TextSelectionBar'
import ResourcesModal from './components/ResourcesModal'
import BookReferenceChooser from './components/BookReferenceChooser'
import { useBookmarks } from './hooks/useBookmarks'
import { bibleBooks } from './data/bible-books.js'
import { translations, DEFAULT_TRANSLATION, loadTranslation, loadTranslationLayout } from './data/translations'
import { authors as initialAuthors, loadCommentaryForBook, getAuthorsForBook, hasAnyCommentary } from './data/authors'
import { getNumberedBookReferenceChoices, parseBibleReference } from './utils/parseBibleReference'
import { searchBibleVerses, searchBookLibrary, searchCommentaryLibrary } from './utils/librarySearch'
import { addNativeBackListener, addNativeScrollListener, exitNativeApp, isNativeAndroid, setNativeSideButtonScrollEnabled, setNativeSearchKeyboardCaptureInputEnabled, setNativeTextSelectionMenuSuppressed } from './services/androidControls'
import { setStoredValue, STORAGE_KEYS } from './services/persistentStorage'
import { getReaderProgress, saveBibleProgress } from './services/readerProgress'
import { getActiveReadingPlan } from './services/readingPlanProgress'
import { refreshStaleContentServers } from './services/contentServers'
import { checkForApkUpdate, openApkDownload } from './services/appUpdates'
import { getVerseTextWithPsalmSuperscription, withPsalmSuperscriptionVerse } from './utils/psalmSuperscriptions'
import { toggleVerseInSelection } from './utils/verseSelection'
import { captureBibleTextSelection, clearBrowserTextSelection, combineBibleTextSelections, resolveTextAnchor, textSelectionMatchesAnnotation } from './utils/textSelection'
import { DEFAULT_HIGHLIGHT_COLOR, normalizeHighlightColor } from './utils/highlightColors'
import {
  DEFAULT_ADVANCED_SETTINGS,
  DEFAULT_VOLUME_SCROLL_ANIMATION_MS,
  MAX_VOLUME_SCROLL_ANIMATION_MS,
  DEFAULT_VOLUME_SCROLL_DISTANCE_PERCENT,
  MIN_VOLUME_SCROLL_DISTANCE_PERCENT,
  MAX_VOLUME_SCROLL_DISTANCE_PERCENT,
  normalizeAdvancedSettings,
  scaleVolumeScrollDistance,
} from './utils/advancedSettings'

const TranscriptViewer = lazy(() => import('./components/TranscriptViewer'))
const ResourcePage = lazy(() => import('./components/ResourcePage'))
const ConfessionViewer = lazy(() => import('./components/ConfessionViewer'))
const BookViewer = lazy(() => import('./components/BookViewer'))
const ReadingPlanViewer = lazy(() => import('./components/ReadingPlanViewer'))
const ReadingPlanNoteViewer = lazy(() => import('./components/ReadingPlanNoteViewer'))
const ToolViewer = lazy(() => import('./components/ToolViewer'))
const ContentServersPage = lazy(() => import('./components/ContentServersPage'))
const RemoteResourceViewer = lazy(() => import('./components/RemoteResourceViewer'))
const CommunityHomePage = lazy(() => import('./components/CommunityHomePage'))
const CommunityCallbackPage = lazy(() => import('./components/CommunityCallbackPage'))

const COMMENTARY_RETRY_DELAYS_MS = [300, 900]
const NATIVE_SCROLL_MARKER_ID = 'heritage-volume-scroll-marker'
const NATIVE_VOLUME_NEXT_EVENT = 'heritage:native-volume-next'
const NATIVE_VOLUME_NEXT_DOUBLE_PRESS_MS = 480
const NATIVE_VOLUME_NEXT_SCROLL_BLOCK_MS = 500
const NATIVE_SCROLL_BOTTOM_TOLERANCE_PX = 18
let nativeScrollAnimationFrame = null
let nativeScrollMarkerTimeout = null

function loadAdvancedSettings() {
  try {
    return normalizeAdvancedSettings(JSON.parse(localStorage.getItem(STORAGE_KEYS.advancedSettings) || '{}'))
  } catch {
    return DEFAULT_ADVANCED_SETTINGS
  }
}

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

function getNativeReaderScrollDistance(target, distancePercent = DEFAULT_VOLUME_SCROLL_DISTANCE_PERCENT) {
  const viewport = window.innerHeight || target?.clientHeight || 700
  const targetViewport = target && target !== document.scrollingElement && target !== document.documentElement && target !== document.body
    ? target.clientHeight
    : viewport - getVerticalChromeHeight('top') - getVerticalChromeHeight('bottom')

  const readableHeight = Math.max(180, targetViewport || viewport)
  const overlap = Math.max(28, Math.min(72, getReaderLineHeight() * 1.25))
  const historicalPageStep = Math.max(160, Math.round(readableHeight - overlap))
  return scaleVolumeScrollDistance(historicalPageStep, distancePercent)
}

function isDocumentScrollTarget(target) {
  return target === document.scrollingElement || target === document.documentElement || target === document.body
}

function getScrollTopForTarget(target) {
  if (isDocumentScrollTarget(target)) return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
  return target.scrollTop || 0
}

function getMaxScrollTopForTarget(target) {
  if (isDocumentScrollTarget(target)) {
    const scroller = document.scrollingElement || document.documentElement
    const scrollHeight = Math.max(
      scroller?.scrollHeight || 0,
      document.documentElement?.scrollHeight || 0,
      document.body?.scrollHeight || 0
    )
    return Math.max(0, scrollHeight - (window.innerHeight || scroller?.clientHeight || 0))
  }

  return Math.max(0, (target?.scrollHeight || 0) - (target?.clientHeight || 0))
}

function isScrollTargetAtBottom(target) {
  return getScrollTopForTarget(target) >= getMaxScrollTopForTarget(target) - NATIVE_SCROLL_BOTTOM_TOLERANCE_PX
}

function dispatchNativeVolumeNext() {
  window.dispatchEvent(new CustomEvent(NATIVE_VOLUME_NEXT_EVENT))
}

function setScrollTopForTarget(target, top, forceInstant = false) {
  if (isDocumentScrollTarget(target)) {
    const scroller = document.scrollingElement || document.documentElement
    const prevScrollerBehavior = scroller.style.scrollBehavior
    const prevHtmlBehavior = document.documentElement.style.scrollBehavior
    const prevBodyBehavior = document.body.style.scrollBehavior
    if (forceInstant) {
      scroller.style.scrollBehavior = 'auto'
      document.documentElement.style.scrollBehavior = 'auto'
      document.body.style.scrollBehavior = 'auto'
    }

    scroller.scrollTop = top
    document.documentElement.scrollTop = top
    document.body.scrollTop = top

    if (forceInstant) {
      scroller.style.scrollBehavior = prevScrollerBehavior
      document.documentElement.style.scrollBehavior = prevHtmlBehavior
      document.body.style.scrollBehavior = prevBodyBehavior
    }
    return
  }

  const prevTargetBehavior = target.style.scrollBehavior
  if (forceInstant) target.style.scrollBehavior = 'auto'
  target.scrollTop = top
  if (forceInstant) target.style.scrollBehavior = prevTargetBehavior
}

function cancelNativeReaderScrollAnimation() {
  if (nativeScrollAnimationFrame) {
    window.cancelAnimationFrame(nativeScrollAnimationFrame)
    nativeScrollAnimationFrame = null
  }
}

function animateNativeReaderScroll(target, delta, durationMs = 0) {
  cancelNativeReaderScrollAnimation()

  if (!durationMs) {
    setScrollTopForTarget(target, getScrollTopForTarget(target) + delta, true)
    return
  }

  const startTop = getScrollTopForTarget(target)
  const targetTop = startTop + delta
  const startTime = performance.now()

  const step = (now) => {
    const progress = Math.min(1, (now - startTime) / durationMs)
    setScrollTopForTarget(target, startTop + (targetTop - startTop) * progress, true)

    if (progress < 1) {
      nativeScrollAnimationFrame = window.requestAnimationFrame(step)
    } else {
      nativeScrollAnimationFrame = null
    }
  }

  nativeScrollAnimationFrame = window.requestAnimationFrame(step)
}

function removeNativeScrollMarker() {
  if (nativeScrollMarkerTimeout) {
    window.clearTimeout(nativeScrollMarkerTimeout)
    nativeScrollMarkerTimeout = null
  }
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
  const isDarkMode = document.documentElement.classList.contains('dark')

  Object.assign(marker.style, {
    position: 'absolute',
    top: `${lineRect.bottom + scrollTop + 4}px`,
    left: `${Math.max(12, contentRect.left + scrollLeft + 12)}px`,
    width: `${Math.max(48, contentRect.width - 24)}px`,
    height: '0',
    borderTop: `1px dashed ${isDarkMode ? 'rgba(255, 255, 255, 0.86)' : 'rgba(0, 0, 0, 0.96)'}`,
    opacity: '1',
    transition: 'opacity 10s linear',
    pointerEvents: 'none',
    zIndex: '30',
  })

  document.body.appendChild(marker)
  window.requestAnimationFrame(() => {
    marker.style.opacity = '0'
  })
  nativeScrollMarkerTimeout = window.setTimeout(() => {
    marker.remove()
    nativeScrollMarkerTimeout = null
  }, 10000)
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

function AndroidReaderControls({ enabled, volumeScrollAnimationMs = 0, volumeScrollDistancePercent = DEFAULT_VOLUME_SCROLL_DISTANCE_PERCENT }) {
  const location = useLocation()
  const lastBottomDownPressAtRef = useRef(0)
  const blockNativeScrollUntilRef = useRef(0)

  useEffect(() => {
    cancelNativeReaderScrollAnimation()
    removeNativeScrollMarker()
    return () => {
      cancelNativeReaderScrollAnimation()
      removeNativeScrollMarker()
    }
  }, [location.pathname])

  useEffect(() => {
    setNativeSideButtonScrollEnabled(Boolean(enabled) && isReaderRoute(location.pathname)).catch(() => {})
  }, [enabled, location.pathname])

  useEffect(() => {
    return addNativeScrollListener(direction => {
      if (!enabled || !isReaderRoute(location.pathname)) return
      const target = getBestScrollTarget()
      if (!target) return
      const now = performance.now()
      if (now < blockNativeScrollUntilRef.current) return

      if (direction !== 'down') {
        lastBottomDownPressAtRef.current = 0
      } else if (isScrollTargetAtBottom(target)) {
        if (now - lastBottomDownPressAtRef.current <= NATIVE_VOLUME_NEXT_DOUBLE_PRESS_MS) {
          lastBottomDownPressAtRef.current = 0
          blockNativeScrollUntilRef.current = now + NATIVE_VOLUME_NEXT_SCROLL_BLOCK_MS
          cancelNativeReaderScrollAnimation()
          removeNativeScrollMarker()
          dispatchNativeVolumeNext()
          return
        }
        lastBottomDownPressAtRef.current = now
      } else {
        lastBottomDownPressAtRef.current = 0
      }

      const distance = getNativeReaderScrollDistance(target, volumeScrollDistancePercent)
      const delta = direction === 'up' ? -distance : distance

      if (direction === 'down') placeNativeScrollMarker(target)
      else removeNativeScrollMarker()

      animateNativeReaderScroll(target, delta, volumeScrollAnimationMs)
    })
  }, [enabled, location.pathname, volumeScrollAnimationMs, volumeScrollDistancePercent])

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
  const routeHistoryRef = useRef([])

  useEffect(() => {
    const route = `${location.pathname}${location.search}${location.hash}`
    const history = routeHistoryRef.current
    if (history[history.length - 1] !== route) {
      history.push(route)
      if (history.length > 40) history.splice(0, history.length - 40)
    }
  }, [location.hash, location.pathname, location.search])

  useEffect(() => {
    return addNativeBackListener(event => {
      window.setTimeout(() => {
        if (event?.defaultPrevented) return

        const history = routeHistoryRef.current
        if (history.length > 1) {
          history.pop()
          navigate(-1)
          return
        }

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

        exitNativeApp().catch(() => {})
      }, 0)
    })
  }, [location.hash, location.pathname, location.search, navigate])

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

function AdvancedSettingsPage({ settings, onSettingsChange }) {
  const navigate = useNavigate()
  const normalized = normalizeAdvancedSettings(settings)
  const [updateStatus, setUpdateStatus] = useState('idle')
  const [updateMessage, setUpdateMessage] = useState('')
  const [updateResult, setUpdateResult] = useState(null)
  const canCheckApkUpdates = isNativeAndroid()

  const updateSetting = (key, value) => {
    onSettingsChange?.(normalizeAdvancedSettings({ ...normalized, [key]: value }))
  }

  const handleCheckForUpdate = async () => {
    if (!canCheckApkUpdates) return

    setUpdateStatus('checking')
    setUpdateMessage('Checking GitHub releases...')
    setUpdateResult(null)

    try {
      const result = await checkForApkUpdate()
      setUpdateResult(result)

      if (result.status === 'update-available') {
        setUpdateStatus('downloading')
        setUpdateMessage(`Version ${result.latestVersion} is available. Opening APK download...`)
        await openApkDownload(result.downloadUrl)
        setUpdateStatus('ready')
        return
      }

      if (result.status === 'up-to-date') {
        setUpdateStatus('ready')
        setUpdateMessage(`You're up to date${result.currentVersion ? ` on version ${result.currentVersion}` : ''}.`)
        return
      }

      if (result.status === 'no-apk') {
        setUpdateStatus('ready')
        setUpdateMessage('The latest GitHub release does not include an APK asset yet.')
        return
      }

      setUpdateStatus('ready')
      setUpdateMessage('No GitHub release is available yet.')
    } catch (error) {
      setUpdateStatus('error')
      setUpdateMessage(error?.message || 'Could not check for updates.')
    }
  }

  const handleDownloadUpdate = async () => {
    if (!updateResult?.downloadUrl) return
    setUpdateStatus('downloading')
    setUpdateMessage('Opening APK download...')
    await openApkDownload(updateResult.downloadUrl)
    setUpdateStatus('ready')
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-primary text-white sticky top-0 z-40 shadow-lg">
        <div className="h-14 px-4 sm:px-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="Back"
          >
            ←
          </button>
          <div className="min-w-0">
            <h1 className="heading-text text-lg font-bold leading-tight">Advanced Settings</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-5 pb-20 space-y-4">
        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <button
            type="button"
            onClick={() => updateSetting('eInkLightBackground', !normalized.eInkLightBackground)}
            className="w-full flex items-center justify-between gap-4 text-left"
          >
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Pure White Light Background</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Use #ffffff for light-mode page backgrounds.
              </p>
            </div>
            <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${normalized.eInkLightBackground ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${normalized.eInkLightBackground ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </button>
        </section>

        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Content & Communities</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Add public church libraries, or join a community for shared plans, notes, and events.
              </p>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button type="button" onClick={() => navigate('/settings/content-servers')} className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                Content Servers
              </button>
              <button type="button" onClick={() => navigate('/community')} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white">
                Community Home
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Volume Scroll Distance</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {normalized.volumeScrollDistancePercent}% of the current page step
              </p>
            </div>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_VOLUME_SCROLL_DISTANCE_PERCENT}
              max={MAX_VOLUME_SCROLL_DISTANCE_PERCENT}
              step="1"
              value={normalized.volumeScrollDistancePercent}
              onChange={(event) => updateSetting('volumeScrollDistancePercent', event.target.value)}
              aria-label="Volume scroll distance percentage"
              className="w-24 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>

          <input
            type="range"
            min={MIN_VOLUME_SCROLL_DISTANCE_PERCENT}
            max={MAX_VOLUME_SCROLL_DISTANCE_PERCENT}
            step="1"
            value={normalized.volumeScrollDistancePercent}
            onChange={(event) => updateSetting('volumeScrollDistancePercent', event.target.value)}
            aria-label="Volume scroll distance percentage"
            className="mt-4 w-full accent-blue-700"
          />

          <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            100% keeps the existing page distance. Lower values leave more of the previous screen visible, which can help around camera cutouts or other obstructed areas.
          </p>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              ['Short', 60],
              ['Comfort', 75],
              ['Near page', 90],
              ['Current', DEFAULT_VOLUME_SCROLL_DISTANCE_PERCENT],
            ].map(([label, value]) => (
              <button
                key={label}
                type="button"
                onClick={() => updateSetting('volumeScrollDistancePercent', value)}
                className={`rounded-lg border px-2 py-2 text-xs sm:text-sm font-medium transition-colors ${
                  normalized.volumeScrollDistancePercent === value
                    ? 'border-primary bg-primary/10 text-primary dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Volume Scroll Animation</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {normalized.volumeScrollAnimationMs === 0
                  ? 'Instant movement (0 ms)'
                  : `${normalized.volumeScrollAnimationMs} ms`}
              </p>
            </div>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max={MAX_VOLUME_SCROLL_ANIMATION_MS}
              step="10"
              value={normalized.volumeScrollAnimationMs}
              onChange={(event) => updateSetting('volumeScrollAnimationMs', event.target.value)}
              className="w-24 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100"
            />
          </div>

          <input
            type="range"
            min="0"
            max={MAX_VOLUME_SCROLL_ANIMATION_MS}
            step="10"
            value={normalized.volumeScrollAnimationMs}
            onChange={(event) => updateSetting('volumeScrollAnimationMs', event.target.value)}
            className="mt-4 w-full accent-blue-700"
          />

          <div className="mt-3 grid grid-cols-4 gap-2">
            {[
              ['Off', 0],
              ['Fast', 90],
              ['Default', DEFAULT_VOLUME_SCROLL_ANIMATION_MS],
              ['Slow', 360],
            ].map(([label, value]) => (
              <button
                key={label}
                type="button"
                onClick={() => updateSetting('volumeScrollAnimationMs', value)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  normalized.volumeScrollAnimationMs === value
                    ? 'border-primary bg-primary/10 text-primary dark:border-blue-400 dark:bg-blue-500/15 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">App Updates</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {canCheckApkUpdates
                  ? 'Check GitHub Releases for a newer Android APK.'
                  : 'APK update checks are available in the Android app.'}
              </p>
              {updateMessage && (
                <p className={`text-xs mt-2 ${
                  updateStatus === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-600 dark:text-gray-300'
                }`}>
                  {updateMessage}
                </p>
              )}
              {updateResult?.releaseUrl && (
                <a
                  href={updateResult.releaseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs mt-2 text-primary dark:text-blue-300 hover:underline"
                >
                  View latest release
                </a>
              )}
            </div>

            <div className="flex flex-col sm:items-end gap-2">
              <button
                type="button"
                onClick={handleCheckForUpdate}
                disabled={!canCheckApkUpdates || updateStatus === 'checking' || updateStatus === 'downloading'}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {updateStatus === 'checking' ? 'Checking...' : 'Check for update'}
              </button>
              {updateResult?.status === 'update-available' && (
                <button
                  type="button"
                  onClick={handleDownloadUpdate}
                  disabled={updateStatus === 'downloading'}
                  className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-100 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Download APK
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <button
            type="button"
            onClick={() => navigate('/settings/about')}
            className="w-full flex items-center justify-between gap-4 text-left"
          >
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">About Heritage Study Bible</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Read a short overview of the app and its resources.
              </p>
            </div>
            <span className="text-2xl leading-none text-gray-400 dark:text-gray-500">›</span>
          </button>
        </section>
      </main>
    </div>
  )
}

function AboutPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const previousTitle = document.title
    const description = 'Heritage Study Bible is a fast Bible reading app with convenient Bible navigation, reading plans, and historical Christian resources including confessions, commentaries, and books.'
    let metaDescription = document.querySelector('meta[name="description"]')
    const previousDescription = metaDescription?.getAttribute('content') || ''

    document.title = 'About Heritage Study Bible'
    if (!metaDescription) {
      metaDescription = document.createElement('meta')
      metaDescription.setAttribute('name', 'description')
      document.head.appendChild(metaDescription)
    }
    metaDescription.setAttribute('content', description)

    return () => {
      document.title = previousTitle
      if (metaDescription) metaDescription.setAttribute('content', previousDescription)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background dark:bg-black">
      <header className="bg-primary text-white sticky top-0 z-40 shadow-lg">
        <div className="h-14 px-4 sm:px-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            aria-label="Back"
          >
            ←
          </button>
          <div className="min-w-0">
            <h1 className="heading-text text-lg font-bold leading-tight">About</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-6 pb-20">
        <section className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary dark:text-blue-300">
                Heritage Study Bible
              </p>
              <h2 className="heading-text mt-2 text-2xl sm:text-3xl font-bold text-gray-950 dark:text-gray-100">
                A fast, practical Bible reading app.
              </h2>
              <p className="mt-3 text-sm sm:text-base leading-7 text-gray-600 dark:text-gray-300">
                Heritage Study Bible is built around quick Bible navigation, responsive reading, and simple tools that stay out of the way while you read.
              </p>
            </div>
            <img
              src="/icons/bear-hb-small.svg"
              alt=""
              className="mx-auto h-28 w-36 sm:h-32 sm:w-40 object-contain"
              loading="lazy"
            />
          </div>
        </section>

        <section className="mt-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 sm:p-6">
          <h3 className="heading-text text-xl font-bold text-gray-950 dark:text-gray-100">
            What It Offers
          </h3>
          <div className="mt-4 space-y-4 text-sm sm:text-base leading-7 text-gray-600 dark:text-gray-300">
            <p>
              The app emphasizes convenient movement through Scripture: searching, jumping between books and chapters, reading with volume-button scrolling on Android, and keeping the reading experience comfortable across phones, browsers, and e-ink-style screens.
            </p>
            <p>
              It also includes Bible reading plans designed for daily use, with plan-mode navigation, item progress, and space for reflection as you move through each day.
            </p>
            <p>
              Alongside the Bible, Heritage Study Bible gathers Christian and historically adjacent resources such as confessions, commentaries, books, hymns, and other study tools so Scripture can be read with help from the wider Christian tradition.
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 sm:p-6">
          <h3 className="heading-text text-xl font-bold text-gray-950 dark:text-gray-100">
            Why “Heritage”
          </h3>
          <p className="mt-3 text-sm sm:text-base leading-7 text-gray-600 dark:text-gray-300">
            The goal is to make serious Bible reading feel accessible: Scripture first, with historical resources close at hand when they help clarify doctrine, context, worship, or Christian practice.
          </p>
        </section>
      </main>
    </div>
  )
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
  const [bookReferenceChoices, setBookReferenceChoices] = useState([])
  const [toast, setToast] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false) // Start closed
  const [showGoToPassageButton, setShowGoToPassageButton] = useState(false)
  const [isLargeScreen, setIsLargeScreen] = useState(false)
  const [versePositions, setVersePositions] = useState({})
  const [selectedVerse, setSelectedVerse] = useState(null) // Track selected verse
  const [selectedVerses, setSelectedVerses] = useState([])
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [textSelectionSession, setTextSelectionSession] = useState(null)
  const textSelection = useMemo(() => combineBibleTextSelections([
    ...(textSelectionSession?.committed || []),
    textSelectionSession?.draft,
  ].filter(Boolean)), [textSelectionSession])
  const nativeSelectionCollapsedRef = useRef(false)
  const clearTextSelection = useCallback(() => {
    setTextSelectionSession(null)
    nativeSelectionCollapsedRef.current = false
    clearBrowserTextSelection()
  }, [])
  const addAnotherTextSnippet = useCallback(() => {
    setTextSelectionSession(previous => {
      if (!previous?.draft) return previous
      return {
        committed: [...(previous.committed || []), previous.draft],
        draft: null,
        awaitingSnippet: true,
      }
    })
    nativeSelectionCollapsedRef.current = false
    clearBrowserTextSelection()
  }, [])
  const [highlightColor, setHighlightColor] = useState(() => {
    try { return normalizeHighlightColor(localStorage.getItem(STORAGE_KEYS.highlightColor)) } catch { return DEFAULT_HIGHLIGHT_COLOR }
  })
  const rememberHighlightColor = useCallback(color => {
    setHighlightColor(normalizeHighlightColor(color))
  }, [])
  useEffect(() => {
    setStoredValue(STORAGE_KEYS.highlightColor, highlightColor).catch(() => {})
  }, [highlightColor])
  useEffect(() => {
    setNativeTextSelectionMenuSuppressed(true).catch(() => {})
    return () => { setNativeTextSelectionMenuSuppressed(false).catch(() => {}) }
  }, [])
  const multiSelectSnapshotRef = useRef(null)
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
  const [bibleVerseLayout, setBibleVerseLayout] = useState(null)
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
  const [parallelVerseLayout, setParallelVerseLayout] = useState(null)
  const [parallelLoading, setParallelLoading] = useState(false)

  // Load translation data when translationId changes
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setTranslationLoading(true)
      setTranslationLoadError('')
      setBibleData(null)
      setBibleVerseLayout(null)
      try {
        const [data, layout] = await Promise.all([
          loadTranslation(translationId),
          loadTranslationLayout(translationId),
        ])
        if (!cancelled) {
          setBibleData(data)
          setBibleVerseLayout(layout)
        }
      } catch (err) {
        console.error('Failed to load translation:', err)
        if (!cancelled) {
        setBibleData(null)
          setBibleVerseLayout(null)
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
        setParallelVerseLayout(null)
        setParallelLoading(false)
        return
      }

      setParallelLoading(true)
      try {
        const [data, layout] = await Promise.all([
          loadTranslation(parallelTranslationId),
          loadTranslationLayout(parallelTranslationId),
        ])
        if (!cancelled) {
          setParallelBibleData(data)
          setParallelVerseLayout(layout)
        }
      } catch (error) {
        console.error('Failed to load parallel translation:', error)
        if (!cancelled) {
          setParallelMode(false)
          setParallelBibleData(null)
          setParallelVerseLayout(null)
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

  const cancelMultiSelectMode = useCallback(() => {
    const snapshot = multiSelectSnapshotRef.current
    setMultiSelectMode(false)
    setSelectedVerse(snapshot?.selectedVerse || null)
    setSelectedVerses(snapshot?.selectedVerses || [])
    setIsSidebarOpen(Boolean(snapshot?.sidebarOpen))
    setShowGoToPassageButton(Boolean(snapshot?.showGoToPassageButton))
    multiSelectSnapshotRef.current = null
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
      if (event?.defaultPrevented) return

      if (bookReferenceChoices.length) {
        event?.preventDefault?.()
        setBookReferenceChoices([])
        return
      }

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

      if (textSelection) {
        event?.preventDefault?.()
        clearTextSelection()
        return
      }

      if (multiSelectMode) {
        event?.preventDefault?.()
        cancelMultiSelectMode()
      }
    })
  }, [bookReferenceChoices.length, cancelMultiSelectMode, clearTextSelection, multiSelectMode, searchResults, showBookmarkManager, showResources, textSelection])

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
    notes, saveNote, saveNotes, deleteNote, deleteNoteById,
    addHighlight, removeHighlights, isHighlighted, getVerseHighlightColor,
    addTextHighlight, removeTextHighlight, isTextSelectionHighlighted, getTextSelectionHighlight,
    getTextHighlights, saveTextNote,
  } = useBookmarks()

  const existingTextSelectionNote = useMemo(() => (
    textSelection
      ? notes.find(note => textSelectionMatchesAnnotation(textSelection, note)) || null
      : null
  ), [notes, textSelection])

  const activeTextHighlight = textSelection ? getTextSelectionHighlight(textSelection) : null
  const committedTextSelection = useMemo(
    () => combineBibleTextSelections(textSelectionSession?.committed || []),
    [textSelectionSession?.committed]
  )
  const getVisibleTextHighlights = useCallback((book, chapter, verse, selectedTranslationId, verseText) => {
    const savedHighlights = getTextHighlights(book, chapter, verse, selectedTranslationId, verseText)
    const selectionPreviews = (committedTextSelection?.segments || [])
      .filter(segment =>
        segment.book === book
        && segment.chapter === Number(chapter)
        && segment.verse === Number(verse)
        && segment.translationId === selectedTranslationId
      )
      .map(segment => {
        const resolved = resolveTextAnchor(segment, verseText)
        return resolved ? { ...resolved, selectionPreview: true } : null
      })
      .filter(Boolean)
    return [...savedHighlights, ...selectionPreviews]
  }, [committedTextSelection, getTextHighlights])

  useEffect(() => {
    let frame = null
    const updateSelection = () => {
      if (frame != null) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        if (multiSelectMode) {
          setTextSelectionSession(null)
          return
        }
        const browserSelection = window.getSelection()
        const captured = captureBibleTextSelection(browserSelection, bibleContainerRef.current)
        if (!captured) {
          if (browserSelection?.isCollapsed) nativeSelectionCollapsedRef.current = true
          return
        }

        const startedAfterCollapse = nativeSelectionCollapsedRef.current
        nativeSelectionCollapsedRef.current = false
        setIsSidebarOpen(false)
        setShowGoToPassageButton(false)
        setTextSelectionSession(previous => {
          if (!previous) return { committed: [], draft: captured, awaitingSnippet: false }
          const startsAnotherSnippet = previous.awaitingSnippet || (startedAfterCollapse && previous.draft)
          return startsAnotherSnippet
            ? {
                committed: previous.draft
                  ? [...(previous.committed || []), previous.draft]
                  : (previous.committed || []),
                draft: captured,
                awaitingSnippet: false,
              }
            : { ...previous, draft: captured, awaitingSnippet: false }
        })
      })
    }
    document.addEventListener('selectionchange', updateSelection)
    return () => {
      document.removeEventListener('selectionchange', updateSelection)
      if (frame != null) cancelAnimationFrame(frame)
    }
  }, [currentBook, currentChapter, multiSelectMode, parallelMode, translationId])

  useEffect(() => {
    clearTextSelection()
  }, [clearTextSelection, currentBook, currentChapter, parallelMode, translationId])

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
    if (!incoming?.book || incoming?.chapter == null || incoming?.verse == null) return

    const incomingBook = incoming.book
    const incomingChapter = Number(incoming.chapter)
    const incomingVerse = Number(incoming.verse)

    if (!incomingBook || !Number.isInteger(incomingChapter) || !Number.isInteger(incomingVerse)) return

    const verseText = getVerseTextWithPsalmSuperscription(
      bibleData,
      incomingBook,
      incomingChapter,
      incomingVerse,
      translationId
    )

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
    const chapter = currentBookData.chapters.find(c => c.number === currentChapter)
    return withPsalmSuperscriptionVerse(chapter, currentBook, translationId)
  }, [currentBookData, currentBook, currentChapter, translationId])

  const secondaryChapterData = useMemo(() => {
    if (!parallelBibleData || !parallelMode) return null
    const bookData = parallelBibleData.books?.find(b => b.name === currentBook)
    if (!bookData) return null
    const chapter = bookData.chapters.find(c => c.number === currentChapter) || null
    return withPsalmSuperscriptionVerse(chapter, currentBook, parallelTranslationId)
  }, [parallelBibleData, parallelMode, currentBook, currentChapter, parallelTranslationId])

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
    if (textSelection) {
      clearTextSelection()
      setIsSidebarOpen(false)
      setShowGoToPassageButton(false)
      return
    }

    const clickedVerse = { book: currentBook, chapter, verse, text: verseText }

    if (multiSelectMode) {
      setSelectedVerses(prev => {
        const next = toggleVerseInSelection(prev, clickedVerse)
        const clickedIsSelected = next.some(item =>
          item.book === clickedVerse.book
          && item.chapter === clickedVerse.chapter
          && item.verse === clickedVerse.verse
        )
        setSelectedVerse(clickedIsSelected ? clickedVerse : (next[next.length - 1] || null))
        return next
      })
      setIsSidebarOpen(false)
    } else {
      setSelectedVerse(clickedVerse)
      setSelectedVerses([clickedVerse])
      setIsSidebarOpen(true)
    }

    setShowGoToPassageButton(false)
  }

  const beginFullVerseSelection = (verses) => {
    if (!Array.isArray(verses) || verses.length === 0) return
    multiSelectSnapshotRef.current = {
      selectedVerse,
      selectedVerses,
      sidebarOpen: isSidebarOpen,
      showGoToPassageButton,
    }
    clearTextSelection()
    setSelectedVerse(verses[verses.length - 1])
    setSelectedVerses(verses)
    setMultiSelectMode(true)
    setIsSidebarOpen(false)
    setShowGoToPassageButton(false)
  }

  const toggleMultiSelectMode = () => {
    if (multiSelectMode) {
      if (selectedVerses.length === 0) {
        showToast('Select at least one verse first')
        return
      }
      setMultiSelectMode(false)
      setSelectedVerse(selectedVerses[selectedVerses.length - 1])
      setIsSidebarOpen(true)
      multiSelectSnapshotRef.current = null
      return
    }

    const initialVerses = selectedVerses.length > 0
      ? selectedVerses
      : (selectedVerse ? [selectedVerse] : [])
    multiSelectSnapshotRef.current = {
      selectedVerse,
      selectedVerses: initialVerses,
      sidebarOpen: isSidebarOpen,
      showGoToPassageButton,
    }
    setSelectedVerses(initialVerses)
    setMultiSelectMode(true)
    setIsSidebarOpen(false)
    setShowGoToPassageButton(false)
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
      const verseText = v.text || getVerseTextWithPsalmSuperscription(
        bibleData,
        v.book,
        v.chapter,
        v.verse,
        translationId
      )
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

  const handleSaveNoteForVerse = (book, chapter, verse, text, verseText = '', options = {}) => {
    saveNote(book, chapter, verse, text, verseText, options)
    const selected = [{ book, chapter, verse, text: verseText }]
    if (options.highlight === true) {
      const color = normalizeHighlightColor(options.highlightColor || highlightColor)
      rememberHighlightColor(color)
      addHighlight(selected, color)
    } else if (isHighlighted(book, chapter, verse)) {
      removeHighlights(selected)
    }
  }

  const handleSaveNotesForVerses = (verses, text, options = {}) => {
    if (!Array.isArray(verses) || verses.length === 0) {
      showToast('Select at least one verse first')
      return
    }

    const normalized = verses.map(v => {
      const verseBook = v.book || currentBook
      const verseText = v.text || getVerseTextWithPsalmSuperscription(
        bibleData,
        verseBook,
        v.chapter,
        v.verse,
        translationId
      )
      return { book: verseBook, chapter: v.chapter, verse: v.verse, text: verseText }
    })
    saveNotes(normalized, text, options)

    if (options.highlight === true) {
      const color = normalizeHighlightColor(options.highlightColor || highlightColor)
      rememberHighlightColor(color)
      addHighlight(normalized, color)
    } else if (normalized.every(item => isHighlighted(item.book, item.chapter, item.verse))) {
      removeHighlights(normalized)
    }

    if (text.trim()) {
      showToast(verses.length === 1 ? 'Note saved' : `Saved one note for ${verses.length} verses`)
    } else {
      showToast(verses.length === 1 ? 'Note deleted' : 'Grouped note deleted')
    }
  }

  const handleHighlightMultiple = (verses, color = highlightColor, options = {}) => {
    if (!Array.isArray(verses) || verses.length === 0) {
      showToast('Select at least one verse first')
      return
    }

    const normalized = verses.map(v => {
      const book = v.book || currentBook
      return {
        book,
        chapter: v.chapter,
        verse: v.verse,
        text: v.text || getVerseTextWithPsalmSuperscription(
          bibleData,
          book,
          v.chapter,
          v.verse,
          translationId
        ),
      }
    })
    const allSelectedHighlighted = normalized.every(v => isHighlighted(v.book, v.chapter, v.verse))
    if (allSelectedHighlighted && options.force !== true) {
      removeHighlights(normalized)
      showToast(`Removed highlight from ${normalized.length} verse${normalized.length === 1 ? '' : 's'}`)
    } else {
      const normalizedColor = normalizeHighlightColor(color)
      rememberHighlightColor(normalizedColor)
      addHighlight(normalized, normalizedColor)
      showToast(`Highlighted ${normalized.length} verse${normalized.length === 1 ? '' : 's'}`)
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
    setBookReferenceChoices([])

    if (!trimmedQuery) {
      setSearchResults(null)
      setSearchLoading(false)
      return
    }

    const numberedBookChoices = getNumberedBookReferenceChoices(trimmedQuery)
    if (numberedBookChoices.length > 1) {
      setSearchResults(null)
      setSearchLoading(false)
      setBookReferenceChoices(numberedBookChoices)
      return
    }

    if (numberedBookChoices.length === 1) {
      const [choice] = numberedBookChoices
      setSearchQuery('')
      setSearchResults(null)
      setSearchLoading(false)
      if (choice.verse != null) navigateToVerse(choice.book, choice.chapter, choice.verse)
      else handleNavigate(choice.book, choice.chapter)
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
        if (ref.verse != null) {
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
        translationId,
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
          onSearchKeyboardCaptureChange={setNativeSearchKeyboardCaptureInputEnabled}
          onAdvancedSettingsClick={() => navigate('/settings/advanced')}
        />

        {bookReferenceChoices.length > 1 && (
          <BookReferenceChooser
            choices={bookReferenceChoices}
            onChoose={(choice) => {
              setBookReferenceChoices([])
              setSearchQuery('')
              setSearchResults(null)
              if (choice.verse != null) navigateToVerse(choice.book, choice.chapter, choice.verse)
              else handleNavigate(choice.book, choice.chapter)
            }}
            onCancel={() => setBookReferenceChoices([])}
          />
        )}
        
        <div className="flex">
          {/* Main Content */}
          <main
            className={`reader-main flex-1 px-0 sm:px-4 py-2 sm:py-6 transition-all duration-300 ${(multiSelectMode || textSelection) ? 'reader-selecting' : ''}`}
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
                        bookName={currentBook}
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
                        isVerseHighlighted={(ch, verse) => isHighlighted(currentBook, ch, verse)}
                        getVerseHighlightColor={(ch, verse) => getVerseHighlightColor(currentBook, ch, verse)}
                        getTextHighlights={(ch, verse, selectedTranslationId, verseText) =>
                          getVisibleTextHighlights(currentBook, ch, verse, selectedTranslationId, verseText)
                        }
                        notes={notes}
                        onBookmarkToggle={handleBookmarkToggle}
                        onVersePosition={updateVersePosition}
                        textSize={textSize}
                        primaryVerseLayout={bibleVerseLayout}
                        secondaryVerseLayout={parallelVerseLayout}
                        selectionMode={multiSelectMode}
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
                        isVerseHighlighted={(ch, verse) => isHighlighted(currentBook, ch, verse)}
                        getVerseHighlightColor={(ch, verse) => getVerseHighlightColor(currentBook, ch, verse)}
                        getTextHighlights={(ch, verse, selectedTranslationId, verseText) =>
                          getVisibleTextHighlights(currentBook, ch, verse, selectedTranslationId, verseText)
                        }
                        notes={notes}
                        translationId={translationId}
                        onBookmarkToggle={handleBookmarkToggle}
                        onVersePosition={updateVersePosition}
                        textSize={textSize}
                        verseStacking={verseStacking}
                        verseLayout={bibleVerseLayout}
                        selectionMode={multiSelectMode}
                      />
                    )
                  )}

                  {!translationLoading && currentChapterData == null && (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      Unable to find chapter data for <strong>{currentBook} {currentChapter}</strong> in <strong>{translationId}</strong>.
                    </div>
                  )}

                  {/* Toggle Sidebar Button (desktop only — phones use verse tap) */}
                  {!isSidebarOpen && !multiSelectMode && (
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
          {isSidebarOpen && !multiSelectMode && !searchResults && (
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
              onSaveNote={handleSaveNoteForVerse}
              onSaveNotes={handleSaveNotesForVerses}
              isVerseHighlighted={(book, chapter, verse) => isHighlighted(book, chapter, verse)}
              getVerseHighlightColor={(book, chapter, verse) => getVerseHighlightColor(book, chapter, verse)}
              highlightColor={highlightColor}
              onChooseHighlightColor={rememberHighlightColor}
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
            onDeleteNote={(book, chapter, verse, noteId) => {
              if (noteId) deleteNoteById(noteId)
              else deleteNote(book, chapter, verse)
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

        {textSelection && !multiSelectMode && !searchResults && !showBookmarkManager && !showResources && (
          <TextSelectionBar
            selection={textSelection}
            highlighted={Boolean(activeTextHighlight)}
            existingNote={existingTextSelectionNote}
            highlightColor={activeTextHighlight?.color || highlightColor}
            onChooseHighlightColor={rememberHighlightColor}
            onToggleHighlight={(color, options = {}) => {
              if (isTextSelectionHighlighted(textSelection) && options.force !== true) {
                removeTextHighlight(textSelection)
                showToast('Text highlight removed')
              } else {
                const normalizedColor = normalizeHighlightColor(color || highlightColor)
                rememberHighlightColor(normalizedColor)
                addTextHighlight(textSelection, normalizedColor)
                showToast(`${textSelection.snippetCount || 1} text snippet${textSelection.snippetCount === 1 ? '' : 's'} highlighted`)
              }
              clearTextSelection()
            }}
            onAddSnippet={addAnotherTextSnippet}
            onSelectFullVerses={() => beginFullVerseSelection(textSelection.verses)}
            onSaveNote={(text, options) => {
              saveTextNote(textSelection, text, options)
              if (options.highlight === true) {
                const normalizedColor = normalizeHighlightColor(options.highlightColor || highlightColor)
                rememberHighlightColor(normalizedColor)
                addTextHighlight(textSelection, normalizedColor)
              } else if (isTextSelectionHighlighted(textSelection)) {
                removeTextHighlight(textSelection)
              }
              showToast(text.trim() ? 'Note saved' : 'Note deleted')
              clearTextSelection()
            }}
            onCancel={clearTextSelection}
            onShowToast={showToast}
          />
        )}

        {multiSelectMode && !searchResults && !showBookmarkManager && !showResources && (
          <VerseSelectionBar
            bookName={currentBook}
            selectedVerses={selectedVerses}
            translationId={translationId}
            bibleData={bibleData}
            parallelMode={parallelMode}
            parallelTranslationId={parallelTranslationId}
            parallelBibleData={parallelBibleData}
            notes={notes}
            allBookmarked={selectedVerses.length > 0 && selectedVerses.every(item =>
              isBookmarked(item.book || currentBook, item.chapter, item.verse)
            )}
            allHighlighted={selectedVerses.length > 0 && selectedVerses.every(item =>
              isHighlighted(item.book || currentBook, item.chapter, item.verse)
            )}
            highlightColor={selectedVerses
              .map(item => getVerseHighlightColor(item.book || currentBook, item.chapter, item.verse))
              .find(Boolean) || highlightColor}
            onBookmark={() => handleBookmarkMultiple(selectedVerses)}
            onToggleHighlight={(color) => handleHighlightMultiple(selectedVerses, color)}
            onApplyHighlight={(color) => handleHighlightMultiple(selectedVerses, color, { force: true })}
            onChooseHighlightColor={rememberHighlightColor}
            onSaveNotes={handleSaveNotesForVerses}
            onShowToast={showToast}
            onCancel={cancelMultiSelectMode}
            onDone={toggleMultiSelectMode}
          />
        )}

        {/* Bottom Navigation */}
        {!multiSelectMode && !textSelection && !searchResults && !showBookmarkManager && (
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
          <div className={`fixed ${multiSelectMode ? 'bottom-40' : 'bottom-20'} left-1/2 transform -translate-x-1/2 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 px-6 py-3 rounded-lg shadow-lg z-[70] animate-fade-in`}>
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
  const [advancedSettings, setAdvancedSettingsState] = useState(loadAdvancedSettings)

  const setSideButtonScroll = useCallback((enabled) => {
    const next = Boolean(enabled)
    setSideButtonScrollState(next)
    setStoredValue(STORAGE_KEYS.sideButtonScroll, String(next)).catch(() => {})
  }, [])

  const setAdvancedSettings = useCallback((settings) => {
    const normalized = normalizeAdvancedSettings(settings)
    setAdvancedSettingsState(normalized)
    setStoredValue(STORAGE_KEYS.advancedSettings, JSON.stringify(normalized)).catch(() => {})
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('eink-light', advancedSettings.eInkLightBackground)
  }, [advancedSettings.eInkLightBackground])

  useEffect(() => {
    refreshStaleContentServers().catch(() => {})
  }, [])

  return (
    <Router>
      <ScrollToTopOnRouteChange />
      <NativeBackNavigation />
      <AndroidReaderControls
        enabled={sideButtonScroll}
        volumeScrollAnimationMs={advancedSettings.volumeScrollAnimationMs}
        volumeScrollDistancePercent={advancedSettings.volumeScrollDistancePercent}
      />
      <Suspense fallback={<div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">Loading…</div>}>
        <Routes>
          <Route path="/transcript/:transcriptId" element={<TranscriptViewer />} />
          <Route path="/resources/confessions/:itemId" element={<ConfessionViewer />} />
          <Route path="/resources/books/:itemId" element={<BookViewer />} />
          <Route path="/reading-plan-join" element={<ReadingPlanInviteRedirect />} />
          <Route path="/resources/reading-plans/:itemId/note/:day/:noteId" element={<ReadingPlanNoteViewer />} />
          <Route path="/resources/reading-plans/:itemId" element={<ReadingPlanViewer />} />
          <Route path="/resources/tools/:itemId" element={<ToolViewer />} />
          <Route path="/resources/content/:contentKey" element={<RemoteResourceViewer />} />
          <Route path="/resources/:categoryId" element={<ResourcePage />} />
          <Route path="/settings/about" element={<AboutPage />} />
          <Route path="/settings/advanced" element={<AdvancedSettingsPage settings={advancedSettings} onSettingsChange={setAdvancedSettings} />} />
          <Route path="/settings/content-servers" element={<ContentServersPage />} />
          <Route path="/community/callback" element={<CommunityCallbackPage />} />
          <Route path="/community" element={<CommunityHomePage />} />
          <Route path="/:bookSlug/:chapterNum" element={<BibleStudyApp sideButtonScroll={sideButtonScroll} onSideButtonScrollChange={setSideButtonScroll} />} />
          <Route path="/:bookSlug" element={<BibleStudyApp sideButtonScroll={sideButtonScroll} onSideButtonScrollChange={setSideButtonScroll} />} />
          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<Navigate to="/genesis/1" replace />} />
        </Routes>
      </Suspense>
    </Router>
  )
}

export default App
