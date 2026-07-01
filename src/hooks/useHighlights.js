import { useState, useEffect, useCallback } from 'react'
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

export function useHighlights() {
  const [highlights, setHighlights] = useState([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const stored = await getStoredJson(STORAGE_KEY, [])
        if (cancelled) return
        const list = Array.isArray(stored) ? stored.map(migrateHighlight) : []
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
    if (!ranges.length) return
    const now = new Date().toISOString()
    setHighlights(prev => [
      ...prev,
      ...ranges.map((range) => ({
        id: uuidv4(),
        book,
        chapter,
        verse: range.verse,
        start: range.start,
        end: range.end,
        color: range.color,
        dateCreated: now,
      })),
    ])
  }, [])

  const removeHighlight = useCallback((id) => {
    setHighlights(prev => prev.filter(h => h.id !== id))
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
    findHighlightAt,
  }
}
