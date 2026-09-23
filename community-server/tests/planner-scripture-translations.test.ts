import test from 'node:test'
import assert from 'node:assert/strict'
import core from '../packages/service-core/index.js'
import { addReadingTitle, preparePlannerPresentation } from '../src/components/plannerPresentation'
import { appendBlankSlide } from '../src/components/plannerReadingGroups'
import { setReadingTemplate } from '../src/components/readingTemplates'
import { scriptureTranslationScope, scriptureTranslationRequest, hasScriptureEdits, replaceScriptureTranslation } from '../src/components/plannerScriptureTranslations'
import { plannerSlides } from '../src/components/plannerSlides'

function fixture(sermon = false) {
  let project = core.createServiceProject({id:'translations',title:'Sunday',serviceDate:'2026-09-23',preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null},
    channels:[{id:'english',label:'English',language:'en'},{id:'russian',label:'Russian',language:'ru'},{id:'media',label:'Stage',language:'ru'}]})
  project = core.addBibleItem(project,{id:'passage',title:'John 8:31-32,44 · BSB / SYNO-W',
    range:{bookId:'John',start:{chapter:8,verse:31},end:{chapter:8,verse:44}},verseNumbers:[31,32,44],
    passagesByChannel:Object.fromEntries(['english','russian','media'].map(channel=>[channel,{
      translationId:channel==='english'?'BSB':'SYNO-W',reference:'John 8:31-32,44',attribution:'Original credit',
      verses:[31,32,44].map(number=>({number,text:`${channel} verse ${number}`}))}])),presetId:sermon?'wotbc-sermon-scripture':'wotbc-reading'})
  if (!sermon) project = appendBlankSlide(addReadingTitle(project,'passage',{english:'Berean Standard Bible',russian:'Synodal'}),'passage-reading')
  return preparePlannerPresentation(project).project
}
const source = {translationId:'LSB', reference:'John 8:31-32,44',attribution:'Required source credit',
  verses:[31,32,44].map(number=>({number,text:`New wording ${number}`}))}
function change(p:any, selected='passage', channel:'english'|'russian'='english') {
  return replaceScriptureTranslation(p,scriptureTranslationScope(p,selected)!,
    {channel,translationId:'LSB',translationName:'Legacy Standard Bible',passage:source,sourceUrl:'https://source.example/John/8'})
}
const reopen = (p:any)=>core.parseHeritageServiceDocumentSource(core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({...p,revision:1}))).project

test('reading translation keeps noncontiguous verses, other output, cues, styles and blank',()=>{
  const p=JSON.parse(JSON.stringify(fixture()))
  p.items.passage.textStyle={bodySize:90,bodyAlign:'left'}
  p.items.passage.translationCues={self:'start'}
  p.items.passage.passagesByChannel.english.displayText='Authored excerpt…'
  const scope=scriptureTranslationScope(p,'passage-title')!
  assert.equal(hasScriptureEdits(p,scope,'english'),true)
  assert.equal(hasScriptureEdits(p,scope,'russian'),false)
  assert.deepEqual(scriptureTranslationRequest(p,scope,'LSB').verseNumbers,[31,32,44])
  const changed=reopen(change(p,'passage-title'))
  assert.deepEqual(changed.items.passage.passagesByChannel.russian,p.items.passage.passagesByChannel.russian)
  assert.deepEqual(changed.items.passage.passagesByChannel.media,p.items.passage.passagesByChannel.media)
  assert.deepEqual(changed.items.passage.textStyle,p.items.passage.textStyle)
  assert.equal(changed.items.passage.translationCues.self,'start')
  assert.deepEqual(changed.items.passage.verseNumbers,[31,32,44])
  assert.equal(changed.items.passage.passagesByChannel.english.displayText,undefined)
  assert.equal(changed.items.passage.passagesByChannel.english.attribution,source.attribution)
  assert.match(changed.items['passage-title'].textByChannel.english,/Legacy Standard Bible/)
  assert.equal(changed.items['passage-reading'].childIds.at(-1),'passage-reading-blank')
  assert.equal(p.items.passage.passagesByChannel.english.displayText,'Authored excerpt…')
})

test('Russian changes stage too, including pre-sermon edition field; topic and image layout survive',()=>{
  const p=setReadingTemplate(fixture(),'passage-title','pre-sermon')
  const changed=change(p,'passage-title','russian')
  assert.deepEqual(changed.items.passage.passagesByChannel.english,p.items.passage.passagesByChannel.english)
  for (const output of ['russian','media']) {
    assert.equal(changed.items.passage.passagesByChannel[output].translationId,'LSB')
    const objects=changed.items['passage-title'].objectsByChannel[output]
    assert.equal(objects.find((o:any)=>o.id==='reading-edition').text,'Legacy Standard Bible')
    assert.deepEqual(objects.find((o:any)=>o.id==='reading-topic'),p.items['passage-title'].objectsByChannel[output].find((o:any)=>o.id==='reading-topic'))
  }
})

test('separate sermon references sharing a group do not change together',()=>{
  let p=fixture(true)
  p=core.addProjectItem(p,{id:'sermon',kind:'group',groupKind:'sermon',title:'Sermon',childIds:[]})
  p=core.moveProjectItem(p,{itemId:'passage',targetParentId:'sermon',targetIndex:0})
  p=core.duplicateProjectItem(p,{itemId:'passage',targetParentId:'sermon',targetIndex:1,randomUUID:()=> 'other-passage'})
  const other=p.items.sermon.childIds[1]
  assert.deepEqual(scriptureTranslationScope(p,'passage')!.itemIds,['passage'])
  const changed=change(p)
  assert.deepEqual(changed.items[other],p.items[other])
  assert.equal(changed.items.passage.presetId,'wotbc-sermon-scripture')
})

test('split sermon passage updates all its pages and keeps authored page boundaries',()=>{
  let p=JSON.parse(JSON.stringify(fixture(true)))
  const base=p.items.passage
  delete base.verseNumbers
  for (const passage of Object.values(base.passagesByChannel) as any[]) { delete passage.contentSha256; passage.verses=[31,32,44].map(number=>({number,text:'A very long verse '.repeat(80)})) }
  p=preparePlannerPresentation(core.normalizeServiceProject(p)).project
  const pages=plannerSlides(p).filter(row=>row.kind==='bible')
  assert.ok(pages.length>1)
  assert.deepEqual(scriptureTranslationScope(p,pages[0].itemId)!.itemIds,pages.map(row=>row.itemId))
  const changed=change(p,pages[0].itemId)
  for (const page of pages) {
    assert.deepEqual(changed.items[page.itemId].range,p.items[page.itemId].range)
    assert.equal(changed.items[page.itemId].passagesByChannel.english.translationId,'LSB')
  }
})

test('wrong or incomplete source leaves original plan untouched',()=>{
  const p=fixture(), snapshot=JSON.stringify(p), scope=scriptureTranslationScope(p,'passage')!
  for (const passage of [{...source,translationId:'WRONG'},{...source,verses:source.verses.slice(0,2)}]) {
    assert.throws(()=>replaceScriptureTranslation(p,scope,{channel:'english',translationId:'LSB',translationName:'LSB',passage,sourceUrl:'https://example.com'}),/Nothing was changed/)
    assert.equal(JSON.stringify(p),snapshot)
  }
})
