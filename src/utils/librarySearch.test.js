import { describe, expect, it } from 'vitest'
import {
  makeSearchSnippet,
  searchBibleVerses,
  searchLoadedCommentaries,
} from './librarySearch'

const sampleBible = {
  books: [
    {
      name: 'John',
      chapters: [
        {
          number: 3,
          verses: [
            { number: 16, text: 'For God so loved the world that he gave his one and only Son.' },
            { number: 17, text: 'For God did not send his Son into the world to condemn the world.' },
          ],
        },
      ],
    },
    {
      name: 'Psalms',
      chapters: [
        {
          number: 23,
          verses: [{ number: 1, text: 'The LORD is my shepherd; I shall not want.' }],
        },
      ],
    },
  ],
}

describe('makeSearchSnippet', () => {
  it('returns a trimmed prefix around the query match', () => {
    const text = 'A'.repeat(80) + ' shepherd ' + 'B'.repeat(120)
    const snippet = makeSearchSnippet(text, 'shepherd')
    expect(snippet).toContain('shepherd')
    expect(snippet.startsWith('...')).toBe(true)
    expect(snippet.endsWith('...')).toBe(true)
  })

  it('returns the start of short text when query is missing', () => {
    expect(makeSearchSnippet('Short verse text', 'missing')).toBe('Short verse text')
  })

  it('collapses whitespace in snippets', () => {
    expect(makeSearchSnippet('Line one\n\nLine two', 'line two')).toContain('Line one Line two')
  })
})

describe('searchBibleVerses', () => {
  it('finds matching verses case-insensitively', () => {
    const { items, capped } = searchBibleVerses(sampleBible, 'GOD SO LOVED')
    expect(capped).toBe(false)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      book: 'John',
      chapter: 3,
      verse: 16,
    })
  })

  it('respects maxResults and reports capping', () => {
    const { items, capped } = searchBibleVerses(sampleBible, 'god', { maxResults: 1 })
    expect(items).toHaveLength(1)
    expect(capped).toBe(true)
  })

  it('returns empty results for blank queries', () => {
    expect(searchBibleVerses(sampleBible, '   ')).toEqual({ items: [], capped: false })
  })

  it('calls hasCommentary when provided', () => {
    const hasCommentary = (book, chapter, verse) =>
      book === 'John' && chapter === 3 && verse === 16

    const { items } = searchBibleVerses(sampleBible, 'loved', { hasCommentary })
    expect(items[0].hasCommentary).toBe(true)
  })
})

describe('searchLoadedCommentaries', () => {
  const authors = [
    {
      name: 'Test Author',
      works: [
        {
          title: 'Sample Work',
          book: 'John',
          loaded: true,
          commentaries: [
            {
              reference: 'John 3:16',
              text: 'God so loved the world commentary text.',
            },
          ],
        },
      ],
    },
  ]

  it('searches loaded commentary text', () => {
    const { items } = searchLoadedCommentaries(authors, 'commentary text')
    expect(items).toHaveLength(1)
    expect(items[0].authorName).toBe('Test Author')
    expect(items[0].snippet).toContain('commentary')
  })

  it('skips unloaded works with no inline commentaries', () => {
    const unloaded = [
      {
        name: 'Empty Author',
        works: [{ title: 'Unloaded', book: 'John', loaded: false, commentaries: [] }],
      },
    ]
    expect(searchLoadedCommentaries(unloaded, 'anything').items).toEqual([])
  })
})
