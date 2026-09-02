import assert from 'node:assert/strict'
import test from 'node:test'
import core from '../packages/service-core/index.js'
import formatting from '../packages/service-core/node/services/project/SlideFormatting.js'
import { createTemplateSlide, createTemplateDraft, editTemplateField, insertionPoint, nextPointPrefix } from '../src/components/plannerTemplates.ts'
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

const reopen = (value: any) => core.normalizeHeritageServiceDocument(JSON.parse(core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({...value,revision:1})))).project
const blocks = (value: any, id: string, channel = 'english') => plannerSlides(value).find(row => row.itemId === id)!.cue!.channels[channel].blocks

test('on-slide title drafts default to an undimmed picture with no projected guides', () => {
  let value = createTemplateDraft(project(), {id:'title',template:'title',selectedId:null})
  assert.deepEqual(value.items.title.sermonPresentation,{showText:false,darkenBackground:false})
  assert.deepEqual(blocks(value,'title'),[])
  value = JSON.parse(JSON.stringify(value))
  value.assets[image.id] = image; value.items.title.backgroundAssetId = image.id
  value = reopen(value)
  assert.deepEqual(blocks(value,'title').map((block:any) => [block.type,block.dimOpacity]),[['image',0]])
  value = editTemplateField(value,'title','english','heading','Walk in unity')
  value = editTemplateField(value,'title','english','body','Ephesians 4:1–6')
  assert.equal(blocks(value,'title').length,1,'Hidden text remains stored but is not projected')
  value = JSON.parse(JSON.stringify(value))
  value.items.title.sermonPresentation = {showText:true,darkenBackground:true}
  value = reopen(value)
  const output = blocks(value,'title')
  assert.equal(output[0].dimOpacity,0.55)
  assert.equal(output[1].text,'Walk in unity\n\nEphesians 4:1–6')
  assert.equal(output[1].spans[0].fontScale,0.65)
  assert.equal(blocks(value,'title','russian').filter((block:any) => block.type==='text').length,0,'No invented translation')
  assert.throws(()=>reopen({...value,items:{...value.items,title:{...value.items.title,sermonPresentation:{showText:'yes',darkenBackground:false}}}}),/visibility/)
  assert.throws(()=>reopen({...value,items:{...value.items,title:{...value.items.title,sermonTemplate:'unknown'}}}),/template/)
})

test('new main points copy the preceding outline and emphasis, not later verses or other sermons', () => {
  let value = core.addProjectItem(project(),{id:'sermon',kind:'group',title:'Sermon',groupKind:'sermon',childIds:[]})
  value = createTemplateSlide(value,{id:'one',template:'point',selectedId:'sermon',english:{heading:'Unity',body:'I. Be patient'},russian:{heading:'Единство',body:'I. Будьте терпеливы'}})
  value = JSON.parse(JSON.stringify(value))
  value.items.one.spansByChannel = {english:[{start:3,end:13,weight:'700'}]}
  value = createTemplateSlide(value,{id:'future',template:'point',selectedId:'one',english:{heading:'Unity',body:'I. Be patient\nII. Love'},russian:{heading:'Единство',body:'I. Будьте терпеливы\nII. Любите'}})
  value = createTemplateDraft(value,{id:'two',template:'point',selectedId:'one'})
  assert.equal(value.items.two.textByChannel.english,'I. Be patient')
  assert.deepEqual(value.items.two.spansByChannel.english,value.items.one.spansByChannel.english)
  assert.equal(value.items.two.titlesByChannel.russian,'Единство')
  assert.equal(nextPointPrefix(value.items.two.textByChannel.english),'II. ')
  assert.ok(!JSON.stringify(blocks(value,'two')).includes('Add next point'))
  value = JSON.parse(JSON.stringify(value)); value.channels.media.language = 'und'
  value = editTemplateField(value,'two','english','next','Bear with one another',[{start:0,end:4,underline:true}])
  assert.equal(value.items.two.textByChannel.english,'I. Be patient\nII. Bear with one another')
  assert.equal(value.items.two.spansByChannel.english[1].start,18)
  assert.deepEqual(value.items.two.pendingPointChannels,['russian','media'])
  value = editTemplateField(value,'two','russian','next','II. Снисходите друг ко другу')
  assert.equal(value.items.two.textByChannel.media,value.items.two.textByChannel.russian)
  assert.deepEqual(reopen(value).items.two.pendingPointChannels,[])
  value = createTemplateDraft(value,{id:'new-title',template:'title',selectedId:'two'})
  value = createTemplateDraft(value,{id:'reset',template:'point',selectedId:'new-title'})
  assert.equal(value.items.reset.textByChannel.english,'')
  value = core.addProjectItem(value,{id:'other',kind:'group',title:'Other sermon',groupKind:'sermon',childIds:[]})
  value = createTemplateDraft(value,{id:'separate',template:'point',selectedId:'other'})
  assert.equal(value.items.separate.textByChannel.english,'')
})

test('empty quote fields save without guides and legacy titles retain their old appearance', () => {
  let value = createTemplateDraft(project(),{id:'quote',template:'quote',selectedId:null})
  assert.deepEqual(blocks(reopen(value),'quote'),[])
  value = editTemplateField(value,'quote','russian','body','Любите друг друга')
  assert.equal(blocks(reopen(value),'quote','media')[0].text,'Любите друг друга')
  const old = createTemplateSlide(project(),{id:'old',template:'title',english:text,russian:text,selectedId:null,asset:image})
  assert.equal(blocks(old,'old')[0].dimOpacity,undefined,'Default renderer still dims legacy backgrounds')
  assert.equal(blocks(old,'old')[1].text,text.heading+'\n\n'+text.body)
  assert.equal(nextPointPrefix('1. First\n2. Second'),'3. ')
  assert.equal(nextPointPrefix('VIII. Eighth'),'IX. ')
  assert.throws(()=>core.addProjectItem(project(),{id:'empty',kind:'sermon',title:'Legacy',textByChannel:{english:''},presetId:'wotbc-sermon'}),/required/)
})
