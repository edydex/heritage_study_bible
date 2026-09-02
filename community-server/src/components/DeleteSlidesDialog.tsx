'use client'
import { useEffect, useRef } from 'react'

export default function DeleteSlidesDialog({ count, sections, onDelete, onCancel }: {
  count: number; sections: boolean; onDelete: () => void; onCancel: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} className="heritage-slide-dialog heritage-move-dialog" aria-labelledby="delete-slides-title" onCancel={onCancel}>
    <form onSubmit={event => { event.preventDefault(); onDelete() }}>
      <header><h2 id="delete-slides-title">Delete {count === 1 ? '1 slide' : count ? `${count} slides` : 'section'}?</h2><button type="button" aria-label="Close Delete" onClick={onCancel}>×</button></header>
      <p>{sections ? 'The selected sections and their slides will be removed from this service.' : 'The selected slides will be removed from this service.'} Library originals stay unchanged.</p>
      <small>Undo restores the whole selection before you save.</small>
      <footer><button type="button" autoFocus onClick={onCancel}>Cancel</button><button type="submit">Delete</button></footer>
    </form>
  </dialog>
}
