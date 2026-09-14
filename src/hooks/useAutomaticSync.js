import { useEffect } from 'react'

export function useAutomaticSync(readerReady) {
  useEffect(() => {
    if (!readerReady) return
    let cancelled = false
    let stop
    // Keep sync code and requests out of the Bible's critical startup path.
    import('../services/automaticSync.js').then(({ startAutomaticSync }) => {
      if (!cancelled) stop = startAutomaticSync()
    }).catch(() => {})
    return () => { cancelled = true; stop?.() }
  }, [readerReady])
}
