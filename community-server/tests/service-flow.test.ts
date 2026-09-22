import test from 'node:test'
import assert from 'node:assert/strict'
import core from '../packages/service-core/index.js'
import {
  addReadingTitle,
  preparePlannerPresentation,
} from '../src/components/plannerPresentation'
import { appendBlankSlide } from '../src/components/plannerReadingGroups'
import { insertionPoint, createTemplateDraft, editCanvasObjects } from '../src/components/plannerTemplates'
import {
  plannerSlides,
  deletePlannerSlide,
  movePlannerSlide,
  setSlideTranslationCue,
  translationActionForSlide,
} from '../src/components/plannerSlides'
import { changePlannerSelection } from '../src/components/plannerSelection'
import {
  extractReusableSlide,
  insertReusableSlide,
} from '../src/components/plannerReusableSlides'
import formatting from '../packages/service-core/node/services/project/SlideFormatting.js'
const project = () =>
  core.createServiceProject({
    id: 'test',
    title: 'Test',
    serviceDate: '2026-09-20',
    preferredProfileId: 'main-sanctuary',
    presetPack: { id: 'main-sanctuary', version: 1, sha256: null },
    channels: [
      { id: 'english', label: 'English', language: 'en' },
      { id: 'russian', label: 'Russian', language: 'ru' },
      { id: 'media', label: 'Stage', language: 'ru' },
    ],
  })
function reading() {
  let p = core.addBibleItem(project(), {
    id: 'reading',
    title: 'Psalm',
    presetId: 'wotbc-reading',
    range: {
      bookId: 'Ps',
      start: { chapter: 119, verse: 162 },
      end: { chapter: 119, verse: 175 },
    },
    passagesByChannel: Object.fromEntries(
      ['english', 'russian', 'media'].map((id) => [
        id,
        {
          translationId: 'BSB',
          reference: 'Psalm 119:162–175',
          attribution: 'Credit',
          verses: Array.from({ length: 14 }, (_, i) => ({
            number: 162 + i,
            text: 'Exact verse words '.repeat(4),
          })),
        },
      ]),
    ),
  })
  return addReadingTitle(p, 'reading', { english: 'BSB', russian: 'SYNO' })
}
test('reading has one numbered parent, flat pages, sibling blank and safe subsequent insertion', () => {
  const p = preparePlannerPresentation(
    appendBlankSlide(reading(), 'reading-reading'),
  ).project
  assert.equal(p.items.reading, undefined)
  assert.deepEqual(p.rootItemIds, ['reading-reading', 'reading-reading-blank'])
  const rows = plannerSlides(p)
  assert.equal(rows.filter((r) => r.kind === 'group').length, 0)
  assert.equal(rows[0].readingTitle, true)
  assert.equal(rows[0].depth, 0)
  assert.ok(rows.slice(1, -1).every((r) => r.kind === 'bible' && r.depth === 1))
  assert.deepEqual(insertionPoint(p, rows[1].itemId), {
    parentId: null,
    index: 2,
  })
  assert.deepEqual(insertionPoint(p, rows[1].itemId, true), {
    parentId: 'reading-reading',
    index: 2,
  })
  const removed = deletePlannerSlide(p, rows.at(-1)!)
  assert.equal(plannerSlides(removed).length, rows.length - 1)
  assert.deepEqual(deletePlannerSlide(p, rows[0]).rootItemIds, [
    'reading-reading-blank',
  ])
  assert.deepEqual(
    changePlannerSelection(p, [rows[0].id], 'delete').project.rootItemIds,
    ['reading-reading-blank'],
  )
  const moved = movePlannerSlide(p, rows[0], rows.at(-1)!, true)
  assert.deepEqual(moved.rootItemIds, [
    'reading-reading-blank',
    'reading-reading',
  ])
})
test('legacy nested foreign items are hoisted after reading without losing words', () => {
  let p = JSON.parse(JSON.stringify(reading()))
  p = core.addProjectItem(
    p,
    {
      id: 'next-song-placeholder',
      kind: 'notice',
      title: 'Next song',
      textByChannel: { english: 'Next song' },
    },
    { parentId: 'reading-reading' },
  )
  const fixed = preparePlannerPresentation(p).project
  assert.deepEqual(fixed.rootItemIds, [
    'reading-reading',
    'next-song-placeholder',
  ])
  assert.equal(
    plannerSlides(fixed)
      .filter((r) => r.kind === 'bible')
      .flatMap((r) => r.cue!.channels.english.blocks[0].verses).length,
    14,
  )
  assert.equal(preparePlannerPresentation(fixed).changed, false)
})
test('reusable slides make independent editable copies; source and assets survive', () => {
  let p = core.addProjectItem(project(), {
    id: 'welcome',
    kind: 'notice',
    title: 'Welcome',
    textByChannel: { english: 'Topic', russian: 'Тема' },
    titlesByChannel: { english: 'Welcome', russian: 'Добро пожаловать' },
    presetId: 'notice-simple',
  })
  const source = extractReusableSlide(p, 'welcome'),
    target = insertReusableSlide(project(), source, null, 'new-welcome')
  assert.equal(
    target.project.items['new-welcome'].textByChannel.english,
    'Topic',
  )
  const changed = JSON.parse(JSON.stringify(target.project))
  changed.items['new-welcome'].textByChannel.english = 'Changed'
  assert.equal(
    core.parseHeritageServiceDocumentSource(source).project.items.welcome
      .textByChannel.english,
    'Topic',
  )
  assert.throws(
    () => extractReusableSlide(reading(), 'reading-reading'),
    /Select a picture/,
  )
})
test('Welcome canvas insertion copies frozen template objects before applying defaults', () => {
  let p = createTemplateDraft(project(), { id: 'welcome', template: 'other', selectedId: null })
  const topic = {id: 'welcome-topic', type: 'text', frame: {x: .1, y: .8, width: .8, height: .1, rotation: 0}, text: 'Service topic', fontSize: 64, align: 'center', color: '#ffffff'}
  p = editCanvasObjects(p, 'welcome', 'english', [topic])
  p = editCanvasObjects(p, 'welcome', 'russian', [{...topic, text: 'Тема служения'}])
  const source = extractReusableSlide(p, 'welcome')
  const original = core.parseHeritageServiceDocumentSource(source).project.items.welcome
  assert.ok(Object.isFrozen(original.objectsByChannel.english[0]))
  const inserted = insertReusableSlide(project(), source, null, 'new-welcome').project
  for (const channel of ['english', 'russian', 'media']) {
    assert.equal(inserted.items['new-welcome'].objectsByChannel[channel][0].align, 'left')
    assert.equal(original.objectsByChannel[channel][0].align, 'center')
  }
  assert.equal(inserted.items['new-welcome'].objectsByChannel.english[0].text, 'Service topic')
  assert.equal(inserted.items['new-welcome'].objectsByChannel.russian[0].text, 'Тема служения')
})
test('redundant built-in source notes are hidden, imported translation credit survives', () => {
  const note =
    'Berean Standard Bible (BSB); exact text pinned from Heritage Study Bible reader data.'
  assert.equal(
    formatting.scriptureCredit({ translationId: 'BSB', attribution: note }),
    '',
  )
  assert.equal(formatting.scriptureCredit({translationId: 'SYNO-W', attribution: 'Russian Synodal Bible (SYNO-W); exact text pinned from Heritage Study Bible reader data.'}), '')
  assert.equal(formatting.scriptureCredit({translationId: 'SYNO-W', attribution: 'Required recording or edition credit'}), 'Required recording or edition credit')
  assert.equal(
    formatting.scriptureCredit({
      translationId: 'LSB',
      attribution: 'Required edition credit',
    }),
    'Required edition credit',
  )
})

