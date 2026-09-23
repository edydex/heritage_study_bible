import test from 'node:test'
import assert from 'node:assert/strict'
import core from '../packages/service-core/index.js'
import { createTemplateDraft, insertionPoint } from '../src/components/plannerTemplates'
import { preparePlannerPresentation } from '../src/components/plannerPresentation'
import { groupSermonSections } from '../src/components/plannerSermonSections'
import { plannerSlides } from '../src/components/plannerSlides'
import { changePlannerSelection, plannerClickSelection } from '../src/components/plannerSelection'

function fixture() {
  let p=core.createServiceProject({id:'sermons',title:'Sunday',serviceDate:'2026-09-23',preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null},
    channels:[{id:'english',label:'English',language:'en'},{id:'russian',label:'Russian',language:'ru'}]})
  p=createTemplateDraft(p,{id:'title',template:'title',selectedId:null})
  p=createTemplateDraft(p,{id:'point',template:'point',selectedId:'title'})
  p=core.addBibleItem(p,{id:'sermon-verse',title:'John 8:31',presetId:'wotbc-sermon-scripture',
    range:{bookId:'John',start:{chapter:8,verse:31},end:{chapter:8,verse:31}},
    passagesByChannel:{english:{translationId:'BSB',reference:'John 8:31',attribution:'Credit',verses:[{number:31,text:'Exact verse'}]}}})
  p=core.addProjectItem(p,{id:'blank',kind:'blank',title:'Blank',channelIds:p.channelIds,presetId:'blank-black'})
  return JSON.parse(JSON.stringify(p))
}
const numbered=(p:any)=>plannerSlides(p).filter(row=>row.cue)
const output=(p:any)=>numbered(p).map(row=>({id:row.itemId,channels:row.cue!.channels}))
function reading(p:any) {
  return core.addProjectItem(p,{...p.items['sermon-verse'],id:'regular-reading',presetId:'wotbc-reading'})
}

test('title is the sermon parent; points, sermon Scripture and blank belong until normal reading',()=>{
  let p=reading(fixture())
  p=createTemplateDraft(p,{id:'outside-quote',template:'quote',selectedId:'regular-reading'})
  const before=numbered(p).map(row=>row.itemId), fixed=preparePlannerPresentation(p).project
  assert.deepEqual(numbered(fixed).map(row=>row.itemId),before)
  const rows=plannerSlides(fixed), title=rows[0]
  assert.equal(title.sermonTitle,true)
  assert.equal(title.depth,0)
  assert.deepEqual(plannerClickSelection(rows,title),rows.slice(0,4).map(row=>row.id))
  assert.ok(rows.slice(1,4).every(row=>row.depth===1))
  assert.equal(rows[4].depth,0)
  assert.deepEqual(numbered(changePlannerSelection(fixed,plannerClickSelection(rows,title),'delete').project).map(row=>row.itemId),['regular-reading','outside-quote'])
  const only=changePlannerSelection(fixed,plannerClickSelection(rows,title,[],{ctrlKey:true}),'delete').project
  assert.deepEqual(numbered(only).map(row=>row.itemId),before.slice(1))
  assert.equal(preparePlannerPresentation(fixed).changed,false)
})

test('another title starts a second sermon; duplicate and move retain complete sections',()=>{
  let p=createTemplateDraft(fixture(),{id:'second-title',template:'title',selectedId:'blank'})
  p=createTemplateDraft(p,{id:'second-point',template:'point',selectedId:'second-title'})
  p=preparePlannerPresentation(p).project
  assert.equal(p.rootItemIds.length,2)
  const rows=plannerSlides(p), first=rows[0], second=rows[4]
  assert.equal(second.sermonTitle,true)
  const ids=plannerClickSelection(rows,first)
  assert.equal(ids.length,4)
  const duplicate=changePlannerSelection(p,ids,'duplicate').project
  assert.equal(numbered(duplicate).length,10)
  const moved=changePlannerSelection(p,ids,'move',3).project
  assert.deepEqual(numbered(moved).map(row=>row.itemId),['second-title','second-point','title','point','sermon-verse','blank'])
})

test('adding a regular reading or song exits a sermon, while a sermon slide stays inside',()=>{
  const p=preparePlannerPresentation(fixture()).project, owner=p.rootItemIds[0]
  assert.deepEqual(insertionPoint(p,'point'),{parentId:owner,index:2})
  assert.deepEqual(insertionPoint(p,'point',false,true),{parentId:null,index:1})
  assert.deepEqual(insertionPoint(p,'title',false,true),{parentId:null,index:1})
})

test('a reading moved inside a sermon ends it; following slides retain order outside',()=>{
  const p=JSON.parse(JSON.stringify(preparePlannerPresentation(reading(fixture())).project))
  const group=p.items[p.rootItemIds[0]]
  p.rootItemIds.pop()
  group.childIds.splice(2,0,'regular-reading')
  const before=numbered(p).map(row=>row.itemId)
  assert.equal(groupSermonSections(p),true)
  assert.deepEqual(numbered(p).map(row=>row.itemId),before)
  assert.deepEqual(group.childIds,['title','point'])
  assert.deepEqual(p.rootItemIds.slice(1),['regular-reading','sermon-verse','blank'])
  assert.equal(groupSermonSections(p),false)
})

test('song and its trailing blank end the sermon without capturing the next quote',()=>{
  const p=fixture()
  const resource=core.addSongResource(p,core.parseSongDocument('---\nid: example\ntitle: Example\nlanguage: en\n---\n\n^1\nOriginal test words',{fileName:'song.md'}))
  let next=core.addProjectItem(resource.project,{id:'song',kind:'song',title:'Example',primaryChannelId:'english',
    variants:{english:{mode:'content',resourceId:resource.resourceId},russian:{mode:'inherit',from:'english'}},arrangement:[{id:'first',sectionId:'verse-1'}]})
  next=createTemplateDraft(next,{id:'after-song',template:'quote',selectedId:'song'})
  const fixed=preparePlannerPresentation(next).project
  assert.deepEqual(fixed.rootItemIds,['title-sermon','song','after-song'])
})
