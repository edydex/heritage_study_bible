'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import formatting from '../../packages/service-core/node/services/project/SlideFormatting.js'

type Span = Record<string, any>
const EMPTY_SPANS: Span[] = []
type SelectionRange = { start: number; end: number; x: number; y: number }

export default function SlideText({ text, label, role, spans = EMPTY_SPANS, readOnly = false, canFormat = false, onCommit }: {
  text: string; label: string; role: string; spans?: Span[]; readOnly?: boolean; canFormat?: boolean;
  onCommit: (text: string, spans: Span[]) => void
}) {
  const element = useRef<HTMLDivElement>(null)
  const toolbar = useRef<HTMLDivElement>(null)
  const draft = useRef({ text, spans })
  const [range, setRange] = useState<SelectionRange | null>(null)
  const rangeRef = useRef<SelectionRange | null>(null)
  const [error, setError] = useState('')
  function restore(start: number, end: number) {
    const root = element.current!
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const selection = document.createRange()
    let offset = 0, found = false, node: Node | null
    while ((node = walker.nextNode())) {
      const length = node.textContent?.length || 0
      if (!found && start <= offset + length) { selection.setStart(node, start - offset); found = true }
      if (found && end <= offset + length) { selection.setEnd(node, end - offset); break }
      offset += length
    }
    if (found) { const selected = window.getSelection(); selected?.removeAllRanges(); selected?.addRange(selection) }
  }
  function paint() {
    const node = element.current
    if (!node) return
    node.replaceChildren()
    let offset = 0
    for (const span of draft.current.spans) {
      node.append(document.createTextNode(draft.current.text.slice(offset, span.start)))
      const fragment = document.createElement('span')
      fragment.textContent = draft.current.text.slice(span.start, span.end)
      if (span.foreground) fragment.style.color = span.foreground
      if (span.weight) fragment.style.fontWeight = span.weight
      if (span.fontScale) fragment.style.fontSize = `${span.fontScale}em`
      if (span.italic !== undefined) fragment.style.fontStyle = span.italic ? 'italic' : 'normal'
      if (span.underline !== undefined) fragment.style.textDecoration = span.underline ? 'underline' : 'none'
      node.append(fragment); offset = span.end
    }
    node.append(document.createTextNode(draft.current.text.slice(offset)))
  }
  useEffect(() => {
    draft.current = { text, spans }; paint()
    if (rangeRef.current && document.activeElement === element.current) restore(rangeRef.current.start, rangeRef.current.end)
  }, [text, spans])
  useEffect(() => {
    if (!canFormat) return
    const update = () => {
      const selection = window.getSelection(), root = element.current
      if (!root || !selection?.rangeCount) return
      const selected = selection.getRangeAt(0)
      if (!root.contains(selected.startContainer) || !root.contains(selected.endContainer) || selected.collapsed) {
        if (toolbar.current?.contains(document.activeElement)) return
        rangeRef.current = null; setRange(null); return
      }
      const prefix = selected.cloneRange(); prefix.selectNodeContents(root); prefix.setEnd(selected.startContainer, selected.startOffset)
      const start = prefix.toString().length, end = start + selected.toString().length
      const rect = selected.getBoundingClientRect()
      const value = { start, end, x: Math.max(8, Math.min(rect.left, innerWidth - 290)), y: Math.max(8, rect.top - 44) }
      rangeRef.current = value; setRange(value)
    }
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [canFormat])
  function input() {
    const value = element.current?.textContent || ''
    draft.current = { text: value, spans: formatting.remapTextSpans(draft.current.text, value, draft.current.spans) }
    element.current?.dispatchEvent(new Event('input-fit', { bubbles: true }))
  }
  function insertPlain(value: string) {
    const selection = window.getSelection()
    if (!selection?.rangeCount) return
    const selected = selection.getRangeAt(0)
    if (!element.current?.contains(selected.commonAncestorContainer)) return
    selected.deleteContents(); const node = document.createTextNode(value); selected.insertNode(node)
    selected.setStartAfter(node); selected.collapse(true); selection.removeAllRanges(); selection.addRange(selected); input()
  }
  function active(key: string, value: unknown) {
    if (!range) return false
    const base = getComputedStyle(element.current!)
    const fallback = key === 'weight' ? base.fontWeight : key === 'italic' ? base.fontStyle === 'italic' : base.textDecorationLine.includes('underline')
    const points = [...new Set([range.start, range.end, ...draft.current.spans.flatMap(span => [span.start, span.end]).filter(offset => offset > range.start && offset < range.end)])].sort((a,b) => a-b)
    for (let index = 0; index < points.length - 1; index++) {
      const span = draft.current.spans.find(span => span.start <= points[index] && span.end >= points[index+1])
      const actual = span?.[key] ?? fallback
      if (key === 'weight' ? Number(actual) < 600 : actual !== value) return false
    }
    return true
  }
  function apply(patch: Record<string, unknown> | null, focusEditor = true) {
    const selected = rangeRef.current
    if (!selected) return
    try {
      const next = formatting.applyTextStyle(draft.current.text, draft.current.spans, selected.start, selected.end, patch)
      draft.current = { ...draft.current, spans: next }; paint(); if (focusEditor) element.current?.focus(); restore(selected.start, selected.end)
      onCommit(draft.current.text, next); setError('')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not format text.') }
  }
  function commit() { if (draft.current.text !== text || JSON.stringify(draft.current.spans) !== JSON.stringify(spans)) onCommit(draft.current.text, draft.current.spans) }
  return <><div ref={element} className="heritage-service-planner__editable-text" data-role={role} data-fit-text
    contentEditable={readOnly ? false : 'plaintext-only'} suppressContentEditableWarning
    role={!readOnly || canFormat ? 'textbox' : undefined} aria-readonly={readOnly && canFormat || undefined} aria-multiline={!readOnly || canFormat || undefined} aria-label={label} tabIndex={readOnly && canFormat ? 0 : undefined}
    onInput={input} onBlur={event => { if (!toolbar.current?.contains(event.relatedTarget as Node)) commit() }}
    onPaste={event => { if (readOnly) return; event.preventDefault(); insertPlain(event.clipboardData.getData('text/plain')) }}
    onKeyDown={event => {
      if (canFormat && (event.metaKey || event.ctrlKey) && ['b','i','u'].includes(event.key.toLowerCase())) { event.preventDefault(); const key = event.key.toLowerCase() === 'b' ? 'weight' : event.key.toLowerCase() === 'i' ? 'italic' : 'underline'; const value = key === 'weight' ? '700' : true; apply({ [key]: active(key, value) ? (key === 'weight' ? '400' : false) : value }); return }
      if (readOnly) return
      if (event.key === 'Escape') { draft.current = {text,spans}; paint(); element.current?.blur() }
      if (event.key === 'Enter') { event.preventDefault(); if (event.metaKey || event.ctrlKey) element.current?.blur(); else insertPlain('\n') }
    }} />
    {range && canFormat ? createPortal(<div ref={toolbar} className="heritage-slide-format" role="toolbar" aria-label="Selected text formatting" style={{left:range.x,top:range.y}}>
      {([['Bold','B','weight','700'],['Italic','I','italic',true],['Underline','U','underline',true]] as const).map(([label,caption,key,value]) => <button key={key} type="button" aria-label={label} aria-pressed={active(key,value)} onPointerDown={event => event.preventDefault()} onClick={() => apply({ [key]: active(key,value) ? (key === 'weight' ? '400' : false) : value })}>{caption}</button>)}
      <label title="Text color"><span>Color</span><input type="color" aria-label="Text color" defaultValue="#ffc000" onInput={event => apply({foreground:event.currentTarget.value}, false)} /></label>
      <button type="button" aria-label="Clear formatting" onPointerDown={event => event.preventDefault()} onClick={() => apply(null)}>Clear</button>
      {error ? <span role="alert">{error}</span> : null}
    </div>, document.body) : null}</>
}
