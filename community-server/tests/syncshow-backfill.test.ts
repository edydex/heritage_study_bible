import assert from 'node:assert/strict'
import test from 'node:test'
import { backfillSongSyncDocuments } from '../src/lib/backfillSongSyncDocuments.ts'

test('one malformed legacy song is logged and cannot abort the remaining backfill', async () => {
  const updates: Array<{ id: number; documents: unknown[] }> = []
  const errors: Array<Record<string, unknown>> = []
  const songs = [
    {
      id: 1,
      slug: 'first-good',
      syncId: 'first-good',
      title: 'First good',
      lyrics: 'A usable line',
      syncDocuments: [],
    },
    {
      id: 2,
      slug: 'malformed-source',
      syncId: 'malformed-source',
      title: 'Malformed source',
      lyrics: 'This lyric remains untouched',
      sourceUrl: 'javascript:alert(1)',
      syncDocuments: [],
    },
    {
      id: 3,
      slug: 'second-good',
      syncId: 'second-good',
      title: 'Second good',
      russianTitle: 'Вторая',
      russianLyrics: 'Полезная строка',
      syncDocuments: [],
    },
    {
      id: 4,
      slug: 'title-only',
      syncId: 'title-only',
      title: 'Title only',
      syncDocuments: [],
    },
  ]
  const payload = {
    find: async () => ({
      docs: songs,
      hasNextPage: false,
    }),
    update: async ({
      id,
      data,
    }: {
      id: number
      data: { syncDocuments: unknown[] }
    }) => {
      updates.push({ id, documents: data.syncDocuments })
      return data
    },
    logger: {
      error: (context: Record<string, unknown>) => errors.push(context),
      info: () => undefined,
    },
  }

  const report = await backfillSongSyncDocuments(payload as never)
  assert.deepEqual(report, {
    scanned: 4,
    backfilled: 2,
    metadataOnly: 1,
    skipped: 1,
  })
  assert.deepEqual(updates.map(update => update.id), [1, 3])
  assert.equal(errors.length, 1)
  assert.equal(errors[0].songId, 2)
  assert.equal(errors[0].syncId, 'malformed-source')
})
