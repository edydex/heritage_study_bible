import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { RESOURCE_CATEGORIES } from '../data/resources'
import {
  COMMENTS_ITEM_TYPE,
  PLAN_NOTE_ITEM_TYPE,
  PLAN_NOTES_BASE_URL,
  bookToSlug,
  getCompletedDayNumbers,
  getFirstIncompleteItem,
  getNextIncompleteDay,
  getPlanNotePath,
  getReadingItems,
  getTodayPlanDay,
  isPlanDayComplete,
  isPlanItemComplete,
  loadPlanGroups,
  loadPlanProgress,
  markThroughPlanDay,
  normalizeProgressForPlan,
  parsePassageStart,
  planNotesApi,
  saveActiveReadingPlan,
  savePlanGroups,
  savePlanProgress,
  setPlanDayComplete,
  todayIsoDate,
  togglePlanItem,
} from '../services/readingPlanProgress'
import { addNativeBackListener } from '../services/androidControls'

const PLAN_CACHE_VERSION = 1
const DAY_STRIP_RADIUS = 7

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

function parseJoinLink(value) {
  const text = String(value || '').trim()
  if (!text) return null

  try {
    const url = new URL(text)
    const params = new URLSearchParams(url.search)
    if (!params.get('group') && url.hash.includes('?')) {
      url.hash.slice(url.hash.indexOf('?') + 1).split('&').forEach(part => {
        const [rawKey, rawValue] = part.split('=')
        if (rawKey && rawValue) params.set(decodeURIComponent(rawKey), decodeURIComponent(rawValue))
      })
    }
    const groupId = params.get('group') || params.get('groupId')
    const inviteToken = params.get('invite') || params.get('inviteToken')
    const planId = params.get('plan') || params.get('planId')
    if (groupId && inviteToken) return { groupId, inviteToken, planId }
  } catch {
    // Fall through to compact token parsing.
  }

  const match = text.match(/group[=:]([a-z0-9_-]+).+invite[=:]([a-z0-9_-]+)/i)
  if (match) return { groupId: match[1], inviteToken: match[2], planId: null }
  return null
}

