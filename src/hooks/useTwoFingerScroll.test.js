import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRef } from 'react'
import { useTwoFingerScroll } from './useTwoFingerScroll'

function renderWithScroll(enabled = true) {
  const el = document.createElement('div')
  el.style.height = '100px'
  el.style.overflow = 'auto'
  const inner = document.createElement('div')
  inner.style.height = '1000px'
  el.appendChild(inner)
  document.body.appendChild(el)

  const { result, unmount } = renderHook(() => {
    const ref = useRef(el)
    useTwoFingerScroll(ref, enabled)
    return ref
  })

  return {
    el,
    ref: result.current,
    unmount: () => {
      unmount()
      document.body.removeChild(el)
    },
  }
}

function firePointer(el, type, { pointerId, clientX, clientY, pointerType = 'touch' }) {
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId,
    clientX,
    clientY,
    pointerType,
  }))
}

describe('useTwoFingerScroll', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('scrolls the container when two fingers drag', () => {
    const { el, unmount } = renderWithScroll(true)
    el.scrollTop = 50

    firePointer(el, 'pointerdown', { pointerId: 1, clientX: 10, clientY: 100 })
    firePointer(el, 'pointerdown', { pointerId: 2, clientX: 40, clientY: 100 })
    firePointer(el, 'pointermove', { pointerId: 1, clientX: 10, clientY: 80 })
    firePointer(el, 'pointermove', { pointerId: 2, clientX: 40, clientY: 80 })

    expect(el.scrollTop).toBeGreaterThan(50)
    unmount()
  })

  it('does not scroll with a single finger', () => {
    const { el, unmount } = renderWithScroll(true)
    el.scrollTop = 50

    firePointer(el, 'pointerdown', { pointerId: 1, clientX: 10, clientY: 100 })
    firePointer(el, 'pointermove', { pointerId: 1, clientX: 10, clientY: 60 })

    expect(el.scrollTop).toBe(50)
    unmount()
  })

  it('dispatches cancel event when the second finger lands', () => {
    const { el, unmount } = renderWithScroll(true)
    const spy = vi.fn()
    el.addEventListener('journal-two-finger-scroll', spy)

    firePointer(el, 'pointerdown', { pointerId: 1, clientX: 10, clientY: 100 })
    firePointer(el, 'pointerdown', { pointerId: 2, clientX: 40, clientY: 100 })

    expect(spy).toHaveBeenCalledTimes(1)
    unmount()
  })
})
