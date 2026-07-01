import { describe, expect, it, vi } from 'vitest'
import {
  COMMENTS_ITEM_TYPE,
  getBibleReadingItems,
  getCompletedDayNumbers,
  getLegacyPlanItemId,
  getNextIncompleteDay,
  getPlanItemId,
  getPlanItemNeighbor,
  getReadingItems,
  getTodayPlanDay,
  isPlanDayComplete,
  isPlanItemComplete,
  loadPlanProgress,
  markPlanItemComplete,
  markThroughPlanDay,
  normalizeCompletedDays,
  normalizeProgressForPlan,
  parseIsoDate,
  parsePassageChapters,
  parsePassageStart,
  savePlanProgress,
  saveActiveReadingPlan,
  clearActiveReadingPlan,
  getActiveReadingPlan,
  setPlanDayComplete,
  togglePlanItem,
} from './readingPlanProgress'
import { STORAGE_KEYS } from './persistentStorage'

const sampleReading = {
  day: 1,
  passages: ['Genesis 1', 'Genesis 2-3'],
}

const samplePlan = {
  totalDays: 2,
  readings: [
    sampleReading,
    {
      day: 2,
      passages: ['John 1'],
    },
  ],
}

describe('parsePassageChapters', () => {
  it('expands single-chapter passages', () => {
    expect(parsePassageChapters('Genesis 1')).toEqual([
      { book: 'Genesis', chapter: 1, label: 'Genesis 1', passage: 'Genesis 1' },
    ])
  })

  it('expands chapter ranges in either order', () => {
    expect(parsePassageChapters('Genesis 3-1')).toEqual([
      { book: 'Genesis', chapter: 1, label: 'Genesis 1', passage: 'Genesis 3-1' },
      { book: 'Genesis', chapter: 2, label: 'Genesis 2', passage: 'Genesis 3-1' },
      { book: 'Genesis', chapter: 3, label: 'Genesis 3', passage: 'Genesis 3-1' },
    ])
  })

  it('returns an empty array for invalid passages', () => {
    expect(parsePassageChapters('Not a passage')).toEqual([])
  })
})

describe('parsePassageStart', () => {
  it('extracts the starting book and chapter', () => {
    expect(parsePassageStart('Matthew 5:3-12')).toEqual({
      book: 'Matthew',
      chapter: 5,
    })
  })
})

describe('parseIsoDate', () => {
  it('parses valid ISO dates', () => {
    expect(parseIsoDate('2026-06-27')).toEqual(new Date(2026, 5, 27))
  })

  it('rejects invalid dates', () => {
    expect(parseIsoDate('2026/06/27')).toBeNull()
    expect(parseIsoDate('not-a-date')).toBeNull()
  })
})

describe('normalizeCompletedDays', () => {
  it('deduplicates, sorts, and filters out-of-range days', () => {
    expect(normalizeCompletedDays([3, 1, 3, 0, 99], 5)).toEqual([1, 3])
  })
})

describe('reading plan items', () => {
  it('builds stable chapter item ids', () => {
    expect(getPlanItemId(5, '1 Corinthians', 13)).toBe('day-5-chapter-1-corinthians-13')
  })

  it('expands passages into chapter items and appends comments', () => {
    const items = getReadingItems(sampleReading)
    expect(items.filter(item => item.type === 'chapter')).toHaveLength(3)
    expect(items.at(-1)).toMatchObject({
      type: COMMENTS_ITEM_TYPE,
      label: 'Comments',
    })
  })

  it('supports structured reading items with notes and passages', () => {
    const items = getBibleReadingItems({
      day: 4,
      items: [
        { type: 'note', id: 'intro', title: 'Intro', text: 'Welcome' },
        { type: 'passage', passage: 'Psalms 23' },
      ],
    })

    expect(items).toHaveLength(2)
    expect(items[0].type).toBe('plan-note')
    expect(items[1]).toMatchObject({ book: 'Psalms', chapter: 23 })
  })
})

