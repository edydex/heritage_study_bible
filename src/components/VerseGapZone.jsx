import { useRef } from 'react'
import { isDoubleTap } from '../utils/doubleTap'

function useInsertGuard() {
  const guard = useRef(false)
  return (fn) => {
    if (guard.current) return
    guard.current = true
    fn()
    window.setTimeout(() => { guard.current = false }, 400)
  }
}

/** Invisible hit strip between verses — double-tap to insert writing space. */
function VerseGapZone({ afterVerse, onInsert }) {
  const lastTap = useRef(null)
  const runInsert = useInsertGuard()

  const insert = () => runInsert(() => onInsert(afterVerse))

  const handleActivate = (e) => {
    e.preventDefault()
    e.stopPropagation()
    insert()
  }

  return (
    <div
      role="button"
      tabIndex={-1}
      data-testid={`gap-zone-after-${afterVerse}`}
      aria-label="Double-tap to type"
      onDoubleClick={handleActivate}
      onPointerUp={(e) => {
        if (e.pointerType === 'pen') return
        if (isDoubleTap(e, lastTap)) handleActivate(e)
      }}
      className="journal-gap-zone"
    />
  )
}

export default VerseGapZone
