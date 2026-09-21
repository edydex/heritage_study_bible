'use client'
import { useEffect, useRef, type ReactNode } from 'react'
export default function SlideSettingsDialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { const node=dialog.current; node?.showModal(); return () => node?.close() }, [])
  return <dialog ref={dialog} className="heritage-slide-dialog heritage-slide-settings" aria-labelledby="slide-settings-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <header><h2 id="slide-settings-title">Slide settings</h2><button type="button" aria-label="Close slide settings" onClick={onClose}>×</button></header>
    <div className="heritage-slide-settings__fields">{children}</div>
    <footer><small>Changes stay in your draft. Save the sermon or service to keep them.</small><button type="button" onClick={onClose}>Done</button></footer>
  </dialog>
}
