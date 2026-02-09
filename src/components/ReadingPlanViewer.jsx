import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { RESOURCE_CATEGORIES } from '../data/resources'

const PLAN_CACHE_VERSION = 1
const PROGRESS_VERSION = 2

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // no-op
  }
}

function todayIsoDate() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseIsoDate(dateText) {
  if (!dateText || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null
  const [y, m, d] = dateText.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function normalizeCompletedDays(days, totalDays = Number.POSITIVE_INFINITY) {
  if (!Array.isArray(days)) return []
  const unique = new Set()
  for (const value of days) {
    const day = Number(value)
    if (Number.isInteger(day) && day >= 1 && day <= totalDays) unique.add(day)
  }
  return [...unique].sort((a, b) => a - b)
}

function loadProgressState(itemId) {
  const key = `heritage-plan-progress-v${PROGRESS_VERSION}-${itemId}`
  const saved = readJson(key)

  if (saved && Array.isArray(saved.completedDays)) {
    return {
      version: PROGRESS_VERSION,
      completedDays: normalizeCompletedDays(saved.completedDays),
      startedOn: typeof saved.startedOn === 'string' ? saved.startedOn : null,
      updatedAt: saved.updatedAt || null,
    }
  }

  // Migrate v1 shape where the value was a plain array.
  const oldArray = readJson(`heritage-plan-${itemId}`)
  if (Array.isArray(oldArray)) {
    return {
      version: PROGRESS_VERSION,
      completedDays: normalizeCompletedDays(oldArray),
      startedOn: null,
      updatedAt: null,
    }
  }

  return {
    version: PROGRESS_VERSION,
    completedDays: [],
    startedOn: null,
    updatedAt: null,
  }
}

function parsePassageStart(passage) {
  // Supports references like "Genesis 1-3" or "John 3".
  const match = String(passage || '').match(/^(.+?)\s+(\d+)(?::\d+)?(?:-\d+(?::\d+)?)?$/)
  if (!match) return null
  return {
    book: match[1],
    chapter: Number(match[2]),
  }
}

function bookToSlug(bookName) {
  return String(bookName || '').toLowerCase().replace(/\s+/g, '-')
}

function ReadingPlanViewer() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cacheNotice, setCacheNotice] = useState('')
  const [filterMode, setFilterMode] = useState('all')

  const category = RESOURCE_CATEGORIES.find(c => c.id === 'reading-plans')
  const meta = category?.items.find(i => i.id === itemId)

  const [progressState, setProgressState] = useState(() => loadProgressState(itemId))

  useEffect(() => {
    setProgressState(loadProgressState(itemId))
  }, [itemId])

  useEffect(() => {
    const key = `heritage-plan-progress-v${PROGRESS_VERSION}-${itemId}`
    writeJson(key, progressState)
  }, [itemId, progressState])

  useEffect(() => {
    let cancelled = false

    const loadPlan = async () => {
      const cacheKey = `heritage-plan-cache-v${PLAN_CACHE_VERSION}-${itemId}`
      const cached = readJson(cacheKey)

      setError(null)
      setCacheNotice('')

      if (cached?.data) {
        setPlan(cached.data)
        setLoading(false)
      } else {
        setLoading(true)
      }

      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/reading-plans/${itemId}.json`)
        if (!response.ok) throw new Error('Plan not found')
        const data = await response.json()

        if (cancelled) return

        setPlan(data)
        setLoading(false)
        setCacheNotice('')

        writeJson(cacheKey, {
          itemId,
          version: PLAN_CACHE_VERSION,
          cachedAt: new Date().toISOString(),
          data,
        })
      } catch (err) {
        if (cancelled) return

        if (cached?.data) {
          setPlan(cached.data)
          setCacheNotice('Offline fallback: using your cached copy of this reading plan.')
          setLoading(false)
        } else {
          setError(err.message)
          setLoading(false)
        }
      }
    }

    loadPlan()
    return () => { cancelled = true }
  }, [itemId])

  const completedDays = useMemo(
    () => normalizeCompletedDays(progressState.completedDays, plan?.totalDays || Number.POSITIVE_INFINITY),
    [plan?.totalDays, progressState.completedDays]
  )

  const completedSet = useMemo(() => new Set(completedDays), [completedDays])

  const startedOn = progressState.startedOn || ''

  const todayDay = useMemo(() => {
    if (!plan?.totalDays || !startedOn) return null
    const start = parseIsoDate(startedOn)
    if (!start) return null

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const diff = Math.floor((today - start) / 86400000) + 1

    if (diff < 1) return 1
    if (diff > plan.totalDays) return plan.totalDays
    return diff
  }, [plan?.totalDays, startedOn])

  const nextUnreadDay = useMemo(() => {
    if (!plan?.totalDays) return null
    for (let day = 1; day <= plan.totalDays; day += 1) {
      if (!completedSet.has(day)) return day
    }
    return null
  }, [completedSet, plan?.totalDays])

  const toggleDay = (day) => {
    setProgressState(prev => {
      const set = new Set(normalizeCompletedDays(prev.completedDays, plan?.totalDays || Number.POSITIVE_INFINITY))
      if (set.has(day)) {
        set.delete(day)
      } else {
        set.add(day)
      }

      return {
        ...prev,
        completedDays: [...set].sort((a, b) => a - b),
        startedOn: prev.startedOn || todayIsoDate(),
        updatedAt: new Date().toISOString(),
      }
    })
  }

  const markThroughDay = (day) => {
    if (!plan?.totalDays) return
    const target = Math.min(Math.max(day, 1), plan.totalDays)
    setProgressState(prev => {
      const set = new Set(normalizeCompletedDays(prev.completedDays, plan.totalDays))
      for (let d = 1; d <= target; d += 1) set.add(d)

      return {
        ...prev,
        completedDays: [...set].sort((a, b) => a - b),
        startedOn: prev.startedOn || todayIsoDate(),
        updatedAt: new Date().toISOString(),
      }
    })
  }

  const resetProgress = () => {
    if (!confirm('Reset all progress for this reading plan?')) return
    setProgressState({
      version: PROGRESS_VERSION,
      completedDays: [],
      startedOn,
      updatedAt: new Date().toISOString(),
    })
  }

  const progressPct = plan?.totalDays
    ? Math.round((completedDays.length / plan.totalDays) * 100)
    : 0

  const readings = plan?.readings || []

  const filteredReadings = useMemo(() => {
    if (filterMode === 'all') return readings
    if (filterMode === 'completed') return readings.filter(r => completedSet.has(r.day))
    return readings.filter(r => !completedSet.has(r.day))
  }, [completedSet, filterMode, readings])

  const groupedReadings = useMemo(() => {
    const groups = []
    let current = null

    for (const r of filteredReadings) {
      const groupLabel = r.month || `Days ${Math.floor((r.day - 1) / 30) * 30 + 1}-${Math.min(Math.floor((r.day - 1) / 30) * 30 + 30, plan?.totalDays || r.day)}`
      if (!current || current.label !== groupLabel) {
        current = { label: groupLabel, readings: [] }
        groups.push(current)
      }
      current.readings.push(r)
    }

    return groups
  }, [filteredReadings, plan?.totalDays])

  const jumpToDay = useCallback((day) => {
    const node = document.getElementById(`plan-day-${day}`)
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  const openPassage = (passage) => {
    const parsed = parsePassageStart(passage)
    if (!parsed) return
    navigate(`/${bookToSlug(parsed.book)}/${parsed.chapter}`)
  }

  const handleStartDateChange = (value) => {
    setProgressState(prev => ({
      ...prev,
      startedOn: value || null,
      updatedAt: new Date().toISOString(),
    }))
  }

  if (!meta && !loading && !plan) {
    return (
      <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">Reading plan not found</h2>
          <button
            onClick={() => navigate('/resources/reading-plans')}
            className="text-primary dark:text-blue-400 hover:underline"
          >
            Back to Reading Plans
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-primary text-white shadow-lg sticky top-0 z-40">
        <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/resources/reading-plans')}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <span className="text-lg">{'\u2190'}</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold heading-text truncate">
              {meta?.title || plan?.title || 'Loading…'}
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 sm:px-6 py-6 pb-20">
        {loading && (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400 animate-pulse">
            Loading…
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-4xl mb-4">📅</p>
            <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">Plan unavailable</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">{error}</p>
          </div>
        )}

        {plan && !loading && (
          <>
            <div className="text-center mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 heading-text">
                {plan.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-2xl mx-auto">
                {plan.description}
              </p>
              {plan.attribution && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 max-w-2xl mx-auto">
                  {plan.attribution}
                </p>
              )}
              {cacheNotice && (
                <p className="text-xs text-amber-600 dark:text-amber-300 mt-2">{cacheNotice}</p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5 shadow-sm mb-5">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs text-gray-500 dark:text-gray-400">Plan start date</label>
                <input
                  type="date"
                  value={startedOn}
                  onChange={(event) => handleStartDateChange(event.target.value)}
                  className="px-2.5 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                />
                <button
                  onClick={() => handleStartDateChange(todayIsoDate())}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Start today
                </button>
                {todayDay && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">Today maps to day {todayDay}</span>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {nextUnreadDay && (
                  <button
                    onClick={() => jumpToDay(nextUnreadDay)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-300 hover:bg-primary/20"
                  >
                    Jump to next unread (Day {nextUnreadDay})
                  </button>
                )}
                {todayDay && (
                  <button
                    onClick={() => jumpToDay(todayDay)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Jump to today (Day {todayDay})
                  </button>
                )}
                {todayDay && (
                  <button
                    onClick={() => markThroughDay(todayDay)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                  >
                    Mark through today complete
                  </button>
                )}
                {completedDays.length > 0 && (
                  <button
                    onClick={resetProgress}
                    className="px-3 py-1.5 text-xs rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Reset progress
                  </button>
                )}
              </div>
            </div>

            <div className="mb-6 px-1">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                <span>{completedDays.length} of {plan.totalDays} days complete</span>
                <span>{progressPct}%</span>
              </div>
              <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary dark:bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 text-xs rounded-lg border ${filterMode === 'all' ? 'border-primary text-primary bg-primary/10 dark:bg-blue-500/20' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                All days
              </button>
              <button
                onClick={() => setFilterMode('remaining')}
                className={`px-3 py-1.5 text-xs rounded-lg border ${filterMode === 'remaining' ? 'border-primary text-primary bg-primary/10 dark:bg-blue-500/20' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                Remaining
              </button>
              <button
                onClick={() => setFilterMode('completed')}
                className={`px-3 py-1.5 text-xs rounded-lg border ${filterMode === 'completed' ? 'border-primary text-primary bg-primary/10 dark:bg-blue-500/20' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              >
                Completed
              </button>
            </div>

            <hr className="border-gray-200 dark:border-gray-700 mb-6" />

            <div className="space-y-8">
              {groupedReadings.map((group, gi) => (
                <div key={gi}>
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 sticky top-14 bg-background dark:bg-gray-900 py-2 z-10">
                    {group.label}
                  </h3>

                  <div className="space-y-2">
                    {group.readings.map((r) => {
                      const done = completedSet.has(r.day)
                      return (
                        <div
                          id={`plan-day-${r.day}`}
                          key={r.day}
                          className={`w-full rounded-lg px-3 py-2.5 border transition-colors ${done ? 'bg-primary/5 dark:bg-blue-900/20 border-primary/20 dark:border-blue-400/30' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => toggleDay(r.day)}
                              className={`w-5 h-5 rounded border-2 mt-0.5 flex-shrink-0 flex items-center justify-center transition-colors ${done ? 'bg-primary border-primary text-white' : 'border-gray-300 dark:border-gray-600 hover:border-primary'}`}
                              aria-label={done ? `Mark day ${r.day} incomplete` : `Mark day ${r.day} complete`}
                            >
                              {done && <span className="text-xs">✓</span>}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-xs font-mono ${done ? 'text-primary dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                                  Day {r.day}
                                </span>
                                {todayDay === r.day && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium">
                                    Today
                                  </span>
                                )}
                              </div>

                              <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {r.passages.map((passage, index) => (
                                  <button
                                    key={`${r.day}-${index}`}
                                    onClick={() => openPassage(passage)}
                                    className={`text-xs px-2 py-1 rounded-md border ${done ? 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-primary/40' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-primary/50 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                                    title={`Open ${passage}`}
                                  >
                                    {passage}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {filteredReadings.length === 0 && (
              <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-10">
                No days match this filter.
              </div>
            )}
          </>
        )}

        <div className="mt-12 text-center">
          <button
            onClick={() => navigate('/resources/reading-plans')}
            className="text-sm text-primary dark:text-blue-400 hover:underline"
          >
            {'\u2190'} Back to Reading Plans
          </button>
        </div>
      </main>
    </div>
  )
}

export default ReadingPlanViewer
