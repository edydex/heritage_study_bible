'use client'
import { useWorkspaceText } from './useWorkspaceText'
import { useEffect, useRef } from 'react'

export default function DeleteSlidesDialog({ count, sections, onDelete, onCancel }: {
  count: number; sections: boolean; onDelete: () => void; onCancel: () => void
}) {
  const t = useWorkspaceText()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} className="heritage-slide-dialog heritage-move-dialog" aria-labelledby="delete-slides-title" onCancel={onCancel}>
    <form onSubmit={event => { event.preventDefault(); onDelete() }}>
      <header><h2 id="delete-slides-title">{t('Delete {selection}?', { selection: count === 1 ? t('1 slide') : count ? t('{count} slides', { count }) : t('section') })}</h2><button type="button" aria-label={t("Close Delete")} onClick={onCancel}>×</button></header>
      <p>{sections ? t("The selected sections and their slides will be removed from this service.") : t("The selected slides will be removed from this service.")}  {t("Library originals stay unchanged.")}</p>
      <small>{t("Undo restores the whole selection before you save.")}</small>
      <footer><button type="button" autoFocus onClick={onCancel}>{t("Cancel")}</button><button type="submit">{t("Delete")}</button></footer>
    </form>
  </dialog>
}
