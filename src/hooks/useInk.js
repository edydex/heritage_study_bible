import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getStoredJson, setStoredJson, STORAGE_KEYS } from '../services/persistentStorage'

const STORAGE_KEY = STORAGE_KEYS.ink

export const INK_PANES = { bible: 'bible', notes: 'notes', page: 'page' }

function matches(entry, book, chapter, pane) {
  return entry.book === book && entry.chapter === chapter && entry.pane === pane
}

/** Merge legacy bible/notes pane entries into a single page pane per chapter. */
export function migrateInkEntries(entries) {
  if (!Array.isArray(entries)) return []

  const byChapter = new Map()
  const pageEntries = []
  const other = []

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    if (entry.pane === INK_PANES.page) {
      pageEntries.push(entry)
      continue
    }
    if (entry.pane === INK_PANES.bible || entry.pane === INK_PANES.notes) {
      const key = `${entry.book}::${entry.chapter}`
      if (!byChapter.has(key)) {
        byChapter.set(key, { book: entry.book, chapter: entry.chapter, strokes: [] })
      }
      const bucket = byChapter.get(key)
      if (Array.isArray(entry.strokes)) {
        bucket.strokes.push(...entry.strokes)
      }
      continue
    }
    other.push(entry)
  }

  // Merge any existing page entries with migrated bible/notes strokes.
  const pageByChapter = new Map()
  for (const entry of pageEntries) {
    const key = `${entry.book}::${entry.chapter}`
    pageByChapter.set(key, {
      book: entry.book,
      chapter: entry.chapter,
      pane: INK_PANES.page,
      strokes: [...(entry.strokes || [])],
    })
  }

  for (const [key, bucket] of byChapter) {
    if (pageByChapter.has(key)) {
      pageByChapter.get(key).strokes.push(...bucket.strokes)
    } else if (bucket.strokes.length > 0) {
      pageByChapter.set(key, {
        book: bucket.book,
        chapter: bucket.chapter,
        pane: INK_PANES.page,
        strokes: bucket.strokes,
      })
    }
  }

  return [
    ...other,
    ...[...pageByChapter.values()].filter(e => e.strokes.length > 0),
  ]
}

export function useInk() {
  const [entries, setEntries] = useState([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const stored = await getStoredJson(STORAGE_KEY, [])
        if (cancelled) return
        setEntries(migrateInkEntries(Array.isArray(stored) ? stored : []))
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

  const getStrokes = useCallback((book, chapter, pane = INK_PANES.page) => {
    const entry = entries.find(e => matches(e, book, chapter, pane))
    return entry?.strokes || []
  }, [entries])

  const hasStrokesOnAnchor = useCallback((book, chapter, pane, anchorId) => {
    return getStrokes(book, chapter, pane).some(s => s.anchorId === anchorId)
  }, [getStrokes])

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

  return {
    entries,
    hydrated,
    getStrokes,
    hasStrokesOnAnchor,
    addStroke,
    eraseStroke,
    clearPane,
  }
}
