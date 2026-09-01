import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BookmarkManager from './BookmarkManager'

function renderManager() {
  return render(
    <BookmarkManager
      bookmarks={[{
        id: 'bookmark-1',
        book: 'John',
        chapter: 3,
        verse: 16,
        verseText: 'For God so loved the world.',
        hasCommentary: true,
        dateCreated: '2026-09-01T12:00:00.000Z',
      }]}
      notes={[{
        id: 'note-1',
        type: 'note',
        book: 'Jeremiah',
        chapter: 20,
        verse: 13,
        reference: 'Jeremiah 20:13-15',
        text: 'One note for the passage.',
        dateCreated: '2026-09-01T12:00:00.000Z',
      }]}
      onClose={vi.fn()}
      onNavigate={vi.fn()}
      onDelete={vi.fn()}
      onUpdateNote={vi.fn()}
      onDeleteCommentary={vi.fn()}
      onNavigateToCommentary={vi.fn()}
      onDeleteNote={vi.fn()}
    />
  )
}

describe('BookmarkManager', () => {
  it('shows explicit references without unrelated commentary metadata', () => {
    renderManager()

    expect(screen.getByRole('heading', { name: '⭐ Bookmarks & Notes (2)' })).toBeVisible()
    const dateGroup = screen.getByRole('button', { name: /John 3:16, Jeremiah 20:13-15/ })
    fireEvent.click(dateGroup)

    expect(screen.getAllByText('John 3:16').length).toBeGreaterThan(0)
    expect(screen.getByText('Note on Jeremiah 20:13-15')).toBeVisible()
    expect(screen.queryByText('Has commentary')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'By Books' }))
    const johnGroup = screen.getByRole('button', { name: /John.*1 saved item/ })
    fireEvent.click(johnGroup)
    const chapterGroup = screen.getByRole('button', { name: /Chapter 3 \(1\)/ })
    fireEvent.click(chapterGroup)

    const johnSection = chapterGroup.parentElement
    expect(within(johnSection).getByText('John 3:16')).toBeVisible()
  })
})
