import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RESOURCE_CATEGORIES } from '../data/resources'
import MassVerseExportViewer from './MassVerseExportViewer'

function ToolViewer() {
  const { itemId } = useParams()
  const navigate = useNavigate()

  const toolsCategory = useMemo(
    () => RESOURCE_CATEGORIES.find(category => category.id === 'tools'),
    []
  )
  const tool = toolsCategory?.items?.find(item => item.id === itemId) || null

  if (itemId === 'mass-verse-export') {
    return <MassVerseExportViewer toolMeta={tool} />
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
            {tool?.title || 'Tool'}
          </h1>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center">
          <p className="text-3xl mb-3">🛠️</p>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Coming soon</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            This tool is listed in the menu but not implemented yet.
          </p>
          <button
            onClick={() => navigate('/resources/tools')}
            className="text-sm text-primary dark:text-blue-400 hover:underline"
          >
            {'\u2190'} Back to More Tools
          </button>
        </div>
      </main>
    </div>
  )
}

export default ToolViewer

