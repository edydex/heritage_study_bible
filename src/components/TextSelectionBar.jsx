import { useEffect, useState } from 'react'
import { writeTextToClipboard } from '../utils/verseSelection'
import { HighlightColorPicker, HoldHighlightAction } from './HighlightColorPicker'

function SelectionAction({ icon, label, active = false, disabled = false, ...buttonProps }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      className={`min-h-12 w-full select-none rounded-lg px-1 py-1.5 text-xs font-medium disabled:opacity-40 ${
        active
          ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100'
          : 'text-gray-700 active:bg-gray-100 dark:text-gray-200 dark:active:bg-gray-700'
      }`}
      {...buttonProps}
    >
      <span className="block text-lg leading-none" aria-hidden="true">{icon}</span>
      <span className="mt-1 block">{label}</span>
    </button>
  )
}

export default function TextSelectionBar({
  selection,
  highlighted = false,
  existingNote = null,
  highlightColor = 'yellow',
  onToggleHighlight,
  onChooseHighlightColor,
  onAddSnippet,
  onSelectFullVerses,
  onSaveNote,
  onCancel,
  onShowToast,
}) {
  const [showNote, setShowNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [showInline, setShowInline] = useState(false)
  const [highlightWithNote, setHighlightWithNote] = useState(false)
  const [noteHighlightColor, setNoteHighlightColor] = useState(highlightColor)
  const disabled = selection?.mixedTranslations === true
  const snippetCount = selection?.snippetCount || 1

  useEffect(() => {
    setNoteText(existingNote?.text || '')
    setShowInline(existingNote?.inline === true)
  }, [existingNote, selection])

  useEffect(() => {
    setHighlightWithNote(highlighted)
  }, [highlighted, selection])

  useEffect(() => {
    setNoteHighlightColor(highlightColor)
  }, [highlightColor])

  useEffect(() => {
    const handleEscape = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (showNote) setShowNote(false)
      else onCancel?.()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onCancel, showNote])

  const copySelection = async () => {
    try {
      await writeTextToClipboard(`${selection.selectedText}\n\n${selection.reference} (${selection.translationId || 'multiple translations'})`)
      onShowToast?.(`${snippetCount} text snippet${snippetCount === 1 ? '' : 's'} copied`)
    } catch {
      onShowToast?.('Failed to copy selected text')
    }
  }

  const saveNote = () => {
    onSaveNote?.(noteText, {
      inline: showInline,
      highlight: highlightWithNote,
      highlightColor: noteHighlightColor,
    })
    setShowNote(false)
  }

  const chooseHighlightColor = color => {
    setNoteHighlightColor(color)
    onChooseHighlightColor?.(color)
  }

  return (
    <>
      <section
        className="fixed inset-x-0 bottom-0 z-50 border-t border-blue-200 bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.14)] safe-area-bottom dark:border-blue-800 dark:bg-gray-900"
        role="region"
        aria-label="Selected text actions"
        onPointerDown={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}
      >
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
            <button type="button" onClick={onCancel} className="min-h-10 px-2 text-sm font-semibold text-gray-600 dark:text-gray-300">Cancel</button>
            <div className="min-w-0 flex-1 text-center" aria-live="polite">
              <p className="truncate text-sm font-bold text-primary dark:text-blue-300">{selection.reference}</p>
              <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                {disabled
                  ? 'Keep snippets within one translation'
                  : `${snippetCount} text snippet${snippetCount === 1 ? '' : 's'} · ${selection.translationId}`}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-5 px-2 py-1">
            <SelectionAction icon="📋" label="Copy" onClick={copySelection} />
            <HoldHighlightAction
              highlighted={highlighted}
              color={highlightColor}
              disabled={disabled}
              onClick={() => onToggleHighlight?.(highlightColor)}
              onChooseColor={color => {
                onChooseHighlightColor?.(color)
                onToggleHighlight?.(color, { force: true })
              }}
              renderButton={buttonProps => (
                <SelectionAction
                  {...buttonProps}
                  icon="🖍️"
                  label={highlighted ? 'Unhighlight' : 'Highlight'}
                  active={highlighted}
                />
              )}
            />
            <SelectionAction icon="➕" label="Select More" onClick={onAddSnippet} disabled={disabled} />
            <SelectionAction icon="☑️" label="Full verses" onClick={onSelectFullVerses} disabled={disabled} />
            <SelectionAction icon="📝" label="Note" onClick={() => setShowNote(true)} disabled={disabled} />
          </div>
        </div>
      </section>

      {showNote && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onPointerDown={event => event.stopPropagation()}>
          <button type="button" aria-label="Close note" className="absolute inset-0 bg-black/50" onClick={() => setShowNote(false)} />
          <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-800" role="dialog" aria-modal="true" aria-labelledby="text-note-title">
            <h3 id="text-note-title" className="mb-1 pr-8 text-lg font-bold text-gray-900 dark:text-gray-100">
              Note on {snippetCount === 1 ? 'selected words' : `${snippetCount} selected snippets`}
            </h3>
            <p className="mb-3 line-clamp-3 text-xs italic text-gray-500 dark:text-gray-400">“{selection.selectedText}”</p>
            <textarea
              value={noteText}
              onChange={event => setNoteText(event.target.value)}
              autoFocus
              placeholder="Write your note..."
              className="h-32 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
            <label className="mt-3 flex min-h-11 items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200">
              <input type="checkbox" checked={showInline} onChange={event => setShowInline(event.target.checked)} className="h-4 w-4" />
              Show this note inline after the final selected verse
            </label>
            <label className="mt-2 flex min-h-11 items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200">
              <input type="checkbox" checked={highlightWithNote} onChange={event => setHighlightWithNote(event.target.checked)} className="h-4 w-4" />
              Highlight the selected text
            </label>
            {highlightWithNote && (
              <div className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-600">
                <HighlightColorPicker value={noteHighlightColor} onChange={chooseHighlightColor} />
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setShowNote(false)} className="min-h-11 flex-1 rounded-lg border border-gray-300 px-4 py-2 dark:border-gray-600">Cancel</button>
              <button type="button" onClick={saveNote} className="min-h-11 flex-1 rounded-lg bg-primary px-4 py-2 text-white">
                {noteText.trim() ? 'Save Note' : 'Delete Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
