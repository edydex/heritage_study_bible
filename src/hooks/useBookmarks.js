import { useState, useEffect } from 'react'
import { getStoredJson, setStoredJson, STORAGE_KEYS } from '../services/persistentStorage'
import {
  annotationIncludesVerse,
  annotationsOverlap,
  buildGroupedAnnotation,
  getAnnotationVerses,
} from '../utils/verseAnnotations'
import { resolveTextAnchor, textSelectionMatchesAnnotation } from '../utils/textSelection'
import { normalizeHighlightColor } from '../utils/highlightColors'

const STORAGE_KEY = STORAGE_KEYS.bookmarks
const COMMENTARY_STORAGE_KEY = STORAGE_KEYS.commentaryBookmarks
const NOTES_STORAGE_KEY = STORAGE_KEYS.notes
const HIGHLIGHTS_STORAGE_KEY = STORAGE_KEYS.highlights

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState([])
  const [commentaryBookmarks, setCommentaryBookmarks] = useState([])
  const [notes, setNotes] = useState([])
  const [highlights, setHighlights] = useState([])
  const [hydrated, setHydrated] = useState(false)

  // Load from localStorage first, then native Preferences if this is the Android app.
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [storedBookmarks, storedCommentary, storedNotes, storedHighlights] = await Promise.all([
          getStoredJson(STORAGE_KEY, []),
          getStoredJson(COMMENTARY_STORAGE_KEY, []),
          getStoredJson(NOTES_STORAGE_KEY, []),
          getStoredJson(HIGHLIGHTS_STORAGE_KEY, []),
        ])

        if (cancelled) return
        setBookmarks(Array.isArray(storedBookmarks) ? storedBookmarks : [])
        setCommentaryBookmarks(Array.isArray(storedCommentary) ? storedCommentary : [])
        setNotes(Array.isArray(storedNotes) ? storedNotes : [])
        setHighlights(Array.isArray(storedHighlights) ? storedHighlights : [])
      } catch (e) {
        console.error('Error loading bookmarks:', e)
      } finally {
        if (!cancelled) setHydrated(true)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    setStoredJson(STORAGE_KEY, bookmarks).catch(e => console.error('Error saving bookmarks:', e))
  }, [bookmarks, hydrated])

  useEffect(() => {
    if (!hydrated) return
    setStoredJson(COMMENTARY_STORAGE_KEY, commentaryBookmarks).catch(e => console.error('Error saving commentary bookmarks:', e))
  }, [commentaryBookmarks, hydrated])

  useEffect(() => {
    if (!hydrated) return
    setStoredJson(NOTES_STORAGE_KEY, notes).catch(e => console.error('Error saving notes:', e))
  }, [notes, hydrated])

  useEffect(() => {
    if (!hydrated) return
    setStoredJson(HIGHLIGHTS_STORAGE_KEY, highlights).catch(e => console.error('Error saving highlights:', e))
  }, [highlights, hydrated])

  const addBookmark = (bookmark) => {
    const newBookmark = {
      id: crypto.randomUUID(),
      ...bookmark,
      dateCreated: new Date().toISOString(),
      dateModified: new Date().toISOString()
    }
    setBookmarks(prev => [...prev, newBookmark])
    return newBookmark
  }

  const removeBookmark = (book, chapter, verse) => {
    setBookmarks(prev => prev.filter(b => 
      !(b.book === book && b.chapter === chapter && b.verse === verse)
    ))
  }

  const updateBookmark = (id, updates) => {
    setBookmarks(prev => prev.map(b => 
      b.id === id 
        ? { ...b, ...updates, dateModified: new Date().toISOString() }
        : b
    ))
  }

  const isBookmarked = (book, chapter, verse) => {
    return bookmarks.some(b => 
      b.book === book && b.chapter === chapter && b.verse === verse
    )
  }

  const getBookmark = (book, chapter, verse) => {
    return bookmarks.find(b => 
      b.book === book && b.chapter === chapter && b.verse === verse
    )
  }

  const addCommentaryBookmark = (commentary, authorName, workTitle) => {
    const existing = commentaryBookmarks.find(cb => cb.commentaryId === commentary.id)
    if (existing) return existing

    const newBookmark = {
      id: crypto.randomUUID(),
      commentaryId: commentary.id,
      reference: commentary.reference,
      chapter: commentary.chapter,
      authorName,
      workTitle,
      textSnippet: commentary.text.substring(0, 150),
      dateCreated: new Date().toISOString()
    }
    setCommentaryBookmarks(prev => [...prev, newBookmark])
    return newBookmark
  }

  const removeCommentaryBookmark = (commentaryId) => {
    setCommentaryBookmarks(prev => prev.filter(cb => cb.commentaryId !== commentaryId))
  }

  const isCommentaryBookmarked = (commentaryId) => {
    return commentaryBookmarks.some(cb => cb.commentaryId === commentaryId)
  }

  const toggleCommentaryBookmark = (commentary, authorName, workTitle) => {
    if (isCommentaryBookmarked(commentary.id)) {
      removeCommentaryBookmark(commentary.id)
      return false
    } else {
      addCommentaryBookmark(commentary, authorName, workTitle)
      return true
    }
  }

  const saveNotes = (verses, text, options = {}) => {
    const grouped = buildGroupedAnnotation(verses)
    if (!grouped) return null
    const trimmedText = String(text || '').trim()
    const now = new Date().toISOString()

    setNotes(prev => {
      const overlapping = prev.filter(note => !note.segments?.length && annotationsOverlap(note, grouped))
      const withoutOverlapping = prev.filter(note => note.segments?.length || !annotationsOverlap(note, grouped))
      if (!trimmedText) return withoutOverlapping

      const existingExact = overlapping.find(note => {
        const existingVerses = getAnnotationVerses(note)
        const nextVerses = getAnnotationVerses(grouped)
        return existingVerses.length === nextVerses.length
          && existingVerses.every(item => annotationIncludesVerse(grouped, item.book, item.chapter, item.verse))
      })
      const verseText = grouped.verses
        .map(item => item.text || item.verseText || '')
        .filter(Boolean)
        .join(' ')
      const note = {
        ...grouped,
        id: existingExact?.id || crypto.randomUUID(),
        type: 'note',
        text: String(text),
        verseText,
        inline: options.inline === true,
        dateCreated: existingExact?.dateCreated || now,
        dateModified: now,
      }
      return [...withoutOverlapping, note]
    })
    return grouped
  }

  const saveNote = (book, chapter, verse, text, verseText = '', options = {}) => {
    const now = new Date().toISOString()
    const trimmedText = String(text || '').trim()
    setNotes(prev => {
      const existing = prev.find(note => !note.segments?.length && annotationIncludesVerse(note, book, chapter, verse))
      if (existing) {
        if (!trimmedText) return prev.filter(note => note.id !== existing.id)
        return prev.map(note => note.id === existing.id
          ? { ...note, text: String(text), inline: options.inline ?? note.inline ?? false, dateModified: now }
          : note)
      }
      if (!trimmedText) return prev
      const grouped = buildGroupedAnnotation([{ book, chapter, verse, text: verseText }])
      return [...prev, {
        ...grouped,
        id: crypto.randomUUID(),
        type: 'note',
        text: String(text),
        verseText,
        inline: options.inline === true,
        dateCreated: now,
        dateModified: now,
      }]
    })
  }

  const deleteNote = (book, chapter, verse) => {
    setNotes(prev => prev.filter(n => 
      n.segments?.length || !annotationIncludesVerse(n, book, chapter, verse)
    ))
  }

  const deleteNoteById = id => {
    setNotes(prev => prev.filter(note => note.id !== id))
  }

  const getNote = (book, chapter, verse) => {
    return notes.find(n => 
      annotationIncludesVerse(n, book, chapter, verse)
    )
  }

  const hasNote = (book, chapter, verse) => {
    return notes.some(n => 
      annotationIncludesVerse(n, book, chapter, verse)
    )
  }

  const addHighlight = (verses, color = 'yellow') => {
    const grouped = buildGroupedAnnotation(verses)
    if (!grouped) return null
    const now = new Date().toISOString()
    setHighlights(prev => {
      const overlapping = prev.filter(highlight => !highlight.segments?.length && annotationsOverlap(highlight, grouped))
      const merged = buildGroupedAnnotation([
        ...grouped.verses,
        ...overlapping.flatMap(getAnnotationVerses),
      ])
      return [
        ...prev.filter(highlight => highlight.segments?.length || !annotationsOverlap(highlight, grouped)),
        {
          ...merged,
          id: crypto.randomUUID(),
          type: 'highlight',
          kind: 'verses',
          color: normalizeHighlightColor(color),
          dateCreated: now,
          dateModified: now,
        },
      ]
    })
    return grouped
  }

  const removeHighlights = (verses) => {
    const grouped = buildGroupedAnnotation(verses)
    if (!grouped) return
    const now = new Date().toISOString()
    setHighlights(prev => prev.flatMap(highlight => {
      if (highlight.segments?.length) return [highlight]
      if (!annotationsOverlap(highlight, grouped)) return [highlight]
      const remaining = getAnnotationVerses(highlight).filter(item =>
        !annotationIncludesVerse(grouped, item.book, item.chapter, item.verse)
      )
      const replacement = buildGroupedAnnotation(remaining, {
        ...highlight,
        dateModified: now,
      })
      return replacement ? [replacement] : []
    }))
  }

  const isHighlighted = (book, chapter, verse) => {
    return highlights.some(highlight => !highlight.segments?.length
      && annotationIncludesVerse(highlight, book, chapter, verse))
  }

  const getVerseHighlightColor = (book, chapter, verse) => {
    const highlight = highlights.find(item => !item.segments?.length
      && annotationIncludesVerse(item, book, chapter, verse))
    return highlight ? normalizeHighlightColor(highlight.color) : null
  }

  const addTextHighlight = (selection, color = 'yellow') => {
    if (!selection?.segments?.length || selection.mixedTranslations) return null
    const now = new Date().toISOString()
    const highlight = {
      ...selection,
      id: crypto.randomUUID(),
      type: 'highlight',
      kind: 'text',
      color: normalizeHighlightColor(color),
      dateCreated: now,
      dateModified: now,
    }
    setHighlights(prev => [
      ...prev.filter(item => !textSelectionMatchesAnnotation(selection, item)),
      highlight,
    ])
    return highlight
  }

  const removeTextHighlight = selection => {
    setHighlights(prev => prev.filter(item => !textSelectionMatchesAnnotation(selection, item)))
  }

  const isTextSelectionHighlighted = selection => {
    return highlights.some(item => textSelectionMatchesAnnotation(selection, item))
  }

  const getTextSelectionHighlight = selection => {
    return highlights.find(item => textSelectionMatchesAnnotation(selection, item)) || null
  }

  const getTextHighlights = (book, chapter, verse, translationId, verseText) => {
    return highlights.flatMap(highlight => {
      if (highlight.translationId !== translationId || !Array.isArray(highlight.segments)) return []
      return highlight.segments
        .filter(segment =>
          segment.book === book
          && segment.chapter === Number(chapter)
          && segment.verse === Number(verse)
        )
        .map(segment => {
          const resolved = resolveTextAnchor(segment, verseText)
          return resolved ? { ...resolved, color: normalizeHighlightColor(highlight.color) } : null
        })
        .filter(Boolean)
    })
  }

  const saveTextNote = (selection, text, options = {}) => {
    if (!selection?.segments?.length || selection.mixedTranslations) return null
    const trimmedText = String(text || '').trim()
    const now = new Date().toISOString()
    setNotes(prev => {
      const existing = prev.find(note => textSelectionMatchesAnnotation(selection, note))
      if (!trimmedText) return existing ? prev.filter(note => note.id !== existing.id) : prev
      const note = {
        ...selection,
        id: existing?.id || crypto.randomUUID(),
        type: 'note',
        kind: 'text',
        text: String(text),
        verseText: selection.selectedText,
        inline: options.inline === true,
        dateCreated: existing?.dateCreated || now,
        dateModified: now,
      }
      return [...prev.filter(item => item.id !== existing?.id), note]
    })
    return selection
  }

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
    updateBookmark,
    isBookmarked,
    getBookmark,
    commentaryBookmarks,
    addCommentaryBookmark,
    removeCommentaryBookmark,
    isCommentaryBookmarked,
    toggleCommentaryBookmark,
    notes,
    saveNote,
    saveNotes,
    deleteNote,
    deleteNoteById,
    getNote,
    hasNote,
    highlights,
    addHighlight,
    removeHighlights,
    isHighlighted,
    getVerseHighlightColor,
    addTextHighlight,
    removeTextHighlight,
    isTextSelectionHighlighted,
    getTextSelectionHighlight,
    getTextHighlights,
    saveTextNote,
  }
}
