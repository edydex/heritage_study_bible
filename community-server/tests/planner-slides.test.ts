import assert from 'node:assert/strict'
import test from 'node:test'
import core from '../packages/service-core/index.js'
import { deletePlannerSlide, editPlannerSlide, movePlannerSlide, plannerSlides, setSlideTranslationCue } from '../src/components/plannerSlides.ts'

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
  const originalCueIds = plannerSlides(project).map(row => row.id)
  const edited = editPlannerSlide(project, plannerSlides(project)[3], 'russian', 0, 'Edited chorus\nNext line')
  const rows = plannerSlides(reopen(edited))
  assert.deepEqual(rows.map(row => row.id), originalCueIds, 'Editing lyrics must preserve the live cue and all other song occurrences')
  assert.equal(rows[3].cue!.channels.russian.blocks[0].text, 'Edited chorus\nNext line')
  assert.equal(rows[3].cue!.channels.media.blocks[0].text, 'Edited chorus\nNext line')
  assert.equal(rows[3].cue!.channels.english.blocks[0].text, 'Chorus line')
  assert.equal(rows[4].cue!.channels.russian.blocks[0].text, 'Chorus line')
  assert.deepEqual(edited.resources[resourceId], project.resources[resourceId])
  assert.equal(JSON.stringify(project), original)
})

test('editing a multi-page verse preserves every stable song cue across successive corrections', () => {
  const {project}=fixture(),before=plannerSlides(project)
  const originalIds=before.map(row=>row.id)
  let edited=editPlannerSlide(project,before[2],'english',0,'Corrected second page')
  let rows=plannerSlides(reopen(edited))
  assert.deepEqual(rows.map(row=>row.id),originalIds)
  assert.equal(rows[1].cue!.channels.english.blocks[0].text,'First line\nSecond line')
  assert.equal(rows[2].cue!.channels.english.blocks[0].text,'Corrected second page')
  edited=editPlannerSlide(edited,rows[4],'russian',0,'Corrected final chorus')
  rows=plannerSlides(reopen(edited))
  assert.deepEqual(rows.map(row=>row.id),originalIds)
  assert.equal(rows[3].cue!.channels.russian.blocks[0].text,'Chorus line')
  assert.equal(rows[4].cue!.channels.russian.blocks[0].text,'Corrected final chorus')
})

test('move and delete operate on one lyric slide and preserve both translations', () => {
  const { project } = fixture()
  const rows = plannerSlides(project)
  const moved = movePlannerSlide(project, rows[1], rows[3], true)
  const afterMove = plannerSlides(reopen(moved))
  assert.deepEqual(afterMove.map(row=>row.id),[rows[0],rows[2],rows[3],rows[1],rows[4],rows[5]].map(row=>row.id),'Moving one lyric page must retain every existing cue identity')
  assert.deepEqual(afterMove.slice(1, 5).map(row => row.title), ['Second slide', 'Chorus line', 'First line', 'Chorus line'])
  const deleted = deletePlannerSlide(moved, afterMove[2])
  assert.deepEqual(plannerSlides(reopen(deleted)).map(row=>row.id),afterMove.filter((_,index)=>index!==2).map(row=>row.id),'Deleting one lyric page must retain every surviving cue identity')
  assert.deepEqual(plannerSlides(reopen(deleted)).slice(1, 4).map(row => row.title), ['Second slide', 'First line', 'Chorus line'])
  assert.equal(plannerSlides(project).length, 6)
})

