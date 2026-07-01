import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getStoredJson, setStoredJson, STORAGE_KEYS } from '../services/persistentStorage'

const STORAGE_KEY = STORAGE_KEYS.highlights

// Fixed 4-color palette. Class strings are written as literals so Tailwind's
// content scanner picks them up at build time (no dynamic class construction).
export const HIGHLIGHT_COLORS = [
  { id: 'yellow', label: 'Yellow', swatch: 'bg-yellow-300', verseClass: 'bg-yellow-200 dark:bg-yellow-500/30' },
  { id: 'green', label: 'Green', swatch: 'bg-green-300', verseClass: 'bg-green-200 dark:bg-green-500/30' },
  { id: 'blue', label: 'Blue', swatch: 'bg-blue-300', verseClass: 'bg-blue-200 dark:bg-blue-500/30' },
  { id: 'pink', label: 'Pink', swatch: 'bg-pink-300', verseClass: 'bg-pink-200 dark:bg-pink-500/30' },
]

export function getHighlightColor(colorId) {
  return HIGHLIGHT_COLORS.find(c => c.id === colorId) || null
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
        setHighlights(Array.isArray(stored) ? stored : [])
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

  const getHighlight = useCallback((book, chapter, verse) => {
    return highlights.find(h => h.book === book && h.chapter === chapter && h.verse === verse) || null
  }, [highlights])

  // Toggle off when the same color is applied again; replace when a different
  // color is chosen; create when none exists.
  const setHighlight = useCallback((book, chapter, verse, color) => {
    setHighlights(prev => {
      const existing = prev.find(h => h.book === book && h.chapter === chapter && h.verse === verse)
      if (existing) {
        if (existing.color === color) {
          return prev.filter(h => h.id !== existing.id)
        }
        return prev.map(h => h.id === existing.id ? { ...h, color } : h)
      }
      return [...prev, { id: uuidv4(), book, chapter, verse, color, dateCreated: new Date().toISOString() }]
    })
  }, [])

  const clearHighlight = useCallback((book, chapter, verse) => {
    setHighlights(prev => prev.filter(h => !(h.book === book && h.chapter === chapter && h.verse === verse)))
  }, [])

  return { highlights, getHighlight, setHighlight, clearHighlight }
}
