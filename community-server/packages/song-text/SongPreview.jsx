import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './preview.css'

// Keep the existing link/button as the interaction target. Keyboard focus also
// opens the preview; touch taps still open the song normally.
export default function SongPreview({ children, title, sections, loadSections, block = false }) {
  const anchor = useRef(null), popup = useRef(null), timer = useRef(null)
  const [open, setOpen] = useState(false), [loaded, setLoaded] = useState(null)
  const [position, setPosition] = useState({ left: 8, top: 8 })
  const [failed, setFailed] = useState(false)
  const id = useId()
  function cancel() { clearTimeout(timer.current) }
  function show(delay = 250) { cancel(); timer.current = setTimeout(() => setOpen(true), delay) }
  function hide() { cancel(); timer.current = setTimeout(() => setOpen(false), 140) }
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (!open || sections || !loadSections) return
    let active = true
    const controller = new AbortController()
    setLoaded(null); setFailed(false)
    Promise.resolve().then(() => loadSections(controller.signal)).then(value => { if (active) setLoaded(value) })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false; controller.abort() }
  }, [open, sections, loadSections])
  useEffect(() => {
    if (!open) return
    function place() {
      const a = anchor.current?.getBoundingClientRect(), p = popup.current?.getBoundingClientRect()
      if (!a || !p) return
      const left = Math.max(8, Math.min(a.left, window.innerWidth - p.width - 8))
      const top = a.bottom + 8 + p.height <= window.innerHeight - 8 ? a.bottom + 8 : Math.max(8, a.top - p.height - 8)
      setPosition({ left, top })
    }
    const observer = new ResizeObserver(place)
    if (popup.current) observer.observe(popup.current)
    const escape = event => { if (event.key === 'Escape') { cancel(); setOpen(false) } }
    const scroll = event => { if (!popup.current?.contains(event.target)) setOpen(false) }
    place(); document.addEventListener('keydown', escape); document.addEventListener('scroll', scroll, true); window.addEventListener('resize', place)
    return () => { observer.disconnect(); document.removeEventListener('keydown', escape); document.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', place) }
  }, [open])
  const content = sections || loaded
  const Wrapper = block ? 'div' : 'span'
  return <Wrapper ref={anchor} className="heritage-song-preview-anchor" aria-describedby={open ? id : undefined}
    onMouseEnter={() => show()} onMouseLeave={hide} onFocusCapture={() => show(0)}
    onBlurCapture={event => { if (!anchor.current?.contains(event.relatedTarget) && !popup.current?.contains(event.relatedTarget)) hide() }}>
    {children}
    {open && createPortal(<div ref={popup} id={id} role="tooltip" className="heritage-song-preview" style={position} onMouseEnter={cancel} onMouseLeave={hide}>
      <strong>{title}</strong>
      {content?.length ? content.map((section, index) => <section key={index} lang={section.language || 'en'}><small>{section.label || (section.language === 'ru' ? 'Куплет 1' : 'First section')}</small><p>{section.lines.join('\n')}</p></section>)
        : <p>{failed ? 'Preview unavailable. Open the song to try again.' : content ? 'No lyrics available for preview.' : 'Loading first section…'}</p>}
    </div>, document.body)}
  </Wrapper>
}
