import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  getFirstIncompleteItem,
  getReadingItems,
  isPlanDayComplete,
  normalizeProgressForPlan,
  parsePassageChapters,
  parsePassageReference,
} from '../src/services/readingPlanProgress.js'

test('verse ranges do not turn into accidental chapter ranges', () => {
  assert.deepEqual(parsePassageChapters('2 Kings 22:1-2').map(row => row.chapter), [22])
  assert.deepEqual(parsePassageChapters('2 Kings 22-23').map(row => row.chapter), [22, 23])
  assert.deepEqual(parsePassageChapters('Jeremiah 20:13-21:2').map(row => row.chapter), [20, 21])
  assert.deepEqual(parsePassageReference('Jeremiah 20:13-21:2'), {
    book: 'Jeremiah',
    startChapter: 20,
    startVerse: 13,
    endChapter: 21,
    endVerse: 2,
  })
})

test('reflection is optional and does not block day completion', () => {
  const reading = { day: 7, passages: ['Jeremiah 1-2'] }
  const items = getReadingItems(reading)
  assert.deepEqual(items.map(item => item.id), ['chapter-jeremiah-1', 'chapter-jeremiah-2'])
  assert.equal(isPlanDayComplete({ completedItems: { 7: items.map(item => item.id) } }, reading), true)
  assert.equal(getFirstIncompleteItem(reading, { completedItems: { 7: items.map(item => item.id) } }), null)
})

test('legacy day-scoped chapter IDs follow a chapter when a plan is rebalanced', () => {
  const plan = {
    revision: 'test-revision',
    totalDays: 2,
    readings: [
      { day: 1, passages: ['Jeremiah 1'] },
      { day: 2, passages: ['Genesis 1'] },
    ],
  }
  const progress = normalizeProgressForPlan({
    completedItems: { 19: ['day-19-chapter-jeremiah-1', 'day-19-comments'] },
    completedDays: [],
    dayNotes: { 19: 'A saved reflection' },
  }, plan)

  assert.deepEqual(progress.completedItems, { 1: ['chapter-jeremiah-1'] })
  assert.equal(progress.planRevision, 'test-revision')
  assert.equal(progress.dayNotes[19], 'A saved reflection')
})

test('Josiah context is scheduled before Jeremiah begins', async () => {
  const plan = JSON.parse(await readFile(new URL('../public/data/reading-plans/chronological-bible.json', import.meta.url), 'utf8'))
  const sequence = plan.readings.flatMap(reading => reading.passages.map(passage => ({ day: reading.day, passage })))
  const kings = sequence.findIndex(item => item.passage === '2 Kings 22-23')
  const chronicles = sequence.findIndex(item => item.passage === '2 Chronicles 34-35')
  const jeremiah = sequence.findIndex(item => /^Jeremiah\b/.test(item.passage))

  assert.ok(kings >= 0, '2 Kings 22-23 should be present')
  assert.ok(chronicles > kings, '2 Chronicles 34-35 should follow 2 Kings 22-23')
  assert.ok(jeremiah > chronicles, 'Jeremiah should begin after the Josiah context readings')
  assert.ok(sequence[kings].day < sequence[jeremiah].day)
})
