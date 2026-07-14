import { useEffect, useRef } from 'react'

/**
 * When enabled (e.g. touch-none tool modes), allow scrolling with two fingers.
 * Dispatches `journal-two-finger-scroll` on the scroll element when a second
 * finger lands so ink/highlight gestures can cancel.
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

    const clear = () => {
      activePointers.current.clear()
      scrolling.current = false
      lastY.current = null
    }

    const onDown = (e) => {
      if (e.pointerType === 'pen') return
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (activePointers.current.size >= 2 && !scrolling.current) {
        scrolling.current = true
        lastY.current = averageY()
        el.dispatchEvent(new CustomEvent('journal-two-finger-scroll', { bubbles: false }))
        try { el.releasePointerCapture?.(e.pointerId) } catch { /* ignore */ }
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
      activePointers.current.delete(e.pointerId)
      if (activePointers.current.size < 2) {
        scrolling.current = false
        lastY.current = null
      }
      if (activePointers.current.size === 0) clear()
    }

    el.addEventListener('pointerdown', onDown, { capture: true })
    el.addEventListener('pointermove', onMove, { capture: true, passive: false })
    el.addEventListener('pointerup', onUp, { capture: true })
    el.addEventListener('pointercancel', onUp, { capture: true })
    el.addEventListener('lostpointercapture', onUp)

    return () => {
      el.removeEventListener('pointerdown', onDown, { capture: true })
      el.removeEventListener('pointermove', onMove, { capture: true })
      el.removeEventListener('pointerup', onUp, { capture: true })
      el.removeEventListener('pointercancel', onUp, { capture: true })
      el.removeEventListener('lostpointercapture', onUp)
      clear()
    }
  }, [scrollRef, enabled])
}
