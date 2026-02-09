import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { RESOURCE_CATEGORIES, TAG_COLORS } from '../data/resources'

function ResourceTag({ tag }) {
  const colors = TAG_COLORS[tag]
  if (!colors) return null
  return (
    <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium ${colors.bg} ${colors.text}`}>
      {tag}
    </span>
  )
}

function YearBadge({ year }) {
  if (!year) return null
  const display = year < 100 ? `c. ${year} AD` : year < 1000 ? `${year} AD` : `${year}`
  return (
    <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
      {display}
    </span>
  )
}

// Categories whose items are clickable into detail views
const CLICKABLE_CATEGORIES = ['confessions', 'books', 'reading-plans']

function ResourcePage() {
  const { categoryId } = useParams()
  const navigate = useNavigate()

  const category = RESOURCE_CATEGORIES.find(c => c.id === categoryId)

  if (!category) {
    return (
      <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">Category not found</h2>
          <button
            onClick={() => navigate('/genesis/1')}
            className="text-primary hover:underline"
          >
            Back to Bible
          </button>
        </div>
      </div>
    )
  }

  const isConfessions = categoryId === 'confessions'
  const isBooks = categoryId === 'books'
  const isClickable = CLICKABLE_CATEGORIES.includes(categoryId)
  const items = useMemo(() => {
    if (!isConfessions && !isBooks) return category.items
    return [...category.items].sort((a, b) => {
      const ay = Number.isFinite(a.year) ? a.year : Number.POSITIVE_INFINITY
      const by = Number.isFinite(b.year) ? b.year : Number.POSITIVE_INFINITY
      if (ay !== by) return ay - by
      return a.title.localeCompare(b.title)
    })
  }, [category.items, isBooks, isConfessions])

  const handleItemClick = (item) => {
    if (isClickable) {
      navigate(`/resources/${categoryId}/${item.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      {/* Header bar */}
      <header className="bg-primary text-white shadow-lg sticky top-0 z-40">
        <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/genesis/1')}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <span className="text-lg">{'\u2190'}</span>
          </button>
          <h1 className="text-base sm:text-lg font-bold heading-text truncate">
            {category.title}
          </h1>
        </div>
      </header>

      {/* Items list */}
      <main className="container mx-auto max-w-2xl px-4 py-6">
        <div className="space-y-3">
          {items.map(item => {
            const Wrapper = isClickable ? 'button' : 'div'
            return (
              <Wrapper
                key={item.id}
                onClick={isClickable ? () => handleItemClick(item) : undefined}
                className={`w-full text-left p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-all ${
                  isClickable
                    ? 'hover:border-primary/40 dark:hover:border-blue-400/40 hover:shadow-md active:scale-[0.99] cursor-pointer'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm sm:text-base">
                        {item.title}
                      </h3>
                      {(isConfessions || isBooks) && item.tag && <ResourceTag tag={item.tag} />}
                    </div>
                    {/* Author line for books */}
                    {isBooks && item.author && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.author}</p>
                    )}
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {item.year && <YearBadge year={item.year} />}
                    {isClickable && (
                      <span className="text-gray-300 dark:text-gray-600 text-lg mt-1">›</span>
                    )}
                  </div>
                </div>
                {/* Audiobook badge for books (no embed on listing page) */}
                {isBooks && item.librivox && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                    <span>🎧</span>
                    <span>Free audiobook available</span>
                  </div>
                )}
              </Wrapper>
            )
          })}
        </div>

        {/* Back button at bottom */}
        <div className="mt-8 text-center">
          <button
            onClick={() => navigate('/genesis/1')}
            className="text-sm text-primary hover:underline"
          >
            Back to Bible
          </button>
        </div>
      </main>
    </div>
  )
}

export default ResourcePage
