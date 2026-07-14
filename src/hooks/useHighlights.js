import { useState, useEffect, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getStoredJson, setStoredJson, STORAGE_KEYS } from '../services/persistentStorage'

const STORAGE_KEY = STORAGE_KEYS.highlights

export const HIGHLIGHT_COLORS = [
  {
    id: 'yellow',
    label: 'Yellow',
    swatch: 'bg-yellow-300',
    markClass: 'bg-yellow-200/70 dark:bg-yellow-500/40',
  },
  {
    id: 'green',
    label: 'Green',
    swatch: 'bg-green-300',
    markClass: 'bg-green-200/70 dark:bg-green-500/40',
  },
  {
    id: 'blue',
    label: 'Blue',
    swatch: 'bg-blue-300',
    markClass: 'bg-blue-200/70 dark:bg-blue-500/40',
  },
  {
    id: 'pink',
    label: 'Pink',
    swatch: 'bg-pink-300',
    markClass: 'bg-pink-200/70 dark:bg-pink-500/40',
  },
]

export function getHighlightColor(colorId) {
  return HIGHLIGHT_COLORS.find(c => c.id === colorId) || null
}

function migrateHighlight(entry) {
  if (typeof entry.start === 'number' && typeof entry.end === 'number') return entry
  return {
    ...entry,
    start: 0,
    end: Number.MAX_SAFE_INTEGER,
  }
}

export function rangesOverlapOrTouch(a, b) {
  return a.start <= b.end && b.start <= a.end
}

/**
 * Merge incoming ranges into existing highlights, coalescing same-color
 * overlapping/adjacent spans on the same verse.
 */
export function mergeNewHighlightRanges(prev, book, chapter, ranges, now, idFactory = uuidv4) {
  let next = [...prev]
  const ids = []
  const replaced = []
  const prevIds = new Set(prev.map(h => h.id))

  for (const range of ranges) {
    const overlapping = next.filter(h =>
      h.book === book
      && h.chapter === chapter
      && h.verse === range.verse
      && h.color === range.color
      && rangesOverlapOrTouch(h, range)
    )

    let start = range.start
    let end = range.end
    for (const h of overlapping) {
      start = Math.min(start, h.start)
      end = Math.max(end, h.end)
      if (prevIds.has(h.id)) replaced.push(h)
      const createdIdx = ids.indexOf(h.id)
      if (createdIdx >= 0) ids.splice(createdIdx, 1)
    }

    const overlapIds = new Set(overlapping.map(h => h.id))
    next = next.filter(h => !overlapIds.has(h.id))

    const entry = {
      id: idFactory(),
      book,
      chapter,
      verse: range.verse,
      start,
      end,
      color: range.color,
      dateCreated: now,
    }
    ids.push(entry.id)
    next.push(entry)
  }

  return { next, ids, replaced }
}

export function useHighlights() {
  const [highlights, setHighlights] = useState([])
  const [hydrated, setHydrated] = useState(false)
  const highlightsRef = useRef(highlights)
  highlightsRef.current = highlights

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const stored = await getStoredJson(STORAGE_KEY, [])
        if (cancelled) return
        const list = Array.isArray(stored) ? stored.map(migrateHighlight) : []
        highlightsRef.current = list
        setHighlights(list)
      } catch (e) {
        console.error('Error loading highlights:', e)
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    setStoredJson(STORAGE_KEY, highlights).catch(e => console.error('Error saving highlights:', e))
  }, [highlights, hydrated])

  const getVerseHighlights = useCallback((book, chapter, verse) => {
    return highlights.filter(h => h.book === book && h.chapter === chapter && h.verse === verse)
  }, [highlights])

  const addHighlightRanges = useCallback((book, chapter, ranges) => {
    if (!ranges.length) return { ids: [], replaced: [] }
    const now = new Date().toISOString()
    const result = mergeNewHighlightRanges(highlightsRef.current, book, chapter, ranges, now)
    highlightsRef.current = result.next
    setHighlights(result.next)
    return { ids: result.ids, replaced: result.replaced }
  }, [])

  const removeHighlight = useCallback((id) => {
    const next = highlightsRef.current.filter(h => h.id !== id)
    highlightsRef.current = next
    setHighlights(next)
  }, [])

  const removeHighlights = useCallback((ids) => {
    if (!ids?.length) return
    const remove = new Set(ids)
    const next = highlightsRef.current.filter(h => !remove.has(h.id))
    highlightsRef.current = next
    setHighlights(next)
  }, [])

  const restoreHighlights = useCallback((entries) => {
    if (!entries?.length) return
    const existing = new Set(highlightsRef.current.map(h => h.id))
    const toAdd = entries.filter(h => h?.id && !existing.has(h.id))
    if (!toAdd.length) return
    const next = [...highlightsRef.current, ...toAdd]
    highlightsRef.current = next
    setHighlights(next)
  }, [])

  const findHighlightAt = useCallback((book, chapter, verse, offset) => {
    const matches = highlights.filter(h =>
      h.book === book
      && h.chapter === chapter
      && h.verse === verse
      && h.start <= offset
      && h.end > offset
    )
    return matches.length ? matches[matches.length - 1] : null
  }, [highlights])

  return {
    highlights,
    getVerseHighlights,
    addHighlightRanges,
    removeHighlight,
    removeHighlights,
    restoreHighlights,
    findHighlightAt,
  }
}
