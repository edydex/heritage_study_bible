import { useState, useEffect, useCallback } from 'react'
import { translations, loadTranslation } from '../data/translations'
import { bibleBooks } from '../data/bible-books.js'

// BibleHub book slug map — matches BibleHub URL patterns
const BIBLEHUB_SLUGS = {
  'Genesis': 'genesis', 'Exodus': 'exodus', 'Leviticus': 'leviticus',
  'Numbers': 'numbers', 'Deuteronomy': 'deuteronomy', 'Joshua': 'joshua',
  'Judges': 'judges', 'Ruth': 'ruth',
  '1 Samuel': '1_samuel', '2 Samuel': '2_samuel',
  '1 Kings': '1_kings', '2 Kings': '2_kings',
  '1 Chronicles': '1_chronicles', '2 Chronicles': '2_chronicles',
  'Ezra': 'ezra', 'Nehemiah': 'nehemiah', 'Esther': 'esther',
  'Job': 'job', 'Psalms': 'psalms', 'Proverbs': 'proverbs',
  'Ecclesiastes': 'ecclesiastes', 'Song of Solomon': 'songs',
  'Isaiah': 'isaiah', 'Jeremiah': 'jeremiah', 'Lamentations': 'lamentations',
  'Ezekiel': 'ezekiel', 'Daniel': 'daniel',
  'Hosea': 'hosea', 'Joel': 'joel', 'Amos': 'amos', 'Obadiah': 'obadiah',
  'Jonah': 'jonah', 'Micah': 'micah', 'Nahum': 'nahum', 'Habakkuk': 'habakkuk',
  'Zephaniah': 'zephaniah', 'Haggai': 'haggai', 'Zechariah': 'zechariah', 'Malachi': 'malachi',
  'Matthew': 'matthew', 'Mark': 'mark', 'Luke': 'luke', 'John': 'john',
  'Acts': 'acts', 'Romans': 'romans',
  '1 Corinthians': '1_corinthians', '2 Corinthians': '2_corinthians',
  'Galatians': 'galatians', 'Ephesians': 'ephesians',
  'Philippians': 'philippians', 'Colossians': 'colossians',
  '1 Thessalonians': '1_thessalonians', '2 Thessalonians': '2_thessalonians',
  '1 Timothy': '1_timothy', '2 Timothy': '2_timothy',
  'Titus': 'titus', 'Philemon': 'philemon', 'Hebrews': 'hebrews',
  'James': 'james', '1 Peter': '1_peter', '2 Peter': '2_peter',
  '1 John': '1_john', '2 John': '2_john', '3 John': '3_john',
  'Jude': 'jude', 'Revelation': 'revelation',
}

const STORAGE_KEY = 'heritage-compare-translations'

function getOriginalLanguage(bookName) {
  const book = bibleBooks.find(b => b.name === bookName)
  if (!book) return 'Hebrew'
  if (book.testament === 'NT') return 'Greek'
  // Daniel and Ezra have large Aramaic sections
  if (bookName === 'Daniel' || bookName === 'Ezra') return 'Hebrew/Aramaic'
  return 'Hebrew'
}

function getBibleHubUrl(bookName, chapter, verse) {
  const slug = BIBLEHUB_SLUGS[bookName]
  if (!slug) return null
  return `https://biblehub.com/text/${slug}/${chapter}-${verse}.htm`
}

