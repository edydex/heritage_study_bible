import assert from 'node:assert/strict'
import test from 'node:test'
import core from '../packages/service-core/index.js'
import { changePlannerSelection, plannerRangeSelection, selectedPlannerSlides } from '../src/components/plannerSelection.ts'
import { editPlannerSlide, isSongTitleSlide, plannerSlides } from '../src/components/plannerSlides.ts'
import { plannerPreview } from '../src/components/plannerPreview.ts'
import { preparePlannerPresentation } from '../src/components/plannerPresentation.ts'

function fixture() {
  let project = core.createServiceProject({id:'selection-test', title:'Sunday', serviceDate:'2026-08-23',
    preferredProfileId:'main-sanctuary', presetPack:{id:'main-sanctuary',version:1,sha256:null},
    channels:[{id:'english',label:'English',language:'en'}, {id:'russian',label:'Russian',language:'ru'}, {id:'media',label:'Singers',language:'ru'}]})
  const resources: Record<string, string> = {}
  for (const [channel, language, lines] of [['english','en','First\nSecond\nThird\nFourth'],['russian','ru','Один\nДва\nТри\nЧетыре']]) {
    const added = core.addSongResource(project, core.parseSongDocument(`---\nid: song-${language}\ntitle: Song ${language}\nlanguage: ${language}\n---\n\n^1\n${lines}\n\n---\nNext ${language}\n\n^chorus\nChorus ${language}\n`, {fileName:language+'.md'}))
    project = added.project; resources[channel] = added.resourceId
  }
  project = core.addProjectItem(project, {id:'section',kind:'group',groupKind:'section',title:'Worship',childIds:[]})
  project = core.addProjectItem(project, {id:'song',kind:'song',title:'Song',
    variants:{english:{mode:'content',resourceId:resources.english},russian:{mode:'content',resourceId:resources.russian},
      media:{mode:'derive',from:'russian',transform:{id:'first-lines',version:1,maxLines:2}}},
    primaryChannelId:'english', arrangement:[{id:'verse',sectionId:'verse-1'}, {id:'chorus',sectionId:'chorus'}, {id:'repeat',sectionId:'chorus'}],
    titlePresetId:'wotbc-song-title',lyricsPresetId:'wotbc-song-stacked',
    songPresentation:{stackedTranslation:true,primaryChannelId:'russian',secondaryChannelId:'english',credits:'Writer'}}, {parentId:'section'})
  for (const id of ['welcome','closing']) project = core.addProjectItem(project, {id,kind:'notice',title:id,textByChannel:{english:id,russian:id+' ru'},
    spansByChannel:{english:[{start:0,end:3,weight:'700',foreground:'#ffcc33'}]}})
  return project
}
const slides = (project: any) => plannerSlides(project).filter(row => row.cue)
const visible = (project: any) => slides(project).map(row => ({kind:row.kind,channels:row.cue!.channels,preset:row.cue!.presetId}))
const reopen = (project: any) => preparePlannerPresentation(core.parseHeritageServiceDocumentSource(core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({...project,revision:1}))).project).project
function action(project: any, numbers: number[], operation: 'move'|'duplicate'|'delete', destination?: number) {
  return changePlannerSelection(project, numbers.map(number => slides(project)[number-1].id), operation, destination)
}

test('Shift ranges work in both directions and skip section headings', () => {
  const project=fixture(), rows=plannerSlides(project), numbered=slides(project)
  const forward=plannerRangeSelection(rows, numbered[1].id, numbered[5].id)
  assert.deepEqual(forward, numbered.slice(1,6).map(row=>row.id))
  assert.deepEqual(plannerRangeSelection(rows, numbered[5].id, numbered[1].id),forward)
  assert.equal(selectedPlannerSlides(rows,['section']).length,5)
})

test('duplicate one ordinary slide preserves styling and inserts directly after it', () => {
  const project=fixture(), before=visible(project)
  const result=action(project,[6],'duplicate'), after=visible(reopen(result.project))
  assert.deepEqual(after,[...before.slice(0,6),before[5],...before.slice(6)])
  assert.equal(result.selectedIds.length,1)
  const copied=plannerSlides(result.project).find(row=>row.id===result.activeId)!
  const edited=editPlannerSlide(result.project,copied,'english',0,'Different welcome')
  assert.equal(slides(edited)[5].cue!.channels.english.blocks[0].text,'welcome')
  assert.equal(slides(edited)[6].cue!.channels.english.blocks[0].text,'Different welcome')
})

test('duplicating repeated lyrics creates one independent bilingual slide without an extra title', () => {
  const project=fixture(), snapshot=JSON.stringify(project), before=visible(project)
  const result=action(project,[4],'duplicate'), after=reopen(result.project)
  assert.deepEqual(visible(after),[...before.slice(0,4),before[3],...before.slice(4)])
  const copied=slides(after)[4]
  assert.equal(isSongTitleSlide(copied),false)
  const edited=editPlannerSlide(after,copied,'english',0,'Новая строка')
  assert.equal(slides(edited)[4].cue!.channels.english.blocks[0].text,'Новая строка')
  assert.equal(slides(edited)[3].cue!.channels.english.blocks[0].text,'Chorus ru')
  assert.equal(slides(edited)[5].cue!.channels.english.blocks[0].text,'Chorus ru')
  assert.equal(slides(edited)[4].cue!.channels.english.blocks[1].text,'Chorus en')
  for (const [id,resource] of Object.entries(project.resources)) assert.deepEqual(edited.resources[id],resource)
  assert.equal(JSON.stringify(project),snapshot)
})

