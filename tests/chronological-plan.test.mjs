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

  assert.equal(plan.revision, '2026-08-jeremiah-ezekiel-interweave')
  assert.ok(position('2 Kings', 22) < position('Jeremiah', 1))
  assert.ok(position('2 Chronicles', 35) < position('Jeremiah', 1))
  assert.ok(position('Jeremiah', 20) < position('2 Kings', 24))
  assert.ok(position('2 Kings', 24) < position('Jeremiah', 21))
  assert.ok(position('2 Kings', 25) < position('2 Chronicles', 36))
  assert.ok(position('2 Chronicles', 36) < position('Jeremiah', 39))

  const expectedJeremiahOrder = [
    ...Array.from({ length: 38 }, (_, index) => index + 1),
    ...Array.from({ length: 7 }, (_, index) => index + 45),
    39,
    52,
    ...Array.from({ length: 5 }, (_, index) => index + 40),
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
    if (contextNote.timeline.presentation === 'situational') {
      assert.ok(contextNote.timeline.phases.length > 0, `${id} should include situation phases`)
      assert.ok(contextNote.timeline.passages.length > 0, `${id} should include passage bars`)
    } else {
      assert.ok(contextNote.timeline.contexts.length > 0, `${id} should include timeline context bars`)
      assert.match(
        contextNote.timeline.caption,
        /setting|period|narrated|year notices|endpoints/i,
        `${id} should explain what its bars mean`
      )
    }
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

test('the generated plan covers all 365 days and 1,189 chapters exactly once', async () => {
  const plan = await loadPlan()
  const seen = new Map()

  assert.equal(plan.totalDays, 365)
  assert.equal(plan.totalChapters, 1189)
  assert.equal(plan.readings.length, 365)
  assert.deepEqual(plan.readings.map(reading => reading.day), Array.from({ length: 365 }, (_, index) => index + 1))
  assert.ok(plan.methodology.some(line => /event-first historical situation track/.test(line)))

  for (const reading of plan.readings) {
    for (const passage of reading.passages) {
      const match = passage.match(/^(.+?)\s+(\d+)(?:-(\d+))?$/)
      assert.ok(match, `unsupported generated passage ${passage}`)
      const start = Number(match[2])
      const end = Number(match[3] || match[2])
      for (let chapter = start; chapter <= end; chapter += 1) {
        const reference = `${match[1]} ${chapter}`
        assert.equal(seen.has(reference), false, `${reference} repeats on days ${seen.get(reference)} and ${reading.day}`)
        seen.set(reference, reading.day)
      }
    }
  }

  assert.equal(seen.size, 1189)
})

test('every timeline aid uses a valid event-first situation track', async () => {
  const plan = await loadPlan()
  const timelineNotes = flattenedItems(plan).filter(item => item.type === 'note' && item.timeline)

  assert.equal(timelineNotes.length, 40)

  for (const note of timelineNotes) {
    const { timeline } = note
    assert.equal(timeline.presentation, 'situational', `${note.id} should use an event-first track`)
    assert.equal(timeline.perspective, 'historical-situation')
    assert.ok(Array.isArray(timeline.phases) && timeline.phases.length > 0)
    assert.ok(Array.isArray(timeline.passages) && timeline.passages.length > 0)
    assert.equal('startYear' in timeline, false, `${note.id} should not use a year master bar`)
    assert.equal('endYear' in timeline, false, `${note.id} should not use a year master bar`)

    const phaseIds = new Set(timeline.phases.map(phase => phase.id))
    assert.equal(phaseIds.size, timeline.phases.length, `${note.id} needs unique situation phases`)
    for (const phase of timeline.phases) {
      if (!phase.anchor) continue
      assert.match(phase.anchor.dateLabel, /\d/, `${note.id}/${phase.label} needs a dated anchor label`)
      assert.ok(phase.anchor.summary.length <= 160, `${note.id}/${phase.label} anchor context should stay short`)
      assert.doesNotMatch(phase.anchor.summary, /\n/, `${note.id}/${phase.label} anchor context should be one sentence`)
      assert.match(phase.anchor.summary, /[.!?]$/, `${note.id}/${phase.label} anchor context should be a complete sentence`)
      assert.equal((phase.anchor.summary.match(/[.!?]/g) || []).length, 1, `${note.id}/${phase.label} anchor context should be one sentence`)
    }
    for (const passage of timeline.passages) {
      assert.match(passage.label, /\d/, `${note.id} should label passage bars with references`)
      assert.ok(phaseIds.has(passage.start), `${note.id}/${passage.label} has an unknown start phase`)
      assert.ok(phaseIds.has(passage.end), `${note.id}/${passage.label} has an unknown end phase`)
      assert.equal('dateLabel' in passage, false, `${note.id}/${passage.label} should not repeat dates inline`)
    }
  }
})

test('every passage maps to a contiguous portion of its situation track', async () => {
  const plan = await loadPlan()
  const timelineNotes = flattenedItems(plan).filter(item => item.type === 'note' && item.timeline)

  for (const note of timelineNotes) {
    const phaseIds = note.timeline.phases.map(phase => phase.id)
    for (const passage of note.timeline.passages) {
      assert.ok(
        phaseIds.indexOf(passage.start) <= phaseIds.indexOf(passage.end),
        `${note.id}/${passage.label} should run forward through the situation`
      )
    }
  }
})

test('the fall note uses one situational siege track for Jeremiah, Kings, and Chronicles', async () => {
  const plan = await loadPlan()
  const note = flattenedItems(plan).find(item => item.id === 'jeremiah-fall-and-aftermath')

  assert.ok(note)
  assert.match(note.title, /Kings and Chronicles/)
  assert.equal(note.timeline.presentation, 'situational')
  assert.equal(note.timeline.heading, 'Babylon’s siege and its aftermath')
  assert.deepEqual(
    note.timeline.phases.map(phase => phase.label),
    ['Siege', 'Fall', 'Gedaliah', 'Flight', 'Egypt']
  )
  assert.deepEqual(
    note.timeline.passages.map(passage => passage.label),
    ['Jer 39–41', 'Jer 42–44', '2 Kin 25:1–26', '2 Chr 36:17–21']
  )
  assert.deepEqual(
    note.timeline.passages.find(passage => passage.label === 'Jer 39–41'),
    {
      label: 'Jer 39–41',
      source: 'jeremiah',
      start: 'fall',
      end: 'gedaliah',
    }
  )
  assert.equal(note.timeline.phases.every(phase => phase.anchor), true)
  assert.equal(
    note.timeline.phases.find(phase => phase.id === 'flight').anchor.dateLabel,
    'After 586 BC (est.)'
  )
})

test('Jeremiah 52 is explicitly retrospective and sits beside Jeremiah 39', async () => {
  const plan = await loadPlan()
  const items = flattenedItems(plan)
  const note = items.find(item => item.id === 'jeremiah-historical-appendix')

  assert.ok(note)
  assert.match(note.title, /beside Jeremiah 39.*retrospective appendix/i)
  assert.match(note.text, /not a second capture of Jerusalem/i)
  assert.ok(chapterPosition(items, 'Jeremiah', 39) < chapterPosition(items, 'Jeremiah', 52))
  assert.ok(chapterPosition(items, 'Jeremiah', 52) < chapterPosition(items, 'Jeremiah', 40))
  assert.deepEqual(
    note.timeline.phases.map(phase => phase.label),
    ['Zedekiah', 'Final siege', 'Fall / deportation', 'Escape to Egypt', 'Jehoiachin freed']
  )
  assert.deepEqual(
    note.timeline.phases.map(phase => phase.anchor.dateLabel),
    ['597–586 BC (est.)', '588–586 BC (est.)', '586 BC (est.)', 'After 586 BC (est.)', '561 BC (est.)']
  )
})

test('Lamentations sits with Jerusalem’s fall without claiming an Egyptian composition', async () => {
  const plan = await loadPlan()
  const items = flattenedItems(plan)
  const note = items.find(item => item.id === 'lamentations-after-jerusalem-falls')

  assert.ok(note)
  assert.equal(note.title, 'Lamentations beside Jerusalem’s fall')
  assert.match(note.text, /does not name its author or place of composition/i)
  assert.match(note.text, /personified Jerusalem, an individual sufferer, and the surviving community/i)
  assert.match(note.text, /historical setting, not where Jeremiah wrote them/i)
  assert.ok(note.sources.includes('lamentations_esv_study_bible'))
  assert.ok(chapterPosition(items, 'Jeremiah', 52) < chapterPosition(items, 'Lamentations', 1))
  assert.ok(chapterPosition(items, 'Lamentations', 5) < chapterPosition(items, 'Jeremiah', 40))
  assert.deepEqual(
    note.timeline.phases.map(phase => phase.label),
    ['Jerusalem falls', 'City in ruins', 'Communal mourning', 'Restoration sought', 'Flight to Egypt']
  )
  assert.deepEqual(
    note.timeline.passages.map(passage => passage.label),
    ['Lam 1–2', 'Lam 3', 'Lam 4', 'Lam 5', '2 Kin 25:1–21', 'Jer 39; 52:1–30', 'Jer 40–44']
  )
  assert.deepEqual(
    note.timeline.passages.find(passage => passage.label === 'Jer 40–44'),
    {
      label: 'Jer 40–44',
      source: 'jeremiah',
      start: 'ruins',
      end: 'flight',
    }
  )
  assert.equal(note.timeline.phases.every(phase => phase.anchor), true)
})

test('Daniel’s early-exile note dates its anchors and distinguishes the later exile', async () => {
  const plan = await loadPlan()
  const note = flattenedItems(plan).find(item => item.id === 'daniel-early-babylonian-exile')

  assert.ok(note)
  assert.equal(note.timeline.phases.every(phase => phase.anchor), true)
  assert.deepEqual(
    note.timeline.phases.map(phase => phase.label),
    ['Jehoiakim', 'Babylon triumphs', 'Daniel taken', 'Court training', 'Jehoiachin exiled']
  )
  assert.deepEqual(
    note.timeline.passages.map(passage => passage.label),
    ['Dan 1', 'Dan 2', 'Jer 25:1; 46:2', '2 Kin 24:1–17', '2 Chr 36:5–10', 'Jer 24:1']
  )
  assert.deepEqual(
    note.timeline.passages.find(passage => passage.label === 'Dan 2'),
    {
      label: 'Dan 2',
      source: 'prophet',
      start: 'training',
      end: 'training',
    }
  )
  assert.equal(
    note.timeline.phases.find(phase => phase.id === 'babylon').anchor.dateLabel,
    '605 BC (est.)'
  )
  assert.match(note.text, /should not be confused with Daniel's earlier removal/i)
})

test('Ezekiel’s dated ministry is interwoven with Jeremiah before and through Jerusalem’s fall', async () => {
  const plan = await loadPlan()
  const items = flattenedItems(plan)
  const note = items.find(item => item.id === 'ezekiel-dated-exile-visions')

  assert.ok(note)
  assert.equal(note.title, 'Jeremiah in Judah, Ezekiel among the exiles')
  assert.match(note.text, /fifth year of Jehoiachin’s exile/i)
  assert.match(note.text, /while Zedekiah still rules Jerusalem and Jeremiah is still preaching there/i)
  assert.match(note.text, /Ezekiel 29:17 is a later dated addition/i)
  assert.ok(note.sources.includes('ezekiel_esv_global_study_bible'))

  assert.ok(chapterPosition(items, 'Jeremiah', 29) < chapterPosition(items, 'Ezekiel', 1))
  assert.ok(chapterPosition(items, 'Ezekiel', 7) < chapterPosition(items, 'Jeremiah', 30))
  assert.ok(chapterPosition(items, 'Jeremiah', 36) < chapterPosition(items, 'Ezekiel', 8))
  assert.ok(chapterPosition(items, 'Ezekiel', 23) < chapterPosition(items, 'Jeremiah', 37))
  assert.ok(chapterPosition(items, 'Jeremiah', 38) < chapterPosition(items, 'Ezekiel', 24))
  assert.ok(chapterPosition(items, 'Ezekiel', 31) < chapterPosition(items, '2 Kings', 25))
  assert.ok(chapterPosition(items, 'Jeremiah', 44) < chapterPosition(items, 'Ezekiel', 25))

  assert.deepEqual(
    expandBookChapters(plan, 'Ezekiel'),
    [
      ...Array.from({ length: 24 }, (_, index) => index + 1),
      29, 30, 31,
      25, 26, 27, 28,
      ...Array.from({ length: 17 }, (_, index) => index + 32),
    ]
  )
  assert.deepEqual(
    note.timeline.phases.map(phase => phase.label),
    ['Jehoiachin exiled', 'Ezekiel called', 'Parallel warnings', 'Final siege', 'Fall / news', 'Restoration visions']
  )
  assert.equal(note.timeline.phases.every(phase => phase.anchor), true)
  for (const label of ['Jer 27–36', 'Ezek 1–7', 'Jer 37–39', 'Ezek 24; 29–31', '2 Kin 24:10–25:21', '2 Chr 36:9–21']) {
    assert.ok(note.timeline.passages.some(passage => passage.label === label), `missing Ezekiel context row ${label}`)
  }
})

test('the exile-Psalms aid retains Jeremiah, Kings, and Chronicles as historical context', async () => {
  const plan = await loadPlan()
  const note = flattenedItems(plan).find(item => item.id === 'exilic-psalm-laments')

  assert.ok(note)
  assert.ok(note.sources.includes('late_judah_biblical_timeline'))
  assert.match(note.text, /Jeremiah, Kings, and Chronicles visible/i)
  assert.deepEqual(
    note.timeline.phases.map(phase => phase.label),
    ['Jerusalem destroyed', 'Survivors displaced', 'Lament in exile', 'Hope for return', 'Return begins']
  )
  assert.equal(note.timeline.phases.every(phase => phase.anchor), true)
  for (const label of ['2 Kin 25', '2 Chr 36:17–23', 'Jer 39–44; 52']) {
    assert.ok(note.timeline.passages.some(passage => passage.label === label), `missing exile-Psalms context row ${label}`)
  }
})

test('other clear parallel notes also expose their historical accounts in the chart', async () => {
  const plan = await loadPlan()
  const notes = new Map(flattenedItems(plan)
    .filter(item => item.type === 'note' && item.timeline)
    .map(item => [
      item.id,
      (item.timeline.passages || item.timeline.contexts || []).map(row => row.label),
    ]))

  const expectedRows = {
    'jonah-jeroboam-ii': ['2 Kin 14:23–25', 'Jon 1–4'],
    'isaiah-hezekiah-assyrian-crisis': ['Isa 36–39', '2 Kin 18:13–20:19', '2 Chr 32'],
    'josiah-context-before-jeremiah': ['2 Kin 22–23', '2 Chr 34–35'],
    'jeremiah-zedekiah-siege-anchors': ['Jer 37–38', '2 Kin 25:1–7', '2 Chr 36:17–20'],
    'jeremiah-historical-appendix': ['Jer 52:1–30', '2 Kin 24:18–25:21', '2 Chr 36:11–21'],
    'exilic-psalm-laments': ['2 Kin 25', '2 Chr 36:17–23', 'Jer 39–44; 52'],
    'ezekiel-dated-exile-visions': ['Jer 27–36', 'Ezek 1–7', '2 Kin 24:10–25:21', '2 Chr 36:9–21'],
  }

  for (const [noteId, labels] of Object.entries(expectedRows)) {
    assert.ok(notes.has(noteId), `missing ${noteId}`)
    for (const label of labels) {
      assert.ok(notes.get(noteId).includes(label), `${noteId} should chart ${label}`)
    }
  }
})
