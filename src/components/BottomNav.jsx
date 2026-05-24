import { useEffect, useMemo, useRef, useState } from 'react'
import {
  COMMENTS_ITEM_TYPE,
  clearActiveReadingPlan,
  getFirstIncompleteItem,
  getNextPlanDay,
  getPlanItemById,
  getPlanItemForChapter,
  getPlanItemNeighbor,
  getPlanModeLabel,
  getReadingItems,
  isPlanItemComplete,
  loadPlanGroups,
  loadPlanProgress,
  markPlanItemComplete,
  parsePassageStart,
  planNotesApi,
  saveActiveReadingPlan,
  savePlanProgress,
  setPlanDayNote,
  togglePlanItem,
} from '../services/readingPlanProgress'

function BottomNav({ 
  currentBook, 
  currentChapter, 
  books = [],
  onNavigate,
  onPrevious, 
  onNext,
  hasPrevious,
  hasNext,
  isSidebarOpen = false,
  sidebarWidth = 540,
  activePlan = null,
  onPlanNavigate = null
}) {
  const [showPicker, setShowPicker] = useState(false)
  const [showPlanPanel, setShowPlanPanel] = useState(false)
  const [pickerView, setPickerView] = useState('book') // 'book' or 'chapter'
  const [selectedBook, setSelectedBook] = useState(null)
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [isDraggingPanel, setIsDraggingPanel] = useState(false)
  const [activePlanData, setActivePlanData] = useState(null)
  const [activePlanProgress, setActivePlanProgress] = useState(null)
  const [activePlanLoading, setActivePlanLoading] = useState(false)
  const [groupState, setGroupState] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [commentAnswerText, setCommentAnswerText] = useState('')
  const [planPanelMessage, setPlanPanelMessage] = useState('')
  const [planPanelBusy, setPlanPanelBusy] = useState(false)
  const dragCleanupRef = useRef(null)
  const overlayHistoryRef = useRef(false)
  const overlayClosingFromBackRef = useRef(false)
  const pendingOverlayCallbackRef = useRef(null)
  const dragStateRef = useRef({
    active: false,
    startY: 0,
    startTime: 0,
  })

  const getClientY = (event) => {
    if (!event) return 0
    if (typeof event.clientY === 'number') return event.clientY
    if (event.touches?.[0]?.clientY) return event.touches[0].clientY
    if (event.changedTouches?.[0]?.clientY) return event.changedTouches[0].clientY
    return 0
  }

  const clearDragListeners = () => {
    if (dragCleanupRef.current) {
      dragCleanupRef.current()
      dragCleanupRef.current = null
    }
  }

  const handleBookSelect = (book) => {
    setSelectedBook(book)
    setPickerView('chapter')
  }

  const handleChapterSelect = (chapter) => {
    const bookName = selectedBook?.name
    if (!bookName) return
    closeBottomOverlayForNavigation(() => onNavigate(bookName, chapter))
  }

  const closeBottomOverlayState = () => {
    clearDragListeners()
    setShowPicker(false)
    setShowPlanPanel(false)
    setPickerView('book')
    setSelectedBook(null)
    setDragOffsetY(0)
    setIsDraggingPanel(false)
    dragStateRef.current.active = false
  }

  const handleClose = () => {
    if (overlayHistoryRef.current && typeof window !== 'undefined' && !overlayClosingFromBackRef.current) {
      overlayClosingFromBackRef.current = true
      window.history.back()
      return
    }

    closeBottomOverlayState()
  }

  const closeBottomOverlayForNavigation = (callback) => {
    if (overlayHistoryRef.current && typeof window !== 'undefined' && !overlayClosingFromBackRef.current) {
      pendingOverlayCallbackRef.current = callback
      overlayClosingFromBackRef.current = true
      window.history.back()
      return
    }

    closeBottomOverlayState()
    if (callback) callback()
  }

  const beginPanelDrag = (clientY) => {
    clearDragListeners()
    dragStateRef.current.active = true
    dragStateRef.current.startY = clientY
    dragStateRef.current.startTime = Date.now()
    setIsDraggingPanel(true)

    const handleMove = (event) => {
      if (!dragStateRef.current.active) return
      movePanelDrag(getClientY(event))
      if (event.cancelable) event.preventDefault()
    }

    const handleEnd = (event) => {
      endPanelDrag(getClientY(event))
      clearDragListeners()
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleEnd)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', handleEnd)
    window.addEventListener('touchcancel', handleEnd)

    dragCleanupRef.current = () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleEnd)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleEnd)
      window.removeEventListener('touchcancel', handleEnd)
    }
  }

  const movePanelDrag = (clientY) => {
    if (!dragStateRef.current.active) return
    const delta = Math.max(0, clientY - dragStateRef.current.startY)
    setDragOffsetY(delta)
  }

  const endPanelDrag = (clientY) => {
    if (!dragStateRef.current.active) return
    const delta = Math.max(0, clientY - dragStateRef.current.startY)
    const elapsed = Math.max(1, Date.now() - dragStateRef.current.startTime)
    const velocity = delta / elapsed

    dragStateRef.current.active = false
    setIsDraggingPanel(false)

    // Close on pull distance or quick downward flick.
    if (delta > 90 || (delta > 20 && velocity > 0.5)) {
      handleClose()
      return
    }

    setDragOffsetY(0)
  }

  useEffect(() => () => clearDragListeners(), [])

  useEffect(() => {
    const overlayOpen = showPicker || showPlanPanel
    if (!overlayOpen || overlayHistoryRef.current || typeof window === 'undefined') return

    const currentState = window.history.state || {}
    window.history.pushState({ ...currentState, heritageBottomOverlay: true }, '', window.location.href)
    overlayHistoryRef.current = true
  }, [showPicker, showPlanPanel])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handlePopState = () => {
      if (!overlayHistoryRef.current) return

      overlayHistoryRef.current = false
      overlayClosingFromBackRef.current = false
      closeBottomOverlayState()

      const pendingCallback = pendingOverlayCallbackRef.current
      pendingOverlayCallbackRef.current = null
      if (pendingCallback) window.setTimeout(pendingCallback, 0)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!activePlan?.planId) {
      setActivePlanData(null)
      setActivePlanProgress(null)
      setShowPlanPanel(false)
      return
    }

    let cancelled = false
    const loadPlan = async () => {
      setActivePlanLoading(true)
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/reading-plans/${activePlan.planId}.json`)
        if (!response.ok) throw new Error('Plan not found')
        const data = await response.json()
        if (cancelled) return
        setActivePlanData(data)
        setActivePlanProgress(loadPlanProgress(activePlan.planId))
      } catch {
        if (!cancelled) {
          setActivePlanData(null)
          setActivePlanProgress(loadPlanProgress(activePlan.planId))
        }
      } finally {
        if (!cancelled) setActivePlanLoading(false)
      }
    }

    loadPlan()
    return () => { cancelled = true }
  }, [activePlan?.planId, activePlan?.updatedAt])

  const groupRecord = activePlan?.planId ? loadPlanGroups()[activePlan.planId] : null
  const groupToken = groupRecord?.participantToken || groupRecord?.leaderToken || null

  useEffect(() => {
    if (!activePlan?.groupId || !groupToken) {
      setGroupState(null)
      return
    }

    let cancelled = false
    planNotesApi.getGroupState(activePlan.groupId, groupToken)
      .then(state => {
        if (!cancelled) setGroupState(state)
      })
      .catch(() => {
        if (!cancelled) setPlanPanelMessage('Group questions are unavailable right now.')
      })

    return () => { cancelled = true }
  }, [activePlan?.groupId, groupToken])

  // Toggle: should the book/chapter picker avoid overlapping the commentary sidebar?
  // Set to false to make the picker full-width again.
  const PICKER_RESPECTS_SIDEBAR = true

  const pickerRightStyle = PICKER_RESPECTS_SIDEBAR && isSidebarOpen
    ? { right: `${sidebarWidth}px` }
    : { right: 0 }

  // Group books by testament
  const oldTestament = books.filter((_, i) => i < 39)
  const newTestament = books.filter((_, i) => i >= 39)
  const activePlanReading = useMemo(() => {
    if (!activePlanData?.readings?.length || !activePlan?.day) return null
    return activePlanData.readings.find(reading => Number(reading.day) === Number(activePlan.day)) || null
  }, [activePlan?.day, activePlanData])
  const activePlanItems = useMemo(() => getReadingItems(activePlanReading), [activePlanReading])
  const nextPlanItem = useMemo(() => {
    if (!activePlanReading || !activePlanProgress) return null
    return getFirstIncompleteItem(activePlanReading, activePlanProgress)
  }, [activePlanProgress, activePlanReading])
  const currentPlanItem = useMemo(() => {
    if (!activePlanReading) return null
    return getPlanItemById(activePlanReading, activePlan?.itemId)
      || getPlanItemForChapter(activePlanReading, currentBook, currentChapter)
      || nextPlanItem
      || activePlanItems[0]
  }, [activePlan?.itemId, activePlanItems, activePlanReading, currentBook, currentChapter, nextPlanItem])
  const previousPlanItem = useMemo(
    () => getPlanItemNeighbor(activePlanReading, currentPlanItem?.id, 'previous'),
    [activePlanReading, currentPlanItem?.id]
  )
  const followingPlanItem = useMemo(
    () => getPlanItemNeighbor(activePlanReading, currentPlanItem?.id, 'next'),
    [activePlanReading, currentPlanItem?.id]
  )
  const currentItemDone = activePlanProgress && currentPlanItem
    ? isPlanItemComplete(activePlanProgress, activePlan.day, currentPlanItem.id)
    : false
  const selectedQuestions = useMemo(() => {
    const questions = groupState?.questions || []
    return questions.filter(question => Number(question.day) === Number(activePlan?.day))
  }, [activePlan?.day, groupState])
  const selectedAnswers = useMemo(() => {
    const answers = groupState?.answers || []
    return answers.filter(answer => Number(answer.day) === Number(activePlan?.day))
  }, [activePlan?.day, groupState])

  useEffect(() => {
    if (!activePlan?.day || !activePlanProgress) {
      setCommentText('')
      return
    }
    setCommentText(activePlanProgress.dayNotes?.[activePlan.day] || '')
  }, [activePlan?.day, activePlanProgress])

  const updateActivePlanProgress = (updater) => {
    if (!activePlan?.planId) return
    setActivePlanProgress(prev => {
      const next = updater(prev || loadPlanProgress(activePlan.planId))
      savePlanProgress(activePlan.planId, next)
      return next
    })
  }

  const completeCurrentChapterItem = () => {
    if (!activePlan?.planId || !activePlanReading || !currentPlanItem || currentPlanItem.type !== 'chapter') return
    updateActivePlanProgress(prev => markPlanItemComplete(prev, activePlanReading, currentPlanItem.id))
  }

  const openPlanItem = (item, { showPanelForComments = true } = {}) => {
    if (!activePlan?.planId || !activePlanReading || !item) return
    saveActiveReadingPlan({
      ...activePlan,
      planTitle: activePlanData?.title || activePlan.planTitle,
      day: activePlanReading.day,
      itemId: item.id,
    })

    if (item.type === COMMENTS_ITEM_TYPE) {
      if (showPanelForComments) setShowPlanPanel(true)
      return
    }

    const parsed = item.book && item.chapter ? { book: item.book, chapter: item.chapter } : parsePassageStart(item.passage)
    if (!parsed) return
    closeBottomOverlayForNavigation(() => {
      if (typeof onPlanNavigate === 'function') {
        onPlanNavigate(parsed.book, parsed.chapter)
      } else {
        onNavigate(parsed.book, parsed.chapter)
      }
    })
  }

  const handlePlanPrevious = () => {
    if (!activePlan?.planId) {
      onPrevious()
      return
    }
    if (!previousPlanItem) return
    if (currentPlanItem?.type === 'chapter') completeCurrentChapterItem()
    openPlanItem(previousPlanItem)
  }

  const handlePlanNext = () => {
    if (!activePlan?.planId) {
      onNext()
      return
    }
    if (currentPlanItem?.type === COMMENTS_ITEM_TYPE) {
      setShowPlanPanel(true)
      return
    }
    completeCurrentChapterItem()
    if (followingPlanItem) openPlanItem(followingPlanItem)
  }

  const handleClosePlanMode = () => {
    clearActiveReadingPlan()
    handleClose()
  }

  const handleSaveComments = () => {
    if (!activePlan?.planId || !activePlanReading) return
    const commentsItem = activePlanItems.find(item => item.type === COMMENTS_ITEM_TYPE)
    updateActivePlanProgress(prev => {
      const withNote = setPlanDayNote(prev, activePlan.day, commentText)
      return commentsItem ? markPlanItemComplete(withNote, activePlanReading, commentsItem.id) : withNote
    })
    setPlanPanelMessage('Comments saved.')
  }

  const handleNextPlanDay = () => {
    const nextDay = getNextPlanDay(activePlanData, activePlan?.day)
    if (!nextDay) {
      handleClosePlanMode()
      return
    }
    const nextItem = getFirstIncompleteItem(nextDay, activePlanProgress) || getReadingItems(nextDay)[0]
    saveActiveReadingPlan({
      ...activePlan,
      day: nextDay.day,
      itemId: nextItem?.id || null,
    })
    if (nextItem?.type === COMMENTS_ITEM_TYPE) {
      setShowPlanPanel(true)
      return
    }
    const parsed = nextItem?.book && nextItem?.chapter ? { book: nextItem.book, chapter: nextItem.chapter } : parsePassageStart(nextItem?.passage)
    if (parsed && typeof onPlanNavigate === 'function') {
      closeBottomOverlayForNavigation(() => onPlanNavigate(parsed.book, parsed.chapter))
    }
  }

  const handleSubmitGroupAnswer = async () => {
    if (!activePlan?.groupId || !groupToken || !commentAnswerText.trim()) return
    setPlanPanelBusy(true)
    try {
      await planNotesApi.submitAnswer(activePlan.groupId, groupToken, {
        planId: activePlan.planId,
        day: activePlan.day,
        text: commentAnswerText.trim(),
      })
      setCommentAnswerText('')
      const state = await planNotesApi.getGroupState(activePlan.groupId, groupToken)
      setGroupState(state)
      setPlanPanelMessage('Answer shared.')
    } catch {
      setPlanPanelMessage('Could not share that answer yet.')
    } finally {
      setPlanPanelBusy(false)
    }
  }

  const openFullPlan = () => {
    if (!activePlan?.planId) return
    if (typeof onPlanNavigate === 'function') {
      closeBottomOverlayForNavigation(() => onPlanNavigate(null, null, `/resources/reading-plans/${activePlan.planId}`))
    }
  }

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-40 safe-area-bottom transition-all duration-300"
        style={{ right: isSidebarOpen ? `${sidebarWidth}px` : 0 }}
      >
        <div className="flex items-center justify-between h-14 px-2">
          {/* Previous Button */}
          <button
            onClick={handlePlanPrevious}
            disabled={activePlan?.planId ? !previousPlanItem : !hasPrevious}
            className="flex items-center justify-center w-14 h-full text-primary dark:text-blue-400 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
            aria-label={activePlan?.planId ? 'Previous plan item' : 'Previous chapter'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Chapter Selector Button */}
          <button
            onClick={() => activePlan?.planId ? setShowPlanPanel(true) : setShowPicker(true)}
            className="flex-1 min-w-0 flex items-center justify-center gap-2 h-full mx-2 rounded-lg active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
          >
            <span className="text-base font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[160px] sm:max-w-[200px]">
              {activePlan?.planId ? getPlanModeLabel(currentPlanItem, currentBook, currentChapter) : `${currentBook} ${currentChapter}`}
            </span>
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Next Button */}
          <button
            onClick={handlePlanNext}
            disabled={activePlan?.planId ? (!followingPlanItem && currentPlanItem?.type !== COMMENTS_ITEM_TYPE) : !hasNext}
            className="flex items-center justify-center w-14 h-full text-primary dark:text-blue-400 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
            aria-label={activePlan?.planId ? 'Next plan item' : 'Next chapter'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Book/Chapter Picker Modal */}
      {showPicker && (
        <div
          className="fixed inset-0 z-50 transition-all duration-300"
          style={pickerRightStyle}
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={handleClose}
          />

          {/* Picker Panel */}
          <div
            className={`absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl safe-area-bottom max-h-[80vh] flex flex-col ${isDraggingPanel ? '' : 'animate-slide-up'}`}
            style={{
              transform: `translateY(${dragOffsetY}px)`,
              transition: isDraggingPanel ? 'none' : 'transform 180ms ease-out',
            }}
          >
            {/* Handle */}
            <div
              className="flex justify-center py-3 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
              onMouseDown={(e) => beginPanelDrag(e.clientY)}
              onTouchStart={(e) => beginPanelDrag(e.touches[0]?.clientY || 0)}
            >
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              {pickerView === 'chapter' ? (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setPickerView('book')}
                    className="p-1 -ml-1 text-primary dark:text-blue-400"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{selectedBook?.name}</h3>
                </div>
              ) : (
                <h3 className="text-lg font-semibold text-center text-gray-800 dark:text-gray-200">Select Book</h3>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {pickerView === 'book' ? (
                <div className="p-4">
                  {/* Old Testament */}
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Old Testament</h4>
                  <div className="grid grid-cols-3 gap-1.5 mb-4">
                    {oldTestament.map(book => (
                      <button
                        key={book.name}
                        onClick={() => handleBookSelect(book)}
                        className={`px-2 py-2 text-sm rounded-lg text-left transition-all truncate ${
                          book.name === currentBook
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 active:bg-gray-200 dark:active:bg-gray-600'
                        }`}
                      >
                        {book.name}
                      </button>
                    ))}
                  </div>
                  
                  {/* New Testament */}
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">New Testament</h4>
                  <div className="grid grid-cols-3 gap-1.5">
                    {newTestament.map(book => (
                      <button
                        key={book.name}
                        onClick={() => handleBookSelect(book)}
                        className={`px-2 py-2 text-sm rounded-lg text-left transition-all truncate ${
                          book.name === currentBook
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 active:bg-gray-200 dark:active:bg-gray-600'
                        }`}
                      >
                        {book.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 lg:p-6">
                  <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-2 lg:gap-1.5">
                    {Array.from({ length: selectedBook?.chapters || 0 }, (_, i) => i + 1).map(num => (
                      <button
                        key={num}
                        onClick={() => handleChapterSelect(num)}
                        className={`aspect-square flex items-center justify-center rounded-xl lg:rounded-lg text-lg lg:text-sm font-medium transition-all ${
                          num === currentChapter && selectedBook?.name === currentBook
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-200'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cancel Button */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
              <button
                onClick={handleClose}
                className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium active:bg-gray-200 dark:active:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showPlanPanel && activePlan?.planId && (
        <div
          className="fixed inset-0 z-50 transition-all duration-300"
          style={pickerRightStyle}
        >
          <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
          <div
            className={`absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl safe-area-bottom max-h-[82vh] flex flex-col ${isDraggingPanel ? '' : 'animate-slide-up'}`}
            style={{
              transform: `translateY(${dragOffsetY}px)`,
              transition: isDraggingPanel ? 'none' : 'transform 180ms ease-out',
            }}
          >
            <div
              className="flex justify-center py-3 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
              onMouseDown={(e) => beginPanelDrag(e.clientY)}
              onTouchStart={(e) => beginPanelDrag(e.touches[0]?.clientY || 0)}
            >
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>

            <div className="px-5 pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {activePlanData?.title || activePlan.planTitle || 'Reading Plan'}
                  </p>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Day {activePlan.day}
                  </h3>
                </div>
                <button
                  onClick={openFullPlan}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                >
                  Open Plan
                </button>
                <button
                  onClick={handleClosePlanMode}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300"
                >
                  Close Plan
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-2">
              {activePlanLoading && (
                <p className="py-8 text-center text-gray-500 dark:text-gray-400 animate-pulse">Loading plan...</p>
              )}

              {!activePlanLoading && activePlanItems.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  This plan day is not available offline yet.
                </p>
              )}

              {activePlanItems.map(item => {
                const done = activePlanProgress ? isPlanItemComplete(activePlanProgress, activePlan.day, item.id) : false
                const active = currentPlanItem?.id === item.id
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 py-4 border-b border-gray-100 dark:border-gray-700 ${active ? 'bg-primary/5 dark:bg-blue-500/10 -mx-3 px-3 rounded-lg border-b-transparent' : ''}`}
                  >
                    <button
                      onClick={() => updateActivePlanProgress(prev => togglePlanItem(prev, activePlanReading, item.id))}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        done
                          ? 'bg-primary border-primary text-white'
                          : 'border-gray-300 dark:border-gray-600 text-transparent'
                      }`}
                      aria-label={done ? `Mark ${item.label} incomplete` : `Mark ${item.label} complete`}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => {
                        if (currentPlanItem?.type === 'chapter' && currentPlanItem.id !== item.id) completeCurrentChapterItem()
                        openPlanItem(item)
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className={`block text-lg ${done ? 'text-gray-500 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                        {item.label}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {item.type === COMMENTS_ITEM_TYPE ? (done ? 'Finished' : 'Talk it over') : (done ? 'Finished' : 'Tap to read')}
                      </span>
                    </button>
                    <span className="text-2xl text-gray-400 dark:text-gray-500">›</span>
                  </div>
                )
              })}

              {currentPlanItem?.type === COMMENTS_ITEM_TYPE && (
                <div className="py-5 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Comments
                    </label>
                    <textarea
                      value={commentText}
                      onChange={event => setCommentText(event.target.value)}
                      rows={4}
                      autoComplete="on"
                      autoCorrect="on"
                      spellCheck={true}
                      placeholder="Write thoughts, notes, or prayer points from today's reading."
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                    <button
                      onClick={handleSaveComments}
                      className="mt-2 w-full py-2 rounded-lg bg-primary text-white font-semibold"
                    >
                      Mark Comments Done
                    </button>
                  </div>

                  {selectedQuestions.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Questions</h4>
                      {selectedQuestions.map(question => (
                        <div key={question.id || question.text} className="rounded-lg bg-gray-50 dark:bg-gray-700/60 p-3">
                          <p className="text-sm text-gray-900 dark:text-gray-100">{question.text}</p>
                        </div>
                      ))}
                      <textarea
                        value={commentAnswerText}
                        onChange={event => setCommentAnswerText(event.target.value)}
                        rows={3}
                        autoComplete="on"
                        autoCorrect="on"
                        spellCheck={true}
                        placeholder="Answer for the group"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                      <button
                        onClick={handleSubmitGroupAnswer}
                        disabled={planPanelBusy || !commentAnswerText.trim()}
                        className="w-full py-2 rounded-lg bg-primary text-white font-semibold disabled:opacity-60"
                      >
                        Share Answer
                      </button>
                    </div>
                  )}

                  {selectedAnswers.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Group Answers</h4>
                      {selectedAnswers.map(answer => (
                        <div key={answer.id || `${answer.memberId}-${answer.createdAt}`} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{answer.displayName || 'Reader'}</p>
                          <p className="text-sm text-gray-800 dark:text-gray-100">{answer.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {currentItemDone && (
                    <div className="rounded-lg border border-primary/30 dark:border-blue-500/30 bg-primary/5 dark:bg-blue-500/10 p-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                        Day {activePlan.day} is done.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          onClick={handleNextPlanDay}
                          className="py-2 rounded-lg bg-primary text-white font-semibold"
                        >
                          Next Plan Day
                        </button>
                        <button
                          onClick={handleClosePlanMode}
                          className="py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold"
                        >
                          Exit Plan Mode
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {planPanelMessage && (
                <p className="py-2 text-xs text-amber-600 dark:text-amber-300">{planPanelMessage}</p>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => {
                  if (currentPlanItem?.type === 'chapter') completeCurrentChapterItem()
                  openPlanItem(nextPlanItem || activePlanItems[0])
                }}
                disabled={!activePlanItems.length}
                className="w-full py-3 rounded-full bg-gray-950 dark:bg-gray-100 text-white dark:text-gray-950 font-bold disabled:opacity-50"
              >
                {nextPlanItem?.type === COMMENTS_ITEM_TYPE ? 'Talk It Over' : 'Continue Reading'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default BottomNav
