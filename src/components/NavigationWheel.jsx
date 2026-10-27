import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import './navigationWheel.css'

const choices = [
  { label: 'Chapters', icon: '☷' },
  { label: 'Audiobooks', icon: '♫', path: '/audio?kind=audiobook' },
  { label: 'Books', icon: '▤', path: '/resources/books' },
  { label: 'Reading plans', icon: '✓', path: '/resources/reading-plans' },
]
const HOLD_MS = 450

// Pointer capture keeps a single hold/slide/release gesture working even when
// the finger leaves the title. A plain tap retains the chapter picker.
export default function NavigationWheel({ children, onClick, className = '', ...props }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const trigger = useRef(null), menu = useRef(null), timer = useRef(null)
  const cancelled = useRef(false)
  const held = useRef(false), pointer = useRef(null), origin = useRef(null)
  const activeRef = useRef(-1), center = useRef({ x: 0, y: 0 })
  const choose = index => {
    setOpen(false)
    activeRef.current = -1
    setActive(-1)
    if (index === 0) onClick?.()
    else if (choices[index]) navigate(choices[index].path)
  }
  const show = () => {
    held.current = pointer.current != null
    center.current = { x: window.innerWidth / 2, y: Math.max(175, window.innerHeight - 210) }
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
    window.addEventListener('heritage:native-back', close, true)
    return () => {
      document.body.style.overflow = lock
      window.removeEventListener('keydown', close)
      window.removeEventListener('popstate', close)
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
        const index = moved > 14 && distance > 48 && distance < 174 ? (dy < 0 ? (dx < 0 ? 0 : 1) : (dx < 0 ? 2 : 3)) : -1
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
      <div ref={menu} className="navigation-wheel" role="dialog" aria-modal="true" aria-label="Slide to navigate"
        style={{ left: center.current.x, top: center.current.y }}
        onKeyDown={event => {
          const buttons = [...menu.current.querySelectorAll('button')]
          if (event.key === 'Tab') { event.preventDefault(); buttons[(buttons.indexOf(document.activeElement) + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus() }
          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); buttons[(buttons.indexOf(document.activeElement) + (['ArrowLeft', 'ArrowUp'].includes(event.key) ? buttons.length - 1 : 1)) % buttons.length]?.focus() }
        }}>
        {choices.map((choice, index) => <button key={choice.label} type="button" className={`navigation-wheel-choice wheel-choice-${index} ${index === active ? 'is-active' : ''}`}
          onPointerEnter={() => { if (pointer.current == null) { setActive(index); activeRef.current = index } }}
          onClick={() => choose(index)}><span aria-hidden="true">{choice.icon}</span>{choice.label}</button>)}
        <button type="button" className="navigation-wheel-cancel" aria-label="Cancel navigation" onClick={() => setOpen(false)}>×</button>
        <p className="navigation-wheel-hint" aria-live="polite">{active >= 0 ? `Release for ${choices[active].label}` : 'Slide to a section, then release'}</p>
      </div>
    </div>, document.body)}
  </>
}
