import { describe, expect, it, vi } from 'vitest'
import {
  getAuthorsForBook,
  getCommentariesForChapter,
  getCommentaryForVerse,
  getWorksForBook,
  hasAnyCommentary,
  loadCommentaryForBook,
} from './authors'

const sampleAuthors = [
  {
    id: 'test-author',
    name: 'Test Author',
    works: [
      {
        id: 'work-john',
        book: 'John',
        loaded: true,
        dataPath: '/data/commentary/test/john.json',
        commentaries: [
          {
            id: 'c1',
            chapter: 3,
            reference: 'John 3:16',
            text: 'Commentary on verse sixteen.',
            verses: [{ chapter: 3, verse: 16 }],
          },
          {
            id: 'c2',
            chapter: 3,
            reference: 'John 3',
            text: 'Chapter overview.',
          },
        ],
      },
      {
        id: 'work-unloaded',
        book: 'Romans',
        loaded: false,
        dataPath: '/data/commentary/test/romans.json',
        commentaries: [],
      },
    ],
  },
]

describe('authors helpers', () => {
  it('finds authors and works for a book', () => {
    expect(getAuthorsForBook('John', sampleAuthors)).toHaveLength(1)
    expect(getWorksForBook('test-author', 'John', sampleAuthors)).toHaveLength(1)
    expect(getWorksForBook('missing', 'John', sampleAuthors)).toEqual([])
  })

  it('returns chapter commentaries for a work', () => {
    expect(getCommentariesForChapter('test-author', 'work-john', 3, sampleAuthors)).toHaveLength(2)
  })

  it('detects verse-level commentary', () => {
    expect(hasAnyCommentary('John', 3, 16, sampleAuthors)).toBe(true)
    expect(getCommentaryForVerse('test-author', 'work-john', 3, 16, sampleAuthors)?.id).toBe('c1')
  })

  it('treats chapter commentaries without verse lists as chapter-wide', () => {
    expect(hasAnyCommentary('John', 3, 17, sampleAuthors)).toBe(true)
  })
})

describe('loadCommentaryForBook', () => {
  it('loads unloaded works via fetch and merges commentary data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        metadata: { book: 'Romans' },
        commentaries: [{ id: 'loaded', chapter: 1, text: 'Loaded commentary.' }],
      }),
    }))

    const updated = await loadCommentaryForBook('Romans', sampleAuthors)
    const work = updated[0].works.find(row => row.id === 'work-unloaded')
    expect(work.loaded).toBe(true)
    expect(work.commentaries).toHaveLength(1)

    vi.unstubAllGlobals()
  })

  it('returns the original authors array when nothing needs loading', async () => {
    const onlyLoaded = [
      {
        id: 'loaded-author',
        works: [{ id: 'loaded-work', book: 'John', loaded: true, commentaries: [] }],
      },
    ]
    await expect(loadCommentaryForBook('John', onlyLoaded)).resolves.toBe(onlyLoaded)
  })
})
