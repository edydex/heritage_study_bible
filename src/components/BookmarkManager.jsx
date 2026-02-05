import { useState, useEffect } from 'react'

function BookmarkManager({ bookmarks, commentaryBookmarks = [], onClose, onNavigate, onDelete, onUpdateNote, onDeleteCommentary, onNavigateToCommentary }) {
  const [viewMode, setViewMode] = useState('date') // 'date' or 'books'
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedItems, setExpandedItems] = useState({})
  const [editingNote, setEditingNote] = useState(null)
  const [noteText, setNoteText] = useState('')

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Normalize commentary bookmarks to match verse bookmark structure
  const normalizedCommentaryBookmarks = commentaryBookmarks.map(cb => ({
    ...cb,
    id: cb.id || cb.commentaryId,
    type: 'commentary',
    book: 'Revelation',
    chapter: cb.chapter,
    verse: cb.startVerse || 0,
    verseText: cb.textSnippet || '',
    dateCreated: cb.dateCreated || new Date().toISOString()
  }))

  // Normalize verse bookmarks
  const normalizedVerseBookmarks = bookmarks.map(b => ({
    ...b,
    type: 'verse'
  }))

  // Combine all bookmarks
  const allBookmarks = [...normalizedVerseBookmarks, ...normalizedCommentaryBookmarks]

  // Filter bookmarks by search
  const filteredBookmarks = allBookmarks.filter(b => {
    if (searchQuery === '') return true
    const query = searchQuery.toLowerCase()
    if (b.type === 'commentary') {
      return (
        b.reference?.toLowerCase().includes(query) ||
        b.authorName?.toLowerCase().includes(query) ||
        b.textSnippet?.toLowerCase().includes(query) ||
        b.workTitle?.toLowerCase().includes(query)
      )
    }
    return (
      b.verseText?.toLowerCase().includes(query) ||
      b.userNote?.toLowerCase().includes(query) ||
      `${b.book} ${b.chapter}:${b.verse}`.toLowerCase().includes(query)
    )
  })

  // Group bookmarks by date
  const groupByDate = () => {
    const groups = {}
    filteredBookmarks.forEach(bookmark => {
      const date = new Date(bookmark.dateCreated)
      const dateKey = formatDate(date)
      if (!groups[dateKey]) {
        groups[dateKey] = { date: dateKey, books: new Set(), bookmarks: [] }
      }
      groups[dateKey].books.add(bookmark.book)
      groups[dateKey].bookmarks.push(bookmark)
    })
    // Sort bookmarks within each group by date (newest first)
    Object.values(groups).forEach(group => {
      group.bookmarks.sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated))
    })
    return Object.values(groups).sort((a, b) => 
      new Date(b.bookmarks[0].dateCreated) - new Date(a.bookmarks[0].dateCreated)
    )
  }

  // Group bookmarks by book/chapter
  const groupByBooks = () => {
    const groups = {}
    filteredBookmarks.forEach(bookmark => {
      if (!groups[bookmark.book]) {
        groups[bookmark.book] = { chapters: {} }
      }
      if (!groups[bookmark.book].chapters[bookmark.chapter]) {
        groups[bookmark.book].chapters[bookmark.chapter] = []
      }
      groups[bookmark.book].chapters[bookmark.chapter].push(bookmark)
    })
    // Sort bookmarks within each chapter (verses first, then commentary)
    Object.values(groups).forEach(book => {
      Object.keys(book.chapters).forEach(chapter => {
        book.chapters[chapter].sort((a, b) => {
          // Verses before commentary
          if (a.type !== b.type) return a.type === 'verse' ? -1 : 1
          // Then by verse number
          return (a.verse || 0) - (b.verse || 0)
        })
      })
    })
    return groups
  }

  // Format date as DD-MM-YY
  const formatDate = (date) => {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear()).slice(-2)
    return `${day}-${month}-${year}`
  }

  const toggleExpand = (key) => {
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleEditNote = (bookmark) => {
    setEditingNote(bookmark.id)
    setNoteText(bookmark.userNote || '')
  }

  const handleSaveNote = (id) => {
    onUpdateNote(id, noteText)
    setEditingNote(null)
    setNoteText('')
  }

  const handleExport = () => {
    const data = JSON.stringify(bookmarks, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bible-bookmarks.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const dateGroups = groupByDate()
  const bookGroups = groupByBooks()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-primary text-white px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="heading-text text-xl font-bold flex items-center gap-2">
              <span>⭐</span>
              Bookmarks ({bookmarks.length + commentaryBookmarks.length})
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
              ✕
            </button>
          </div>
          
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex bg-white/20 rounded-lg p-1">
              <button
                onClick={() => setViewMode('date')}
                className={`px-2 py-1 rounded text-xs sm:text-sm transition-colors ${viewMode === 'date' ? 'bg-white text-primary' : 'hover:bg-white/10'}`}
              >
                By Date
              </button>
              <button
                onClick={() => setViewMode('books')}
                className={`px-2 py-1 rounded text-xs sm:text-sm transition-colors ${viewMode === 'books' ? 'bg-white text-primary' : 'hover:bg-white/10'}`}
              >
                By Books
              </button>
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-1 bg-white/20 rounded-lg text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredBookmarks.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-4xl mb-4">⭐</p>
              <p>{allBookmarks.length === 0 ? 'No bookmarks yet. Click the star on any verse or commentary to bookmark it!' : 'No bookmarks match your search.'}</p>
            </div>
          ) : viewMode === 'date' ? (
            /* Date View */
            <div className="space-y-3">
              {dateGroups.map((group) => (
                <div key={group.date} className="border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleExpand(group.date)}
                    className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span>📅</span>
                      <span className="font-medium">{group.date}</span>
                      <span className="text-secondary">*{Array.from(group.books).join(', ')}*</span>
                      <span className="text-gray-500">{group.bookmarks.length}</span>
                    </div>
                    <span>{expandedItems[group.date] ? '▼' : '▶'}</span>
                  </button>
                  {expandedItems[group.date] && (
                    <div className="divide-y">
                      {group.bookmarks.map((bookmark) => (
                        <BookmarkItem 
                          key={bookmark.id}
                          bookmark={bookmark}
                          onNavigate={onNavigate}
                          onDelete={onDelete}
                          onDeleteCommentary={onDeleteCommentary}
                          onNavigateToCommentary={onNavigateToCommentary}
                          onEditNote={handleEditNote}
                          editingNote={editingNote}
                          noteText={noteText}
                          setNoteText={setNoteText}
                          onSaveNote={handleSaveNote}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Books View */
            <div className="space-y-3">
              {Object.entries(bookGroups).map(([book, data]) => {
                const totalBookmarks = Object.values(data.chapters).flat().length
                return (
                  <div key={book} className="border rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleExpand(book)}
                      className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span>📖</span>
                        <span className="font-medium">{book}</span>
                        <span className="text-gray-500">({totalBookmarks} bookmarks)</span>
                      </div>
                      <span>{expandedItems[book] ? '▼' : '▶'}</span>
                    </button>
                    {expandedItems[book] && (
                      <div className="pl-4">
                        {Object.entries(data.chapters).sort(([a], [b]) => Number(a) - Number(b)).map(([chapter, chapterBookmarks]) => (
                          <div key={chapter}>
                            <button
                              onClick={() => toggleExpand(`${book}-${chapter}`)}
                              className="w-full px-4 py-2 hover:bg-gray-50 flex items-center justify-between transition-colors text-sm"
                            >
                              <span>Chapter {chapter} ({chapterBookmarks.length})</span>
                              <span>{expandedItems[`${book}-${chapter}`] ? '▼' : '▶'}</span>
                            </button>
                            {expandedItems[`${book}-${chapter}`] && (
                              <div className="divide-y border-l ml-4">
                                {chapterBookmarks.map((bookmark) => (
                                  <BookmarkItem 
                                    key={bookmark.id}
                                    bookmark={bookmark}
                                    onNavigate={onNavigate}
                                    onDelete={onDelete}
                                    onDeleteCommentary={onDeleteCommentary}
                                    onNavigateToCommentary={onNavigateToCommentary}
                                    onEditNote={handleEditNote}
                                    editingNote={editingNote}
                                    noteText={noteText}
                                    setNoteText={setNoteText}
                                    onSaveNote={handleSaveNote}
                                    compact
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 bg-gray-50 flex justify-between items-center">
          <button
            onClick={handleExport}
            disabled={bookmarks.length === 0 && commentaryBookmarks.length === 0}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Export
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function BookmarkItem({ bookmark, onNavigate, onDelete, onDeleteCommentary, onNavigateToCommentary, onEditNote, editingNote, noteText, setNoteText, onSaveNote, compact }) {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear()).slice(-2)
    return `${day}-${month}-${year}`
  }

  const isCommentary = bookmark.type === 'commentary'

  const handleClick = () => {
    if (isCommentary) {
      onNavigateToCommentary?.(bookmark.chapter, bookmark.commentaryId)
    } else {
      onNavigate(bookmark.book, bookmark.chapter, bookmark.verse)
    }
  }

  const handleDelete = () => {
    if (isCommentary) {
      onDeleteCommentary?.(bookmark.commentaryId)
    } else {
      onDelete(bookmark.id)
    }
  }

  return (
    <div className={`${compact ? 'px-3 py-2' : 'px-4 py-3'} ${isCommentary ? 'hover:bg-blue-50' : 'hover:bg-amber-50'} transition-colors`}>
      <div className="flex items-start justify-between gap-2">
        <div 
          className="flex-1 cursor-pointer"
          onClick={handleClick}
        >
          {isCommentary ? (
            /* Commentary Bookmark Display */
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-blue-500">💬</span>
                <span className="font-medium text-primary">
                  {compact ? `${bookmark.reference}` : `${bookmark.reference}`}
                </span>
                <span className="text-xs text-gray-400">({formatDate(bookmark.dateCreated)})</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">by {bookmark.authorName} • {bookmark.workTitle}</p>
              <p className="text-sm text-gray-600 truncate mt-1">{bookmark.textSnippet}...</p>
            </>
          ) : (
            /* Verse Bookmark Display */
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-primary">
                  {compact ? `Verse ${bookmark.verse}` : `${bookmark.book} ${bookmark.chapter}:${bookmark.verse}`}
                </span>
                <span className="text-xs text-gray-400">({formatDate(bookmark.dateCreated)})</span>
                {bookmark.hasCommentary && (
                  <span className="text-xs bg-secondary/20 text-amber-700 px-1.5 py-0.5 rounded">💬</span>
                )}
              </div>
              <p className="text-sm text-gray-600 truncate">{bookmark.verseText}...</p>
              {bookmark.userNote && (
                <p className="text-xs text-accent mt-1 italic">📝 {bookmark.userNote}</p>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isCommentary && editingNote === bookmark.id ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="px-2 py-1 text-sm border rounded w-40"
                placeholder="Add note..."
                autoFocus
              />
              <button onClick={() => onSaveNote(bookmark.id)} className="text-accent hover:text-teal-700">✓</button>
            </div>
          ) : (
            <>
              {!isCommentary && (
                <button 
                  onClick={() => onEditNote(bookmark)} 
                  className="p-1 text-gray-400 hover:text-accent transition-colors"
                  title="Edit note"
                >
                  📝
                </button>
              )}
              <button 
                onClick={handleDelete} 
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                title="Delete bookmark"
              >
                🗑️
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default BookmarkManager
