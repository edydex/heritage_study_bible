import assert from 'node:assert/strict'
import test from 'node:test'
import core from '../packages/service-core/index.js'
import formatting from '../packages/service-core/node/services/project/SlideFormatting.js'
import {passageSelectionChoices,passageReferenceChoices} from '../packages/bible-reference/range.js'
import {loadHeritageServiceBiblePassage} from '../src/lib/syncshow/HeritageServiceBibleLookup.ts'
import {plannerSlides,editPlannerSlide} from '../src/components/plannerSlides.ts'
import {preparePlannerPresentation} from '../src/components/plannerPresentation.ts'
import {createTemplateDraft,editTemplateField} from '../src/components/plannerTemplates.ts'
const project=()=>core.createServiceProject({id:'editing',title:'Rehearsal',serviceDate:'2026-09-22',preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null},channels:[{id:'english',label:'English',language:'en'},{id:'russian',label:'Russian',language:'ru'},{id:'media',label:'Stage',language:'ru'}]})
const reopen=(p:any)=>core.parseHeritageServiceDocumentSource(core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({...p,revision:1}))).project
const lookup=()=>loadHeritageServiceBiblePassage({schemaVersion:1,bookId:'John',start:{chapter:8,verse:31},end:{chapter:8,verse:44}}, {verseNumbers:[31,32,44],fetchImpl:async url=>new Response(JSON.stringify({name:'John',chapters:[{number:8,verses:Array.from({length:44},(_,i)=>({number:i+1,text:`${String(url).includes('SYNO')?'Русский':'English'} verse ${i+1}.`}))}]}))})
test('separated-verse shortcuts preserve selections, ambiguity and invalid-input errors',()=>{
 assert.deepEqual(passageSelectionChoices('Joh 8:31-32,44')[0].verseNumbers,[31,32,44])
 assert.deepEqual(passageSelectionChoices('1 chr 3 7-10,14-15')[0].verseNumbers,[7,8,9,10,14,15])
 assert.deepEqual(passageSelectionChoices('Jo 3:1,3').map(v=>v.book),['Joshua','Job','Joel','Jonah','John'])
 for(const text of ['John 8:31,31','John 8:44,31','John 8:31,','John 8:31-9:1,4','John 8:31,33junk']) assert.ok(passageSelectionChoices(text)[0]?.invalidReason,text)
 assert.deepEqual(passageReferenceChoices('John 8:31-32,44'),[])
})
test('lookup pins only requested verses on all screens and survives save/pagination',async()=>{
 const passage=await lookup()
 assert.equal(passage.title,'John 8:31–32,44')
 let p=core.addBibleItem(project(),{id:'passage',range:passage.range,verseNumbers:passage.verseNumbers,passagesByChannel:passage.passagesByChannel,presetId:'wotbc-sermon-scripture'})
 p=reopen(preparePlannerPresentation(p).project)
 for(const channel of p.channelIds){const b=p.items.passage.passagesByChannel[channel];assert.deepEqual(b.verses.map((v:any)=>v.number),[31,32,44]);assert.equal(b.reference,'John 8:31–32,44')}
 const mismatch=JSON.parse(JSON.stringify(p));mismatch.items.passage.verseNumbers=[31,44];assert.throws(()=>core.normalizeServiceProject(mismatch),/exactly its selected verses/)
 assert.throws(()=>core.addBibleItem(project(),{id:'wrong',range:passage.range,passagesByChannel:passage.passagesByChannel}),/exactly cover/)
})
test('passage edits are presentation-only, styled, retained after reopening, and Russian stage follows',async()=>{
 const passage=await lookup();let p=core.addBibleItem(project(),{id:'passage',range:passage.range,verseNumbers:passage.verseNumbers,passagesByChannel:passage.passagesByChannel,presetId:'wotbc-sermon-scripture'})
 const original=p.items.passage.passagesByChannel.russian,english=p.items.passage.passagesByChannel.english
 const row=plannerSlides(p)[0],text='John 8:31–32,44 … [контекст] выбранные слова.'
 p=editPlannerSlide(p,row,'russian',0,text,[{start:20,end:29,background:'#ffff00'}]);p=reopen(preparePlannerPresentation(p).project)
 assert.deepEqual(p.items.passage.passagesByChannel.russian.verses,original.verses)
 assert.equal(p.items.passage.passagesByChannel.russian.contentSha256,original.contentSha256)
 assert.deepEqual(p.items.passage.passagesByChannel.english,english)
 for(const channel of ['russian','media']){const b=plannerSlides(p)[0].cue!.channels[channel].blocks[0];assert.equal(formatting.scriptureDisplay(b,'wotbc-sermon-scripture').text,text);assert.equal(b.displaySpans[0].background,'#ffff00')}
 const bad=JSON.parse(JSON.stringify(p));bad.items.passage.passagesByChannel.russian.verses[0].text='tampered original';assert.throws(()=>core.normalizeServiceProject(bad),/checksum/)
})
test('quotation has separate heading, body and source; hidden titles still head following passages',async()=>{
 let p=createTemplateDraft(project(),{id:'title',template:'title',selectedId:null});p=editTemplateField(p,'title','english','heading','Sermon title')
 const passage=await lookup();p=core.addBibleItem(p,{id:'reading',range:passage.range,verseNumbers:passage.verseNumbers,passagesByChannel:passage.passagesByChannel,presetId:'wotbc-sermon-scripture'})
 assert.equal(plannerSlides(p).find(v=>v.itemId==='reading')!.cue!.channels.english.blocks[0].text,'Sermon title')
 p=createTemplateDraft(p,{id:'quote',template:'quote',selectedId:'reading'});p=editTemplateField(p,'quote','english','heading','Quotation heading');p=editTemplateField(p,'quote','english','body','The quoted words.');p=editTemplateField(p,'quote','english','credit','Author, source')
 p=reopen(p);const blocks=plannerSlides(p).find(v=>v.itemId==='quote')!.cue!.channels.english.blocks
 assert.deepEqual(blocks.map((v:any)=>[v.role,v.text]),[['title','Quotation heading'],['body','The quoted words.'],['credit','Author, source']])
 assert.notEqual(p.items.quote.title,'Author, source')
})

test('older title slides allow editing context without enabling the overlay',()=>{
 let p=core.addProjectItem(project(),{id:'legacy',kind:'sermon',title:'Legacy',presetId:'wotbc-sermon-title',textByChannel:{english:'Existing',russian:'Существующий'},sermonPresentation:{showText:false,darkenBackground:false}})
 p=editTemplateField(p,'legacy','english','heading','Context without overlay')
 assert.equal(p.items.legacy.titlesByChannel.english,'Context without overlay');assert.equal(p.items.legacy.sermonPresentation.showText,false)
})
