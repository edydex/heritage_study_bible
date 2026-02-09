import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { RESOURCE_CATEGORIES, TAG_COLORS } from '../data/resources'

function ConfessionViewer() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const [confession, setConfession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const category = RESOURCE_CATEGORIES.find(c => c.id === 'confessions')
  const meta = category?.items.find(i => i.id === itemId)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`${import.meta.env.BASE_URL}data/confessions/${itemId}.json`)
      .then(res => {
        if (!res.ok) throw new Error('Confession not found')
        return res.json()
      })
      .then(data => setConfession(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [itemId])

  const renderContent = (block, index) => {
    switch (block.type) {
      case 'text':
        return (
          <p key={index} className="text-[15px] text-gray-800 dark:text-gray-200 leading-[1.8] whitespace-pre-line mb-5">
            {block.text}
          </p>
        )
      case 'numbered':
        return (
          <ol key={index} className="list-decimal list-outside pl-8 space-y-2.5 mb-6">
            {block.items.map((item, i) => (
              <li key={i} className="text-[15px] text-gray-800 dark:text-gray-200 leading-[1.8] pl-2">
                {item}
              </li>
            ))}
          </ol>
        )
      case 'heading':
        return (
          <h3 key={index} className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-10 mb-3 heading-text border-b border-gray-200 dark:border-gray-700 pb-2">
            {block.text}
          </h3>
        )
      case 'subheading':
        return (
          <h4 key={index} className="text-base font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-2 italic">
            {block.text}
          </h4>
        )
      case 'qa':
        return (
          <div key={index} className="mb-6 py-3">
            <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2 leading-relaxed">
              <span className="inline-block min-w-[2.5rem] text-primary dark:text-blue-400 font-bold">Q{block.number}.</span>
              {block.question}
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-[1.8] pl-4 border-l-2 border-primary/20 dark:border-blue-400/20 ml-1">
              <span className="font-bold text-primary dark:text-blue-400">A. </span>
              {block.answer}
            </p>
          </div>
        )
      case 'article':
        return (
          <div key={index} className="mb-4">
            <p className="text-[15px] text-gray-800 dark:text-gray-200 leading-[1.8]">
              <span className="font-bold text-primary dark:text-blue-400">{block.number}. </span>
              {block.text}
            </p>
          </div>
        )
      default:
        return null
    }
  }

  const tagColors = meta?.tag ? TAG_COLORS[meta.tag] : null
  const yearDisplay = meta?.year
    ? meta.year < 100 ? `c. ${meta.year} AD` : meta.year < 1000 ? `${meta.year} AD` : `${meta.year}`
    : null

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      {/* Header */}
      <header className="bg-primary text-white shadow-lg sticky top-0 z-40">
        <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/resources/confessions')}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <span className="text-lg">{'\u2190'}</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold heading-text truncate">
              {meta?.title || confession?.title || 'Loading\u2026'}
            </h1>
          </div>
          {tagColors && (
            <span className={`hidden sm:inline text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium ${tagColors.bg} ${tagColors.text}`}>
              {meta.tag}
            </span>
          )}
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 sm:px-6 py-6 pb-20">
        {/* Loading */}
        {loading && (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400 animate-pulse">
            Loading…
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-16">
            <p className="text-gray-400 text-4xl mb-4">📜</p>
            <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">Not yet available</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">This confession will be added soon.</p>
          </div>
        )}

        {/* Content */}
        {confession && !loading && (
          <>
            {/* Title block */}
            <div className="text-center mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 heading-text">
                {confession.title}
              </h2>
              <div className="flex items-center justify-center gap-2 mt-2">
                {yearDisplay && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">
                    {yearDisplay}
                  </span>
                )}
                {tagColors && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagColors.bg} ${tagColors.text}`}>
                    {meta.tag}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 max-w-md mx-auto italic">
                {confession.description || meta?.description}
              </p>
            </div>

            <hr className="border-gray-200 dark:border-gray-700 mb-8" />

            {/* Confession body */}
            <div className="confession-body">
              {confession.content.map(renderContent)}
            </div>
          </>
        )}

        {/* Footer nav */}
        <div className="mt-12 text-center">
          <button
            onClick={() => navigate('/resources/confessions')}
            className="text-sm text-primary dark:text-blue-400 hover:underline"
          >
            {'\u2190'} Back to Confessions & Creeds
          </button>
        </div>
      </main>
    </div>
  )
}

export default ConfessionViewer
