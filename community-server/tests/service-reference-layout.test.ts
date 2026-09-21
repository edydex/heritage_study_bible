import assert from 'node:assert/strict'
import test from 'node:test'
import core from '../packages/service-core/index.js'
import { addReadingTitle, preparePlannerPresentation } from '../src/components/plannerPresentation.ts'
import { parsePlannerLibrarySongDocument } from '../src/components/serviceDocumentPlannerModel.ts'
import { songDocumentBody } from '../src/lib/songSourceSyntax.ts'
import { synthesizeLegacySyncDocuments } from '../src/lib/syncShowProtocol.ts'
import { createTemplateSlide } from '../src/components/plannerTemplates.ts'
import { plannerSlides, deletePlannerSlide, editPlannerSlide } from '../src/components/plannerSlides.ts'
import {prepareSongSyncFields} from '../src/lib/syncShowSongHooks.ts'
import formatting from '../packages/service-core/node/services/project/SlideFormatting.js'
const project=()=>core.createServiceProject({id:'reference',title:'Reference',serviceDate:'2026-09-20',preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null},channels:[{id:'english',label:'English',language:'en'},{id:'russian',label:'Russian',language:'ru'},{id:'media',label:'Stage',language:'ru'}]})
const passage={translationId:'BSB',reference:'Ephesians 4:25',verses:[{number:25,text:'Therefore each of you must put off falsehood and speak truthfully to his neighbor.'}],attribution:'Berean Standard Bible'}
const range={bookId:'Eph',start:{chapter:4,verse:25},end:{chapter:4,verse:25}}
const addPassage=(p:any,id='reading',presetId='wotbc-reading',parentId?:string)=>core.addBibleItem(p,{id,title:'Reading',presetId,range,passagesByChannel:{english:passage,russian:{...passage,translationId:'SYNO',reference:'Ефесянам 4:25'}},parentId})

test('reading has one title before exact flowing Scripture, including a one-page reading',()=>{
 let p=addReadingTitle(addPassage(project()),'reading',{english:'Berean Standard Bible',russian:'Синодальный перевод'})
 p=preparePlannerPresentation(p).project
 const rows=plannerSlides(p).filter(row=>row.cue)
 assert.equal(rows.length,2)
 assert.equal(rows[0].cue!.presetId,'wotbc-reading-title')
 assert.equal(rows[0].cue!.channels.russian.blocks[0].text,'Ефесянам 4:25\nСинодальный перевод')
 assert.deepEqual(rows[1].cue!.channels.english.blocks[0].verses,passage.verses)
 assert.equal(preparePlannerPresentation(p).changed,false)
})

test('sermon passage follows current title then latest point/subpoint per output and scope',()=>{
 let p=core.addProjectItem(project(),{id:'sermon',kind:'group',groupKind:'sermon',title:'Sermon',childIds:[]})
 p=core.addProjectItem(p,{id:'title',kind:'sermon',sermonTemplate:'title',title:'Truth',titlesByChannel:{english:'From lies to truth',russian:'От лжи к истине'},textByChannel:{english:'',russian:''},presetId:'wotbc-sermon-title'},{parentId:'sermon'})
 p=addPassage(p,'first','wotbc-sermon-scripture','sermon')
 p=core.addProjectItem(p,{id:'point',kind:'sermon',sermonTemplate:'point',title:'Point',titlesByChannel:{english:'Truth',russian:'Истина'},textByChannel:{english:'I. Therefore\n  a. Remember',russian:'I. Поэтому\n  а. Помните'},presetId:'wotbc-sermon'},{parentId:'sermon'})
 p=addPassage(p,'second','wotbc-sermon-scripture','sermon')
 p=addPassage(p,'outside','wotbc-sermon-scripture')
 const rows=plannerSlides(p)
 assert.equal(rows.find(row=>row.itemId==='first')!.cue!.channels.english.blocks[0].text,'From lies to truth')
 const row=rows.find(row=>row.itemId==='second')!
 assert.equal(row.cue!.channels.russian.blocks[0].text,'а. Помните')
 assert.equal(rows.find(row=>row.itemId==='outside')!.cue!.channels.english.blocks[0].type,'bible')
 const block=row.cue!.channels.english.blocks[1], display=formatting.scriptureDisplay(block,row.cue!.presetId)
 assert.ok(display.text.startsWith('Ephesians 4:25 Therefore'))
 const spans=formatting.applyTextStyle(display.text,display.spans,display.bodyStart,display.text.length,{background:'#999999'})
 const changed=editPlannerSlide(p,row,'english',1,display.text,spans)
 assert.equal(changed.items.second.passagesByChannel.english.spans[0].start,display.sourceStart)
 assert.deepEqual(changed.items.second.passagesByChannel.english.verses,passage.verses)
})

