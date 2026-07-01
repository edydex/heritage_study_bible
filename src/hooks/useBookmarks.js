import { useState, useEffect } from 'react'
import { getStoredJson, setStoredJson, STORAGE_KEYS } from '../services/persistentStorage'

const STORAGE_KEY = STORAGE_KEYS.bookmarks
const COMMENTARY_STORAGE_KEY = STORAGE_KEYS.commentaryBookmarks
const NOTES_STORAGE_KEY = STORAGE_KEYS.notes

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState([])
  const [commentaryBookmarks, setCommentaryBookmarks] = useState([])
  const [notes, setNotes] = useState([])
  const [hydrated, setHydrated] = useState(false)

  // Load from localStorage first, then native Preferences if this is the Android app.
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const [storedBookmarks, storedCommentary, storedNotes] = await Promise.all([
          getStoredJson(STORAGE_KEY, []),
          getStoredJson(COMMENTARY_STORAGE_KEY, []),
          getStoredJson(NOTES_STORAGE_KEY, []),
        ])

        if (cancelled) return
        setBookmarks(Array.isArray(storedBookmarks) ? storedBookmarks : [])
        setCommentaryBookmarks(Array.isArray(storedCommentary) ? storedCommentary : [])
        setNotes(Array.isArray(storedNotes) ? storedNotes : [])
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

  const saveNote = (book, chapter, verse, text, verseText = '') => {
    const existing = notes.find(n => 
      n.book === book && n.chapter === chapter && n.verse === verse
    )
    
    if (existing) {
      if (text.trim() === '') {
        setNotes(prev => prev.filter(n => n.id !== existing.id))
        return null
      }
      setNotes(prev => prev.map(n => 
        n.id === existing.id 
          ? { ...n, text, dateModified: new Date().toISOString() }
          : n
      ))
      return existing
    } else if (text.trim() !== '') {
      const newNote = {
        id: crypto.randomUUID(),
        type: 'note',
        book,
        chapter,
        verse,
        text,
        verseText,
        dateCreated: new Date().toISOString(),
        dateModified: new Date().toISOString()
      }
      setNotes(prev => [...prev, newNote])
      return newNote
    }
    return null
  }

  const deleteNote = (book, chapter, verse) => {
    setNotes(prev => prev.filter(n => 
      !(n.book === book && n.chapter === chapter && n.verse === verse)
    ))
  }

  const getNote = (book, chapter, verse) => {
    return notes.find(n => 
      n.book === book && n.chapter === chapter && n.verse === verse
    )
  }

  const hasNote = (book, chapter, verse) => {
    return notes.some(n => 
      n.book === book && n.chapter === chapter && n.verse === verse
    )
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
    deleteNote,
    getNote,
    hasNote
  }
}
