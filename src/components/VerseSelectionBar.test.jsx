import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import VerseSelectionBar from './VerseSelectionBar'

describe('VerseSelectionBar', () => {
  it('saves a grouped note with its chosen highlight color', () => {
    const onSaveNotes = vi.fn()
    const onChooseHighlightColor = vi.fn()
    render(
      <VerseSelectionBar
        bookName="John"
        selectedVerses={[
          { book: 'John', chapter: 3, verse: 16, text: 'For God so loved the world.' },
          { book: 'John', chapter: 3, verse: 17, text: 'For God did not send His Son.' },
        ]}
        translationId="BSB"
        notes={[]}
        highlightColor="green"
        onSaveNotes={onSaveNotes}
        onChooseHighlightColor={onChooseHighlightColor}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Notes' }))
    fireEvent.change(screen.getByPlaceholderText('Write your notes here...'), {
      target: { value: 'One thought for both verses.' },
    })
    fireEvent.click(screen.getByLabelText('Highlight the selected verses'))
    fireEvent.click(screen.getByRole('button', { name: 'Purple highlight' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Note' }))

    expect(onChooseHighlightColor).toHaveBeenCalledWith('purple')
    expect(onSaveNotes).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ verse: 16 }), expect.objectContaining({ verse: 17 })]),
      'One thought for both verses.',
      { inline: false, highlight: true, highlightColor: 'purple' },
    )
  })
})
