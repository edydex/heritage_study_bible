import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 72

function atTop(element) {
  for (let node = element; node; node = node.parentElement) if (node.scrollTop > 0) return false
  return (window.scrollY || 0) <= 0
}

export default function PullToRefresh({ children, onRefresh, refreshing = false, enabled = true }) {
  const root = useRef(null)
  const latest = useRef({ onRefresh, refreshing, enabled })
  latest.current = { onRefresh, refreshing, enabled }
  const [distance, setDistance] = useState(0)

  useEffect(() => {
    const element = root.current
    let start = null
    let pull = 0
    const reset = () => { start = null; pull = 0; setDistance(0) }
    const begin = event => {
      if (!latest.current.enabled || latest.current.refreshing || event.touches.length !== 1 || !atTop(event.target)
        || event.target.closest('input,select,textarea,button,a,[contenteditable]')) return
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY, target: event.target }
    }
    const move = event => {
      if (!start || event.touches.length !== 1) return reset()
      const dx = Math.abs(event.touches[0].clientX - start.x)
      const dy = event.touches[0].clientY - start.y
      if (dy < 0 || (dx > 12 && dx > dy)) return reset()
      if (dy < 10 || !atTop(start.target)) return
      if (event.cancelable) event.preventDefault()
      pull = Math.min(105, dy * .55)
      setDistance(pull)
    }
    const end = () => {
      const refresh = pull >= THRESHOLD && !latest.current.refreshing
      reset()
      if (refresh) void latest.current.onRefresh()
    }
    element.addEventListener('touchstart', begin, { passive: true })
    element.addEventListener('touchmove', move, { passive: false })
    element.addEventListener('touchend', end)
    element.addEventListener('touchcancel', reset)
    return () => {
      element.removeEventListener('touchstart', begin)
      element.removeEventListener('touchmove', move)
      element.removeEventListener('touchend', end)
      element.removeEventListener('touchcancel', reset)
    }
  }, [])

  return <div ref={root}>
    <div aria-live="polite" className="overflow-hidden text-center text-sm text-gray-600 dark:text-gray-300" style={{ height: refreshing ? 48 : distance }}>
      {(distance > 0 || refreshing) && <p className="py-3">{refreshing ? 'Refreshing songs…' : distance >= THRESHOLD ? 'Release to refresh' : '↓ Pull to refresh'}</p>}
    </div>
    {children}
  </div>
}
