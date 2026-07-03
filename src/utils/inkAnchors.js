/** Find the ink anchor element containing or nearest above a content-space point. */
export function findAnchorAt(container, contentX, contentY) {
  if (!container) return null
  const containerRect = container.getBoundingClientRect()
  const anchors = container.querySelectorAll('[data-ink-anchor]')

  let containing = null
  let nearestAbove = null
  let nearestTop = -Infinity

  for (const el of anchors) {
    const rect = el.getBoundingClientRect()
    const top = rect.top - containerRect.top + container.scrollTop
    const left = rect.left - containerRect.left + container.scrollLeft
    const bottom = top + rect.height
    const right = left + rect.width

    if (contentX >= left && contentX <= right && contentY >= top && contentY <= bottom) {
      containing = { id: el.dataset.inkAnchor, top, left, el }
      break
    }

    if (contentY >= top && top >= nearestTop) {
      nearestAbove = { id: el.dataset.inkAnchor, top, left, el }
      nearestTop = top
    }
  }

  return containing || nearestAbove
}

/** Measure anchor position within a scroll container's content coordinates. */
export function measureAnchor(container, anchorId) {
  if (!container || !anchorId) return null
  const el = container.querySelector(`[data-ink-anchor="${anchorId}"]`)
  if (!el) return null
  const containerRect = container.getBoundingClientRect()
  const rect = el.getBoundingClientRect()
  return {
    id: anchorId,
    top: rect.top - containerRect.top + container.scrollTop,
    left: rect.left - containerRect.left + container.scrollLeft,
    el,
  }
}

/** Convert absolute content points to anchor-relative storage format. */
export function toAnchorRelativePoints(points, anchor) {
  if (!anchor) return points
  return points.map(([x, y, pressure]) => [x - anchor.left, y - anchor.top, pressure])
}

/** Convert anchor-relative points to absolute content coordinates for rendering. */
export function toAbsolutePoints(points, anchorPos) {
  if (!anchorPos) return points
  return points.map(([x, y, pressure]) => [x + anchorPos.left, y + anchorPos.top, pressure])
}
