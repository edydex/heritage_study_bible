import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TextSelectionBar from './TextSelectionBar'

const selection = {
  reference: 'John 3:16',
  translationId: 'BSB',
  selectedText: 'God so loved',
  mixedTranslations: false,
}

describe('TextSelectionBar', () => {
  it('offers full-verse promotion and saves the inline-note option', () => {
    const onSelectFullVerses = vi.fn()
    const onSaveNote = vi.fn()
    render(
      <TextSelectionBar
        selection={selection}
        onSelectFullVerses={onSelectFullVerses}
        onSaveNote={onSaveNote}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Full verses' }))
    expect(onSelectFullVerses).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Note' }))
    fireEvent.change(screen.getByPlaceholderText('Write your note...'), {
      target: { value: 'A note on these words.' },
    })
    fireEvent.click(screen.getByLabelText('Show this note inline after the final selected verse'))
    fireEvent.click(screen.getByRole('button', { name: 'Save Note' }))

    expect(onSaveNote).toHaveBeenCalledWith('A note on these words.', {
      inline: true,
      highlight: false,
      highlightColor: 'yellow',
    })
  })

  it('adds another snippet and can save a note with a chosen highlight color', () => {
    const onAddSnippet = vi.fn()
    const onSaveNote = vi.fn()
    const onChooseHighlightColor = vi.fn()
    render(
      <TextSelectionBar
        selection={{ ...selection, snippetCount: 2 }}
        highlightColor="blue"
        onAddSnippet={onAddSnippet}
        onSaveNote={onSaveNote}
        onChooseHighlightColor={onChooseHighlightColor}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add text' }))
    expect(onAddSnippet).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Note' }))
    fireEvent.change(screen.getByPlaceholderText('Write your note...'), { target: { value: 'Linked thoughts.' } })
    fireEvent.click(screen.getByLabelText('Highlight the selected text'))
    fireEvent.click(screen.getByRole('button', { name: 'Pink highlight' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Note' }))

    expect(onChooseHighlightColor).toHaveBeenCalledWith('pink')
    expect(onSaveNote).toHaveBeenCalledWith('Linked thoughts.', {
      inline: false,
      highlight: true,
      highlightColor: 'pink',
    })
  })

  it('opens the color picker when Highlight is held and applies the chosen color', () => {
    vi.useFakeTimers()
    const onToggleHighlight = vi.fn()
    const onChooseHighlightColor = vi.fn()
    try {
      render(
        <TextSelectionBar
          selection={selection}
          onToggleHighlight={onToggleHighlight}
          onChooseHighlightColor={onChooseHighlightColor}
        />
      )

      fireEvent.pointerDown(screen.getByRole('button', { name: 'Highlight' }), { pointerType: 'touch' })
      act(() => vi.advanceTimersByTime(500))
      fireEvent.click(screen.getByRole('button', { name: 'Green highlight' }))

      expect(onChooseHighlightColor).toHaveBeenCalledWith('green')
      expect(onToggleHighlight).toHaveBeenCalledWith('green', { force: true })
    } finally {
      vi.useRealTimers()
    }
  })
})
