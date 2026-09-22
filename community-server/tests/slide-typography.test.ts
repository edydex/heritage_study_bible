import assert from 'node:assert/strict'
import test from 'node:test'
import core from '../packages/service-core/index.js'
import typography from '../packages/service-core/node/services/project/SlideTypography.js'
import {createTemplateDraft,editTemplateField} from '../src/components/plannerTemplates.ts'
import {addReadingTitle,preparePlannerPresentation} from '../src/components/plannerPresentation.ts'
import {typographyItemIds} from '../src/components/plannerTypography.ts'
import {setReadingTemplate} from '../src/components/readingTemplates.ts'

const project=()=>core.createServiceProject({id:'typography',title:'Sunday',serviceDate:'2026-09-22',preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null},channels:[{id:'english',label:'English',language:'en'},{id:'russian',label:'Russian',language:'ru'}]})
const reopen=(p:any)=>core.parseHeritageServiceDocumentSource(core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({...p,revision:1}))).project

test('one minimal line-fitting size is used across the entire bilingual song',()=>{
  let line='Мы славим Тебя'
  while(typography.textWidth(line,106,'600')<2390)line+=' и'
  const make=(id:string,text:string)=>core.parseSongDocument(`---\nid: ${id}\ntitle: Praise\nlanguage: en\n---\n^1\n${text}\n\n^2\nShort line`,{fileName:`${id}.md`})
  let p=project();const pinned=core.addSongResource(p,make('praise',line));p=core.addProjectItem(pinned.project,{id:'song',kind:'song',title:'Praise',lyricsPresetId:'wotbc-song-lyrics',primaryChannelId:'english',variants:{english:{mode:'content',resourceId:pinned.resourceId},russian:{mode:'inherit',from:'english'}},arrangement:[{id:'one',sectionId:'verse-1'},{id:'two',sectionId:'verse-2'}]})
  const timeline=core.compileServiceProject(reopen(p));const cues=Object.values(timeline.cues).filter((c:any)=>c.presetId==='wotbc-song-lyrics') as any[]
  assert.equal(cues.length,2);assert.equal(new Set(cues.map(c=>c.textStyle.bodySize)).size,1)
  const size=cues[0].textStyle.bodySize,width=1920*typography.textPreset(cues[0].presetId).bodyWidthPercent/100
  assert.ok(size<106 && size>=80);assert.ok(typography.textWidth(line,size,'600')<=width)
  assert.ok(typography.textWidth(line,size+1,'600')>width,'No unnecessary reduction')
})

test('short final reading page retains the same font as full pages through save and reload',()=>{
  let p=core.addBibleItem(project(),{id:'reading',title:'Psalm 119',range:{bookId:'Ps',start:{chapter:119,verse:162},end:{chapter:119,verse:175}},passagesByChannel:{english:{reference:'Psalm 119:162–175',translationId:'BSB',verses:Array.from({length:14},(_,i)=>({number:162+i,text:'Your word is truth, and I rejoice in your promises. '.repeat(i===0?4:2)}))}},presetId:'wotbc-reading'})
  p=reopen(preparePlannerPresentation(p).project)
  const rows=Object.values(core.compileServiceProject(p).cues).filter((c:any)=>c.kind==='bible') as any[]
  assert.ok(rows.length>1);assert.equal(new Set(rows.map(c=>c.textStyle.bodySize)).size,1);assert.equal(rows[0].textStyle.bodySize,85)
  p=JSON.parse(JSON.stringify(p))
  for(const item of Object.values(p.items) as any[])if(item.kind==='bible')item.textStyle={bodySize:32,bodyAlign:'right'}
  const small=Object.values(core.compileServiceProject(reopen(p)).cues).filter((c:any)=>c.kind==='bible') as any[]
  assert.ok(small.every(c=>c.textStyle.bodySize===32 && c.textStyle.bodyAlign==='right'))
})

