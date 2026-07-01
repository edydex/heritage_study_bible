import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { getStroke } from 'perfect-freehand'
import { v4 as uuidv4 } from 'uuid'

// Tools this layer reacts to. In 'highlight'/'select' the layer is inert so verse
// taps and finger/pen scrolling behave normally.
export const INK_TOOLS = { draw: 'draw', erase: 'erase', highlight: 'highlight', select: 'select' }

const STROKE_OPTIONS = {
  smoothing: 0.5,
  streamline: 0.5,
  thinning: 0.6,
}

// Convert a perfect-freehand outline into an SVG path string.
function outlineToPath(outline) {
  if (!outline.length) return ''
  const d = outline.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...outline[0], 'Q']
  )
  d.push('Z')
  return d.join(' ')
}

function strokeToPath(points, size) {
  const outline = getStroke(points, { ...STROKE_OPTIONS, size })
  return outlineToPath(outline)
}

// Distance from point p to segment ab, for eraser hit testing.
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx
  const cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

function pointHitsStroke(x, y, stroke, threshold) {
  const pts = stroke.points
  if (pts.length === 0) return false
  if (pts.length === 1) {
    return Math.hypot(x - pts[0][0], y - pts[0][1]) <= threshold
  }
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSegment(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) <= threshold) {
      return true
    }
  }
  return false
}

/**
 * SVG ink overlay for a scrollable pane. It renders committed strokes plus the
 * in-progress stroke, and captures pointer input from the scroll container when
 * the draw or erase tool is active. Pen, mouse, and finger all draw; switch to
 * the read/select tool to scroll with touch again.
 */
function InkLayer({
  scrollContainerRef,
  strokes = [],
  tool = INK_TOOLS.select,
  color = '#1d4ed8',
  size = 4,
  onCommitStroke,
  onEraseStroke,
}) {
  const [dims, setDims] = useState({ width: 0, height: 0 })
  const [liveStroke, setLiveStroke] = useState(null) // { color, size, points }
  const drawing = useRef(false)
  const livePoints = useRef([])

  const active = tool === INK_TOOLS.draw || tool === INK_TOOLS.erase

  // Keep the overlay sized to the full scrollable content.
  useLayoutEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const measure = () => {
      setDims({ width: el.clientWidth, height: Math.max(el.scrollHeight, el.clientHeight) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [scrollContainerRef, strokes, tool])

  const toContentPoint = useCallback((e) => {
    const el = scrollContainerRef.current
    const rect = el.getBoundingClientRect()
    return [
      e.clientX - rect.left + el.scrollLeft,
      e.clientY - rect.top + el.scrollTop,
      e.pressure && e.pressure > 0 ? e.pressure : 0.5,
    ]
  }, [scrollContainerRef])

  const eraseAt = useCallback((x, y) => {
    const threshold = 12
    for (const stroke of strokes) {
      if (pointHitsStroke(x, y, stroke, threshold + (stroke.size || 0))) {
        onEraseStroke?.(stroke.id)
        break
      }
    }
  }, [strokes, onEraseStroke])

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el || !active) return

    const acceptsInkPointer = (e) =>
      e.pointerType === 'pen' || e.pointerType === 'mouse' || e.pointerType === 'touch'

    const handleDown = (e) => {
      if (!acceptsInkPointer(e)) return
      e.preventDefault()
      try { el.setPointerCapture?.(e.pointerId) } catch {}
      const pt = toContentPoint(e)
      if (tool === INK_TOOLS.erase) {
        drawing.current = true
        eraseAt(pt[0], pt[1])
        return
      }
      drawing.current = true
      livePoints.current = [pt]
      setLiveStroke({ color, size, points: [pt] })
    }

    const handleMove = (e) => {
      if (!drawing.current) return
      e.preventDefault()
      const pt = toContentPoint(e)
      if (tool === INK_TOOLS.erase) {
        eraseAt(pt[0], pt[1])
        return
      }
      livePoints.current = [...livePoints.current, pt]
      setLiveStroke({ color, size, points: livePoints.current })
    }

    const finish = (e) => {
      if (!drawing.current) return
      drawing.current = false
      try { el.releasePointerCapture?.(e.pointerId) } catch {}
      if (tool === INK_TOOLS.draw && livePoints.current.length > 0) {
        onCommitStroke?.({ id: uuidv4(), color, size, points: livePoints.current })
      }
      livePoints.current = []
      setLiveStroke(null)
    }

    el.addEventListener('pointerdown', handleDown, { passive: false })
    el.addEventListener('pointermove', handleMove, { passive: false })
    el.addEventListener('pointerup', finish)
    el.addEventListener('pointercancel', finish)
    el.addEventListener('pointerleave', finish)
    return () => {
      el.removeEventListener('pointerdown', handleDown)
      el.removeEventListener('pointermove', handleMove)
      el.removeEventListener('pointerup', finish)
      el.removeEventListener('pointercancel', finish)
      el.removeEventListener('pointerleave', finish)
    }
  }, [scrollContainerRef, active, tool, color, size, toContentPoint, eraseAt, onCommitStroke])

  return (
    <svg
      className="absolute top-0 left-0 z-20"
      style={{ width: dims.width, height: dims.height, pointerEvents: 'none', touchAction: 'none' }}
      width={dims.width}
      height={dims.height}
      aria-hidden="true"
    >
      {strokes.map(stroke => (
        <path key={stroke.id} d={strokeToPath(stroke.points, stroke.size || size)} fill={stroke.color} />
      ))}
      {liveStroke && (
        <path d={strokeToPath(liveStroke.points, liveStroke.size)} fill={liveStroke.color} />
      )}
    </svg>
  )
}

export default InkLayer
