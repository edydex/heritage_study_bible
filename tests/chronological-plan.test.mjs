import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const planUrl = new URL('../public/data/reading-plans/chronological-bible.json', import.meta.url)

async function loadPlan() {
  return JSON.parse(await readFile(planUrl, 'utf8'))
}

function flattenedItems(plan) {
  return plan.readings.flatMap(reading => reading.items.map(item => ({
    ...item,
    day: reading.day,
  })))
}

function passageCovers(passage, book, chapter) {
  const match = String(passage || '').match(/^(.+?)\s+(\d+)(?:-(\d+))?$/)
  if (!match || match[1] !== book) return false
  const start = Number(match[2])
  const end = Number(match[3] || match[2])
  return chapter >= start && chapter <= end
}

function chapterPosition(items, book, chapter) {
  return items.findIndex(item => item.type === 'passage' && passageCovers(item.passage, book, chapter))
}

function expandBookChapters(plan, book) {
  return plan.readings.flatMap(reading => reading.passages.flatMap(passage => {
    const match = passage.match(/^(.+?)\s+(\d+)(?:-(\d+))?$/)
    if (!match || match[1] !== book) return []
    const start = Number(match[2])
    const end = Number(match[3] || match[2])
    return Array.from({ length: end - start + 1 }, (_, index) => start + index)
  }))
}

test('late-Judah history frames Jeremiah without over-fragmenting it', async () => {
  const plan = await loadPlan()
  const items = flattenedItems(plan)
  const position = (book, chapter) => chapterPosition(items, book, chapter)

  assert.equal(plan.revision, '2026-07-late-judah-history-first')
  assert.ok(position('2 Kings', 22) < position('Jeremiah', 1))
  assert.ok(position('2 Chronicles', 35) < position('Jeremiah', 1))
  assert.ok(position('Jeremiah', 20) < position('2 Kings', 24))
  assert.ok(position('2 Kings', 24) < position('Jeremiah', 21))
  assert.ok(position('2 Kings', 25) < position('2 Chronicles', 36))
  assert.ok(position('2 Chronicles', 36) < position('Jeremiah', 39))

  const expectedJeremiahOrder = [
    ...Array.from({ length: 38 }, (_, index) => index + 1),
    ...Array.from({ length: 7 }, (_, index) => index + 45),
    ...Array.from({ length: 6 }, (_, index) => index + 39),
    52,
  ]
  assert.deepEqual(expandBookChapters(plan, 'Jeremiah'), expectedJeremiahOrder)
})

test('late-Judah reading notes name reigns and their Kings and Chronicles anchors', async () => {
  const plan = await loadPlan()
  const notes = new Map(flattenedItems(plan)
    .filter(item => item.type === 'note')
    .map(item => [item.id, item]))

  const expectedNotes = [
    'jeremiah-era-band-compromise',
    'jeremiah-last-kings-survey',
    'jeremiah-jehoiakim-fourth-year',
    'jeremiah-zedekiah-first-exiles',
    'jeremiah-consolation-siege-flashback',
    'jeremiah-zedekiah-siege-anchors',
    'jeremiah-appendix-oracles',
    'late-judah-fall-history-first',
    'jeremiah-fall-and-aftermath',
    'jeremiah-historical-appendix',
  ]

  for (const id of expectedNotes) {
    const contextNote = notes.get(id)
    assert.ok(contextNote, `missing generated note ${id}`)
    assert.ok(
      contextNote.sources.includes('late_judah_biblical_timeline'),
      `${id} should cite the primary late-Judah timeline source`
    )
  }

  const royalSurvey = notes.get('jeremiah-last-kings-survey').text
  assert.match(royalSurvey, /Zedekiah/)
  assert.match(royalSurvey, /Jehoiakim/)
  assert.match(royalSurvey, /Jehoiachin/)
  assert.match(royalSurvey, /2 Kings 23:31-24:20/)
  assert.match(royalSurvey, /2 Chronicles 36:1-13/)

  const mixedBand = notes.get('jeremiah-consolation-siege-flashback').text
  assert.match(mixedBand, /Zedekiah/)
  assert.match(mixedBand, /Jehoiakim/)
  assert.match(mixedBand, /2 Kings 24/)
  assert.match(mixedBand, /2 Chronicles 36:4-13/)
})
