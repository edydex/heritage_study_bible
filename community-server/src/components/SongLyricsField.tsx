'use client'

import { TextareaField, useFormFields } from '@payloadcms/ui'
import type { TextareaFieldClientProps } from 'payload'
import { useLayoutEffect, useRef } from 'react'

/** Keep Payload's validation and form state; only the textarea's size changes. */
export default function SongLyricsField(props: TextareaFieldClientProps) {
  const root = useRef<HTMLDivElement>(null)
  const value = useFormFields(([fields]) => fields[props.path]?.value)
  useLayoutEffect(() => {
    const textarea = root.current?.querySelector('textarea')
    if (!textarea) return
    const resize = () => {
      if (!textarea.clientWidth) return // Chords can be mounted inside a closed panel.
      textarea.style.height = 'auto'
      const border = textarea.offsetHeight - textarea.clientHeight
      textarea.style.height = `${textarea.scrollHeight + border}px`
    }
    resize()
    // Observe width changes, not our own textarea height changes.
    let width = root.current!.clientWidth
    const widthObserver = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width
      if (next !== width) { width = next; resize() }
    })
    widthObserver.observe(root.current!)
    return () => widthObserver.disconnect()
  }, [value])
  return <div ref={root} className="heritage-song-lyrics"><TextareaField {...props} /></div>
}