describe('reading plan progress', () => {
  it('persists and reloads progress from localStorage', () => {
    const progress = {
      completedItems: { 1: [getPlanItemId(1, 'Genesis', 1)] },
      completedDays: [],
      startedOn: '2026-01-01',
      dayNotes: { 1: 'Day one note' },
    }

    savePlanProgress('chronological-bible', progress)
    const loaded = loadPlanProgress('chronological-bible')

    expect(loaded.completedItems[1]).toContain(getPlanItemId(1, 'Genesis', 1))
    expect(loaded.startedOn).toBe('2026-01-01')
    expect(loaded.dayNotes[1]).toBe('Day one note')
  })

  it('tracks item completion and day completion', () => {
    let progress = loadPlanProgress('test-plan')
    const reading = sampleReading

    expect(isPlanDayComplete(progress, reading)).toBe(false)
    progress = markPlanItemComplete(progress, reading, getPlanItemId(1, 'Genesis', 1))
    expect(isPlanItemComplete(progress, 1, getPlanItemId(1, 'Genesis', 1))).toBe(true)
    expect(isPlanDayComplete(progress, reading)).toBe(false)

    progress = setPlanDayComplete(progress, reading, true)
    expect(isPlanDayComplete(progress, reading)).toBe(true)
    expect(getCompletedDayNumbers(progress, samplePlan)).toEqual([1])
  })

  it('toggles individual items', () => {
    const reading = { day: 1, passages: ['John 1'] }
    const itemId = getPlanItemId(1, 'John', 1)
    let progress = togglePlanItem(loadPlanProgress('toggle-plan'), reading, itemId)
    expect(isPlanItemComplete(progress, 1, itemId)).toBe(true)

    progress = togglePlanItem(progress, reading, itemId)
    expect(isPlanItemComplete(progress, 1, itemId)).toBe(false)
  })

  it('marks all days through a target day complete', () => {
    const progress = markThroughPlanDay(loadPlanProgress('through-plan'), samplePlan, 2)
    expect(getCompletedDayNumbers(progress, samplePlan)).toEqual([1, 2])
  })

  it('migrates legacy completed item ids to chapter ids', () => {
    const reading = { day: 1, passages: ['Genesis 1', 'John 1'] }
    const plan = { totalDays: 1, readings: [reading] }
    const legacyId = getLegacyPlanItemId(1, 0)
    const progress = normalizeProgressForPlan({
      completedItems: { 1: [legacyId] },
      completedDays: [1],
    }, plan)

    expect(progress.completedItems[1]).toContain(getPlanItemId(1, 'Genesis', 1))
    expect(progress.completedItems[1]).not.toContain(legacyId)
    expect(progress.completedDays).toEqual([])
  })

  it('calculates today plan day from startedOn', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 27))
    expect(getTodayPlanDay({ totalDays: 10 }, '2026-06-25')).toBe(3)
    vi.useRealTimers()
  })

  it('finds the next incomplete day', () => {
    let progress = loadPlanProgress('next-day-plan')
    progress = setPlanDayComplete(progress, sampleReading, true)
    expect(getNextIncompleteDay(samplePlan, progress)).toBe(2)
  })

  it('returns neighboring plan items', () => {
    const items = getReadingItems({ day: 1, passages: ['John 1'] })
    const first = items[0].id
    const second = items[1].id
    expect(getPlanItemNeighbor({ day: 1, passages: ['John 1'] }, first, 'next')?.id).toBe(second)
    expect(getPlanItemNeighbor({ day: 1, passages: ['John 1'] }, second, 'previous')?.id).toBe(first)
  })

  it('persists and clears the active reading plan context', () => {
    const saved = saveActiveReadingPlan({
      planId: 'chronological-bible',
      planTitle: 'Chronological Bible',
      day: 5,
      itemId: 'day-5-chapter-genesis-1',
    })

    expect(saved.planId).toBe('chronological-bible')
    expect(getActiveReadingPlan()).toMatchObject({ day: 5 })

    clearActiveReadingPlan()
    expect(getActiveReadingPlan()).toBeNull()
    expect(localStorage.getItem(STORAGE_KEYS.activeReadingPlan)).toBeNull()
  })
})
