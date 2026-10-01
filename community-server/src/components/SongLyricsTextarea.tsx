'use client'

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

/** Show all review text, including after edits or a change in column width. */
export default function SongLyricsTextarea({ value, rows = 1, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const textarea = ref.current
    if (!textarea) return
    const resize = () => {
      if (!textarea.clientWidth) return
      textarea.style.height = 'auto'
      const border = textarea.offsetHeight - textarea.clientHeight
      textarea.style.height = `${textarea.scrollHeight + border}px`
    }
    resize()
    let width = textarea.clientWidth
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width
      if (next !== width) { width = next; resize() }
    })
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [value])
  return <textarea {...props} ref={ref} value={value} rows={rows} className={['heritage-song-lyrics-textarea', className].filter(Boolean).join(' ')} />
}
