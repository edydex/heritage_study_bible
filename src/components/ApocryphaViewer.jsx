import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from './BottomNav'

const APOCRYPHA_DATA_PATH = '/data/apocrypha/kjva-apocrypha.json'

function renderVerseText(text) {
  const sourceText = String(text || '')
  const lines = sourceText.replace(/\s*\|\|\s*/g, '\n').split('\n')
  if (lines.length === 1 && !sourceText.includes('<b>')) return sourceText

  return lines.map((line, index) => {
    let rendered
    if (line.includes('<b>')) {
      const parts = line.split(/(<b>.*?<\/b>)/g)
      rendered = parts.map((part, partIndex) => {
        const match = part.match(/^<b>(.*?)<\/b>$/)
        if (match) return <strong key={`${index}-${partIndex}`} className="font-bold">{match[1]}</strong>
        return part
      })
    } else {
      rendered = line
    }

    if (index === 0) return <span key={index}>{rendered}</span>
    return (
      <span key={index}>
        <br />
        <span className="inline-block w-4" />
        {rendered}
      </span>
    )
  })
}

function ApocryphaViewer({ toolMeta }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentBook, setCurrentBook] = useState('')
  const [currentChapter, setCurrentChapter] = useState(1)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(APOCRYPHA_DATA_PATH)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const parsed = await response.json()
        if (cancelled) return
        setData(parsed)
        const firstBook = parsed?.books?.[0]
        setCurrentBook(firstBook?.name || '')
        setCurrentChapter(firstBook?.chapters?.[0]?.number || 1)
      } catch (loadError) {
        if (!cancelled) setError('Failed to load Apocrypha text.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const books = data?.books || []
  const bookSummaries = useMemo(
    () => books.map(book => ({ name: book.name, chapters: book.chapters.length })),
    [books]
  )

  const currentBookIndex = useMemo(
    () => books.findIndex(book => book.name === currentBook),
    [books, currentBook]
  )

  const selectedBookData = useMemo(
    () => books[currentBookIndex] || null,
    [books, currentBookIndex]
  )

  const selectedChapterData = useMemo(() => {
    if (!selectedBookData) return null
    return selectedBookData.chapters.find(chapter => chapter.number === currentChapter) || selectedBookData.chapters[0] || null
  }, [selectedBookData, currentChapter])

  useEffect(() => {
    if (selectedBookData && !selectedBookData.chapters.some(chapter => chapter.number === currentChapter)) {
      setCurrentChapter(selectedBookData.chapters[0]?.number || 1)
    }
  }, [selectedBookData, currentChapter])

  useEffect(() => {
    if (!selectedBookData || !selectedChapterData) return
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [selectedBookData, selectedChapterData])

  const hasPrevious = Boolean(selectedBookData) && (
    currentChapter > (selectedBookData?.chapters?.[0]?.number || 1) || currentBookIndex > 0
  )
  const hasNext = Boolean(selectedBookData) && (
    currentChapter < (selectedBookData?.chapters?.[selectedBookData.chapters.length - 1]?.number || currentChapter) ||
    currentBookIndex < books.length - 1
  )

  const handleNavigate = (bookName, chapterNumber) => {
    const targetBook = books.find(book => book.name === bookName)
    if (!targetBook) return
    setCurrentBook(targetBook.name)
    setCurrentChapter(chapterNumber)
  }

  const handlePrevious = () => {
    if (!selectedBookData) return
    const firstChapter = selectedBookData.chapters[0]?.number || 1
    if (currentChapter > firstChapter) {
      setCurrentChapter(prev => prev - 1)
      return
    }
    if (currentBookIndex <= 0) return
    const prevBook = books[currentBookIndex - 1]
    if (!prevBook) return
    setCurrentBook(prevBook.name)
    setCurrentChapter(prevBook.chapters[prevBook.chapters.length - 1]?.number || 1)
  }

  const handleNext = () => {
    if (!selectedBookData) return
    const lastChapter = selectedBookData.chapters[selectedBookData.chapters.length - 1]?.number || currentChapter
    if (currentChapter < lastChapter) {
      setCurrentChapter(prev => prev + 1)
      return
    }
    if (currentBookIndex >= books.length - 1) return
    const nextBook = books[currentBookIndex + 1]
    if (!nextBook) return
    setCurrentBook(nextBook.name)
    setCurrentChapter(nextBook.chapters[0]?.number || 1)
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-primary text-white shadow-lg sticky top-0 z-40">
        <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/resources/tools')}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <span className="text-lg">{'\u2190'}</span>
          </button>
          <h1 className="text-base sm:text-lg font-bold heading-text truncate">
            {toolMeta?.title || 'Apocrypha'}
          </h1>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-6 pb-24">
        {loading && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-sm text-gray-500 dark:text-gray-400 animate-pulse">
            Loading Apocrypha text...
          </div>
        )}

        {!loading && error && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && selectedBookData && selectedChapterData && (
          <>
            <div className="text-center mb-5">
              <h2 className="text-2xl sm:text-3xl font-bold heading-text text-primary dark:text-blue-300">
                {selectedBookData.name} {selectedChapterData.number}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                King James Version with Apocrypha (Public Domain)
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-none sm:rounded-xl shadow-none sm:shadow-md px-1 py-1 sm:p-6 md:p-8">
              {selectedChapterData.verses.map((verse) => (
                <div
                  key={verse.number}
                  className="flex items-start gap-0.5 sm:gap-2 py-0.5 sm:py-1 px-0 sm:px-2 rounded-lg"
                >
                  <span className="text-[10px] sm:text-sm text-gray-400 dark:text-gray-500 font-medium min-w-[1rem] sm:min-w-[2rem] pt-1 sm:pt-0.5 select-none text-right">
                    {verse.number}
                  </span>
                  <p className="verse-text flex-1 text-gray-700 dark:text-gray-300" style={{ fontSize: '18px', lineHeight: 1.6 }}>
                    {renderVerseText(verse.text)}
                  </p>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
              Source text:{' '}
              <a
                href={data?.source}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary dark:text-blue-300 hover:underline"
              >
                KJVA dataset
              </a>
            </p>
          </>
        )}
      </main>

      {!loading && !error && selectedBookData && (
        <BottomNav
          currentBook={selectedBookData.name}
          currentChapter={selectedChapterData?.number || 1}
          books={bookSummaries}
          onNavigate={handleNavigate}
          onPrevious={handlePrevious}
          onNext={handleNext}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
        />
      )}
    </div>
  )
}

export default ApocryphaViewer