function CompareModal({ bookName, chapter, verse, verseText, translationId, onClose }) {
  // Persisted comparison translation IDs
  const [compareIds, setCompareIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Filter out the current main translation and invalid ids
        return parsed.filter(id => translations.some(t => t.id === id))
      }
    } catch {}
    return []
  })

  const [showPicker, setShowPicker] = useState(false)
  const [loadedTexts, setLoadedTexts] = useState({}) // { translationId: verseText }
  const [loadingIds, setLoadingIds] = useState(new Set())

  // Persist comparison choices
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(compareIds))
    } catch {}
  }, [compareIds])

  // Load verse text for a given translation id
  const loadVerseText = useCallback(async (tId) => {
    if (loadedTexts[tId] !== undefined) return
    setLoadingIds(prev => new Set([...prev, tId]))
    try {
      const data = await loadTranslation(tId)
      const bookData = data.books.find(b => b.name === bookName)
      const chapterData = bookData?.chapters.find(c => c.number === chapter)
      const verseData = chapterData?.verses.find(v => v.number === verse)
      setLoadedTexts(prev => ({ ...prev, [tId]: verseData?.text || '(verse not found)' }))
    } catch {
      setLoadedTexts(prev => ({ ...prev, [tId]: '(failed to load)' }))
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev)
        next.delete(tId)
        return next
      })
    }
  }, [bookName, chapter, verse, loadedTexts])

  // Load all comparison translations on mount / when compareIds change
  useEffect(() => {
    compareIds.forEach(id => {
      if (loadedTexts[id] === undefined && !loadingIds.has(id)) {
        loadVerseText(id)
      }
    })
  }, [compareIds, loadVerseText, loadedTexts, loadingIds])

  const addTranslation = (tId) => {
    if (!compareIds.includes(tId)) {
      setCompareIds(prev => [...prev, tId])
    }
    setShowPicker(false)
  }

  const removeTranslation = (tId) => {
    setCompareIds(prev => prev.filter(id => id !== tId))
    setLoadedTexts(prev => {
      const next = { ...prev }
      delete next[tId]
      return next
    })
  }

  // Translations available to add (not already selected and not the main one)
  const availableTranslations = translations.filter(
    t => t.id !== translationId && !compareIds.includes(t.id)
  )

  const originalLang = getOriginalLanguage(bookName)
  const bibleHubUrl = getBibleHubUrl(bookName, chapter, verse)

  // Clean verse text for display (strip || markers)
  const cleanText = (text) => {
    if (!text) return text
    return text.replace(/ \|\| /g, ' ')
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Compare Translations</h3>
            <p className="text-sm text-gray-500">{bookName} {chapter}:{verse}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Main translation (current reading) */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                {translationId} — Reading
              </span>
            </div>
            <p className="text-gray-800 text-sm leading-relaxed">{cleanText(verseText)}</p>
          </div>

          {/* Comparison translations */}
          {compareIds.map(tId => {
            const tInfo = translations.find(t => t.id === tId)
            const text = loadedTexts[tId]
            const isLoading = loadingIds.has(tId)
            return (
              <div key={tId} className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {tInfo?.abbr || tId}
                  </span>
                  <button
                    onClick={() => removeTranslation(tId)}
                    className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title={`Remove ${tInfo?.abbr || tId}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                {isLoading ? (
                  <p className="text-gray-400 text-sm italic animate-pulse">Loading...</p>
                ) : (
                  <p className="text-gray-700 text-sm leading-relaxed">{cleanText(text)}</p>
                )}
              </div>
            )
          })}

          {/* Add translation button / picker */}
          {availableTranslations.length > 0 && (
            <div className="relative">
              {showPicker ? (
                <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Add Translation</p>
                  <div className="space-y-1">
                    {availableTranslations.map(t => (
                      <button
                        key={t.id}
                        onClick={() => addTranslation(t.id)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white transition-colors flex items-center gap-3"
                      >
                        <span className="font-bold text-sm text-gray-800 w-10">{t.abbr}</span>
                        <div className="min-w-0">
                          <span className="text-sm text-gray-700">{t.name}</span>
                          <span className="text-xs text-gray-400 ml-2">{t.description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowPicker(false)}
                    className="mt-2 text-xs text-gray-400 hover:text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowPicker(true)}
                  className="w-full py-3 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <span className="text-lg leading-none">+</span>
                  Add Translation
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer — BibleHub link */}
        {bibleHubUrl && (
          <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <a
              href={bibleHubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-primary hover:text-blue-700 font-medium transition-colors"
            >
              <span className="text-base">📜</span>
              Show {originalLang} Interlinear
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default CompareModal