test('translation cues target the exact slide and follow Start/Stop range state', () => {
  const p = preparePlannerPresentation(
    appendBlankSlide(reading(), 'reading-reading'),
  ).project
  const rows = plannerSlides(p)
  const start = setSlideTranslationCue(p, rows[1], 'start'),
    marked = plannerSlides(start)
  assert.equal(marked[1].cue!.translationAction, 'start')
  assert.equal(translationActionForSlide(marked, marked[2]), 'stop')
  assert.equal(translationActionForSlide(marked, marked[0]), 'start')
  const stop = setSlideTranslationCue(start, marked[2], 'stop'),
    final = plannerSlides(stop)
  assert.equal(final[2].cue!.translationAction, 'stop')
  assert.equal(translationActionForSlide(final, final.at(-1)!), 'start')
  assert.equal(
    plannerSlides(setSlideTranslationCue(stop, final[1], null))[1].cue!
      .translationAction,
    undefined,
  )
  assert.equal(
    core.parseHeritageServiceDocumentSource(
      extractReusableSlide(
        core.addProjectItem(project(), {
          id: 'note',
          kind: 'notice',
          textByChannel: { english: 'Text' },
          translationCues: { self: 'start' },
        }),
        'note',
      ),
    ).project.items.note.translationCues.self,
    'start',
  )
})

test('cue-only changes retain reviewed translation settings; slide changes require review', async () => {
  const { sameServiceApartFromTranslationCues } =
    await import('../src/lib/serviceTranslationPlan')
  const p = preparePlannerPresentation(reading()).project
  const source = (value: any) =>
    core.serializeHeritageServiceDocument(
      core.createHeritageServiceDocument({
        ...value,
        revision: Math.max(1, value.revision),
      }),
    )
  const before = source(p)
  const marked = setSlideTranslationCue(p, plannerSlides(p)[0], 'start')
  const after = source(marked)
  assert.equal(sameServiceApartFromTranslationCues(before, after), true)
  const changed = JSON.parse(JSON.stringify(marked))
  changed.title = 'A different sermon'
  assert.equal(
    sameServiceApartFromTranslationCues(before, source(changed)),
    false,
  )
  assert.equal(sameServiceApartFromTranslationCues(before, '{}'), false)
})
