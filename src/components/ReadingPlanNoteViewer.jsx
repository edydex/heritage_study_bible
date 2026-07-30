import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RESOURCE_CATEGORIES } from '../data/resources'
import ChronologyTimeline from './ChronologyTimeline'
import {
  COMMENTS_ITEM_TYPE,
  PLAN_NOTE_ITEM_TYPE,
  bookToSlug,
  getPlanNotePath,
  getReadingItems,
  isPlanItemComplete,
  loadPlanProgress,
  markPlanItemComplete,
  parsePassageStart,
  saveActiveReadingPlan,
  savePlanProgress,
  togglePlanItem,
} from '../services/readingPlanProgress'

function getPlanNoteSources(item) {
  if (Array.isArray(item?.sourceLinks) && item.sourceLinks.length) {
    return item.sourceLinks.map((source, index) => ({
      key: source.id || source.url || `${source.title || 'source'}-${index}`,
      title: source.title || source.id || 'Source',
      url: source.url || '',
    }))
  }

  const labels = item?.sourceLabels?.length ? item.sourceLabels : item?.sources || []
  return labels.map((label, index) => ({
    key: `${label}-${index}`,
    title: label,
    url: '',
  }))
}

function decodeParam(value) {
  try {
    return decodeURIComponent(value || '')
  } catch {
    return value || ''
  }
}

