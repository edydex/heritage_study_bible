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

  assert.equal(plan.revision, '2026-07-parallel-timeline-groups')
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
    assert.ok(contextNote.timeline, `${id} should include a visual timeline aid`)
    assert.ok(contextNote.timeline.contexts.length > 0, `${id} should include timeline context bars`)
    assert.match(
      contextNote.timeline.caption,
      /setting|period|narrated|year notices|endpoints/i,
      `${id} should explain what its bars mean`
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

test('timeline aids are valid and distinguish attributed setting from fulfillment', async () => {
  const plan = await loadPlan()
  const timelineNotes = flattenedItems(plan).filter(item => item.type === 'note' && item.timeline)

  assert.ok(timelineNotes.length >= 35)

  for (const note of timelineNotes) {
    const { timeline } = note
    assert.ok(Number.isFinite(timeline.startYear), `${note.id} needs a numeric start year`)
    assert.ok(Number.isFinite(timeline.endYear), `${note.id} needs a numeric end year`)
    assert.notEqual(timeline.startYear, timeline.endYear, `${note.id} needs a usable range`)
    assert.ok(Array.isArray(timeline.contexts) && timeline.contexts.length > 0)
    assert.equal(
      timeline.perspective,
      'attributed-setting',
      `${note.id} should identify the bars as attributed setting rather than fulfillment`
    )

    const minimum = Math.min(timeline.startYear, timeline.endYear)
    const maximum = Math.max(timeline.startYear, timeline.endYear)
    for (const row of timeline.contexts) {
      assert.ok(row.label, `${note.id} has an unlabeled context row`)
      assert.ok(row.dateLabel, `${note.id}/${row.label} needs a readable date label`)
      assert.doesNotMatch(
        `${row.label} ${row.dateLabel}`,
        /\bfulfill(?:ed|ment)?\b|\blater event announced\b/i,
        `${note.id}/${row.label} must plot attributed setting, not fulfillment`
      )
      assert.ok(row.startYear >= minimum && row.startYear <= maximum, `${note.id}/${row.label} starts outside its axis`)
      assert.ok(row.endYear >= minimum && row.endYear <= maximum, `${note.id}/${row.label} ends outside its axis`)
    }
  }
})

test('parallel-account groups use identical ranges and stay contiguous', async () => {
  const plan = await loadPlan()
  const timelineNotes = flattenedItems(plan).filter(item => item.type === 'note' && item.timeline)

  for (const note of timelineNotes) {
    const groupedRows = new Map()

    note.timeline.contexts.forEach((row, index) => {
      if (!row.group) return
      if (!groupedRows.has(row.group)) groupedRows.set(row.group, [])
      groupedRows.get(row.group).push({ ...row, index })
    })

    for (const [group, rows] of groupedRows) {
      assert.ok(rows.length >= 2, `${note.id}/${group} should contain at least two related rows`)
      const indexes = rows.map(row => row.index)
      assert.equal(
        Math.max(...indexes) - Math.min(...indexes) + 1,
        rows.length,
        `${note.id}/${group} rows should remain together`
      )

      if (/^(Parallel accounts|Same historical window)/.test(group)) {
        const expectedRange = [rows[0].startYear, rows[0].endYear]
        for (const row of rows.slice(1)) {
          assert.deepEqual(
            [row.startYear, row.endYear],
            expectedRange,
            `${note.id}/${group}/${row.label} should align to the same visible range`
          )
        }
      }
    }
  }
})

test('Day 245 directly aligns Jeremiah with Kings and Chronicles', async () => {
  const plan = await loadPlan()
  const note = flattenedItems(plan).find(item =>
    item.day === 245 &&
    item.id === 'jeremiah-fall-and-aftermath'
  )

  assert.ok(note)
  assert.match(note.title, /Kings and Chronicles/)

  const rows = new Map(note.timeline.contexts.map(row => [row.label, row]))
  const fallLabels = [
    'Jeremiah 39',
    'Jeremiah 40-41',
    '2 Kings 25:4-25',
    '2 Chronicles 36:17-21',
  ]

  for (const label of fallLabels) {
    assert.ok(rows.has(label), `Day 245 should show ${label}`)
    assert.deepEqual(
      [rows.get(label).startYear, rows.get(label).endYear],
      [586, 585],
      `${label} should use the shared fall-and-immediate-aftermath range`
    )
  }

  assert.equal(rows.get('Jeremiah 39').group, rows.get('Jeremiah 40-41').group)
  assert.deepEqual(
    [rows.get('Jeremiah 42-43').startYear, rows.get('Jeremiah 42-43').endYear],
    [rows.get('2 Kings 25:26').startYear, rows.get('2 Kings 25:26').endYear]
  )
  assert.notEqual(rows.get('Jeremiah 44').group, rows.get('Jeremiah 39').group)
})

test('other clear parallel notes also expose their historical accounts in the chart', async () => {
  const plan = await loadPlan()
  const notes = new Map(flattenedItems(plan)
    .filter(item => item.type === 'note' && item.timeline)
    .map(item => [item.id, item.timeline.contexts.map(row => row.label)]))

  const expectedRows = {
    'jonah-jeroboam-ii': ['2 Kings 14:23-25', 'Jonah 1-4'],
    'isaiah-hezekiah-assyrian-crisis': ['Isaiah 36-39', '2 Kings 18:13-20:19', '2 Chronicles 32'],
    'josiah-context-before-jeremiah': ['2 Kings 22-23', '2 Chronicles 34-35'],
    'jeremiah-zedekiah-siege-anchors': ['Jeremiah 37-38', '2 Kings 25:1-7', '2 Chronicles 36:17-20'],
    'jeremiah-historical-appendix': ['Jeremiah 52:1-30', '2 Kings 24:18-25:21', '2 Chronicles 36:11-21'],
  }

  for (const [noteId, labels] of Object.entries(expectedRows)) {
    assert.ok(notes.has(noteId), `missing ${noteId}`)
    for (const label of labels) {
      assert.ok(notes.get(noteId).includes(label), `${noteId} should chart ${label}`)
    }
  }
})