test('moving and deleting other lyric pages preserve a corrected bilingual live cue and its settings',()=>{
 let project=fixture().project
 const liveKey=plannerSlides(project)[3].cue!.sourceLeafKey
 project=JSON.parse(JSON.stringify(project))
 project.items.song.songPresentation={stackedTranslation:true,primaryChannelId:'english',secondaryChannelId:'russian',credits:'Keep the credits',audienceLanguage:'both',slidePrimaryChannelIds:{[liveKey]:'russian'}}
 project.items.song.textStyle={bodySize:48,bodyAlign:'center'}
 const settings={sourceLanguage:'ru',targetLanguage:'en',voice:'marin',speechEnabled:true,captionStyle:'ticker',captionChannel:'english'}
 project=setSlideTranslationCue(project,plannerSlides(project)[3],'start',settings)
 project=editPlannerSlide(project,plannerSlides(project)[3],'english',0,'Исправленный припев')
 const before=plannerSlides(project),live=before[3],pins=project.resources
 const moved=movePlannerSlide(project,before[1],before[4],true)
 const rows=plannerSlides(reopen(moved))
 assert.deepEqual(new Set(rows.map(row=>row.id)),new Set(before.map(row=>row.id)))
 const removed=rows.find(row=>row.id===before[2].id)!
 const edited=reopen(deletePlannerSlide(moved,removed)),after=plannerSlides(edited)
 assert.deepEqual(new Set(after.map(row=>row.id)),new Set(before.filter(row=>row.id!==removed.id).map(row=>row.id)))
 const current=after.find(row=>row.id===live.id)!
 assert.ok(current,'The displayed lyric cue remains available to Next and retake')
 assert.equal(current.cue!.sourceLeafKey,liveKey)
 assert.equal(current.cue!.channels.english.blocks[0].text,'Исправленный припев')
 assert.equal(current.cue!.channels.english.blocks[1].text,'Chorus line')
 assert.equal(current.cue!.channels.english.blocks[1].spans[0].foreground,'#ffc000')
 assert.deepEqual(current.cue!.translationSettings,settings)
 assert.equal(current.cue!.translationAction,'start')
 assert.equal(edited.items.song.songPresentation.slidePrimaryChannelIds[liveKey],'russian')
 assert.equal(edited.items.song.songPresentation.credits,'Keep the credits')
 assert.deepEqual(edited.items.song.textStyle,project.items.song.textStyle)
 for(const [id,resource] of Object.entries(pins))assert.deepEqual(edited.resources[id],resource)
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


test('translation configuration follows a section through save, lyric edits, and Stop',()=>{
 const original=fixture().project
 const settings={sourceLanguage:'en',targetLanguage:'ru',voice:'marin',speechEnabled:true,captionStyle:'ticker',captionChannel:'russian'}
 let project=setSlideTranslationCue(original,plannerSlides(original)[1],'start',settings)
 project=setSlideTranslationCue(project,plannerSlides(project)[4],'stop')
 project=reopen(project)
 let rows=plannerSlides(project)
 assert.equal(rows[0].cue!.translationSettings,undefined)
 assert.deepEqual(rows[1].cue!.translationSettings,settings)
 assert.deepEqual(rows[3].cue!.translationSettings,settings)
 assert.equal(rows[4].cue!.translationSettings,undefined)
 project=editPlannerSlide(project,rows[1],'english',0,'Revised lyrics')
 rows=plannerSlides(reopen(project))
 assert.equal(rows[1].cue!.translationAction,'start')
 assert.deepEqual(rows[1].cue!.translationSettings,settings)
 project=setSlideTranslationCue(project,rows[1],null)
 assert.ok(plannerSlides(reopen(project)).every(row=>!row.cue!.translationSettings))
 assert.throws(()=>setSlideTranslationCue(original,plannerSlides(original)[1],'start',{...settings,voice:'../unknown'}))
})

test('bilingual song labels follow the chosen language even when both outputs draw Russian first',()=>{
 let project=fixture().project
 const russian=core.parseSongDocument('---\nid: test-song-ru\ntitle: Русская песня\nlanguage: ru\n---\n\n^1\nПервая строка\nВторая строка\n\n---\nВторой слайд\n\n^chorus\nПрипев\n',{fileName:'ru.md'})
 const added=core.addSongResource(project,russian)
 project=JSON.parse(JSON.stringify(added.project))
 project.items.song.variants.russian.resourceId=added.resourceId
 project.items.song.songPresentation={stackedTranslation:true,primaryChannelId:'russian',secondaryChannelId:'english',credits:''}
 project=reopen(project)
 assert.equal(plannerSlides(project,'english')[0].title,'Test Song')
 assert.equal(plannerSlides(project,'english')[1].title,'First line')
 assert.equal(plannerSlides(project,'russian')[0].title,'Русская песня')
 assert.equal(plannerSlides(project,'russian')[1].title,'Первая строка')
 assert.equal(plannerSlides(project,'russian')[2].title,'Второй слайд')
 assert.equal(plannerSlides(project,'russian')[4].title,'Припев')
})

test('a repeated bilingual correction preserves primary language, translation settings, formatting and occurrence identity',()=>{
 let project=fixture().project
 const russian=core.parseSongDocument('---\nid: test-song-ru\ntitle: Русская песня\nlanguage: ru\n---\n^1\nПервая строка\nВторая строка\n---\nВторой слайд\n^chorus\nРусский припев\n',{fileName:'ru.md'})
 const added=core.addSongResource(project,russian)
 project=JSON.parse(JSON.stringify(added.project));project.items.song.variants.russian.resourceId=added.resourceId
 let rows=plannerSlides(project),key=rows[3].cue!.sourceLeafKey
 project.items.song.songPresentation={stackedTranslation:true,primaryChannelId:'english',secondaryChannelId:'russian',credits:'Original authors',audienceLanguage:'both',slidePrimaryChannelIds:{[key]:'russian'}}
 const settings={sourceLanguage:'ru',targetLanguage:'en',voice:'marin',speechEnabled:true,captionStyle:'ticker',captionChannel:'english'}
 project=setSlideTranslationCue(project,plannerSlides(project)[3],'start',settings)
 rows=plannerSlides(project)
 const ids=rows.map(row=>row.id),pinned=JSON.stringify(project.resources),arrangement=project.items.song.arrangement
 let edited=editPlannerSlide(project,rows[3],'english',1,'Corrected English chorus')
 edited=reopen(edited);rows=plannerSlides(edited)
 assert.deepEqual(rows.map(row=>row.id),ids)
 assert.deepEqual(edited.items.song.arrangement.map((entry:any)=>entry.id),arrangement.map((entry:any)=>entry.id))
 assert.equal(rows[3].cue!.channels.english.blocks[0].text,'Русский припев')
 assert.equal(rows[3].cue!.channels.english.blocks[1].text,'Corrected English chorus')
 assert.equal(rows[3].cue!.channels.english.blocks[1].spans[0].foreground,'#ffc000')
 assert.equal(rows[4].cue!.channels.english.blocks[0].text,'Chorus line')
 assert.equal(rows[4].cue!.channels.english.blocks[1].text,'Русский припев')
 assert.deepEqual(rows[3].cue!.translationSettings,settings)
 assert.equal(rows[3].cue!.translationAction,'start')
 assert.equal(edited.items.song.songPresentation.slidePrimaryChannelIds[key],'russian')
 assert.equal(edited.items.song.songPresentation.credits,'Original authors')
 assert.deepEqual(JSON.parse(pinned),project.resources,'Pinned library resources must remain immutable')
 for(const [id,resource] of Object.entries(project.resources)) assert.deepEqual(edited.resources[id],resource)
 const privateId=edited.items.song.arrangement[1].sectionId
 edited=editPlannerSlide(edited,rows[3],'english',0,'Исправленный русский припев')
 rows=plannerSlides(reopen(edited))
 assert.deepEqual(rows.map(row=>row.id),ids)
 assert.equal(edited.items.song.arrangement[1].sectionId,privateId,'Further corrections reuse the same private occurrence')
 assert.equal(rows[3].cue!.channels.english.blocks[0].text,'Исправленный русский припев')
 assert.equal(rows[3].cue!.channels.english.blocks[1].text,'Corrected English chorus')
 assert.equal(rows[3].cue!.channels.media.blocks[0].text,'Исправленный русский припев')
})
