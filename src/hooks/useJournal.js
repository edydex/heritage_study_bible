import { useState, useEffect, useCallback } from 'react'
import { getStoredJson, setStoredJson, STORAGE_KEYS } from '../services/persistentStorage'

const STORAGE_KEY = STORAGE_KEYS.journal

export const JOURNAL_PANES = { bible: 'bible', notes: 'notes' }

export const DEFAULT_BIBLE_EXTRA_SPACE = 160
export const BIBLE_SPACE_INCREMENT = 200

function paneOf(entry) {
  return entry?.pane || JOURNAL_PANES.notes
}

function matches(entry, book, chapter, pane) {
  return entry.book === book && entry.chapter === chapter && paneOf(entry) === pane
}

// Per-chapter journal entries, keyed by book + chapter + pane.
//   notes pane: { book, chapter, pane: 'notes', text, dateModified }
//   bible pane: { book, chapter, pane: 'bible', text, extraSpace, dateModified }
export function useJournal() {
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
        console.error('Error loading journal entries:', e)
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    setStoredJson(STORAGE_KEY, entries).catch(e => console.error('Error saving journal entries:', e))
  }, [entries, hydrated])

  const getEntry = useCallback((book, chapter, pane = JOURNAL_PANES.notes) => {
    return entries.find(e => matches(e, book, chapter, pane)) || null
  }, [entries])

  const saveEntry = useCallback((book, chapter, text, pane = JOURNAL_PANES.notes) => {
    setEntries(prev => {
      const existing = prev.find(e => matches(e, book, chapter, pane))
      const trimmed = (text ?? '').trim()
      const extraSpace = existing?.extraSpace ?? DEFAULT_BIBLE_EXTRA_SPACE

      if (existing) {
        // Bible pane: keep the entry when extra space was added, even if text is empty.
        const hasBibleSpace = pane === JOURNAL_PANES.bible && extraSpace > DEFAULT_BIBLE_EXTRA_SPACE
        if (trimmed === '' && !hasBibleSpace) {
          return prev.filter(e => e !== existing)
        }
        return prev.map(e => e === existing
          ? { ...e, text, dateModified: new Date().toISOString() }
          : e)
      }
      if (trimmed === '' && pane !== JOURNAL_PANES.bible) return prev
      return [...prev, {
        book,
        chapter,
        pane,
        text,
        ...(pane === JOURNAL_PANES.bible ? { extraSpace: DEFAULT_BIBLE_EXTRA_SPACE } : {}),
        dateCreated: new Date().toISOString(),
        dateModified: new Date().toISOString(),
      }]
    })
  }, [])

  const addBibleSpace = useCallback((book, chapter, increment = BIBLE_SPACE_INCREMENT) => {
    setEntries(prev => {
      const existing = prev.find(e => matches(e, book, chapter, JOURNAL_PANES.bible))
      if (existing) {
        return prev.map(e => e === existing
          ? {
            ...e,
            extraSpace: (e.extraSpace ?? DEFAULT_BIBLE_EXTRA_SPACE) + increment,
            dateModified: new Date().toISOString(),
          }
          : e)
      }
      return [...prev, {
        book,
        chapter,
        pane: JOURNAL_PANES.bible,
        text: '',
        extraSpace: DEFAULT_BIBLE_EXTRA_SPACE + increment,
        dateCreated: new Date().toISOString(),
        dateModified: new Date().toISOString(),
      }]
    })
  }, [])

  return { entries, getEntry, saveEntry, addBibleSpace, hydrated }
}
