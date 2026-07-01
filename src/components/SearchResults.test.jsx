import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import SearchResults from './SearchResults'

describe('SearchResults', () => {
  it('renders grouped search results and calls click handlers', () => {
    const onVerseClick = vi.fn()
    const onCommentaryClick = vi.fn()
    const onBookClick = vi.fn()
    const onClose = vi.fn()

    render(
      <SearchResults
        query="shepherd"
        results={{
          verses: [{ book: 'Psalms', chapter: 23, verse: 1, text: 'The LORD is my shepherd.' }],
          commentaries: [{ reference: 'Psalms 23', text: 'Shepherd imagery.', authorName: 'Calvin' }],
          books: [{ bookTitle: 'Institutes', snippet: 'Christ our shepherd.' }],
          sectionOrder: ['verses', 'commentaries', 'books'],
        }}
        onVerseClick={onVerseClick}
        onCommentaryClick={onCommentaryClick}
        onBookClick={onBookClick}
        onClose={onClose}
      />
    )

    expect(screen.getByText('Search Results')).toBeInTheDocument()
    expect(screen.getByText(/Found 3 results for "shepherd"/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Psalms 23:1'))
    expect(onVerseClick).toHaveBeenCalledWith('Psalms', 23, 1)

    fireEvent.click(screen.getByText('Clear Search'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders an empty state when nothing matches', () => {
    render(
      <SearchResults
        query="missing"
        results={{ verses: [], commentaries: [], books: [] }}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('No results found. Try a different search term.')).toBeInTheDocument()
  })

  it('shows a capped-results warning', () => {
    render(
      <SearchResults
        query="god"
        results={{
          verses: [{ book: 'John', chapter: 3, verse: 16, text: 'For God so loved the world.' }],
          commentaries: [],
          books: [],
          versesCapped: true,
        }}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText(/results limited/i)).toBeInTheDocument()
  })
})
