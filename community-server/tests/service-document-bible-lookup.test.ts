import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HeritageServiceBibleLookupError,
  loadHeritageServiceBiblePassage,
} from '../src/lib/syncshow/HeritageServiceBibleLookup.ts'

function translationBook(name: string, texts: string[]) {
  return JSON.stringify({
    name,
    chapters: [{
      number: 3,
      verses: texts.map((text, index) => ({ number: index + 14, text })),
    }],
  })
}

test('Community resolves and pins an exact bilingual Heritage reader passage', async () => {
  const requested: string[] = []
  const passage = await loadHeritageServiceBiblePassage({
    schemaVersion: 1,
    bookId: 'Eph',
    start: { chapter: 3, verse: 14 },
    end: { chapter: 3, verse: 16 },
  }, {
    heritageAppUrl: 'https://reader.example.church/app',
    fetchImpl: async input => {
      const url = String(input)
      requested.push(url)
      const russian = url.includes('/SYNO-W/')
      return new Response(translationBook('Ephesians', russian
        ? ['Русский 14', 'Русский 15', 'Русский 16']
        : ['English 14', 'English 15', 'English 16']))
    },
  })

  assert.deepEqual(requested.sort(), [
    'https://reader.example.church/app/data/translations/BSB/ephesians.json',
    'https://reader.example.church/app/data/translations/SYNO-W/ephesians.json',
  ])
  assert.equal(passage.title, 'Ephesians 3:14-16')
  assert.equal(passage.passagesByChannel.english.translationId, 'BSB')
  assert.equal(passage.passagesByChannel.russian.translationId, 'SYNO-W')
  assert.deepEqual(
    passage.passagesByChannel.media.verses.map(verse => verse.text),
    ['Русский 14', 'Русский 15', 'Русский 16'],
  )
})

test('Community rejects cross-chapter service readings before any reader request', async () => {
  let fetched = false
  await assert.rejects(
    loadHeritageServiceBiblePassage({
      schemaVersion: 1,
      bookId: 'Eph',
      start: { chapter: 3, verse: 21 },
      end: { chapter: 4, verse: 2 },
    }, {
      fetchImpl: async () => {
        fetched = true
        return new Response('{}')
      },
    }),
    (error: unknown) => (
      error instanceof HeritageServiceBibleLookupError
      && error.code === 'INVALID_BIBLE_RANGE'
    ),
  )
  assert.equal(fetched, false)
})
