/** Returns true when two pointer events form a double-tap/click. */
export function isDoubleTap(event, lastTapRef, { maxDelay = 400, maxDistance = 36 } = {}) {
  const now = Date.now()
  const point = { time: now, x: event.clientX, y: event.clientY }

  if (lastTapRef.current) {
    const dt = now - lastTapRef.current.time
    const dist = Math.hypot(point.x - lastTapRef.current.x, point.y - lastTapRef.current.y)
    if (dt < maxDelay && dist < maxDistance) {
      lastTapRef.current = null
      return true
    }
  }

  lastTapRef.current = point
  return false
}
