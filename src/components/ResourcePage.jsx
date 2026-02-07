import { useParams, useNavigate } from 'react-router-dom'
import { RESOURCE_CATEGORIES } from '../data/resources'

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

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      {/* Header bar */}
      <header className="bg-primary text-white shadow-lg sticky top-0 z-40">
        <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
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
          {category.items.map(item => (
            <div
              key={item.id}
              className="w-full text-left p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm sm:text-base">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                <span className="text-[10px] sm:text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium flex-shrink-0 whitespace-nowrap">
                  God willing - coming eventually
                </span>
              </div>
            </div>
          ))}
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
