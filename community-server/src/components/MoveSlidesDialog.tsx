'use client'
import { useWorkspaceText } from './useWorkspaceText'
import { useEffect, useRef, useState } from 'react'

export default function MoveSlidesDialog({ count, maximum, initial, onMove, onCancel }: {
  count: number; maximum: number; initial: number; onMove: (position: number) => void; onCancel: () => void
}) {
  const t = useWorkspaceText()
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
      <header><h2 id="move-slides-title">{t('Move {selection} to…', { selection: count === 1 ? t('slide') : count ? t('{count} slides', { count }) : t('section') })}</h2><button type="button" aria-label={t("Close Move To")} onClick={onCancel}>×</button></header>
      <label>{t("Starting slide number")}<input ref={input} type="number" min={1} max={maximum} step={1} defaultValue={Math.min(initial, maximum)} required autoFocus /></label>
      <p>{t("The selection will start at this number. Its slides stay in order; the other slides shift to make room.")}</p>
      <small>{t('Choose 1–{maximum}', { maximum })}. {count > 1 ? t('The selection occupies {count} consecutive slides.', { count }) : ''}</small>
      {error ? <p role="alert">{t(error)}</p> : null}
      <footer><button type="button" onClick={onCancel}>{t("Cancel")}</button><button type="submit">{t("Move")}</button></footer>
    </form>
  </dialog>
}
