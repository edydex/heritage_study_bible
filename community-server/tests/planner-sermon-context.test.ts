import assert from 'node:assert/strict'
import test from 'node:test'
import core from '../packages/service-core/index.js'
import context from '../packages/service-core/node/services/project/SermonContext.js'
import {createTemplateDraft, editTemplateField} from '../src/components/plannerTemplates.ts'
import {plannerSlides} from '../src/components/plannerSlides.ts'
function fixture(first='english') {
 let p=core.createServiceProject({id:'language-flow',title:'Sermon',serviceDate:'2026-09-23',preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null},channels:[{id:'english',label:'English',language:'en'},{id:'russian',label:'Russian',language:'ru'},{id:'media',label:'Stage',language:'ru'}]})
 p=createTemplateDraft(p,{id:'title',template:'title',selectedId:null})
 p=editTemplateField(p,'title',first,'heading','Title in first language')
 p=createTemplateDraft(p,{id:'one',template:'point',selectedId:'title'})
 p=editTemplateField(p,'one',first,'body','I. Therefore')
 p=createTemplateDraft(p,{id:'reminder',template:'point',selectedId:'one'})
 p=createTemplateDraft(p,{id:'two',template:'point',selectedId:'reminder'})
 p=editTemplateField(p,'two',first,'next','Laying aside falsehood')
 p=core.addBibleItem(p,{id:'verse',title:'Ephesians 4:25',presetId:'wotbc-sermon-scripture',range:{bookId:'Ephesians',start:{chapter:4,verse:25},end:{chapter:4,verse:25}},passagesByChannel:{english:{translationId:'BSB',reference:'Ephesians 4:25',attribution:'',verses:[{number:25,text:'Speak truth.'}]},russian:{translationId:'SYNO-W',reference:'Ефесянам 4:25',attribution:'',verses:[{number:25,text:'Говорите истину.'}]}}})
 return p
}
const row=(p:any,id:string)=>plannerSlides(p).find(row=>row.itemId===id)!
const output=(p:any,id:string,channel:string)=>row(p,id).cue!.channels[channel]
const reopen=(p:any)=>core.normalizeServiceProject(JSON.parse(JSON.stringify(p)))

test('English first: late Russian title and first point flow forward without storing fallback',()=>{
 let p=fixture(); const raw=JSON.stringify(p)
 assert.equal(row(p,'reminder').title,'I. Therefore')
 assert.equal(row(p,'two').title,'II. Laying aside falsehood')
 assert.equal(output(p,'two','russian').fallbackFromChannelId,'english')
 assert.equal(context.resolveSermonContext(p).two.item.titlesByChannel.russian,undefined)
 assert.equal(JSON.stringify(p),raw,'compilation never mutates authored languages')
 p=editTemplateField(p,'title','russian','heading','От лжи к истине')
 p=editTemplateField(p,'one','russian','body','I. Поэтому')
 let resolved=context.resolveSermonContext(p)
 assert.equal(resolved.reminder.item.titlesByChannel.russian,'От лжи к истине')
 assert.equal(resolved.reminder.item.textByChannel.russian,'I. Поэтому')
 assert.equal(resolved.two.item.textByChannel.russian,'I. Поэтому')
 assert.equal(output(p,'reminder','russian').fallbackFromChannelId,undefined)
 assert.equal(output(p,'two','russian').fallbackFromChannelId,'english','missing II still warns and displays complete English')
 assert.equal(p.items.two.textByChannel.russian,'','inherited words are derived, not copied into storage')
 p=editTemplateField(p,'two','russian','next','Отложив ложь')
 p=reopen(p)
 assert.equal(output(p,'two','russian').fallbackFromChannelId,undefined)
 assert.equal(context.resolveSermonContext(p).two.item.textByChannel.russian,'I. Поэтому\nII. Отложив ложь')
 assert.equal(output(p,'verse','russian').blocks[0].text,'II. Отложив ложь')
 p=editTemplateField(p,'one','russian','body','I. Итак')
 p=editTemplateField(p,'title','russian','heading','Истина')
 resolved=context.resolveSermonContext(p)
 assert.equal(resolved.two.item.textByChannel.russian,'I. Итак\nII. Отложив ложь')
 assert.equal(resolved.two.item.titlesByChannel.russian,'Истина')
})

