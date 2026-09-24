import test from 'node:test'
import assert from 'node:assert/strict'
import core from '../packages/service-core/index.js'
import { preparePlannerPresentation,addReadingTitle,scripturePages } from '../src/components/plannerPresentation'
import { appendBlankSlide } from '../src/components/plannerReadingGroups'
import { reflowScripture } from '../src/components/plannerScriptureReflow'
import { scriptureTranslationScope } from '../src/components/plannerScriptureTranslations'
import { createTemplateDraft } from '../src/components/plannerTemplates'
import { withinSermon } from '../src/components/plannerSermonSections'
import { plannerSlides } from '../src/components/plannerSlides'
import formatting from '../packages/service-core/node/services/project/SlideFormatting.js'

function fixture(reading=false) {
  let p=core.createServiceProject({id:'reflow',title:'Reflow rehearsal',serviceDate:'2026-09-24',preferredProfileId:'main-sanctuary',
    presetPack:{id:'main-sanctuary',version:1,sha256:null},channels:[{id:'english',label:'English',language:'en'},{id:'russian',label:'Russian',language:'ru'},{id:'media',label:'Stage',language:'ru'}]})
  p=createTemplateDraft(p,{id:'title',template:'title',selectedId:null})
  p=core.addBibleItem(p,{id:'passage',title:'Ephesians 4:20–26',range:{bookId:'Ephesians',start:{chapter:4,verse:20},end:{chapter:4,verse:26}},
    presetId:reading?'wotbc-reading':'wotbc-sermon-scripture',passagesByChannel:Object.fromEntries(['english','russian','media'].map(channel=>[channel,{
      translationId:channel==='english'?'BSB':'SYNO-W',reference:'Ephesians 4:20–26',attribution:'',
      verses:Array.from({length:7},(_,i)=>({number:20+i,text:(channel==='english'?'Exact test wording stays preserved. ':'Точный русский текст сохраняется. ').repeat(7)}))}]))})
  if(reading)p=appendBlankSlide(addReadingTitle(p,'passage',{english:'BSB',russian:'Synodal'}),'passage-reading')
  return preparePlannerPresentation(p).project
}
const bible=(p:any)=>plannerSlides(p).filter(row=>row.kind==='bible').map(row=>p.items[row.itemId])
const reopen=(p:any)=>core.parseHeritageServiceDocumentSource(core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({...p,revision:1}))).project

test('smaller size pulls whole verses backward; leftover verse remains, increasing size splits again',()=>{
  const p=fixture(),old=bible(p),oldWords=old.flatMap(item=>item.passagesByChannel.english.verses)
  const result=reflowScripture(p,old.at(-1).id,63),next=reopen(result.project),pages=bible(next)
  assert.ok(pages[0].passagesByChannel.english.verses.length>old[0].passagesByChannel.english.verses.length)
  assert.ok(pages.length>1,'sample needs overflow so partial backfill is exercised')
  assert.deepEqual(pages.flatMap(item=>item.passagesByChannel.english.verses),oldWords)
  for(const page of pages) {
    assert.equal(page.textStyle.bodySize,63)
    assert.deepEqual(page.passagesByChannel.russian.verses.map((v:any)=>v.number),page.passagesByChannel.english.verses.map((v:any)=>v.number))
  }
  assert.ok(next.items[result.selectedId].passagesByChannel.english.verses.some((v:any)=>v.number===26))
  const again=reflowScripture(next,result.selectedId,100).project
  assert.ok(bible(again).length>pages.length)
  assert.deepEqual(bible(again).flatMap(item=>item.passagesByChannel.english.verses),oldWords)
  assert.deepEqual(reflowScripture(next,result.selectedId,63).project,next)
})

test('reading title and automatic blank survive reflow, one page can split again',()=>{
  const p=fixture(true),first=bible(p)[0]
  const small=reflowScripture(p,first.id,32).project
  assert.equal(bible(small).length,1)
  const id=bible(small)[0].id
  const large=reflowScripture(small,id,100).project
  assert.ok(bible(large).length>1)
  assert.equal(large.items['passage-reading'].childIds[0],'passage-title')
  assert.equal(large.items['passage-reading'].childIds.at(-1),'passage-reading-blank')
  assert.equal(scriptureTranslationScope(large,bible(large)[0].id)!.itemIds.length,bible(large).length)
})

test('formatting spans follow their exact source words through merging and splitting',()=>{
  const p=JSON.parse(JSON.stringify(fixture())),old=bible(p),last=old.at(-1)
  last.passagesByChannel.english.spans=[{start:3,end:13,weight:'700'}]
  const marked=formatting.scriptureFlowText(last.passagesByChannel.english.verses).slice(3,13)
  const next=reflowScripture(p,last.id,32).project
  const spans=bible(next).flatMap(item=>{const passage=item.passagesByChannel.english;return (passage.spans||[]).map((s:any)=>formatting.scriptureFlowText(passage.verses).slice(s.start,s.end))})
  assert.deepEqual(spans,[marked])
  assert.equal(bible(next).length,1)
  assert.equal(reopen(next).items[bible(next)[0].id].passagesByChannel.english.contentSha256.length,64)
})

test('edited excerpts and cue boundaries retain their words and instructions',()=>{
  const p=JSON.parse(JSON.stringify(fixture())),old=bible(p),last=old.at(-1)
  last.passagesByChannel.english.displayText='... selected words [context]'
  old[1].translationCues={self:'start'}
  const next=reflowScripture(p,old[0].id,32)
  assert.equal(next.protectedPages,1)
  assert.equal(next.project.items[last.id].passagesByChannel.english.displayText,'... selected words [context]')
  assert.equal(next.project.items[old[1].id].translationCues.self,'start')
  assert.equal(bible(next.project)[0].range.end.verse,old[0].range.end.verse)
})

test('a standalone sermon passage gains a pagination family, other references keep their sizes',()=>{
  const p=JSON.parse(JSON.stringify(fixture())),first=bible(p)[0]
  const small=JSON.parse(JSON.stringify(reflowScripture(p,first.id,32).project)),only=bible(small)[0]
  // Remove only the automatic page wrapper to exercise an initially single slide.
  const owner=Object.values(small.items).find((i:any)=>i.kind==='group'&&i.childIds.includes(only.id)) as any
  const sermon=Object.values(small.items).find((i:any)=>i.kind==='group'&&i.groupKind==='sermon') as any
  sermon.childIds.splice(sermon.childIds.indexOf(owner.id),1,only.id);delete small.items[owner.id]
  const other=core.addProjectItem(small,{...only,id:'another',textStyle:{bodySize:110}}, {parentId:sermon.id})
  const result=reflowScripture(other,only.id,100),pages=scriptureTranslationScope(result.project,result.selectedId)!.itemIds
  assert.ok(pages.length>1)
  assert.equal(result.project.items.another.textStyle.bodySize,110)
  assert.equal(withinSermon(result.project,result.selectedId),true)
  assert.equal(withinSermon(fixture(true),'passage-title'),false)
})
