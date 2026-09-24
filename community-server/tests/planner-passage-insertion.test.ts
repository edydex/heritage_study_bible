import test from 'node:test'
import assert from 'node:assert/strict'
import core from '../packages/service-core/index.js'
import { createTemplateDraft, insertionPoint } from '../src/components/plannerTemplates'
import { addReadingTitle, preparePlannerPresentation } from '../src/components/plannerPresentation'
import { appendBlankSlide } from '../src/components/plannerReadingGroups'
import { plannerSlides } from '../src/components/plannerSlides'
import { scriptureTranslationScope } from '../src/components/plannerScriptureTranslations'
import { reflowScripture } from '../src/components/plannerScriptureReflow'

function passage(id:string,first:number,last:number) {
  return {id,title:`Ephesians 4:${first}–${last}`,presetId:'wotbc-sermon-scripture',
    range:{bookId:'Ephesians',start:{chapter:4,verse:first},end:{chapter:4,verse:last}},
    passagesByChannel:{english:{translationId:'BSB',reference:`Ephesians 4:${first}–${last}`,attribution:'',
      verses:Array.from({length:last-first+1},(_,i)=>({number:first+i,text:'Sample words remain together in this verse. '.repeat(6)}))}}}
}
function fixture(merge=true) {
  let p=core.createServiceProject({id:'insertion',title:'Passage insertion',serviceDate:'2026-09-24',preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null},channels:[{id:'english',label:'English',language:'en'}]})
  p=createTemplateDraft(p,{id:'title',template:'title',selectedId:null})
  p=core.addBibleItem(p,passage('passage',20,25))
  p=preparePlannerPresentation(p).project
  if(merge)p=reflowScripture(p,p.items.passage.childIds[0],32).project
  return p
}
const rows=(p:any)=>plannerSlides(p).filter(row=>row.cue)

test('new sermon passages and templates insert after the complete page group, without automatic blanks',()=>{
  for(const merged of [false,true]) {
    const p=fixture(merged),page=p.items.passage.childIds[0],owner=p.rootItemIds[0]
    const place=insertionPoint(p,page)
    assert.deepEqual(place,{parentId:owner,index:2})
    assert.deepEqual(insertionPoint(p,page,true),place)
    assert.deepEqual(insertionPoint(p,'passage'),place)
    let next=core.addBibleItem(p,{...passage('earlier-reference',17,18),...place})
    assert.equal(appendBlankSlide(next,'earlier-reference'),next)
    next=preparePlannerPresentation(next).project
    assert.equal(plannerSlides(next).some(row=>row.kind==='group'),false)
    assert.equal(Object.values(next.items).some((item:any)=>item.kind==='blank'),false)
    assert.deepEqual(next.items.passage.childIds,p.items.passage.childIds)
    assert.deepEqual(scriptureTranslationScope(next,page)?.itemIds,p.items.passage.childIds)
    const quote=createTemplateDraft(p,{id:'quote',template:'quote',selectedId:page})
    assert.deepEqual(quote.items[owner].childIds,['title','passage','quote'])
  }
})

test('ordinary readings still exit the sermon and get their closing blank',()=>{
  const p=fixture(),page=p.items.passage.childIds[0]
  let next=core.addBibleItem(p,{...passage('reading',17,18),presetId:'wotbc-reading',...insertionPoint(p,page,false,true)})
  next=appendBlankSlide(addReadingTitle(next,'reading',{english:'BSB'}),'reading-reading')
  next=preparePlannerPresentation(next).project
  assert.equal(next.rootItemIds.at(-1),'reading-reading')
  assert.equal(next.items['reading-reading'].childIds.at(-1),'reading-reading-blank')
})

test('opening an old malformed wrapper repairs nesting without removing or reordering any slides',()=>{
  for(const middle of [false,true]) {
    const p=fixture(!middle),index=middle?1:p.items.passage.childIds.length
    let broken=core.addBibleItem(p,{...passage('earlier-reference',17,18),parentId:'passage',index})
    broken=core.addProjectItem(broken,{id:'earlier-reference-blank',kind:'blank',title:'Blank',channelIds:['english'],presetId:'blank-black'}, {parentId:'passage',index:index+1})
    const before=rows(broken).map(row=>({id:row.itemId,channels:row.cue!.channels}))
    const fixed=preparePlannerPresentation(broken,{paginateItemIds:new Set()})
    assert.equal(fixed.changed,true)
    assert.deepEqual(rows(fixed.project).map(row=>({id:row.itemId,channels:row.cue!.channels})),before)
    assert.equal(plannerSlides(fixed.project).some(row=>row.kind==='group'),false)
    assert.deepEqual(scriptureTranslationScope(fixed.project,'earlier-reference')?.itemIds,['earlier-reference'])
    assert.equal(preparePlannerPresentation(fixed.project,{paginateItemIds:new Set()}).changed,false)
  }
})