test('quote inherits preceding hidden title and explicit heading remains independent',()=>{
  let p=createTemplateDraft(project(),{id:'title',template:'title',selectedId:null})
  p=editTemplateField(p,'title','english','heading','From Lies to Truth')
  p=createTemplateDraft(p,{id:'quote',template:'quote',selectedId:'title'})
  const quote=Object.values(core.compileServiceProject(reopen(p)).cues).find((c:any)=>c.itemId==='quote') as any
  assert.equal(quote.channels.english.blocks.find((b:any)=>b.role==='title').text,'From Lies to Truth')
  p=editTemplateField(p,'quote','english','heading','Another heading')
  const overridden=Object.values(core.compileServiceProject(reopen(p)).cues).find((c:any)=>c.itemId==='quote') as any
  assert.equal(overridden.channels.english.blocks.find((b:any)=>b.role==='title').text,'Another heading')
})

test('pre-sermon reading title is editable, reversible and survives shared serialization',()=>{
  let p=core.addBibleItem(project(),{id:'reading',title:'Ephesians 4',range:{bookId:'Eph',start:{chapter:4,verse:17},end:{chapter:4,verse:18}},passagesByChannel:{english:{reference:'Ephesians 4:17–18',translationId:'BSB',verses:[{number:17,text:'First verse.'},{number:18,text:'Second verse.'}]}},presetId:'wotbc-reading'})
  p=addReadingTitle(p,'reading',{english:'Berean Standard Bible'});const title=Object.values(p.items).find((i:any)=>i.presetId==='wotbc-reading-title') as any
  p=reopen(setReadingTemplate(p,title.id,'pre-sermon'))
  assert.equal(p.items[title.id].sermonTemplate,'other');assert.equal(p.items[title.id].objectsByChannel.english[0].fontSize,117)
  assert.ok(p.items[title.id].objectsByChannel.english.every((o:any)=>o.align==='left'))
  const reverted=reopen(setReadingTemplate(p,title.id,'centered'))
  assert.equal(reverted.items[title.id].kind,'notice');assert.equal(reverted.items[title.id].textByChannel.english,title.textByChannel.english)
})

test('text preferences reject arbitrary properties and invalid values',()=>{
  assert.throws(()=>typography.normalizeTextStyle({bodySize:NaN}));assert.throws(()=>typography.normalizeTextStyle({bodyAlign:'justify'}));assert.throws(()=>typography.normalizeTextStyle({backgroundUrl:'https://example.test'}))
})

 test('reading typography targets matching pages in its group only',()=>{
 const p={items:{group:{kind:'group',childIds:['one','two','sermon','song']},one:{kind:'bible',presetId:'wotbc-reading'},two:{kind:'bible',presetId:'wotbc-reading'},sermon:{kind:'bible',presetId:'wotbc-sermon-scripture'},song:{kind:'song'}}}
 assert.deepEqual(typographyItemIds(p,'one'),['one','two'])
 assert.deepEqual(typographyItemIds(p,'song'),['song'])
 })

test('minimum song font remains valid when a long authored line must wrap',()=>{
 const p={items:{song:{id:'song',textStyle:{bodySize:32}}}}
 const cues={one:{itemId:'song',kind:'song',presetId:'wotbc-song-lyrics',channels:{english:{mode:'content',blocks:[{type:'text',role:'lyrics',text:'A '.repeat(150)}]}}}} as any
 typography.applyTimelineTypography(p,cues,{groupPathByItemId:{}})
 assert.equal(cues.one.textStyle.bodySize,32)
 assert.doesNotThrow(()=>typography.normalizeTextStyle(cues.one.textStyle))
})

test('opening an existing reading keeps its authored page boundaries',()=>{
 const p=core.addBibleItem(project(),{id:'saved-page',title:'Psalm 119',range:{bookId:'Ps',start:{chapter:119,verse:1},end:{chapter:119,verse:14}},passagesByChannel:{english:{reference:'Psalm 119:1–14',translationId:'BSB',verses:Array.from({length:14},(_,i)=>({number:i+1,text:'Your word is truth. '.repeat(10)}))}},presetId:'wotbc-reading'})
 const reopened=preparePlannerPresentation(p,{paginateItemIds:new Set()})
 assert.equal(reopened.changed,false)
 assert.equal(reopened.project,p)
 const added=preparePlannerPresentation(p,{paginateItemIds:new Set(['saved-page'])})
 assert.ok(added.readingsSplit>0)
})
