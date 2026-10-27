import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import './navigationWheel.css'

const choices = [
  { label: 'Chapters', icon: 'M4 6h.01M4 12h.01M4 18h.01M9 6h11M9 12h11M9 18h11' },
  { label: 'Audiobooks', icon: 'M4 14v-3a8 8 0 0 1 16 0v3M4 12H3v8h4v-8H4Zm16 0h1v8h-4v-8h3Z', path: '/audio?kind=audiobook' },
  { label: 'Books', icon: 'M12 6v15M12 6C9 4 6 3.5 3 4v15c3-.5 6 0 9 2 3-2 6-2.5 9-2V4c-3-.5-6 0-9 2Z', path: '/resources/books' },
  { label: 'Reading plans', icon: 'M8 3v4M16 3v4M4 10h16M8 15l3 3 5-5M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z', path: '/resources/reading-plans' },
]
const HOLD_MS = 450
const sectorClip = index => {
  const arc = Array.from({ length: 19 }, (_, point) => {
    const angle = Math.PI - (index + point / 18) * Math.PI / choices.length
    return `${50 + Math.cos(angle) * 50}% ${100 - Math.sin(angle) * 100}%`
  })
  return `polygon(50% 100%, ${arc.join(', ')})`
}

// Pointer capture keeps a single hold/slide/release gesture working even when
// the finger leaves the title. A plain tap retains the chapter picker.
export default function NavigationWheel({ children, onClick, className = '', ...props }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const trigger = useRef(null), menu = useRef(null), timer = useRef(null)
  const cancelled = useRef(false)
  const held = useRef(false), pointer = useRef(null), origin = useRef(null)
  const activeRef = useRef(-1), center = useRef({ x: 0, y: 0, radius: 176, deadzone: 42 })
  const choose = index => {
    setOpen(false)
    activeRef.current = -1
    setActive(-1)
    if (index === 0) onClick?.()
    else if (choices[index]) navigate(choices[index].path)
  }
  const show = () => {
    held.current = pointer.current != null
    const bounds = trigger.current.getBoundingClientRect()
    const anchor = held.current && origin.current ? origin.current : { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
    // The bottom of the fan stays exactly under the held finger. Shrink the
    // radius to fit the viewport instead of moving the gesture's origin.
    const radius = Math.max(1, Math.min(176, anchor.x - 10, window.innerWidth - anchor.x - 10, anchor.y - 46))
    center.current = { ...anchor, radius, deadzone: Math.min(42, radius * .28) }
    setActive(-1); activeRef.current = -1; setOpen(true)
  }
  const clear = () => { clearTimeout(timer.current); timer.current = null }
  useEffect(() => () => clear(), [])
  useEffect(() => {
    if (!open) return
    const before = document.activeElement
    menu.current?.querySelector('button')?.focus({ preventScroll: true })
    const close = event => {
      if (event.type === 'keydown' && event.key !== 'Escape') return
      if (event.type === 'keydown' || event.type === 'heritage:native-back') event.preventDefault()
      if (event.type === 'heritage:native-back') event.stopImmediatePropagation()
      clear(); activeRef.current = -1; setActive(-1); pointer.current = null
      setOpen(false)
    }
    const lock = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', close)
    window.addEventListener('popstate', close)
    window.addEventListener('resize', close)
    window.addEventListener('heritage:native-back', close, true)
    return () => {
      document.body.style.overflow = lock
      window.removeEventListener('keydown', close)
      window.removeEventListener('popstate', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('heritage:native-back', close, true)
      before?.focus?.({ preventScroll: true })
    }
  }, [open])
  return <>
    <button {...props} ref={trigger} type="button" className={`navigation-wheel-trigger ${className}`}
      title="Tap for chapters · Hold and slide to navigate" aria-haspopup="dialog" aria-expanded={open}
      onContextMenu={event => { event.preventDefault(); clear(); show() }}
      onKeyDown={event => {
        if (event.key === 'ContextMenu' || (event.shiftKey && (event.key === 'Enter' || event.key === 'F10'))) { event.preventDefault(); show() }
      }}
      onPointerDown={event => {
        if (event.button !== 0) return
        held.current = false; cancelled.current = false; activeRef.current = -1
        pointer.current = event.pointerId; origin.current = { x: event.clientX, y: event.clientY }
        event.currentTarget.setPointerCapture(event.pointerId)
        clear(); timer.current = setTimeout(show, HOLD_MS)
      }}
      onPointerMove={event => {
        if (pointer.current !== event.pointerId || !origin.current) return
        const moved = Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y)
        if (cancelled.current) return
        if (!held.current) { if (moved > 14) { clear(); held.current = true; cancelled.current = true }; return }
        event.preventDefault()
        const dx = event.clientX - center.current.x, dy = event.clientY - center.current.y
        const distance = Math.hypot(dx, dy)
        const angle = Math.atan2(-dy, dx)
        const index = moved > 14 && dy < 0 && distance > center.current.deadzone && distance <= center.current.radius
          ? Math.min(choices.length - 1, Math.floor((Math.PI - angle) / Math.PI * choices.length)) : -1
        activeRef.current = index; setActive(index)
      }}
      onPointerUp={event => {
        clear(); pointer.current = null
        if (held.current) { event.preventDefault(); if (!cancelled.current && activeRef.current >= 0) choose(activeRef.current) }
      }}
      onPointerCancel={() => { clear(); pointer.current = null; activeRef.current = -1; cancelled.current = true; held.current = true; setOpen(false) }}
      onClick={event => { if (held.current) { held.current = false; event.preventDefault(); return } onClick?.(event) }}
    >{children}</button>
    {open && createPortal(<div className="navigation-wheel-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) setOpen(false) }}>
      <div ref={menu} className={`navigation-wheel ${center.current.radius < 110 ? 'is-compact' : ''} ${center.current.radius < 80 ? 'is-icons-only' : ''}`} role="dialog" aria-modal="true" aria-label="Slide to navigate"
        style={{ left: center.current.x, top: center.current.y, '--wheel-radius': `${center.current.radius}px`, '--wheel-deadzone': `${center.current.deadzone}px`, '--wheel-base-height': `${Math.max(0, window.innerHeight - center.current.y)}px` }}
        onKeyDown={event => {
          const buttons = [...menu.current.querySelectorAll('button')]
          if (event.key === 'Tab') { event.preventDefault(); buttons[(buttons.indexOf(document.activeElement) + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus() }
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); buttons[(buttons.indexOf(document.activeElement) + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? buttons.length - 1 : 1)) % buttons.length]?.focus() }
        }}>
        <div className="navigation-wheel-base" aria-hidden="true" />
        {choices.map((choice, index) => {
          const angle = Math.PI - (index + .5) * Math.PI / choices.length
          const labelRadius = index === 1 || index === 2 ? .74 : .68
          return <button key={choice.label} type="button" aria-label={choice.label} className={`navigation-wheel-choice wheel-choice-${index} ${index === active ? 'is-active' : ''}`}
          style={{ clipPath: sectorClip(index) }}
          onPointerEnter={() => { if (pointer.current == null) { setActive(index); activeRef.current = index } }}
          onClick={() => choose(index)}>
            <span className="navigation-wheel-choice-content" style={{ left: `${50 + Math.cos(angle) * labelRadius * 50}%`, top: `${100 - Math.sin(angle) * labelRadius * 100}%` }}>
              <svg className="navigation-wheel-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={choice.icon} /></svg>
              <span className="navigation-wheel-label">{index === 1 ? <>Audio<wbr />books</> : choice.label}</span>
            </span>
          </button>
        })}
        <svg className="navigation-wheel-dividers" viewBox="0 0 200 100" aria-hidden="true">
          <path d="M0 100 A100 100 0 0 1 200 100 M100 100 L29.289 29.289 M100 100 L100 0 M100 100 L170.711 29.289" />
        </svg>
        <button type="button" className="navigation-wheel-cancel" aria-label="Cancel navigation" onClick={() => setOpen(false)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
        <p className="navigation-wheel-hint" aria-live="polite">{active >= 0 ? `Release for ${choices[active].label}` : 'Slide up to a section, then release'}</p>
      </div>
    </div>, document.body)}
  </>
}