function ReadingPlanNoteViewer() {
  const { itemId, day, noteId } = useParams()
  const navigate = useNavigate()
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [progressState, setProgressState] = useState(() => loadPlanProgress(itemId))

  const category = RESOURCE_CATEGORIES.find(c => c.id === 'reading-plans')
  const meta = category?.items.find(i => i.id === itemId)

  useEffect(() => {
    setProgressState(loadPlanProgress(itemId))
  }, [itemId])

  useEffect(() => {
    let cancelled = false

    const loadPlan = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`${import.meta.env.BASE_URL}data/reading-plans/${itemId}.json`)
        if (!response.ok) throw new Error('Plan note unavailable')
        const data = await response.json()
        if (!cancelled) {
          setPlan(data)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Plan note unavailable')
          setLoading(false)
        }
      }
    }

    loadPlan()
    return () => { cancelled = true }
  }, [itemId])

  useEffect(() => {
    savePlanProgress(itemId, progressState)
  }, [itemId, progressState])

  const planEntries = useMemo(() => {
    if (!plan?.readings?.length) return []
    return plan.readings.flatMap(reading =>
      getReadingItems(reading).map(item => ({ reading, item }))
    )
  }, [plan])

  const decodedNoteId = decodeParam(noteId)
  const requestedDay = Number(day)
  const currentIndex = useMemo(() => {
    return planEntries.findIndex(({ reading, item }) =>
      Number(reading.day) === requestedDay &&
      item.type === PLAN_NOTE_ITEM_TYPE &&
      (
        item.id === noteId ||
        item.id === decodedNoteId ||
        item.rawNoteId === noteId ||
        item.rawNoteId === decodedNoteId
      )
    )
  }, [decodedNoteId, noteId, planEntries, requestedDay])

  const currentEntry = currentIndex >= 0 ? planEntries[currentIndex] : null
  const previousEntry = currentIndex > 0 ? planEntries[currentIndex - 1] : null
  const nextEntry = currentIndex >= 0 ? planEntries[currentIndex + 1] : null
  const noteItem = currentEntry?.item || null
  const reading = currentEntry?.reading || null
  const done = noteItem ? isPlanItemComplete(progressState, reading.day, noteItem.id) : false
  const sourceItems = useMemo(() => getPlanNoteSources(noteItem), [noteItem])
  const usesSituationalTimeline = noteItem?.timeline?.presentation === 'situational'

  useEffect(() => {
    if (!reading || !noteItem) return
    saveActiveReadingPlan({
      planId: itemId,
      planTitle: plan?.title || meta?.title || 'Reading Plan',
      day: reading.day,
      itemId: noteItem.id,
    })
  }, [itemId, meta?.title, noteItem, plan?.title, reading])

  const updateProgress = (updater) => {
    setProgressState(prev => updater(prev))
  }

  const goToEntry = (entry) => {
    if (!entry) return
    const { reading: targetReading, item } = entry
    saveActiveReadingPlan({
      planId: itemId,
      planTitle: plan?.title || meta?.title || 'Reading Plan',
      day: targetReading.day,
      itemId: item.id,
    })

    if (item.type === PLAN_NOTE_ITEM_TYPE) {
      const notePath = getPlanNotePath(itemId, targetReading.day, item.id)
      if (notePath) navigate(notePath)
      return
    }

    if (item.type === COMMENTS_ITEM_TYPE) {
      const firstBibleItem = getReadingItems(targetReading).find(row => row.type === 'chapter')
      if (firstBibleItem?.book && firstBibleItem?.chapter) {
        navigate(`/${bookToSlug(firstBibleItem.book)}/${firstBibleItem.chapter}`)
      } else {
        navigate(`/resources/reading-plans/${itemId}?day=${targetReading.day}`)
      }
      return
    }

    const parsed = item.book && item.chapter
      ? { book: item.book, chapter: item.chapter }
      : parsePassageStart(item.passage)
    if (parsed) navigate(`/${bookToSlug(parsed.book)}/${parsed.chapter}`)
  }

  const handleToggle = () => {
    if (!reading || !noteItem) return
    updateProgress(prev => togglePlanItem(prev, reading, noteItem.id))
  }

  const handleNext = () => {
    if (!reading || !noteItem) return
    updateProgress(prev => markPlanItemComplete(prev, reading, noteItem.id))
    goToEntry(nextEntry)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(`/resources/reading-plans/${itemId}?day=${requestedDay || 1}`)}
            className="text-sm font-semibold text-primary dark:text-blue-300"
          >
            Back to Plan
          </button>
          <div className="min-w-0 text-center">
            <p className="text-xs uppercase text-gray-500 dark:text-gray-400 font-semibold">
              Day {requestedDay || ''}
            </p>
            <h1 className="truncate text-sm font-bold text-gray-950 dark:text-gray-100">
              {plan?.title || meta?.title || 'Reading Plan'}
            </h1>
          </div>
          <button
            onClick={handleToggle}
            disabled={!noteItem}
            className={`text-sm font-semibold ${done ? 'text-primary dark:text-blue-300' : 'text-gray-600 dark:text-gray-300 disabled:text-gray-400'}`}
          >
            {done ? 'Done' : 'Mark Done'}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-7">
        {loading && (
          <div className="py-16 text-center text-gray-500 dark:text-gray-400 animate-pulse">
            Loading note...
          </div>
        )}

        {error && !loading && (
          <div className="py-16 text-center">
            <p className="font-semibold text-gray-900 dark:text-gray-100">Plan note unavailable</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error}</p>
          </div>
        )}

        {!loading && !error && !noteItem && (
          <div className="py-16 text-center">
            <p className="font-semibold text-gray-900 dark:text-gray-100">Plan note not found</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              This note may have moved when the plan was regenerated.
            </p>
          </div>
        )}

        {!loading && !error && noteItem && (
          <>
            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 sm:p-6">
              {!usesSituationalTimeline && (
                <>
                  <p className="text-xs uppercase font-semibold text-amber-700 dark:text-amber-300">
                    Chronology Note
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-gray-950 dark:text-gray-100">
                    {noteItem.label}
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-gray-700 dark:text-gray-200">
                    {noteItem.note}
                  </p>
                </>
              )}

              <ChronologyTimeline
                detailsText={noteItem.note}
                sources={sourceItems}
                timeline={noteItem.timeline}
              />

              {!usesSituationalTimeline && sourceItems.length > 0 && (
                <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sources</h3>
                  <ul className="mt-2 space-y-2">
                    {sourceItems.map(source => (
                      <li key={source.key} className="text-sm text-gray-600 dark:text-gray-300">
                        {source.url ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary dark:text-blue-300 underline underline-offset-2"
                          >
                            {source.title}
                          </a>
                        ) : (
                          <span>{source.title}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => goToEntry(previousEntry)}
                disabled={!previousEntry}
                className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 disabled:text-gray-400 disabled:opacity-60"
              >
                Previous
              </button>
              <button
                onClick={handleNext}
                disabled={!nextEntry}
                className="px-4 py-3 rounded-lg bg-primary text-white text-sm font-semibold disabled:bg-gray-300 dark:disabled:bg-gray-700"
              >
                Next
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default ReadingPlanNoteViewer
