import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeReadAlong,
  canReadBook,
  bookProjection,
} from '../packages/book-readalong/index.js'
import { readBooksByVisibility } from '../src/access'
const fixture = () => ({
  schema: 'heritage-book-readalong/v1',
  language: 'ru',
  chapters: [
    {
      id: 'one',
      title: 'One',
      duration: 20,
      audioSha256: 'a'.repeat(64),
      audioSize: 100,
      paragraphs: [{ id: 'p1', text: 'One two.', kind: 'paragraph' }],
      words: [
        { paragraphId: 'p1', sourceStart: 0, sourceEnd: 3, start: 0, end: 2 },
        { paragraphId: 'p1', sourceStart: 4, sourceEnd: 7, start: 3, end: 4 },
      ],
    },
  ],
})
test('book access requires membership for published member books and managers for drafts', async () => {
  const book = { status: 'published', visibility: 'members' }
  assert.equal(
    canReadBook(book, { authenticated: false, manager: false }),
    false,
  )
  assert.equal(canReadBook(book, { authenticated: true, manager: false }), true)
  assert.equal(
    canReadBook(
      { ...book, status: 'draft' },
      { authenticated: true, manager: false },
    ),
    false,
  )
  assert.equal(
    canReadBook(
      { ...book, status: 'draft' },
      { authenticated: true, manager: true },
    ),
    true,
  )
  assert.equal(
    canReadBook(
      { ...book, visibility: 'public' },
      { authenticated: false, manager: false },
    ),
    true,
  )
  const query = await readBooksByVisibility({ req: { user: null } } as never)
  assert.deepEqual(query, {
    or: [
      {
        and: [
          { status: { equals: 'published' } },
          { or: [{ visibility: { equals: 'public' } }] },
        ],
      },
    ],
  })
  assert.equal(
    'secret' in bookProjection({ ...book, id: 1, secret: 'private' }),
    false,
  )
})
test('malformed or mismatched timing cannot be attached as playable read-along data', () => {
  assert.equal(normalizeReadAlong(fixture()).chapters[0].words.length, 2)
  for (const mutate of [
    (v: any) => (v.chapters[0].id = '../escape'),
    (v: any) => (v.chapters[0].audioSha256 = 'bad'),
    (v: any) => (v.chapters[0].words[0].sourceEnd = 999),
    (v: any) => (v.chapters[0].words[1].start = -1),
    (v: any) => v.chapters.push(v.chapters[0]),
    (v: any) => (v.chapters[0].words[0].paragraphId = 'missing'),
  ]) {
    const value = fixture()
    mutate(value)
    assert.throws(() => normalizeReadAlong(value))
  }
})
