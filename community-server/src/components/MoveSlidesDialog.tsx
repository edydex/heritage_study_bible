'use client'
import { useEffect, useRef, useState } from 'react'

export default function MoveSlidesDialog({ count, maximum, initial, onMove, onCancel }: {
  count: number; maximum: number; initial: number; onMove: (position: number) => void; onCancel: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  useEffect(() => { dialog.current?.showModal(); input.current?.select() }, [])
  return <dialog ref={dialog} className="heritage-slide-dialog heritage-move-dialog" aria-labelledby="move-slides-title" onCancel={onCancel}>
    <form onSubmit={event => {
      event.preventDefault()
      try { onMove(Number(input.current?.value)); setError('') }
      catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not move the slides.') }
    }}>
      <header><h2 id="move-slides-title">Move {count === 1 ? 'slide' : count ? `${count} slides` : 'section'} to…</h2><button type="button" aria-label="Close Move To" onClick={onCancel}>×</button></header>
      <label>Starting slide number<input ref={input} type="number" min={1} max={maximum} step={1} defaultValue={Math.min(initial, maximum)} required autoFocus /></label>
      <p>The selection will start at this number. Its slides stay in order; the other slides shift to make room.</p>
      <small>Choose 1–{maximum}{count > 1 ? `. The selection occupies ${count} consecutive slides.` : '.'}</small>
      {error ? <p role="alert">{error}</p> : null}
      <footer><button type="button" onClick={onCancel}>Cancel</button><button type="submit">Move</button></footer>
    </form>
  </dialog>
}
