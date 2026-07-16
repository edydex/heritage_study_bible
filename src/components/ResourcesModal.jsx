import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RESOURCE_CATEGORIES } from '../data/resources'
import { CONTENT_SERVERS_CHANGE_EVENT, getRemoteContentItemsForCategory } from '../services/contentServers'

function ResourcesModal({ onClose }) {
  const navigate = useNavigate()
  const [catalogRevision, setCatalogRevision] = useState(0)

  useEffect(() => {
    const refresh = () => setCatalogRevision(value => value + 1)
    window.addEventListener(CONTENT_SERVERS_CHANGE_EVENT, refresh)
    return () => window.removeEventListener(CONTENT_SERVERS_CHANGE_EVENT, refresh)
  }, [])

  const handleCategoryClick = (categoryId) => {
    onClose()
    navigate(`/resources/${categoryId}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative mt-16 sm:mt-20 mx-3 w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/80">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Resources</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-500 dark:text-gray-400"
          >
            {'\u2715'}
          </button>
        </div>

        {/* Category Tiles */}
        <div className="p-4 grid grid-cols-2 gap-3">
          {RESOURCE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => handleCategoryClick(cat.id)}
              className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all duration-200 ${cat.color}`}
            >
              {cat.icon && <span className="text-2xl">{cat.icon}</span>}
              <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm text-center">{cat.title}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {cat.items.length + getRemoteContentItemsForCategory(cat.id).length} items
              </span>
            </button>
          ))}
        </div>
        <div className="px-4 pb-4 -mt-1 grid grid-cols-2 gap-2" data-catalog-revision={catalogRevision}>
          <button onClick={() => { onClose(); navigate('/settings/content-servers') }} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200">Content Servers</button>
          <button onClick={() => { onClose(); navigate('/community') }} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200">Community Home</button>
        </div>
      </div>
    </div>
  )
}

export default ResourcesModal