test('Russian first works symmetrically; inherited heading alone never completes a slide',()=>{
 let p=fixture('russian')
 p=editTemplateField(p,'title','english','heading','From lies to truth')
 assert.equal(output(p,'two','english').fallbackFromChannelId,'russian')
 assert.equal(context.resolveSermonContext(p).two.item.textByChannel.english,'')
 p=editTemplateField(p,'one','english','body','I. Therefore')
 assert.equal(context.resolveSermonContext(p).two.item.textByChannel.english,'I. Therefore')
 assert.equal(output(p,'two','english').fallbackFromChannelId,'russian')
})

test('editing or deleting an inherited point creates a local override that survives later upstream edits',()=>{
 let p=fixture()
 p=editTemplateField(p,'two','english','body','I. Local emphasis\nII. Laying aside falsehood')
 p=editTemplateField(p,'one','english','body','I. Upstream change')
 assert.equal(context.resolveSermonContext(reopen(p)).two.item.textByChannel.english,'I. Local emphasis\nII. Laying aside falsehood')
 p=editTemplateField(p,'two','english','body','II. Laying aside falsehood')
 assert.equal(context.resolveSermonContext(p).two.item.textByChannel.english,'II. Laying aside falsehood')
})

test('legacy copied outlines remain dynamic and a new sermon resets all language context',()=>{
 let p:any=JSON.parse(JSON.stringify(fixture()))
 for(const item of Object.values(p.items) as any[])delete item.sermonInheritance
 p=editTemplateField(p,'one','english','body','I. Updated earlier point')
 assert.equal(context.resolveSermonContext(p).two.item.textByChannel.english,'I. Updated earlier point\nII. Laying aside falsehood')
 p=createTemplateDraft(p,{id:'new-title',template:'title',selectedId:'verse'})
 p=createTemplateDraft(p,{id:'new-point',template:'point',selectedId:'new-title'})
 assert.equal(context.resolveSermonContext(p)['new-point'].item.textByChannel.english,'')
 assert.equal(context.resolveSermonContext(p)['new-point'].item.titlesByChannel?.english,undefined)
})

test('inherited emphasis follows new wording; local later points keep their span offsets',()=>{
 let p=fixture()
 p=editTemplateField(p,'two','english','body','I. Therefore\nII. Laying aside falsehood',[{start:17,end:23,italic:true}])
 p=editTemplateField(p,'one','english','body','I. The earlier point was expanded',[{start:7,end:14,weight:'700'}])
 const body=output(reopen(p),'two','english').blocks.find((block:any)=>block.role==='body')
 assert.equal(body.text,'I. The earlier point was expanded\nII. Laying aside falsehood')
 assert.equal(body.text.slice(body.spans[0].start,body.spans[0].end),'earlier')
 assert.equal(body.text.slice(body.spans[1].start,body.spans[1].end),'Laying')
})

test('deleting an earlier slide does not erase an existing copied outline',()=>{
 let p:any=JSON.parse(JSON.stringify(fixture()))
 delete p.items.one; p.rootItemIds=p.rootItemIds.filter((id:string)=>id!=='one')
 assert.equal(context.resolveSermonContext(p).two.item.textByChannel.english,'I. Therefore\nII. Laying aside falsehood')
})

test('rundown follows the selected output, with display-only language fallback',()=>{
 let p=fixture()
 const title=(id:string,channel:string)=>plannerSlides(p,channel).find(row=>row.itemId===id)!.title
 assert.equal(title('two','russian'),'II. Laying aside falsehood')
 p=editTemplateField(p,'title','russian','heading','От лжи к истине')
 p=editTemplateField(p,'one','russian','body','I. Поэтому')
 p=editTemplateField(p,'two','russian','next','Отложив ложь')
 assert.equal(title('one','english'),'I. Therefore')
 assert.equal(title('one','russian'),'I. Поэтому')
 assert.equal(title('two','russian'),'II. Отложив ложь')
 assert.equal(title('title','russian'),'От лжи к истине')
 assert.equal(title('title','english'),'Title in first language')
})
