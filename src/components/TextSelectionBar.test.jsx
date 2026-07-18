import { fireEvent, render, screen } from '@testing-library/react'
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
    fireEvent.click(screen.getByLabelText('Show this note inline after the verse'))
    fireEvent.click(screen.getByRole('button', { name: 'Save Note' }))

    expect(onSaveNote).toHaveBeenCalledWith('A note on these words.', { inline: true })
  })
})
