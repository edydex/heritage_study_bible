import { describe, expect, it } from 'vitest'
import { getInlineNotesAfterVerse } from './InlineVerseNotes'

describe('inline verse notes', () => {
  it('places a grouped note after its final verse and respects its translation anchor', () => {
    const notes = [{
      id: 'note-1',
      inline: true,
      translationId: 'BSB',
      verses: [
        { book: 'John', chapter: 3, verse: 16 },
        { book: 'John', chapter: 3, verse: 17 },
      ],
    }]

    expect(getInlineNotesAfterVerse(notes, 'John', 3, 16, 'BSB')).toEqual([])
    expect(getInlineNotesAfterVerse(notes, 'John', 3, 17, 'WEB')).toEqual([])
    expect(getInlineNotesAfterVerse(notes, 'John', 3, 17, 'BSB')).toEqual(notes)
  })
})
