import { useState } from 'react'

function BottomNav({ 
  currentBook, 
  currentChapter, 
  books = [],
  onNavigate,
  onPrevious, 
  onNext,
  hasPrevious,
  hasNext,
  isSidebarOpen = false,
  sidebarWidth = 540
}) {
  const [showPicker, setShowPicker] = useState(false)
  const [pickerView, setPickerView] = useState('book') // 'book' or 'chapter'
  const [selectedBook, setSelectedBook] = useState(null)

  const handleBookSelect = (book) => {
    setSelectedBook(book)
    setPickerView('chapter')
  }

  const handleChapterSelect = (chapter) => {
    onNavigate(selectedBook.name, chapter)
    setShowPicker(false)
    setPickerView('book')
    setSelectedBook(null)
  }

  const handleClose = () => {
    setShowPicker(false)
    setPickerView('book')
    setSelectedBook(null)
  }

  // Toggle: should the book/chapter picker avoid overlapping the commentary sidebar?
  // Set to false to make the picker full-width again.
  const PICKER_RESPECTS_SIDEBAR = true

  const pickerRightStyle = PICKER_RESPECTS_SIDEBAR && isSidebarOpen
    ? { right: `${sidebarWidth}px` }
    : { right: 0 }

  // Group books by testament
  const oldTestament = books.filter((_, i) => i < 39)
  const newTestament = books.filter((_, i) => i >= 39)

  return (
    <>
      {/* Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 bg-white border-t border-gray-200 shadow-lg z-40 safe-area-bottom transition-all duration-300"
        style={{ right: isSidebarOpen ? `${sidebarWidth}px` : 0 }}
      >
        <div className="flex items-center justify-between h-14 px-2">
          {/* Previous Button */}
          <button
            onClick={onPrevious}
            disabled={!hasPrevious}
            className="flex items-center justify-center w-14 h-full text-primary disabled:text-gray-300 disabled:cursor-not-allowed active:bg-gray-100 transition-colors"
            aria-label="Previous chapter"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Chapter Selector Button */}
          <button
            onClick={() => setShowPicker(true)}
            className="flex-1 flex items-center justify-center gap-2 h-full mx-2 rounded-lg active:bg-gray-100 transition-colors"
          >
            <span className="text-base font-semibold text-gray-800 truncate max-w-[200px]">
              {currentBook} {currentChapter}
            </span>
            <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Next Button */}
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="flex items-center justify-center w-14 h-full text-primary disabled:text-gray-300 disabled:cursor-not-allowed active:bg-gray-100 transition-colors"
            aria-label="Next chapter"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Book/Chapter Picker Modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 transition-all duration-300" style={pickerRightStyle}>
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={handleClose}
          />

          {/* Picker Panel */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl animate-slide-up safe-area-bottom max-h-[80vh] flex flex-col">
            {/* Handle */}
            <div className="flex justify-center py-3 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-4 pb-3 border-b border-gray-100 flex-shrink-0">
              {pickerView === 'chapter' ? (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setPickerView('book')}
                    className="p-1 -ml-1 text-primary"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h3 className="text-lg font-semibold text-gray-800">{selectedBook?.name}</h3>
                </div>
              ) : (
                <h3 className="text-lg font-semibold text-center text-gray-800">Select Book</h3>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {pickerView === 'book' ? (
                <div className="p-4">
                  {/* Old Testament */}
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Old Testament</h4>
                  <div className="grid grid-cols-3 gap-1.5 mb-4">
                    {oldTestament.map(book => (
                      <button
                        key={book.name}
                        onClick={() => handleBookSelect(book)}
                        className={`px-2 py-2 text-sm rounded-lg text-left transition-all truncate ${
                          book.name === currentBook
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-700 active:bg-gray-200'
                        }`}
                      >
                        {book.name}
                      </button>
                    ))}
                  </div>
                  
                  {/* New Testament */}
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">New Testament</h4>
                  <div className="grid grid-cols-3 gap-1.5">
                    {newTestament.map(book => (
                      <button
                        key={book.name}
                        onClick={() => handleBookSelect(book)}
                        className={`px-2 py-2 text-sm rounded-lg text-left transition-all truncate ${
                          book.name === currentBook
                            ? 'bg-primary text-white'
                            : 'bg-gray-100 text-gray-700 active:bg-gray-200'
                        }`}
                      >
                        {book.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 lg:p-6">
                  <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-2 lg:gap-1.5">
                    {Array.from({ length: selectedBook?.chapters || 0 }, (_, i) => i + 1).map(num => (
                      <button
                        key={num}
                        onClick={() => handleChapterSelect(num)}
                        className={`aspect-square flex items-center justify-center rounded-xl lg:rounded-lg text-lg lg:text-sm font-medium transition-all ${
                          num === currentChapter && selectedBook?.name === currentBook
                            ? 'bg-primary text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-200'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cancel Button */}
            <div className="p-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={handleClose}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-medium active:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default BottomNav
