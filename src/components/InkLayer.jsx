import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react'
import { getStroke } from 'perfect-freehand'
import { v4 as uuidv4 } from 'uuid'
import {
  findAnchorAt,
  measureAnchor,
  toAnchorRelativePoints,
  toAbsolutePoints,
} from '../utils/inkAnchors'

// scroll = read/scroll; pen = finger/mouse draw; pen pointer always inks
export const INK_TOOLS = {
  scroll: 'scroll',
  highlight: 'highlight',
  pen: 'pen',
  erase: 'erase',
  text: 'text',
}

const STROKE_OPTIONS = {
  smoothing: 0.5,
  streamline: 0.5,
  thinning: 0.6,
}

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

function shouldInkCapture(tool, pointerType) {
  if (pointerType === 'pen') {
    return tool !== INK_TOOLS.highlight && tool !== INK_TOOLS.text
  }
  return tool === INK_TOOLS.pen || tool === INK_TOOLS.erase
}

function isErasing(tool) {
  return tool === INK_TOOLS.erase
}

function canDrawStroke(tool, pointerType) {
  if (isErasing(tool)) return false
  if (pointerType === 'pen') {
    return tool !== INK_TOOLS.highlight && tool !== INK_TOOLS.text
  }
  return tool === INK_TOOLS.pen
}

/**
 * SVG ink overlay for a scrollable pane. Apple Pencil always draws (or erases);
 * finger/mouse ink only when Pen or Eraser tool is active.
 */
function InkLayer({
  scrollContainerRef,
  strokes = [],
  tool = INK_TOOLS.scroll,
  color = '#1d4ed8',
  size = 4,
  onCommitStroke,
  onEraseStroke,
}) {
  const [dims, setDims] = useState({ width: 0, height: 0 })
  const [anchorPositions, setAnchorPositions] = useState({})
  const [liveStroke, setLiveStroke] = useState(null)
  const drawing = useRef(false)
  const livePoints = useRef([])
  const liveAnchor = useRef(null)

  const measureAnchors = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const ids = new Set()
    strokes.forEach(s => { if (s.anchorId) ids.add(s.anchorId) })
    el.querySelectorAll('[data-ink-anchor]').forEach(node => {
      if (node.dataset.inkAnchor) ids.add(node.dataset.inkAnchor)
    })
    const next = {}
    ids.forEach((id) => {
      const pos = measureAnchor(el, id)
      if (pos) next[id] = pos
    })
    setAnchorPositions(next)
  }, [scrollContainerRef, strokes])

  useLayoutEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const measure = () => {
      setDims({ width: el.clientWidth, height: Math.max(el.scrollHeight, el.clientHeight) })
      measureAnchors()
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const mo = new MutationObserver(measure)
    mo.observe(el, { childList: true, subtree: true, attributes: true })
    window.addEventListener('resize', measure)
    el.addEventListener('scroll', measure, { passive: true })
    return () => {
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', measure)
      el.removeEventListener('scroll', measure)
    }
  }, [scrollContainerRef, strokes, tool, measureAnchors])

  const toContentPoint = useCallback((e) => {
    const el = scrollContainerRef.current
    const rect = el.getBoundingClientRect()
    return [
      e.clientX - rect.left + el.scrollLeft,
      e.clientY - rect.top + el.scrollTop,
      e.pressure && e.pressure > 0 ? e.pressure : 0.5,
    ]
  }, [scrollContainerRef])

  const resolveAbsolutePoints = useCallback((stroke) => {
    if (!stroke.anchorId) return stroke.points
    const anchorPos = anchorPositions[stroke.anchorId]
    if (!anchorPos) return stroke.points
    return toAbsolutePoints(stroke.points, anchorPos)
  }, [anchorPositions])

  const eraseAt = useCallback((x, y) => {
    const threshold = 12
    for (const stroke of strokes) {
      const absPoints = resolveAbsolutePoints(stroke)
      const hitStroke = { ...stroke, points: absPoints }
      if (pointHitsStroke(x, y, hitStroke, threshold + (stroke.size || 0))) {
        onEraseStroke?.(stroke.id)
        break
      }
    }
  }, [strokes, onEraseStroke, resolveAbsolutePoints])

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    const handleDown = (e) => {
      if (!shouldInkCapture(tool, e.pointerType)) return
      if (tool === INK_TOOLS.text || tool === INK_TOOLS.highlight) return

      e.preventDefault()
      try { el.setPointerCapture?.(e.pointerId) } catch {}

      const pt = toContentPoint(e)
      const erasing = isErasing(tool)

      if (erasing) {
        drawing.current = true
        eraseAt(pt[0], pt[1])
        return
      }

      const anchor = findAnchorAt(el, pt[0], pt[1])
      liveAnchor.current = anchor
      drawing.current = true
      livePoints.current = [pt]
      setLiveStroke({ color, size, points: [pt], anchorId: anchor?.id ?? null })
    }

    const handleMove = (e) => {
      if (!drawing.current) return
      if (!shouldInkCapture(tool, e.pointerType)) return
      e.preventDefault()
      const pt = toContentPoint(e)

      if (isErasing(tool)) {
        eraseAt(pt[0], pt[1])
        return
      }

      livePoints.current = [...livePoints.current, pt]
      setLiveStroke({
        color,
        size,
        points: livePoints.current,
        anchorId: liveAnchor.current?.id ?? null,
      })
    }

    const finish = (e) => {
      if (!drawing.current) return
      drawing.current = false
      try { el.releasePointerCapture?.(e.pointerId) } catch {}

      if (isErasing(tool)) {
        livePoints.current = []
        setLiveStroke(null)
        liveAnchor.current = null
        return
      }

      if (livePoints.current.length > 0 && canDrawStroke(tool, e.pointerType)) {
        const anchor = liveAnchor.current
        const relativePoints = anchor
          ? toAnchorRelativePoints(livePoints.current, anchor)
          : livePoints.current
        onCommitStroke?.({
          id: uuidv4(),
          color,
          size,
          anchorId: anchor?.id ?? null,
          points: relativePoints,
        })
      }
      livePoints.current = []
      setLiveStroke(null)
      liveAnchor.current = null
    }

    el.addEventListener('pointerdown', handleDown, { passive: false })
    el.addEventListener('pointermove', handleMove, { passive: false })
    el.addEventListener('pointerup', finish)
    el.addEventListener('pointercancel', finish)
    return () => {
      el.removeEventListener('pointerdown', handleDown)
      el.removeEventListener('pointermove', handleMove)
      el.removeEventListener('pointerup', finish)
      el.removeEventListener('pointercancel', finish)
    }
  }, [scrollContainerRef, tool, color, size, toContentPoint, eraseAt, onCommitStroke])

  const renderedStrokes = useMemo(() => {
    return strokes.map(stroke => ({
      ...stroke,
      absPoints: resolveAbsolutePoints(stroke),
    }))
  }, [strokes, resolveAbsolutePoints])

  const liveAbsPoints = liveStroke?.points ?? null

  return (
    <svg
      className="absolute top-0 left-0 z-20 pointer-events-none"
      style={{ width: dims.width, height: dims.height, touchAction: 'pan-y' }}
      width={dims.width}
      height={dims.height}
      aria-hidden="true"
    >
      {renderedStrokes.map(stroke => (
        <path
          key={stroke.id}
          d={strokeToPath(stroke.absPoints, stroke.size || size)}
          fill={stroke.color}
        />
      ))}
      {liveAbsPoints && (
        <path d={strokeToPath(liveAbsPoints, liveStroke.size)} fill={liveStroke.color} />
      )}
    </svg>
  )
}

export default InkLayer