test('title duplication/deletion affects only the numbered title slide, not the song', () => {
  const project=fixture(), before=visible(project)
  const duplicated=action(project,[1],'duplicate').project
  assert.deepEqual(visible(reopen(duplicated)),[before[0],...before])
  assert.ok(isSongTitleSlide(slides(duplicated)[1]))
  const deleted=action(project,[1],'delete').project
  assert.deepEqual(visible(reopen(deleted)),before.slice(1))
  assert.ok(!isSongTitleSlide(slides(deleted)[0]))
})

test('noncontiguous moves use the final starting number and preserve selection order', () => {
  const project=fixture(), before=visible(project)
  for (const destination of [1,2,4,6]) {
    const result=action(project,[2,6],'move',destination)
    const expected=before.filter((_,index)=>![1,5].includes(index))
    expected.splice(destination-1,0,before[1],before[5])
    assert.deepEqual(visible(reopen(result.project)),expected)
    assert.deepEqual(selectedPlannerSlides(plannerSlides(result.project),result.selectedIds).map(row=>row.number),[destination,destination+1])
  }
})

test('move into a song, then move across its former boundary without changing outputs', () => {
  const project=fixture(), before=visible(project)
  const moved=action(project,[7],'move',3).project
  assert.deepEqual(visible(reopen(moved)),[...before.slice(0,2),before[6],...before.slice(2,6)])
  const again=action(moved,[2,3,4],'move',5).project
  const intermediate=visible(moved), expected=[intermediate[0],...intermediate.slice(4),...intermediate.slice(1,4)]
  assert.deepEqual(visible(reopen(again)),expected)
})

test('singers retain all primary lyrics and follow the next selected slide after a move', () => {
  const project=action(fixture(),[2],'move',6).project, rows=plannerSlides(project), numbered=slides(project)
  const preview=plannerPreview(rows,numbered[5],'media')
  assert.equal(preview.output.blocks.length,1)
  assert.equal(preview.output.blocks[0].text,'Один\nДва\nТри\nЧетыре')
  assert.equal(preview.presetId,'wotbc-song-lyrics')
  assert.deepEqual(plannerPreview(rows,numbered[0],'media').next,{state:'text',text:'Next ru'})
})

test('batch delete removes exactly the chosen slides, including the final lyric', () => {
  const project=fixture(), before=visible(project)
  assert.deepEqual(visible(reopen(action(project,[2,3,4,5],'delete').project)),[before[0],...before.slice(5)])
  const empty=action(project,[1,2,3,4,5,6,7],'delete')
  assert.equal(slides(reopen(empty.project)).length,0)
  assert.equal(empty.activeId,null)
})

test('section operations preserve hierarchy, including empty sections', () => {
  const project=fixture()
  const duplicate=changePlannerSelection(project,['section'],'duplicate')
  assert.equal(duplicate.project.rootItemIds[0],'section')
  const copied=duplicate.project.rootItemIds[1]
  assert.equal(duplicate.project.items[copied].kind,'group')
  assert.equal(selectedPlannerSlides(plannerSlides(duplicate.project),duplicate.selectedIds).length,5)
  assert.equal(slides(duplicate.project).length,12)
  const deleted=changePlannerSelection(project,['section'],'delete')
  assert.deepEqual(deleted.project.rootItemIds,['welcome','closing'])
  let empty=core.addProjectItem(project,{id:'empty',kind:'group',groupKind:'section',title:'Empty',childIds:[]},{index:1})
  const copiedEmpty=changePlannerSelection(empty,['empty'],'duplicate')
  assert.equal(copiedEmpty.project.rootItemIds[1],'empty')
  assert.equal(copiedEmpty.project.rootItemIds[2],copiedEmpty.activeId)
  assert.equal(copiedEmpty.project.items[copiedEmpty.activeId!].title,'Empty')
  assert.equal(slides(copiedEmpty.project).length,7)
})

test('whole-section and nested selections never apply an operation twice', () => {
  const project=fixture()
  const result=changePlannerSelection(project,['section',slides(project)[1].id],'duplicate')
  assert.equal(slides(result.project).length,12)
})

test('bad destinations and stale selections leave the source unchanged', () => {
  const project=fixture(), source=JSON.stringify(project)
  for (const position of [0,-1,1.5,7,NaN,Infinity]) assert.throws(()=>action(project,[1,2],'move',position),/whole slide number/)
  assert.throws(()=>changePlannerSelection(project,['stale'],'delete'),/current service/)
  assert.equal(JSON.stringify(project),source)
})
