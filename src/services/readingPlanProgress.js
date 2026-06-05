import { STORAGE_KEYS } from './persistentStorage'

export const PLAN_PROGRESS_VERSION = 4
export const PLAN_NOTES_BASE_URL = 'https://plannotes.heritage.faith'
export const COMMENTS_ITEM_TYPE = 'comments'
export const PLAN_NOTE_ITEM_TYPE = 'plan-note'

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

function removeValue(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // no-op
  }
}

export function todayIsoDate() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseIsoDate(dateText) {
  if (!dateText || !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null
  const [y, m, d] = dateText.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function parsePassageStart(passage) {
  const match = String(passage || '').match(/^(.+?)\s+(\d+)(?::\d+)?(?:-\d+(?::\d+)?)?$/)
  if (!match) return null
  return {
    book: match[1],
    chapter: Number(match[2]),
  }
}

export function bookToSlug(bookName) {
  return String(bookName || '').toLowerCase().replace(/\s+/g, '-')
}

export function parsePassageChapters(passage) {
  const match = String(passage || '').trim().match(/^(.+?)\s+(\d+)(?::\d+)?(?:-(\d+)(?::\d+)?)?$/)
  if (!match) return []

  const book = match[1]
  const start = Number(match[2])
  const end = Number(match[3] || match[2])
  if (!Number.isInteger(start) || !Number.isInteger(end)) return []

  const first = Math.min(start, end)
  const last = Math.max(start, end)
  return Array.from({ length: last - first + 1 }, (_, index) => {
    const chapter = first + index
    return {
      book,
      chapter,
      label: `${book} ${chapter}`,
      passage,
    }
  })
}

export function getProgressKey(planId) {
  return `${STORAGE_KEYS.readingPlanPrefix}${planId}:progress`
}

export function getLegacyPlanItemId(day, index) {
  return `day-${Number(day)}-reading-${Number(index) + 1}`
}

export function getPlanItemId(day, book, chapter) {
  return `day-${Number(day)}-chapter-${bookToSlug(book)}-${Number(chapter)}`
}

export function getCommentsItemId(day) {
  return `day-${Number(day)}-comments`
}

export function getPlanNoteItemId(day, noteId, index) {
  return `day-${Number(day)}-note-${String(noteId || index + 1).toLowerCase().replace(/[^a-z0-9_-]+/g, '-')}`
}

export function getPlanNotePath(planId, day, itemId) {
  if (!planId || !day || !itemId) return null
  return `/resources/reading-plans/${planId}/note/${Number(day)}/${encodeURIComponent(itemId)}`
}

function appendPassageReadingItems(reading, passage, passageIndex, items) {
  parsePassageChapters(passage).forEach(chapterRef => {
    items.push({
      id: getPlanItemId(reading.day, chapterRef.book, chapterRef.chapter),
      day: reading.day,
      type: 'chapter',
      label: chapterRef.label,
      passage,
      book: chapterRef.book,
      chapter: chapterRef.chapter,
      passageIndex,
      index: items.length,
    })
  })
}

export function getBibleReadingItems(reading) {
  if (!reading?.passages?.length && !reading?.items?.length) return []
  const items = []

  if (Array.isArray(reading.items) && reading.items.length) {
    reading.items.forEach((entry, entryIndex) => {
      if (entry?.type === 'note') {
        items.push({
          id: getPlanNoteItemId(reading.day, entry.id, entryIndex),
          rawNoteId: entry.id || '',
          day: reading.day,
          type: PLAN_NOTE_ITEM_TYPE,
          label: entry.title || 'Plan note',
          note: entry.text || '',
          sources: Array.isArray(entry.sources) ? entry.sources : [],
          sourceLabels: Array.isArray(entry.sourceLabels) ? entry.sourceLabels : [],
          sourceLinks: Array.isArray(entry.sourceLinks) ? entry.sourceLinks : [],
          index: items.length,
        })
        return
      }

      if (entry?.type === 'passage' && entry.passage) {
        appendPassageReadingItems(reading, entry.passage, entryIndex, items)
      }
    })
    return items
  }

  reading.passages.forEach((passage, passageIndex) => {
    appendPassageReadingItems(reading, passage, passageIndex, items)
  })
  return items
}

export function getReadingItems(reading) {
  if (!reading?.passages?.length && !reading?.items?.length) return []
  const bibleItems = getBibleReadingItems(reading)
  return [
    ...bibleItems,
    {
      id: getCommentsItemId(reading.day),
      day: reading.day,
      type: COMMENTS_ITEM_TYPE,
      label: 'Comments',
      passage: null,
      index: bibleItems.length,
    },
  ]
}

export function normalizeCompletedDays(days, totalDays = Number.POSITIVE_INFINITY) {
  if (!Array.isArray(days)) return []
  const unique = new Set()
  for (const value of days) {
    const day = Number(value)
    if (Number.isInteger(day) && day >= 1 && day <= totalDays) unique.add(day)
  }
  return [...unique].sort((a, b) => a - b)
}

function normalizeCompletedItems(value) {
  if (!value || typeof value !== 'object') return {}
  const result = {}
  for (const [dayKey, ids] of Object.entries(value)) {
    const day = Number(dayKey)
    if (!Number.isInteger(day) || day < 1 || !Array.isArray(ids)) continue
    const clean = [...new Set(ids.map(id => String(id)).filter(Boolean))]
    if (clean.length) result[day] = clean
  }
  return result
}

function emptyProgress(extra = {}) {
  return {
    version: PLAN_PROGRESS_VERSION,
    completedItems: {},
    completedDays: [],
    startedOn: null,
    updatedAt: null,
    dayNotes: {},
    ...extra,
  }
}

export function loadPlanProgress(planId) {
  const saved = readJson(getProgressKey(planId))
  if (saved && typeof saved === 'object') {
    return emptyProgress({
      completedItems: normalizeCompletedItems(saved.completedItems),
      completedDays: normalizeCompletedDays(saved.completedDays),
      startedOn: typeof saved.startedOn === 'string' ? saved.startedOn : null,
      updatedAt: saved.updatedAt || null,
      groupId: saved.groupId || null,
      dayNotes: saved.dayNotes && typeof saved.dayNotes === 'object' ? saved.dayNotes : {},
    })
  }

  const oldV2 = readJson(`heritage-plan-progress-v2-${planId}`)
  if (oldV2 && Array.isArray(oldV2.completedDays)) {
    return emptyProgress({
      completedDays: normalizeCompletedDays(oldV2.completedDays),
      startedOn: typeof oldV2.startedOn === 'string' ? oldV2.startedOn : null,
      updatedAt: oldV2.updatedAt || null,
    })
  }

  const oldArray = readJson(`heritage-plan-${planId}`)
  if (Array.isArray(oldArray)) {
    return emptyProgress({ completedDays: normalizeCompletedDays(oldArray) })
  }

  return emptyProgress()
}

export function savePlanProgress(planId, progress) {
  writeJson(getProgressKey(planId), {
    version: PLAN_PROGRESS_VERSION,
    completedItems: normalizeCompletedItems(progress?.completedItems),
    completedDays: normalizeCompletedDays(progress?.completedDays),
    startedOn: typeof progress?.startedOn === 'string' ? progress.startedOn : null,
    updatedAt: progress?.updatedAt || new Date().toISOString(),
    groupId: progress?.groupId || null,
    dayNotes: progress?.dayNotes && typeof progress.dayNotes === 'object' ? progress.dayNotes : {},
  })
}

export function normalizeProgressForPlan(progress, plan) {
  if (!plan?.readings?.length) return emptyProgress(progress)

  const completedItems = normalizeCompletedItems(progress?.completedItems)
  const completedDays = normalizeCompletedDays(progress?.completedDays, plan.totalDays || Number.POSITIVE_INFINITY)

  for (const day of completedDays) {
    const reading = plan.readings.find(row => Number(row.day) === day)
    if (!reading) continue
    completedItems[day] = getReadingItems(reading).map(item => item.id)
  }

  for (const reading of plan.readings) {
    const day = Number(reading.day)
    const previousIds = new Set(completedItems[day] || [])
    if (!previousIds.size) continue

    const nextIds = new Set(previousIds)
    reading.passages?.forEach((passage, index) => {
      if (!previousIds.has(getLegacyPlanItemId(day, index))) return
      parsePassageChapters(passage).forEach(chapterRef => {
        nextIds.add(getPlanItemId(day, chapterRef.book, chapterRef.chapter))
      })
      nextIds.delete(getLegacyPlanItemId(day, index))
    })
    completedItems[day] = [...nextIds]
  }

  return emptyProgress({
    ...progress,
    completedItems,
    completedDays: [],
    startedOn: progress?.startedOn || null,
    updatedAt: progress?.updatedAt || null,
    dayNotes: progress?.dayNotes && typeof progress.dayNotes === 'object' ? progress.dayNotes : {},
  })
}

export function getCompletedItemSet(progress, day) {
  return new Set((progress?.completedItems?.[day] || []).map(String))
}

export function isPlanItemComplete(progress, day, itemId) {
  return getCompletedItemSet(progress, day).has(String(itemId))
}

export function isPlanDayComplete(progress, reading) {
  const items = getReadingItems(reading)
  if (!items.length) return false
  const completed = getCompletedItemSet(progress, reading.day)
  return items.every(item => completed.has(item.id))
}

export function getCompletedDayNumbers(progress, plan) {
  if (!plan?.readings?.length) return []
  return plan.readings
    .filter(reading => isPlanDayComplete(progress, reading))
    .map(reading => reading.day)
}

export function getNextIncompleteDay(plan, progress) {
  if (!plan?.readings?.length) return null
  const reading = plan.readings.find(row => !isPlanDayComplete(progress, row))
  return reading?.day || null
}

export function getFirstIncompleteItem(reading, progress) {
  const items = getReadingItems(reading)
  if (!items.length) return null
  const completed = getCompletedItemSet(progress, reading.day)
  return items.find(item => !completed.has(item.id)) || items[0]
}

export function getPlanItemById(reading, itemId) {
  if (!reading || !itemId) return null
  return getReadingItems(reading).find(item => item.id === itemId) || null
}

export function getPlanItemForChapter(reading, book, chapter) {
  if (!reading || !book || !chapter) return null
  return getReadingItems(reading).find(item =>
    item.type === 'chapter' &&
    item.book === book &&
    Number(item.chapter) === Number(chapter)
  ) || null
}

export function getPlanItemNeighbor(reading, itemId, direction) {
  const items = getReadingItems(reading)
  if (!items.length) return null
  const index = items.findIndex(item => item.id === itemId)
  if (index < 0) return null
  const nextIndex = direction === 'previous' ? index - 1 : index + 1
  return items[nextIndex] || null
}

export function getNextPlanDay(plan, day) {
  if (!plan?.readings?.length) return null
  return plan.readings.find(reading => Number(reading.day) > Number(day)) || null
}

export function getPlanModeLabel(item, fallbackBook, fallbackChapter) {
  if (item?.type === COMMENTS_ITEM_TYPE) return 'Plan - Comments'
  if (item?.label) return `Plan - ${item.label}`
  if (fallbackBook && fallbackChapter) return `Plan - ${fallbackBook} ${fallbackChapter}`
  return 'Plan'
}

export function markPlanItemComplete(progress, reading, itemId) {
  const day = Number(reading?.day)
  if (!Number.isInteger(day)) return progress
  const validIds = new Set(getReadingItems(reading).map(item => item.id))
  if (!validIds.has(itemId)) return progress

  const set = getCompletedItemSet(progress, day)
  set.add(itemId)
  return emptyProgress({
    ...progress,
    completedItems: {
      ...normalizeCompletedItems(progress?.completedItems),
      [day]: [...set],
    },
    startedOn: progress?.startedOn || todayIsoDate(),
    updatedAt: new Date().toISOString(),
  })
}

export function setPlanDayNote(progress, day, note) {
  const normalizedDay = Number(day)
  if (!Number.isInteger(normalizedDay)) return progress
  const dayNotes = {
    ...(progress?.dayNotes || {}),
    [normalizedDay]: String(note || ''),
  }
  if (!dayNotes[normalizedDay].trim()) delete dayNotes[normalizedDay]

  return emptyProgress({
    ...progress,
    dayNotes,
    updatedAt: new Date().toISOString(),
  })
}

export function togglePlanItem(progress, reading, itemId) {
  const day = Number(reading?.day)
  if (!Number.isInteger(day)) return progress
  const validIds = new Set(getReadingItems(reading).map(item => item.id))
  if (!validIds.has(itemId)) return progress

  const set = getCompletedItemSet(progress, day)
  if (set.has(itemId)) set.delete(itemId)
  else set.add(itemId)

  return emptyProgress({
    ...progress,
    completedItems: {
      ...normalizeCompletedItems(progress?.completedItems),
      [day]: [...set],
    },
    startedOn: progress?.startedOn || todayIsoDate(),
    updatedAt: new Date().toISOString(),
  })
}

export function setPlanDayComplete(progress, reading, complete = true) {
  const day = Number(reading?.day)
  if (!Number.isInteger(day)) return progress
  const completedItems = normalizeCompletedItems(progress?.completedItems)
  completedItems[day] = complete ? getReadingItems(reading).map(item => item.id) : []
  if (!completedItems[day].length) delete completedItems[day]

  return emptyProgress({
    ...progress,
    completedItems,
    startedOn: progress?.startedOn || todayIsoDate(),
    updatedAt: new Date().toISOString(),
  })
}

export function markThroughPlanDay(progress, plan, targetDay) {
  if (!plan?.readings?.length) return progress
  const completedItems = normalizeCompletedItems(progress?.completedItems)
  const target = Math.min(Math.max(Number(targetDay) || 1, 1), plan.totalDays || targetDay)

  for (const reading of plan.readings) {
    if (reading.day > target) continue
    completedItems[reading.day] = getReadingItems(reading).map(item => item.id)
  }

  return emptyProgress({
    ...progress,
    completedItems,
    startedOn: progress?.startedOn || todayIsoDate(),
    updatedAt: new Date().toISOString(),
  })
}

export function getTodayPlanDay(plan, startedOn) {
  if (!plan?.totalDays || !startedOn) return null
  const start = parseIsoDate(startedOn)
  if (!start) return null
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.floor((today - start) / 86400000) + 1
  if (diff < 1) return 1
  if (diff > plan.totalDays) return plan.totalDays
  return diff
}

export function getActiveReadingPlan() {
  return readJson(STORAGE_KEYS.activeReadingPlan)
}

export function saveActiveReadingPlan(context) {
  if (!context?.planId || !context?.day) {
    removeValue(STORAGE_KEYS.activeReadingPlan)
    return null
  }

  const normalized = {
    planId: context.planId,
    planTitle: context.planTitle || '',
    day: Number(context.day),
    itemId: context.itemId || null,
    groupId: context.groupId || null,
    updatedAt: new Date().toISOString(),
  }
  writeJson(STORAGE_KEYS.activeReadingPlan, normalized)
  window.dispatchEvent(new CustomEvent('heritage-active-plan-change', { detail: normalized }))
  return normalized
}

export function clearActiveReadingPlan() {
  removeValue(STORAGE_KEYS.activeReadingPlan)
  window.dispatchEvent(new CustomEvent('heritage-active-plan-change', { detail: null }))
}

export function loadPlanGroups() {
  const groups = readJson(STORAGE_KEYS.readingPlanGroups)
  return groups && typeof groups === 'object' ? groups : {}
}

export function savePlanGroups(groups) {
  writeJson(STORAGE_KEYS.readingPlanGroups, groups || {})
}

async function requestPlanNotes(path, options = {}) {
  const response = await fetch(`${PLAN_NOTES_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!response.ok) throw new Error(`Plan notes request failed: ${response.status}`)
  return response.json()
}

export const planNotesApi = {
  createGroup(payload) {
    return requestPlanNotes('/groups', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    })
  },
  joinGroup(groupId, inviteToken, payload) {
    return requestPlanNotes(`/groups/${encodeURIComponent(groupId)}/join`, {
      method: 'POST',
      body: JSON.stringify({ inviteToken, ...(payload || {}) }),
    })
  },
  getGroupState(groupId, token) {
    return requestPlanNotes(`/groups/${encodeURIComponent(groupId)}/state`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  },
  updateProgress(groupId, token, payload) {
    return requestPlanNotes(`/groups/${encodeURIComponent(groupId)}/progress`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(payload || {}),
    })
  },
  createQuestion(groupId, leaderToken, payload) {
    return requestPlanNotes(`/groups/${encodeURIComponent(groupId)}/questions`, {
      method: 'POST',
      headers: leaderToken ? { Authorization: `Bearer ${leaderToken}` } : {},
      body: JSON.stringify(payload || {}),
    })
  },
  submitAnswer(groupId, token, payload) {
    return requestPlanNotes(`/groups/${encodeURIComponent(groupId)}/answers`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: JSON.stringify(payload || {}),
    })
  },
  removeMember(groupId, memberId, leaderToken) {
    return requestPlanNotes(`/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
      headers: leaderToken ? { Authorization: `Bearer ${leaderToken}` } : {},
    })
  },
}