function formatDateForDay(startedOn, day) {
  if (!startedOn || !day) return ''
  const [year, month, date] = startedOn.split('-').map(Number)
  if (!year || !month || !date) return ''
  const value = new Date(year, month - 1, date)
  value.setDate(value.getDate() + day - 1)
  return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

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

function ReadingPlanViewer() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cacheNotice, setCacheNotice] = useState('')
  const [filterMode, setFilterMode] = useState('all')
  const [showMoreSettings, setShowMoreSettings] = useState(false)
  const [showDayMenu, setShowDayMenu] = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)
  const [joinLink, setJoinLink] = useState('')
  const [groupBusy, setGroupBusy] = useState(false)
  const [groupMessage, setGroupMessage] = useState('')
  const [groupState, setGroupState] = useState(null)
  const [answerText, setAnswerText] = useState('')
  const dayMenuHistoryRef = useRef(false)
  const dayMenuClosingFromBackRef = useRef(false)
  const pendingDayMenuCallbackRef = useRef(null)

  const category = RESOURCE_CATEGORIES.find(c => c.id === 'reading-plans')
  const meta = category?.items.find(i => i.id === itemId)
  const [progressState, setProgressState] = useState(() => loadPlanProgress(itemId))
  const [groups, setGroups] = useState(() => loadPlanGroups())

  const groupRecord = groups[itemId] || null
  const groupToken = groupRecord?.participantToken || groupRecord?.leaderToken || null
  const isLeader = Boolean(groupRecord?.leaderToken)

  useEffect(() => {
    setProgressState(loadPlanProgress(itemId))
    setGroups(loadPlanGroups())
    setGroupState(null)
    setGroupMessage('')
    setAnswerText('')
  }, [itemId])

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

  useEffect(() => {
    if (!plan) return
    setProgressState(prev => {
      const normalized = normalizeProgressForPlan(prev, plan)
      savePlanProgress(itemId, normalized)
      return normalized
    })
  }, [itemId, plan])

  useEffect(() => {
    savePlanProgress(itemId, progressState)
  }, [itemId, progressState])

  const readings = plan?.readings || []
  const startedOn = progressState.startedOn || ''
  const todayDay = useMemo(() => getTodayPlanDay(plan, startedOn), [plan, startedOn])
  const completedDays = useMemo(() => getCompletedDayNumbers(progressState, plan), [plan, progressState])
  const completedSet = useMemo(() => new Set(completedDays), [completedDays])
  const nextUnreadDay = useMemo(() => getNextIncompleteDay(plan, progressState), [plan, progressState])
  const progressPct = plan?.totalDays ? Math.round((completedDays.length / plan.totalDays) * 100) : 0
  const totalDayCount = plan?.totalDays || readings.length
  const dayAfterLastCompleted = useMemo(() => {
    if (!totalDayCount) return 1
    if (!completedDays.length) return 1
    return Math.min(totalDayCount, Math.max(...completedDays) + 1)
  }, [completedDays, totalDayCount])

  const selectedReading = useMemo(() => {
    if (!readings.length) return null
    return readings.find(reading => reading.day === selectedDay) || readings[0]
  }, [readings, selectedDay])

  useEffect(() => {
    if (!readings.length) return
    const queryDay = Number(searchParams.get('day'))
    if (!Number.isInteger(queryDay)) return
    if (readings.some(reading => Number(reading.day) === queryDay)) setSelectedDay(queryDay)
  }, [readings, searchParams])

  const selectedItems = useMemo(() => getReadingItems(selectedReading), [selectedReading])
  const selectedDayComplete = selectedReading ? isPlanDayComplete(progressState, selectedReading) : false
  const selectedDate = formatDateForDay(startedOn, selectedReading?.day)
  const selectedQuestions = useMemo(() => {
    const questions = groupState?.questions || []
    return questions.filter(question => Number(question.day) === Number(selectedReading?.day))
  }, [groupState, selectedReading?.day])
  const selectedAnswers = useMemo(() => {
    const answers = groupState?.answers || []
    return answers.filter(answer => Number(answer.day) === Number(selectedReading?.day))
  }, [groupState, selectedReading?.day])

  useEffect(() => {
    if (!plan?.readings?.length) return
    const target = dayAfterLastCompleted || nextUnreadDay || todayDay || 1
    setSelectedDay(prev => {
      if (prev && plan.readings.some(row => row.day === prev)) return prev
      return target
    })
  }, [dayAfterLastCompleted, nextUnreadDay, plan, todayDay])

  const closeDayMenuState = () => {
    setShowDayMenu(false)
  }

  const closeDayMenu = () => {
    if (dayMenuHistoryRef.current && typeof window !== 'undefined' && !dayMenuClosingFromBackRef.current) {
      dayMenuClosingFromBackRef.current = true
      window.history.back()
      return
    }

    closeDayMenuState()
  }

  const closeDayMenuForSelection = (callback) => {
    if (dayMenuHistoryRef.current && typeof window !== 'undefined' && !dayMenuClosingFromBackRef.current) {
      pendingDayMenuCallbackRef.current = callback
      dayMenuClosingFromBackRef.current = true
      window.history.back()
      return
    }

    closeDayMenuState()
    if (callback) callback()
  }

  useEffect(() => {
    if (!showDayMenu || dayMenuHistoryRef.current || typeof window === 'undefined') return

    const currentState = window.history.state || {}
    window.history.pushState({ ...currentState, heritagePlanDayMenu: true }, '', window.location.href)
    dayMenuHistoryRef.current = true
  }, [showDayMenu])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const handlePopState = () => {
      if (!dayMenuHistoryRef.current) return

      dayMenuHistoryRef.current = false
      dayMenuClosingFromBackRef.current = false
      closeDayMenuState()

      const pendingCallback = pendingDayMenuCallbackRef.current
      pendingDayMenuCallbackRef.current = null
      if (pendingCallback) window.setTimeout(pendingCallback, 0)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    return addNativeBackListener(event => {
      if (showDayMenu) {
        event?.preventDefault?.()
        closeDayMenu()
        return
      }

      if (showMoreSettings) {
        event?.preventDefault?.()
        setShowMoreSettings(false)
      }
    })
  }, [showDayMenu, showMoreSettings])

  const refreshGroupState = useCallback(async () => {
    if (!groupRecord?.groupId || !groupToken) return
    try {
      const state = await planNotesApi.getGroupState(groupRecord.groupId, groupToken)
      setGroupState(state)
      setGroupMessage('')
    } catch (error) {
      setGroupMessage('Group sync is not available yet. Local plan progress still works.')
    }
  }, [groupRecord?.groupId, groupToken])

  useEffect(() => {
    refreshGroupState()
  }, [refreshGroupState])

  useEffect(() => {
    const groupId = searchParams.get('group')
    const inviteToken = searchParams.get('invite')
    if (groupId && inviteToken) {
      setJoinLink(`${PLAN_NOTES_BASE_URL}/join?group=${encodeURIComponent(groupId)}&invite=${encodeURIComponent(inviteToken)}&plan=${encodeURIComponent(itemId)}`)
      setShowMoreSettings(true)
    }
  }, [itemId, searchParams])

  const saveGroupRecord = (record) => {
    const next = {
      ...groups,
      [itemId]: {
        ...(groups[itemId] || {}),
        ...record,
        planId: itemId,
        updatedAt: new Date().toISOString(),
      },
    }
    setGroups(next)
    savePlanGroups(next)
  }

  const updateProgress = (updater) => {
    setProgressState(prev => {
      const next = updater(prev)
      if (groupRecord?.groupId && groupToken) {
        planNotesApi.updateProgress(groupRecord.groupId, groupToken, {
          planId: itemId,
          progress: next,
        }).catch(() => {})
      }
      return next
    })
  }

  const openPlanItem = (reading, item) => {
    const targetReading = reading || selectedReading
    const targetItem = item || getFirstIncompleteItem(targetReading, progressState)
    if (!targetReading || !targetItem) return

    saveActiveReadingPlan({
      planId: itemId,
      planTitle: plan?.title || meta?.title || 'Reading Plan',
      day: targetReading.day,
      itemId: targetItem.id,
      groupId: groupRecord?.groupId || null,
    })

    if (targetItem.type === COMMENTS_ITEM_TYPE) {
      const firstBibleItem = getReadingItems(targetReading).find(row => row.type === 'chapter')
      if (firstBibleItem?.book && firstBibleItem?.chapter) {
        navigate(`/${bookToSlug(firstBibleItem.book)}/${firstBibleItem.chapter}`)
      }
      return
    }

    if (targetItem.type === PLAN_NOTE_ITEM_TYPE) {
      const notePath = getPlanNotePath(itemId, targetReading.day, targetItem.id)
      if (notePath) navigate(notePath)
      return
    }

    const parsed = targetItem.book && targetItem.chapter
      ? { book: targetItem.book, chapter: targetItem.chapter }
      : parsePassageStart(targetItem?.passage)
    if (!parsed) return
    navigate(`/${bookToSlug(parsed.book)}/${parsed.chapter}`)
  }

  const openDay = (reading) => {
    if (!reading) return
    setSelectedDay(reading.day)
    openPlanItem(reading, getFirstIncompleteItem(reading, progressState))
  }

  const toggleItem = (reading, itemIdToToggle) => {
    updateProgress(prev => togglePlanItem(prev, reading, itemIdToToggle))
  }

  const toggleSelectedDay = () => {
    if (!selectedReading) return
    updateProgress(prev => setPlanDayComplete(prev, selectedReading, !selectedDayComplete))
  }

  const handleStartDateChange = (value) => {
    updateProgress(prev => ({
      ...prev,
      startedOn: value || null,
      updatedAt: new Date().toISOString(),
    }))
  }

  const markThroughDay = (day) => {
    updateProgress(prev => markThroughPlanDay(prev, plan, day))
  }

  const resetProgress = () => {
    if (!confirm('Reset all progress for this reading plan?')) return
    const next = {
      version: 3,
      completedItems: {},
      completedDays: [],
      startedOn,
      updatedAt: new Date().toISOString(),
      groupId: groupRecord?.groupId || null,
    }
    setProgressState(next)
  }

  const filteredReadings = useMemo(() => {
    if (filterMode === 'completed') return readings.filter(reading => completedSet.has(reading.day))
    if (filterMode === 'remaining') return readings.filter(reading => !completedSet.has(reading.day))
    return readings
  }, [completedSet, filterMode, readings])

  const dayStripFocus = selectedReading?.day || dayAfterLastCompleted || nextUnreadDay || todayDay || 1
  const maxStripItems = (DAY_STRIP_RADIUS * 2) + 1
  const rawDayStripStart = dayStripFocus - DAY_STRIP_RADIUS
  const boundedDayStripStart = Math.max(1, Math.min(rawDayStripStart, Math.max(1, totalDayCount - maxStripItems + 1)))
  const dayStripStart = boundedDayStripStart
  const dayStripEnd = Math.min(totalDayCount, dayStripStart + maxStripItems - 1)
  const visibleStripDays = readings.filter(reading => reading.day >= dayStripStart && reading.day <= dayStripEnd)

  const handleCreateGroup = async () => {
    if (!plan) return
    const displayName = prompt('Your display name for this plan group?', 'Leader')
    if (!displayName) return

    setGroupBusy(true)
    setGroupMessage('')
    try {
      const result = await planNotesApi.createGroup({
        planId: itemId,
        planTitle: plan.title,
        displayName,
      })
      saveGroupRecord({
        groupId: result.groupId,
        inviteToken: result.inviteToken,
        leaderToken: result.leaderToken,
        participantToken: result.participantToken || result.leaderToken,
        displayName,
      })
      setGroupMessage('Group created. Share the invite link with your people.')
      setGroupState(result.state || null)
    } catch (error) {
      setGroupMessage('Could not create the group yet. The plan notes server may not be live.')
    } finally {
      setGroupBusy(false)
    }
  }

  const handleJoinGroup = async () => {
    const parsed = parseJoinLink(joinLink)
    if (!parsed?.groupId || !parsed?.inviteToken) {
      setGroupMessage('Paste a valid group invite link first.')
      return
    }

    const displayName = prompt('Your display name for this group?', 'Reader')
    if (!displayName) return

    setGroupBusy(true)
    setGroupMessage('')
    try {
      const result = await planNotesApi.joinGroup(parsed.groupId, parsed.inviteToken, {
        planId: parsed.planId || itemId,
        displayName,
      })
      saveGroupRecord({
        groupId: parsed.groupId,
        inviteToken: parsed.inviteToken,
        participantToken: result.participantToken,
        displayName,
      })
      setGroupMessage('Joined the plan group.')
      setGroupState(result.state || null)
    } catch (error) {
      setGroupMessage('Could not join the group yet. Check the link or server status.')
    } finally {
      setGroupBusy(false)
    }
  }

  const handleCopyInvite = async () => {
    if (!groupRecord?.groupId || !groupRecord?.inviteToken) return
    const url = `${PLAN_NOTES_BASE_URL}/#/reading-plan-join?group=${encodeURIComponent(groupRecord.groupId)}&invite=${encodeURIComponent(groupRecord.inviteToken)}&plan=${encodeURIComponent(itemId)}`
    try {
      await navigator.clipboard.writeText(url)
      setGroupMessage('Invite link copied.')
    } catch {
      setGroupMessage(url)
    }
  }

  const handleCreateQuestion = async () => {
    if (!isLeader || !groupRecord?.groupId || !selectedReading) return
    const text = prompt(`Question for Day ${selectedReading.day}`)
    if (!text?.trim()) return
    setGroupBusy(true)
    try {
      await planNotesApi.createQuestion(groupRecord.groupId, groupRecord.leaderToken, {
        planId: itemId,
        day: selectedReading.day,
        text: text.trim(),
      })
      await refreshGroupState()
    } catch {
      setGroupMessage('Could not save that question yet.')
    } finally {
      setGroupBusy(false)
    }
  }

  const handleSubmitAnswer = async () => {
    if (!groupRecord?.groupId || !groupToken || !selectedReading || !answerText.trim()) return
    setGroupBusy(true)
    try {
      await planNotesApi.submitAnswer(groupRecord.groupId, groupToken, {
        planId: itemId,
        day: selectedReading.day,
        text: answerText.trim(),
      })
      setAnswerText('')
      await refreshGroupState()
    } catch {
      setGroupMessage('Could not submit that answer yet.')
    } finally {
      setGroupBusy(false)
    }
  }

  const handleRemoveMember = async (memberId) => {
    if (!isLeader || !groupRecord?.groupId || !memberId) return
    if (!confirm('Remove this person and delete their group notes?')) return
    setGroupBusy(true)
    try {
      await planNotesApi.removeMember(groupRecord.groupId, memberId, groupRecord.leaderToken)
      await refreshGroupState()
    } catch {
      setGroupMessage('Could not remove that member yet.')
    } finally {
      setGroupBusy(false)
    }
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
      <header className="bg-primary text-white shadow-lg sticky top-0 z-40 safe-area-top">
        <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => showDayMenu ? closeDayMenu() : navigate('/resources/reading-plans')}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            aria-label={showDayMenu ? 'Back to plan' : 'Back to reading plans'}
          >
            <span className="text-xl leading-none">‹</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold heading-text truncate">
              {showDayMenu ? 'Select Plan Day' : (meta?.title || plan?.title || 'Loading...')}
            </h1>
          </div>
          {!showDayMenu && (
            <button
              onClick={() => setShowMoreSettings(value => !value)}
              className="p-2 rounded-lg hover:bg-white/20 transition-colors"
              aria-label="More settings"
            >
              <span className="block text-xl leading-none">⋮</span>
            </button>
          )}
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 sm:px-6 pt-5 pb-28">
        {loading && (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400 animate-pulse">
            Loading...
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-16">
            <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">Plan unavailable</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">{error}</p>
          </div>
        )}

        {plan && !loading && showDayMenu && selectedReading && (
          <section className="pb-6">
            <div className="mb-5">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                {completedDays.length} of {plan.totalDays} days complete
              </p>
              <h2 className="mt-1 text-2xl font-bold text-gray-950 dark:text-gray-100">
                All Plan Days
              </h2>
            </div>

            <div className="space-y-2">
              {readings.map(reading => {
                const done = completedSet.has(reading.day)
                const active = selectedReading.day === reading.day
                const date = formatDateForDay(startedOn, reading.day)
                const items = getReadingItems(reading)
                const summary = items
                  .filter(item => item.type !== COMMENTS_ITEM_TYPE)
                  .map(item => item.label)
                  .join(', ')

                return (
                  <button
                    key={reading.day}
                    onClick={() => closeDayMenuForSelection(() => {
                      setSelectedDay(reading.day)
                    })}
                    className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                      active
                        ? 'border-primary dark:border-blue-500 bg-primary/10 dark:bg-blue-500/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-base font-semibold text-gray-950 dark:text-gray-100">
                        Day {reading.day}
                      </span>
                      <span className={`text-xs font-semibold ${done ? 'text-primary dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                        {done ? 'Complete' : todayDay === reading.day ? 'Today' : date || 'Not complete'}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                      {summary || reading.passage || 'Reading day'}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {plan && !loading && !showDayMenu && selectedReading && (
          <>
            <section className="mb-5">
              <h2 className="heading-text text-2xl sm:text-3xl font-bold text-gray-950 dark:text-gray-100">
                {plan.title}
              </h2>
              <p className="mt-2 text-sm sm:text-base leading-relaxed text-gray-600 dark:text-gray-400">
                {plan.description}
              </p>
              {cacheNotice && (
                <p className="text-xs text-amber-600 dark:text-amber-300 mt-2">{cacheNotice}</p>
              )}
            </section>

            <section className="mb-5">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                <span>{completedDays.length} of {plan.totalDays} days complete</span>
                <span>{progressPct}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary dark:bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </section>

            <section className="mb-6 -mx-4 sm:-mx-6 overflow-x-auto px-4 sm:px-6">
              <div className="flex gap-2 min-w-max pb-1">
                {visibleStripDays.map(reading => {
                  const done = completedSet.has(reading.day)
                  const active = selectedReading.day === reading.day
                  const date = formatDateForDay(startedOn, reading.day)
                  return (
                    <button
                      key={reading.day}
                      onClick={() => setSelectedDay(reading.day)}
                      onDoubleClick={() => openDay(reading)}
                      className={`w-20 h-16 rounded-lg border text-left px-3 py-2 transition-colors ${
                        active
                          ? 'border-primary dark:border-blue-500 bg-primary/10 dark:bg-blue-500/20'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700'
                      }`}
                    >
                      <span className="flex items-center justify-between text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {reading.day}
                        {done && <span className="text-primary dark:text-blue-300 text-base">✓</span>}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                        {todayDay === reading.day ? 'Today' : date || `Day ${reading.day}`}
                      </span>
                    </button>
                  )
                })}
                <button
                  onClick={() => setShowDayMenu(true)}
                  className="w-20 h-16 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 active:bg-gray-100 dark:active:bg-gray-700 text-left px-3 py-2 transition-colors"
                >
                  <span className="block text-base font-semibold text-gray-900 dark:text-gray-100">
                    See all
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                    {plan.totalDays} days
                  </span>
                </button>
              </div>
            </section>

            <section className="mb-6">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <h3 className="text-2xl font-bold text-gray-950 dark:text-gray-100">
                    Day {selectedReading.day} of {plan.totalDays}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedDate || selectedReading.month || 'Reading day'}
                  </p>
                </div>
                <button
                  onClick={toggleSelectedDay}
                  className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${
                    selectedDayComplete
                      ? 'border-primary/40 bg-primary/10 text-primary dark:text-blue-300 dark:bg-blue-500/20'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {selectedDayComplete ? 'Complete' : 'Mark Day Done'}
                </button>
              </div>

              <div className="space-y-1">
                {selectedItems.map(item => {
                  const done = isPlanItemComplete(progressState, selectedReading.day, item.id)
                  const isPlanNote = item.type === PLAN_NOTE_ITEM_TYPE
                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 py-4 border-b border-gray-200 dark:border-gray-700 ${isPlanNote ? 'bg-amber-50/60 dark:bg-amber-900/10 -mx-3 px-3 rounded-lg border-b-transparent' : ''}`}
                    >
                      <button
                        onClick={() => toggleItem(selectedReading, item.id)}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          done
                            ? 'bg-primary border-primary text-white'
                            : 'border-gray-300 dark:border-gray-600 text-transparent'
                        }`}
                        aria-label={done ? `Mark ${item.label} incomplete` : `Mark ${item.label} complete`}
                      >
                        ✓
                      </button>
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => openPlanItem(selectedReading, item)}
                          className="w-full text-left"
                        >
                          <span className={`block ${isPlanNote ? 'text-base font-semibold' : 'text-lg'} ${done ? 'text-gray-500 dark:text-gray-500 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                            {item.label}
                          </span>
                          {isPlanNote && item.note && (
                            <span className="mt-1 block text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                              {item.note}
                            </span>
                          )}
                          <span className="block text-xs text-gray-500 dark:text-gray-400">
                            {item.type === COMMENTS_ITEM_TYPE ? (done ? 'Finished' : 'Talk it over') : isPlanNote ? (done ? 'Finished' : 'Plan note') : (done ? 'Finished' : 'Tap to read')}
                          </span>
                        </button>
                        {isPlanNote && getPlanNoteSources(item).length > 0 && (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Source:{' '}
                            {getPlanNoteSources(item).map((source, sourceIndex) => (
                              <span key={source.key}>
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
                                {sourceIndex < getPlanNoteSources(item).length - 1 ? ', ' : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {!isPlanNote && <span className="text-2xl text-gray-400 dark:text-gray-500">›</span>}
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Group Plan</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {groupRecord ? 'Shared progress and answers for this plan.' : 'Join by link or create a shared plan when the server is live.'}
                  </p>
                </div>
                {groupRecord && (
                  <button
                    onClick={refreshGroupState}
                    disabled={groupBusy}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                  >
                    Refresh
                  </button>
                )}
              </div>

              {!groupRecord ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={joinLink}
                      onChange={event => setJoinLink(event.target.value)}
                      placeholder="Paste group invite link"
                      className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                    <button
                      onClick={handleJoinGroup}
                      disabled={groupBusy}
                      className="px-4 py-2 rounded-lg bg-primary text-white disabled:opacity-60"
                    >
                      Join
                    </button>
                  </div>
                  <button
                    onClick={handleCreateGroup}
                    disabled={groupBusy}
                    className="w-full py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                  >
                    Create Group Plan
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-200">
                      Joined as {groupRecord.displayName || 'Reader'}
                    </span>
                    {groupRecord.inviteToken && (
                      <button
                        onClick={handleCopyInvite}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                      >
                        Copy Invite
                      </button>
                    )}
                    {isLeader && (
                      <button
                        onClick={handleCreateQuestion}
                        disabled={groupBusy}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary/10 text-primary dark:bg-blue-500/20 dark:text-blue-300"
                      >
                        Add Question
                      </button>
                    )}
                  </div>

                  {selectedQuestions.length > 0 ? (
                    <div className="space-y-3">
                      {selectedQuestions.map(question => (
                        <div key={question.id || question.text} className="rounded-lg bg-gray-50 dark:bg-gray-700/60 p-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{question.text}</p>
                        </div>
                      ))}
                      <textarea
                        value={answerText}
                        onChange={event => setAnswerText(event.target.value)}
                        rows={3}
                        autoComplete="on"
                        autoCorrect="on"
                        spellCheck={true}
                        placeholder="Answer for the group"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                      <button
                        onClick={handleSubmitAnswer}
                        disabled={groupBusy || !answerText.trim()}
                        className="w-full py-2 rounded-lg bg-primary text-white disabled:opacity-60"
                      >
                        Share Answer
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No questions for this day yet.
                    </p>
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

                  {isLeader && Array.isArray(groupState?.members) && groupState.members.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Members</h4>
                      {groupState.members.map(member => (
                        <div key={member.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-gray-700 dark:text-gray-200">{member.displayName || 'Reader'}</span>
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="text-xs text-red-600 dark:text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {groupMessage && (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">{groupMessage}</p>
              )}
            </section>

            {showMoreSettings && (
              <section className="mb-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">More Settings</h3>
                <div className="space-y-5">
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
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                    >
                      Start today
                    </button>
                    {todayDay && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">Today maps to day {todayDay}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {['all', 'remaining', 'completed'].map(mode => (
                      <button
                        key={mode}
                        onClick={() => setFilterMode(mode)}
                        className={`px-3 py-1.5 text-xs rounded-lg border capitalize ${
                          filterMode === mode
                            ? 'border-primary text-primary bg-primary/10 dark:bg-blue-500/20'
                            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {mode === 'all' ? 'All days' : mode}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {nextUnreadDay && (
                      <button
                        onClick={() => setSelectedDay(nextUnreadDay)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-primary/10 dark:bg-blue-500/20 text-primary dark:text-blue-300"
                      >
                        Select next unread (Day {nextUnreadDay})
                      </button>
                    )}
                    {todayDay && (
                      <button
                        onClick={() => setSelectedDay(todayDay)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300"
                      >
                        Select today (Day {todayDay})
                      </button>
                    )}
                    {todayDay && (
                      <button
                        onClick={() => markThroughDay(todayDay)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                      >
                        Mark through today complete
                      </button>
                    )}
                    {completedDays.length > 0 && (
                      <button
                        onClick={resetProgress}
                        className="px-3 py-1.5 text-xs rounded-lg border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300"
                      >
                        Reset progress
                      </button>
                    )}
                  </div>

                  {plan.attribution && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">{plan.attribution}</p>
                  )}

                  <div>
                    <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">Day List</h4>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-64 overflow-y-auto pr-1">
                      {filteredReadings.map(reading => {
                        const done = completedSet.has(reading.day)
                        return (
                          <button
                            key={reading.day}
                            onClick={() => setSelectedDay(reading.day)}
                            className={`px-2 py-2 rounded-lg border text-sm ${
                              selectedReading.day === reading.day
                                ? 'border-primary bg-primary/10 text-primary dark:bg-blue-500/20 dark:text-blue-300'
                                : done
                                  ? 'border-primary/30 text-primary dark:text-blue-300'
                                  : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                            }`}
                          >
                            Day {reading.day}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <div className="fixed left-0 right-0 bottom-0 z-40 bg-white/95 dark:bg-gray-900/95 border-t border-gray-200 dark:border-gray-700 safe-area-bottom px-4 py-3">
              <div className="mx-auto max-w-3xl">
                <button
                  onClick={() => openPlanItem(selectedReading, getFirstIncompleteItem(selectedReading, progressState))}
                  className="w-full h-14 rounded-full bg-gray-950 dark:bg-gray-100 text-white dark:text-gray-950 text-lg font-bold shadow-lg active:scale-[0.99] transition-transform"
                >
                  {selectedDayComplete ? 'Read Again' : 'Start Reading'}
                </button>
              </div>
            </div>
          </>
        )}

        {!showDayMenu && (
          <div className="mt-12 text-center">
            <button
              onClick={() => navigate('/resources/reading-plans')}
              className="text-sm text-primary dark:text-blue-400 hover:underline"
            >
              Back to Reading Plans
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default ReadingPlanViewer
