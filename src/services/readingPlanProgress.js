import { STORAGE_KEYS } from './persistentStorage'

export const PLAN_PROGRESS_VERSION = 3
export const PLAN_NOTES_BASE_URL = 'https://plannotes.heritage.faith'

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

export function getProgressKey(planId) {
  return `${STORAGE_KEYS.readingPlanPrefix}${planId}:progress`
}

export function getPlanItemId(day, index) {
  return `day-${Number(day)}-reading-${Number(index) + 1}`
}

export function getReadingItems(reading) {
  if (!reading?.passages?.length) return []
  return reading.passages.map((passage, index) => ({
    id: getPlanItemId(reading.day, index),
    day: reading.day,
    type: 'reading',
    label: passage,
    passage,
    index,
  }))
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

  return emptyProgress({
    ...progress,
    completedItems,
    completedDays: [],
    startedOn: progress?.startedOn || null,
    updatedAt: progress?.updatedAt || null,
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
