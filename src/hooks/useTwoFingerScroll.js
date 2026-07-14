import { useEffect, useRef } from 'react'

export const TWO_FINGER_SCROLL_START = 'journal-two-finger-scroll'
export const TWO_FINGER_SCROLL_END = 'journal-two-finger-scroll-end'

function averageClientY(touches) {
  let sum = 0
  for (let i = 0; i < touches.length; i++) sum += touches[i].clientY
  return sum / touches.length
}

/**
 * When enabled (e.g. touch-none tool modes), allow scrolling with two fingers.
 * Uses TouchEvents (`e.touches`) so active-finger count can't get stuck from
 * missed pointerup/lostpointercapture. Dispatches start/end for ink/highlight.
 */
export function useTwoFingerScroll(scrollRef, enabled) {
  const scrollingRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    const el = scrollRef.current
    if (!el) return

    let lastY = null

    const endScrolling = () => {
      if (!scrollingRef.current) return
      scrollingRef.current = false
      lastY = null
      el.dispatchEvent(new CustomEvent(TWO_FINGER_SCROLL_END, { bubbles: false }))
    }

    const startScrolling = (touches) => {
      if (scrollingRef.current) return
      scrollingRef.current = true
      lastY = averageClientY(touches)
      el.dispatchEvent(new CustomEvent(TWO_FINGER_SCROLL_START, { bubbles: false }))
    }

    const onTouchStart = (e) => {
      if (e.touches.length >= 2) startScrolling(e.touches)
    }

    const onTouchMove = (e) => {
      if (e.touches.length < 2) {
        endScrolling()
        return
      }
      if (!scrollingRef.current) startScrolling(e.touches)
      e.preventDefault()
      const y = averageClientY(e.touches)
      if (lastY != null) el.scrollTop += lastY - y
      lastY = y
    }

    const onTouchEnd = (e) => {
      if (e.touches.length >= 2) {
        lastY = averageClientY(e.touches)
        return
      }
      endScrolling()
    }

    // While two-finger scrolling, block touch pointer events from restarting ink.
    const blockInkPointers = (e) => {
      if (!scrollingRef.current) return
      if (e.pointerType === 'pen') return
      e.preventDefault()
      e.stopImmediatePropagation()
    }

    const forceEnd = () => endScrolling()

    el.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
    el.addEventListener('touchmove', onTouchMove, { capture: true, passive: false })
    el.addEventListener('touchend', onTouchEnd, { capture: true })
    el.addEventListener('touchcancel', onTouchEnd, { capture: true })
    el.addEventListener('pointerdown', blockInkPointers, { capture: true })
    el.addEventListener('pointermove', blockInkPointers, { capture: true })
    window.addEventListener('blur', forceEnd)
    document.addEventListener('visibilitychange', forceEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart, { capture: true })
      el.removeEventListener('touchmove', onTouchMove, { capture: true })
      el.removeEventListener('touchend', onTouchEnd, { capture: true })
      el.removeEventListener('touchcancel', onTouchEnd, { capture: true })
      el.removeEventListener('pointerdown', blockInkPointers, { capture: true })
      el.removeEventListener('pointermove', blockInkPointers, { capture: true })
      window.removeEventListener('blur', forceEnd)
      document.removeEventListener('visibilitychange', forceEnd)
      endScrolling()
    }
  }, [scrollRef, enabled])
}
