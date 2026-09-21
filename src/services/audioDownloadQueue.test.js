import { expect, it, vi } from 'vitest'
import { createAudioDownloadQueue } from './audioDownloadQueue'
it('does not duplicate active downloads and retries without replacing saved chapters', async () => {
  const saved = new Set(['a'])
  let fail = true, release
  const gate = new Promise(resolve => { release = resolve })
  const download = vi.fn(async id => { await gate; if (id === 'c' && fail) throw Error(); saved.add(id) })
  const queue = createAudioDownloadQueue({ get: async id => saved.has(id), download })
  const tracks = ['a', 'b', 'c'].map(id => ({ id, title: id }))
  const first = queue.start(tracks)
  await queue.start(tracks)
  release(); await first
  expect([...saved]).toEqual(['a', 'b'])
  expect(queue.getSnapshot()).toMatchObject({ running: false, completed: 2, message: expect.stringContaining('Download failed') })
  fail = false
  await queue.start(tracks)
  expect(download.mock.calls.map(([id]) => id)).toEqual(['b', 'c', 'c'])
  expect(saved.size).toBe(3)
})
it('stops between atomic files, leaving the completed file available', async () => {
  let queue
  const download = vi.fn(async () => queue.stop())
  queue = createAudioDownloadQueue({ get: async () => null, download })
  await queue.start([{ id: 'a' }, { id: 'b' }])
  expect(download).toHaveBeenCalledTimes(1)
  expect(queue.getSnapshot()).toMatchObject({ running: false, completed: 1 })
})
