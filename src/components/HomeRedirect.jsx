import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { bibleBooks } from '../data/bible-books'
import { getReaderProgress } from '../services/readerProgress'

export default function HomeRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    let cancelled = false
    const open = target => {
      // An incoming notification or app link may already have changed the URL
      // while React is still committing this root route. Check at navigation
      // time, rather than queuing a later <Navigate> from stale saved progress.
      const livePath = window.location.hash.slice(1).split(/[?#]/, 1)[0]
      if (!cancelled && (!livePath || livePath === '/')) navigate(target, { replace: true })
    }
    getReaderProgress().then(progress => {
      const saved = progress?.bible
      const book = saved?.book ? bibleBooks.find(item => item.name === saved.book) : null
      const chapter = Number(saved?.chapter)
      const valid = book && Number.isInteger(chapter) && chapter >= 1 && chapter <= book.chapters
      open(valid ? `/${book.name.toLowerCase().replace(/\s+/g, '-')}/${chapter}` : '/genesis/1')
    }).catch(() => open('/genesis/1'))
    return () => { cancelled = true }
  }, [navigate])
  return <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center p-6">
    <p className="text-gray-500 dark:text-gray-400 animate-pulse">Opening last passage...</p>
  </div>
}
