import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRef } from 'react'
import {
  useTwoFingerScroll,
  TWO_FINGER_SCROLL_END,
  TWO_FINGER_SCROLL_START,
} from './useTwoFingerScroll'

function renderWithScroll(enabled = true) {
  const el = document.createElement('div')
  el.style.height = '100px'
  el.style.overflow = 'auto'
  const inner = document.createElement('div')
  inner.style.height = '1000px'
  el.appendChild(inner)
  document.body.appendChild(el)

  const { unmount } = renderHook(() => {
    const ref = useRef(el)
    useTwoFingerScroll(ref, enabled)
    return ref
  })

  return {
    el,
    unmount: () => {
      unmount()
      document.body.removeChild(el)
    },
  }
}

function createTouch(target, { identifier, clientX, clientY }) {
  return new Touch({
    identifier,
    target,
    clientX,
    clientY,
    pageX: clientX,
    pageY: clientY,
    screenX: clientX,
    screenY: clientY,
  })
}

function fireTouch(el, type, touches, changedTouches = touches) {
  el.dispatchEvent(new TouchEvent(type, {
    bubbles: true,
    cancelable: true,
    touches,
    targetTouches: touches,
    changedTouches,
  }))
}

describe('useTwoFingerScroll', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('scrolls the container when two fingers drag', () => {
    const { el, unmount } = renderWithScroll(true)
    el.scrollTop = 50

    const t1 = createTouch(el, { identifier: 1, clientX: 10, clientY: 100 })
    const t2 = createTouch(el, { identifier: 2, clientX: 40, clientY: 100 })
    fireTouch(el, 'touchstart', [t1, t2])

    const t1b = createTouch(el, { identifier: 1, clientX: 10, clientY: 80 })
    const t2b = createTouch(el, { identifier: 2, clientX: 40, clientY: 80 })
    fireTouch(el, 'touchmove', [t1b, t2b], [t1b, t2b])

    expect(el.scrollTop).toBeGreaterThan(50)
    unmount()
  })

  it('does not scroll with a single finger', () => {
    const { el, unmount } = renderWithScroll(true)
    el.scrollTop = 50

    const t1 = createTouch(el, { identifier: 1, clientX: 10, clientY: 100 })
    fireTouch(el, 'touchstart', [t1])
    const t1b = createTouch(el, { identifier: 1, clientX: 10, clientY: 40 })
    fireTouch(el, 'touchmove', [t1b], [t1b])

    expect(el.scrollTop).toBe(50)
    unmount()
  })

  it('dispatches start and end events around a two-finger gesture', () => {
    const { el, unmount } = renderWithScroll(true)
    const start = vi.fn()
    const end = vi.fn()
    el.addEventListener(TWO_FINGER_SCROLL_START, start)
    el.addEventListener(TWO_FINGER_SCROLL_END, end)

    const t1 = createTouch(el, { identifier: 1, clientX: 10, clientY: 100 })
    const t2 = createTouch(el, { identifier: 2, clientX: 40, clientY: 100 })
    fireTouch(el, 'touchstart', [t1, t2])
    expect(start).toHaveBeenCalledTimes(1)
    expect(end).not.toHaveBeenCalled()

    fireTouch(el, 'touchend', [t1], [t2])
    expect(end).toHaveBeenCalledTimes(1)

    unmount()
  })

  it('ends scrolling when only one finger remains and ignores later one-finger moves', () => {
    const { el, unmount } = renderWithScroll(true)
    el.scrollTop = 80

    const t1 = createTouch(el, { identifier: 1, clientX: 10, clientY: 100 })
    const t2 = createTouch(el, { identifier: 2, clientX: 40, clientY: 100 })
    fireTouch(el, 'touchstart', [t1, t2])
    fireTouch(el, 'touchend', [t1], [t2])

    const before = el.scrollTop
    const t1b = createTouch(el, { identifier: 1, clientX: 10, clientY: 40 })
    fireTouch(el, 'touchmove', [t1b], [t1b])
    expect(el.scrollTop).toBe(before)
    unmount()
  })

  it('force-ends scrolling on window blur', () => {
    const { el, unmount } = renderWithScroll(true)
    const end = vi.fn()
    el.addEventListener(TWO_FINGER_SCROLL_END, end)

    const t1 = createTouch(el, { identifier: 1, clientX: 10, clientY: 100 })
    const t2 = createTouch(el, { identifier: 2, clientX: 40, clientY: 100 })
    fireTouch(el, 'touchstart', [t1, t2])
    window.dispatchEvent(new Event('blur'))

    expect(end).toHaveBeenCalledTimes(1)
    unmount()
  })
})
