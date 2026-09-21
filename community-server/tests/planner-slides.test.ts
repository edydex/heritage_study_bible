import assert from 'node:assert/strict'
import test from 'node:test'
import core from '../packages/service-core/index.js'
import { deletePlannerSlide, editPlannerSlide, movePlannerSlide, plannerSlides } from '../src/components/plannerSlides.ts'

function fixture() {
  let project = core.createServiceProject({ id: 'planner-test', title: 'Planner rehearsal', serviceDate: '2026-08-23', preferredProfileId: 'main-sanctuary', presetPack: { id: 'main-sanctuary', version: 1, sha256: null },
    channels: [
      { id: 'english', label: 'English', language: 'en' }, { id: 'russian', label: 'Russian', language: 'ru' }, { id: 'media', label: 'Singers', language: 'ru' },
    ] })
  const song = core.parseSongDocument('---\nid: test-song\ntitle: Test Song\nlanguage: en\n---\n\n^1\nFirst line\nSecond line\n\n---\nSecond slide\n\n^chorus\nChorus line\n', { fileName: 'test.md' })
  const pinned = core.addSongResource(project, song)
  project = core.addProjectItem(pinned.project, { id: 'song', kind: 'song', title: 'Test Song',
    variants: { english: { mode: 'content', resourceId: pinned.resourceId }, russian: { mode: 'content', resourceId: pinned.resourceId }, media: { mode: 'derive', from: 'russian', transform: { id: 'first-lines', version: 1, maxLines: 2 } } },
    primaryChannelId: 'english', arrangement: [{ id: 'one', sectionId: 'verse-1' }, { id: 'two', sectionId: 'chorus' }, { id: 'three', sectionId: 'chorus' }],
  })
  project = core.addProjectItem(project, { id: 'notice', kind: 'notice', title: 'Welcome', textByChannel: { english: 'Welcome everyone' } })
  return { project, resourceId: pinned.resourceId }
}

function reopen(project: any) {
  return core.parseHeritageServiceDocumentSource(core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({ ...project, revision: 1 }))).project
}

test('outline includes every compiled slide, not just one row per song', () => {
  const { project } = fixture()
  const rows = plannerSlides(project)
  assert.equal(rows.length, 6)
  assert.deepEqual(rows.map(row => row.number), [1, 2, 3, 4, 5, 6])
  assert.equal(rows[1].title, 'First line')
})

test('direct lyric edits change only that occurrence and output, survive reopen and preserve the pinned library', () => {
  const { project, resourceId } = fixture()
  const original = JSON.stringify(project)
  const edited = editPlannerSlide(project, plannerSlides(project)[3], 'russian', 0, 'Edited chorus\nNext line')
  const rows = plannerSlides(reopen(edited))
  assert.equal(rows[3].cue!.channels.russian.blocks[0].text, 'Edited chorus\nNext line')
  assert.equal(rows[3].cue!.channels.media.blocks[0].text, 'Edited chorus\nNext line')
  assert.equal(rows[3].cue!.channels.english.blocks[0].text, 'Chorus line')
  assert.equal(rows[4].cue!.channels.russian.blocks[0].text, 'Chorus line')
  assert.deepEqual(edited.resources[resourceId], project.resources[resourceId])
  assert.equal(JSON.stringify(project), original)
})

test('move and delete operate on one lyric slide and preserve both translations', () => {
  const { project } = fixture()
  const rows = plannerSlides(project)
  const moved = movePlannerSlide(project, rows[1], rows[3], true)
  const afterMove = plannerSlides(reopen(moved))
  assert.deepEqual(afterMove.slice(1, 5).map(row => row.title), ['Second slide', 'Chorus line', 'First line', 'Chorus line'])
  const deleted = deletePlannerSlide(moved, afterMove[2])
  assert.deepEqual(plannerSlides(reopen(deleted)).slice(1, 4).map(row => row.title), ['Second slide', 'First line', 'Chorus line'])
  assert.equal(plannerSlides(project).length, 6)
})

test('normal slides and whole songs reorder at the service level', () => {
  const { project } = fixture()
  const rows = plannerSlides(project)
  const moved = movePlannerSlide(project, rows[5], rows[0])
  assert.equal(plannerSlides(reopen(moved))[0].itemId, 'notice')
  const deleted = deletePlannerSlide(moved, plannerSlides(moved)[1])
  assert.deepEqual(plannerSlides(reopen(deleted)).map(row => row.itemId), ['notice'])
})

test('editable text is canonical; derived singers and blank lyrics are rejected', () => {
  const { project } = fixture()
  const rows = plannerSlides(project)
  const edited = editPlannerSlide(project, rows[5], 'english', 0, 'Welcome, church')
  assert.equal(plannerSlides(reopen(edited))[5].cue!.channels.english.blocks[0].text, 'Welcome, church')
  assert.throws(() => editPlannerSlide(project, rows[1], 'media', 0, 'Changed'), /generated/)
  assert.throws(() => editPlannerSlide(project, rows[1], 'english', 0, ''), /cannot be empty/)
  assert.throws(() => movePlannerSlide(project, rows[1], rows[5]), /within their song/)
})
