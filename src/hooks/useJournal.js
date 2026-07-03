import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { getStoredJson, setStoredJson, STORAGE_KEYS } from '../services/persistentStorage'

const STORAGE_KEY = STORAGE_KEYS.journal

export const JOURNAL_PANES = { bible: 'bible', notes: 'notes' }

export const DEFAULT_GAP_HEIGHT = 120
export const GAP_HEIGHT_INCREMENT = 80
export const DEFAULT_PAGE_HEIGHT = 800
export const PAGE_HEIGHT_INCREMENT = 200

/** Sentinel: gap appears after all verses when migrating legacy margin notes. */
export const AFTER_ALL_VERSES = 0

function paneOf(entry) {
  return entry?.pane || JOURNAL_PANES.notes
}

function matches(entry, book, chapter, pane) {
  return entry.book === book && entry.chapter === chapter && paneOf(entry) === pane
}

function migrateEntry(entry) {
  const pane = paneOf(entry)

  if (pane === JOURNAL_PANES.bible) {
    if (Array.isArray(entry.gaps)) return { ...entry, pane }
    const gaps = []
    const legacyText = (entry.text ?? '').trim()
    const legacyHeight = entry.extraSpace ?? DEFAULT_GAP_HEIGHT
    if (legacyText || legacyHeight > DEFAULT_GAP_HEIGHT) {
      gaps.push({
        id: uuidv4(),
        afterVerse: AFTER_ALL_VERSES,
        height: Math.max(legacyHeight, DEFAULT_GAP_HEIGHT),
        text: entry.text ?? '',
      })
    }
    return { ...entry, pane, gaps, text: undefined, extraSpace: undefined }
  }

  if (pane === JOURNAL_PANES.notes) {
    if (Array.isArray(entry.blocks)) return { ...entry, pane }
    const blocks = []
    const legacyText = (entry.text ?? '').trim()
    if (legacyText) {
      blocks.push({ id: uuidv4(), y: 16, text: entry.text })
    }
    return {
      ...entry,
      pane,
      blocks,
      pageHeight: entry.pageHeight ?? DEFAULT_PAGE_HEIGHT,
      text: undefined,
    }
  }

  return entry
}

function sortGaps(gaps) {
  return [...gaps].sort((a, b) => a.afterVerse - b.afterVerse || a.id.localeCompare(b.id))
}

