import { useEffect, useRef } from 'react'

export const TWO_FINGER_SCROLL_START = 'journal-two-finger-scroll'
export const TWO_FINGER_SCROLL_END = 'journal-two-finger-scroll-end'

/**
 * When enabled (e.g. touch-none tool modes), allow scrolling with two fingers.
 * Dispatches start/end events so ink/highlight gestures can cancel and resume.
 */
export function useTwoFingerScroll(scrollRef, enabled) {
  const activePointers = useRef(new Map())
  const scrolling = useRef(false)
  const lastY = useRef(null)

  useEffect(() => {
    if (!enabled) return
    const el = scrollRef.current
    if (!el) return

    const averageY = () => {
      let sum = 0
      for (const p of activePointers.current.values()) sum += p.y
      return sum / activePointers.current.size
    }

    const releaseCaptures = () => {
      for (const id of activePointers.current.keys()) {
        try { el.releasePointerCapture?.(id) } catch { /* ignore */ }
      }
    }

    const endScrolling = () => {
      if (!scrolling.current) return
      scrolling.current = false
      lastY.current = null
      el.dispatchEvent(new CustomEvent(TWO_FINGER_SCROLL_END, { bubbles: false }))
    }

    const clear = () => {
      endScrolling()
      activePointers.current.clear()
      lastY.current = null
    }

    const onDown = (e) => {
      if (e.pointerType === 'pen') return

      // Drop stale tracked pointers if the browser reused ids after a missed up.
      if (activePointers.current.has(e.pointerId)) {
        activePointers.current.delete(e.pointerId)
      }

      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (activePointers.current.size >= 2 && !scrolling.current) {
        scrolling.current = true
        lastY.current = averageY()
        releaseCaptures()
        el.dispatchEvent(new CustomEvent(TWO_FINGER_SCROLL_START, { bubbles: false }))
        // Block ink/highlight handlers from treating this as a new stroke.
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }

    const onMove = (e) => {
      if (!activePointers.current.has(e.pointerId)) return
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (!scrolling.current || activePointers.current.size < 2) return
      e.preventDefault()
      e.stopPropagation()
      const y = averageY()
      el.scrollTop += lastY.current - y
      lastY.current = y
    }

    const onUp = (e) => {
      if (!activePointers.current.has(e.pointerId)) return
      activePointers.current.delete(e.pointerId)
      if (activePointers.current.size < 2) endScrolling()
      if (activePointers.current.size === 0) {
        activePointers.current.clear()
        lastY.current = null
      }
    }

    el.addEventListener('pointerdown', onDown, { capture: true })
    el.addEventListener('pointermove', onMove, { capture: true, passive: false })
    el.addEventListener('pointerup', onUp, { capture: true })
    el.addEventListener('pointercancel', onUp, { capture: true })

    return () => {
      el.removeEventListener('pointerdown', onDown, { capture: true })
      el.removeEventListener('pointermove', onMove, { capture: true })
      el.removeEventListener('pointerup', onUp, { capture: true })
      el.removeEventListener('pointercancel', onUp, { capture: true })
      clear()
    }
  }, [scrollRef, enabled])
}
