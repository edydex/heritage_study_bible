import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getStoredJson, setStoredJson, STORAGE_KEYS } from '../services/persistentStorage'

const STORAGE_KEY = STORAGE_KEYS.ink

export const INK_PANES = { bible: 'bible', notes: 'notes' }

function matches(entry, book, chapter, pane) {
  return entry.book === book && entry.chapter === chapter && entry.pane === pane
}

// Per-chapter, per-pane freehand ink strokes. Each entry:
//   { book, chapter, pane, strokes: [ { id, color, size, points: [[x,y,pressure], ...] } ] }
export function useInk() {
  const [entries, setEntries] = useState([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const stored = await getStoredJson(STORAGE_KEY, [])
        if (cancelled) return
        setEntries(Array.isArray(stored) ? stored : [])
      } catch (e) {
        console.error('Error loading ink:', e)
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    setStoredJson(STORAGE_KEY, entries).catch(e => console.error('Error saving ink:', e))
  }, [entries, hydrated])

  const getStrokes = useCallback((book, chapter, pane) => {
    const entry = entries.find(e => matches(e, book, chapter, pane))
    return entry?.strokes || []
  }, [entries])

  const addStroke = useCallback((book, chapter, pane, stroke) => {
    const withId = { id: stroke.id || uuidv4(), ...stroke }
    setEntries(prev => {
      const existing = prev.find(e => matches(e, book, chapter, pane))
      if (existing) {
        return prev.map(e => e === existing
          ? { ...e, strokes: [...e.strokes, withId] }
          : e)
      }
      return [...prev, { book, chapter, pane, strokes: [withId] }]
    })
    return withId
  }, [])

  const eraseStroke = useCallback((book, chapter, pane, strokeId) => {
    setEntries(prev => prev
      .map(e => matches(e, book, chapter, pane)
        ? { ...e, strokes: e.strokes.filter(s => s.id !== strokeId) }
        : e)
      .filter(e => e.strokes.length > 0))
  }, [])

  const clearPane = useCallback((book, chapter, pane) => {
    setEntries(prev => prev.filter(e => !matches(e, book, chapter, pane)))
  }, [])

  return { entries, getStrokes, addStroke, eraseStroke, clearPane, hydrated }
}