export function useJournal() {
  const [entries, setEntries] = useState([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const stored = await getStoredJson(STORAGE_KEY, [])
        if (cancelled) return
        const list = Array.isArray(stored) ? stored.map(migrateEntry) : []
        setEntries(list)
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

  const getBibleGaps = useCallback((book, chapter) => {
    const entry = getEntry(book, chapter, JOURNAL_PANES.bible)
    return sortGaps(entry?.gaps ?? [])
  }, [getEntry])

  const upsertBibleEntry = useCallback((book, chapter, updater) => {
    setEntries(prev => {
      const existing = prev.find(e => matches(e, book, chapter, JOURNAL_PANES.bible))
      const now = new Date().toISOString()
      if (existing) {
        const next = updater({ ...existing, gaps: [...(existing.gaps ?? [])] })
        if (!next || (next.gaps?.length ?? 0) === 0) {
          return prev.filter(e => e !== existing)
        }
        return prev.map(e => e === existing
          ? { ...next, dateModified: now }
          : e)
      }
      const created = updater({
        book,
        chapter,
        pane: JOURNAL_PANES.bible,
        gaps: [],
        dateCreated: now,
        dateModified: now,
      })
      if (!created || (created.gaps?.length ?? 0) === 0) return prev
      return [...prev, created]
    })
  }, [])

  const addGap = useCallback((book, chapter, afterVerse) => {
    const gap = {
      id: uuidv4(),
      afterVerse,
      height: DEFAULT_GAP_HEIGHT,
      text: '',
    }
    upsertBibleEntry(book, chapter, (entry) => ({
      ...entry,
      gaps: sortGaps([...(entry.gaps ?? []), gap]),
    }))
    return gap.id
  }, [upsertBibleEntry])

  const updateGap = useCallback((book, chapter, gapId, updates) => {
    upsertBibleEntry(book, chapter, (entry) => ({
      ...entry,
      gaps: (entry.gaps ?? []).map(g => g.id === gapId ? { ...g, ...updates } : g),
    }))
  }, [upsertBibleEntry])

  const removeGap = useCallback((book, chapter, gapId) => {
    upsertBibleEntry(book, chapter, (entry) => ({
      ...entry,
      gaps: (entry.gaps ?? []).filter(g => g.id !== gapId),
    }))
  }, [upsertBibleEntry])

  const getNotesBlocks = useCallback((book, chapter) => {
    const entry = getEntry(book, chapter, JOURNAL_PANES.notes)
    return entry?.blocks ?? []
  }, [getEntry])

  const getNotesPageHeight = useCallback((book, chapter) => {
    const entry = getEntry(book, chapter, JOURNAL_PANES.notes)
    return entry?.pageHeight ?? DEFAULT_PAGE_HEIGHT
  }, [getEntry])

  const upsertNotesEntry = useCallback((book, chapter, updater) => {
    setEntries(prev => {
      const existing = prev.find(e => matches(e, book, chapter, JOURNAL_PANES.notes))
      const now = new Date().toISOString()
      if (existing) {
        const next = updater({ ...existing, blocks: [...(existing.blocks ?? [])] })
        const hasBlocks = (next.blocks?.length ?? 0) > 0
        const hasHeight = (next.pageHeight ?? DEFAULT_PAGE_HEIGHT) > DEFAULT_PAGE_HEIGHT
        if (!hasBlocks && !hasHeight) {
          return prev.filter(e => e !== existing)
        }
        return prev.map(e => e === existing
          ? { ...next, dateModified: now }
          : e)
      }
      const created = updater({
        book,
        chapter,
        pane: JOURNAL_PANES.notes,
        blocks: [],
        pageHeight: DEFAULT_PAGE_HEIGHT,
        dateCreated: now,
        dateModified: now,
      })
      return [...prev, created]
    })
  }, [])

  const addNotesBlock = useCallback((book, chapter, y, text = '') => {
    const block = { id: uuidv4(), y, text }
    upsertNotesEntry(book, chapter, (entry) => ({
      ...entry,
      blocks: [...(entry.blocks ?? []), block],
    }))
    return block.id
  }, [upsertNotesEntry])

  const updateNotesBlock = useCallback((book, chapter, blockId, updates) => {
    upsertNotesEntry(book, chapter, (entry) => ({
      ...entry,
      blocks: (entry.blocks ?? []).map(b => b.id === blockId ? { ...b, ...updates } : b),
    }))
  }, [upsertNotesEntry])

  const removeNotesBlock = useCallback((book, chapter, blockId) => {
    upsertNotesEntry(book, chapter, (entry) => ({
      ...entry,
      blocks: (entry.blocks ?? []).filter(b => b.id !== blockId),
    }))
  }, [upsertNotesEntry])

  const addNotesPageHeight = useCallback((book, chapter, increment = PAGE_HEIGHT_INCREMENT) => {
    upsertNotesEntry(book, chapter, (entry) => ({
      ...entry,
      pageHeight: (entry.pageHeight ?? DEFAULT_PAGE_HEIGHT) + increment,
    }))
  }, [upsertNotesEntry])

  return {
    entries,
    hydrated,
    getEntry,
    getBibleGaps,
    addGap,
    updateGap,
    removeGap,
    getNotesBlocks,
    getNotesPageHeight,
    addNotesBlock,
    updateNotesBlock,
    removeNotesBlock,
    addNotesPageHeight,
  }
}