test('independent English/Russian title images survive save, compile and asset pruning',()=>{
 const image=(letter:string)=>({id:`sha256:${letter.repeat(64)}`,sha256:letter.repeat(64),kind:'image',fileName:'title.png',storedName:`${letter.repeat(64)}.png`,mediaType:'image/png',size:100,width:1920,height:1080,orientation:1,altText:'Title',attribution:''})
 const a=image('a'),b=image('b')
 let p=createTemplateSlide(project(),{id:'title',template:'title',english:{heading:'Truth',body:''},russian:{heading:'Истина',body:''},selectedId:null,asset:a})
 p=JSON.parse(JSON.stringify(p));p.assets[b.id]=b;p.items.title.backgroundAssetIdsByChannel={english:a.id,russian:b.id,media:b.id}
 p=core.parseHeritageServiceDocumentSource(core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({...p,revision:1}))).project
 const row=plannerSlides(p)[0]
 assert.equal(row.cue!.channels.english.blocks[0].assetId,a.id)
 assert.equal(row.cue!.channels.russian.blocks[0].assetId,b.id)
 assert.ok(core.pruneUnreachableProjectRecords(p,{assetIds:[a.id,b.id]}).assets[b.id])
 assert.equal(Object.keys(deletePlannerSlide(p,row).assets).length,0)
 assert.throws(()=>core.normalizeServiceProject({...p,items:{...p.items,title:{...p.items.title,backgroundAssetIdsByChannel:{unknown:a.id}}}}),/Invalid output/)
})

test('deck-style verse parts, repeated choruses, separators and old wrappers preserve all words',()=>{
 const lyrics='  Verse 1 (a)\r\nOpening words\r\n\r\nVerse 1 (b)\r\nMore words\r\n\r\nChorus\r\nWe Rejoice\r\n\r\nVerse 3 b\r\nLast verse\r\n----\r\nLast slide\r\n\r\nChorus\r\nWe rejoice'
 const sources=synthesizeLegacySyncDocuments({syncId:'forgiving',title:'Example',lyrics,russianLyrics:lyrics,russianTitle:'Пример'})
 const docs=sources.map(v=>parsePlannerLibrarySongDocument(v.source,{fileName:v.id+'.md'}))
 assert.deepEqual(docs[0].document.sections.map((v:any)=>v.id),['1-a','1-b','chorus','3-b','chorus-repeat-2'])
 assert.equal(docs[0].document.sections[3].slides.length,2)
 assert.equal(docs[0].document.sections[4].slides[0].lines[0],'We rejoice')
 assert.ok(core.compareSongTranslations(docs[0].document,docs[1].document).compatible)
 const old=docs[0].document
 const repaired=parsePlannerLibrarySongDocument('---\nid: old\ntitle: Old\nlanguage: en\n---\n^1\nVerse 1 (a)\nOpening words\n^2\nVerse 1 (b)\nMore words',{fileName:'old.md'})
 assert.deepEqual(repaired.document.sections.map((v:any)=>v.slides[0].lines),old.sections.slice(0,2).map((v:any)=>v.slides[0].lines))
 assert.ok(songDocumentBody('Verse of praise is sung\nThese words stay').includes('Verse of praise is sung'))
})

test('a full manager form cannot let unchanged hidden documents override edited verse parts', async()=>{
 const old={syncId:'edited',title:'Example',lyrics:'Verse 1\nFirst line\nSecond line',syncVersion:3}
 const docs=synthesizeLegacySyncDocuments(old)
 const lyrics='Verse 1 (a)\nFirst line\n\nVerse 1 b\nSecond line'
 const result=await prepareSongSyncFields({operation:'update',originalDoc:{...old,syncDocuments:docs},data:{...old,lyrics,syncDocuments:docs},context:{}} as any)
 const parsed=parsePlannerLibrarySongDocument(result!.syncDocuments[0].source,{fileName:'edited.md'})
 assert.deepEqual(parsed.document.sections.map((section:any)=>section.id),['1-a','1-b'])
 assert.equal(result!.syncVersion,4)
 const metadata=await prepareSongSyncFields({operation:'update',originalDoc:{...old,syncDocuments:docs},data:{...old,defaultSongLanguage:'en',syncDocuments:docs},context:{}} as any)
 assert.deepEqual(metadata!.syncDocuments,docs)
 const replacement=synthesizeLegacySyncDocuments({...old,lyrics:'Verse 2\nCanonical replacement'})
 const canonical=await prepareSongSyncFields({operation:'update',originalDoc:{...old,syncDocuments:docs},data:{lyrics,syncDocuments:replacement},context:{}} as any)
 assert.deepEqual(canonical!.syncDocuments,replacement)
})
