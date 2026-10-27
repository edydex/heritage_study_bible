import test from 'node:test'
import assert from 'node:assert/strict'
import core from '../packages/service-core/index.js'
import {plannerSlides} from '../src/components/plannerSlides'
import {plannerClickSelection,changePlannerSelection} from '../src/components/plannerSelection'
import {scriptureTranslationScope} from '../src/components/plannerScriptureTranslations'
import {reflowScripture} from '../src/components/plannerScriptureReflow'

function fixture(count=2) {
  let p=core.createServiceProject({id:'outline',title:'Outline test',serviceDate:'2026-09-24',preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null},channels:[{id:'english',label:'English',language:'en'}]})
  p=core.addProjectItem(p,{id:'pages',kind:'group',groupKind:'section',title:'John 8:31–32',childIds:[],operatorNotes:''})
  for(let i=0;i<count;i++)p=core.addBibleItem(p,{parentId:'pages',id:`page-${i}`,title:`John 8:${31+i}`,presetId:'wotbc-sermon-scripture',range:{bookId:'John',start:{chapter:8,verse:31+i},end:{chapter:8,verse:31+i}},passagesByChannel:{english:{translationId:'BSB',reference:`John 8:${31+i}`,attribution:'',verses:[{number:31+i,text:'Words for this verse.'}]}}})
  return core.addProjectItem(p,{id:'after',kind:'blank',title:'Next slide',channelIds:['english'],presetId:'blank-black',operatorNotes:''})
}

test('passage pages use the first numbered verse as their outline parent and select together',()=>{
  const p=fixture(),rows=plannerSlides(p)
  assert.equal(rows.length,3)
  assert.equal(rows.some(row=>row.kind==='group'),false)
  assert.deepEqual(rows.map(row=>row.depth),[0,1,0])
  assert.equal(rows[0].scripturePageCount,2)
  assert.deepEqual(plannerClickSelection(rows,rows[0]),rows.slice(0,2).map(row=>row.id))
  assert.deepEqual(plannerClickSelection(rows,rows[0],[],{ctrlKey:true}),[rows[0].id])
  assert.deepEqual(plannerClickSelection(rows,rows[0],[],{metaKey:true}),[rows[0].id])
  const deleted=changePlannerSelection(p,plannerClickSelection(rows,rows[0]),'delete').project
  assert.deepEqual(plannerSlides(deleted).map(row=>row.itemId),['after'])
})

test('a one-page passage has no section decoration and deleting it leaves no empty wrapper',()=>{
  const p=fixture(1),rows=plannerSlides(p)
  assert.equal(rows[0].scripturePageCount,undefined)
  assert.equal(rows[0].depth,0)
  assert.equal(rows[0].number,1)
  const deleted=changePlannerSelection(p,[rows[0].id],'delete').project
  assert.equal(deleted.items.pages,undefined)
  assert.deepEqual(plannerSlides(deleted).map(row=>row.itemId),['after'])
})

test('deleting only the first page promotes the remainder; copied passages retain reflow scope',()=>{
  const p=fixture(),rows=plannerSlides(p)
  const one=changePlannerSelection(p,[rows[0].id],'delete').project
  assert.equal(plannerSlides(one)[0].itemId,'page-1')
  assert.equal(plannerSlides(one)[0].scripturePageCount,undefined)
  const copy=changePlannerSelection(p,plannerClickSelection(rows,rows[0]),'duplicate')
  const copied=plannerSlides(copy.project).find(row=>row.id===copy.activeId)!
  assert.equal(copied.scripturePageCount,2)
  assert.equal(scriptureTranslationScope(copy.project,copied.itemId)!.itemIds.length,2)
  const merged=reflowScripture(copy.project,copied.itemId,63).project
  assert.equal(plannerSlides(merged).filter(row=>row.kind==='bible').length,3)
  assert.equal(plannerSlides(merged).filter(row=>row.scripturePageCount===2).length,1)
})
