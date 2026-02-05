import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'

const STORAGE_KEY = 'bible-study-bookmarks'
const COMMENTARY_STORAGE_KEY = 'bible-study-commentary-bookmarks'

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState([])
  const [commentaryBookmarks, setCommentaryBookmarks] = useState([])

  // Load bookmarks from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setBookmarks(JSON.parse(stored))
      }
      const storedCommentary = localStorage.getItem(COMMENTARY_STORAGE_KEY)
      if (storedCommentary) {
        setCommentaryBookmarks(JSON.parse(storedCommentary))
      }
    } catch (e) {
      console.error('Error loading bookmarks:', e)
    }
  }, [])

  // Save bookmarks to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks))
    } catch (e) {
      console.error('Error saving bookmarks:', e)
    }
  }, [bookmarks])

  // Save commentary bookmarks
  useEffect(() => {
    try {
      localStorage.setItem(COMMENTARY_STORAGE_KEY, JSON.stringify(commentaryBookmarks))
    } catch (e) {
      console.error('Error saving commentary bookmarks:', e)
    }
  }, [commentaryBookmarks])

  const addBookmark = (bookmark) => {
    const newBookmark = {
      id: uuidv4(),
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

  // Commentary bookmark functions
  const addCommentaryBookmark = (commentary, authorName, workTitle) => {
    const existing = commentaryBookmarks.find(cb => cb.commentaryId === commentary.id)
    if (existing) return existing

    const newBookmark = {
      id: uuidv4(),
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
    toggleCommentaryBookmark
  }
}
