'use client'
import { useEffect, useRef } from 'react'

export default function ScriptureEditionDialog({ edition, output, onChange, onCancel }: {
  edition: string; output: string; onChange: () => void; onCancel: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} className="heritage-slide-dialog heritage-move-dialog" aria-labelledby="scripture-edition-title" onCancel={onCancel}>
    <form onSubmit={event=>{event.preventDefault();onChange()}}>
      <header><h2 id="scripture-edition-title">Change Bible edition to {edition}?</h2><button type="button" aria-label="Close Bible edition change" onClick={onCancel}>×</button></header>
      <p>This replaces edited Scripture wording and highlights on the {output} output for this passage. Other passages and the other language stay unchanged.</p>
      <small>Undo restores the previous wording and formatting before you save.</small>
      <footer><button type="button" autoFocus onClick={onCancel}>Cancel</button><button type="submit">Change edition</button></footer>
    </form>
  </dialog>
}
