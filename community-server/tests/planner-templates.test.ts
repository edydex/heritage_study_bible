import assert from 'node:assert/strict'
import test from 'node:test'
import core from '../packages/service-core/index.js'
import formatting from '../packages/service-core/node/services/project/SlideFormatting.js'
import { createTemplateSlide, insertionPoint } from '../src/components/plannerTemplates.ts'
import { editPlannerSlide, plannerSlides, deletePlannerSlide } from '../src/components/plannerSlides.ts'
import { preparePlannerPresentation } from '../src/components/plannerPresentation.ts'

function project() { return core.createServiceProject({ id:'templates', title:'Sunday', serviceDate:'2026-09-06', preferredProfileId:'main-sanctuary', presetPack:{id:'main-sanctuary',version:1,sha256:null}, channels:[{id:'english',label:'English',language:'en'},{id:'russian',label:'Russian',language:'ru'},{id:'media',label:'Singers',language:'ru'}] }) }
const text = {heading:'Walk in love',body:'Be patient with one another.'}
const image = {id:`sha256:${'a'.repeat(64)}`,sha256:'a'.repeat(64),kind:'image',fileName:'title.jpg',storedName:`${'a'.repeat(64)}.jpg`,mediaType:'image/jpeg',size:1000,width:1920,height:1080,orientation:1,altText:'Sermon title image',attribution:''}

test('templates create actual bilingual slides and insert after selection',()=>{
  let value = core.addProjectItem(project(),{id:'group',kind:'group',title:'Sermon',groupKind:'sermon',childIds:[]})
  value = createTemplateSlide(value,{id:'point',template:'point',english:text,russian:{heading:'Живите в любви',body:'Будьте терпеливы друг ко другу.'},selectedId:'group'})
  value = createTemplateSlide(value,{id:'quote',template:'quote',english:text,russian:{heading:'',body:''},selectedId:'point'})
  assert.deepEqual(value.items.group.childIds,['point','quote'])
  assert.deepEqual(insertionPoint(value,'point'),{parentId:'group',index:1})
  const row = plannerSlides(value).find(row=>row.itemId==='point')!
  assert.equal(row.cue!.channels.russian.blocks[1].text,'Будьте терпеливы друг ко другу.')
  assert.equal(value.items.quote.textByChannel.russian,text.body)
  assert.throws(()=>createTemplateSlide(value,{id:'empty',template:'point',english:{heading:'',body:''},russian:{heading:'',body:''},selectedId:null}),/Enter/)
})

test('title image and editable title survive round-trip and asset cleanup',()=>{
  const value=createTemplateSlide(project(),{id:'title',template:'title',english:text,russian:{heading:'',body:''},selectedId:null,asset:image})
  const reopened=core.normalizeHeritageServiceDocument(JSON.parse(core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({...value,revision:1})))).project
  assert.equal(reopened.items.title.backgroundAssetId,image.id)
  const row=plannerSlides(reopened)[0]
  assert.equal(row.cue!.channels.english.blocks[0].role,'background')
  assert.equal(row.cue!.channels.english.blocks[1].text,`${text.heading}\n\n${text.body}`)
  const pruned=core.pruneUnreachableProjectRecords(reopened,{assetIds:[image.id]})
  assert.ok(pruned.assets[image.id])
  const removed=deletePlannerSlide(reopened,row)
  assert.equal(removed.assets[image.id],undefined)
  assert.throws(()=>createTemplateSlide(project(),{id:'title',template:'title',english:text,russian:text,selectedId:null}),/image/)
})

test('overlapping bold italic underline and color stay disjoint and survive save',()=>{
  let value=createTemplateSlide(project(),{id:'point',template:'point',english:text,russian:text,selectedId:null})
  let spans=formatting.applyTextStyle(text.body,[],0,10,{weight:'700'})
  spans=formatting.applyTextStyle(text.body,spans,3,18,{italic:true,underline:true,foreground:'#ffc000'})
  const row=plannerSlides(value)[0]
  value=editPlannerSlide(value,row,'english',1,text.body,spans)
  const reopened=core.normalizeHeritageServiceDocument(JSON.parse(core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({...value,revision:1})))).project
  assert.deepEqual(reopened.items.point.spansByChannel.english,spans)
  assert.equal(spans[1].weight,'700'); assert.equal(spans[1].italic,true)
  assert.deepEqual(formatting.applyTextStyle(text.body,spans,0,text.body.length,null),[])
  const changed=formatting.remapTextSpans('Be patient','Be very patient',[{start:3,end:10,weight:'700'}])
  assert.deepEqual(changed,[{start:8,end:15,weight:'700'}])
  const replaced=formatting.remapTextSpans('abcdefghij','aXYj',[{start:0,end:4,weight:'700'},{start:4,end:8,italic:true},{start:8,end:10,underline:true}])
  assert.deepEqual(replaced,[{start:0,end:3,weight:'700'},{start:3,end:4,underline:true}])
  assert.deepEqual(formatting.remapTextSpans('abcdefghij','aXYj',[{start:2,end:4,weight:'700'},{start:6,end:8,italic:true}]),[])
})

test('Scripture formatting preserves words and checksums, including repagination',()=>{
  const verses=Array.from({length:6},(_,i)=>({number:i+1,text:`Verse ${i+1} is exact source text.`}))
  let value=core.addBibleItem(project(),{id:'reading',title:'Psalm 18',range:{bookId:'Ps',start:{chapter:18,verse:1},end:{chapter:18,verse:6}},passagesByChannel:{english:{reference:'Psalm 18:1–6',translationId:'BSB',attribution:'',verses}},presetId:'wotbc-sermon-verse'})
  const original=value.items.reading.passagesByChannel.english.contentSha256
  const row=plannerSlides(value)[0], body=formatting.scriptureFlowText(verses)
  value=editPlannerSlide(value,row,'english',0,body,[{start:0,end:body.length,italic:true,underline:true}])
  assert.equal(value.items.reading.passagesByChannel.english.contentSha256,original)
  assert.throws(()=>editPlannerSlide(value,row,'english',0,'Changed source',[]),/pinned/)
  const paged=preparePlannerPresentation(value).project
  for(const item of Object.values(paged.items) as any[]) if(item.kind==='bible') {
    assert.equal(item.presetId,'wotbc-sermon-verse')
    assert.equal(item.passagesByChannel.english.spans[0].end,formatting.scriptureFlowText(item.passagesByChannel.english.verses).length)
  }
})
