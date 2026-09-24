// Opt-in, localhost-only manual rehearsal; never imported by the application.
import core from '../../packages/service-core/index.js'
import {preparePlannerPresentation} from '../../src/components/plannerPresentation'
import {createTemplateDraft,editTemplateField} from '../../src/components/plannerTemplates'
const key=location.search.includes('language-flow')?'heritage-language-flow-rehearsal-v1':location.search.includes('font-reflow')?'heritage-font-reflow-rehearsal-v1':'heritage-passage-editing-rehearsal-v1'
let project=core.createServiceProject({id:'canvas-rehearsal',title:'Editing rehearsal',serviceDate:'2026-09-22',preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null},channels:[{id:'english',label:'English',language:'en'},{id:'russian',label:'Russian',language:'ru'},{id:'media',label:'Stage',language:'ru'}]})
project=createTemplateDraft(project,{id:'title',template:'title',selectedId:null})
if(location.search.includes('font-reflow')) {
 project=core.addBibleItem(project,{id:'reflow-reading',title:'Ephesians 4:20–26',presetId:'wotbc-sermon-scripture',range:{bookId:'Ephesians',start:{chapter:4,verse:20},end:{chapter:4,verse:26}},passagesByChannel:Object.fromEntries(['english','russian','media'].map(channel=>[channel,{translationId:channel==='english'?'BSB':'SYNO-W',reference:'Ephesians 4:20–26',attribution:'',verses:Array.from({length:7},(_,i)=>({number:20+i,text:(channel==='english'?'Sample words remain together in this verse. ':'Текст стиха остаётся вместе на странице. ').repeat(5)}))}]))})
 project=preparePlannerPresentation(project).project
}

if(location.search.includes('language-flow')) {
 project=editTemplateField(project,'title','english','heading','From lies to truth')
 project=createTemplateDraft(project,{id:'point-one',template:'point',selectedId:'title'})
 project=editTemplateField(project,'point-one','english','body','I. Therefore')
 project=createTemplateDraft(project,{id:'point-two',template:'point',selectedId:'point-one'})
 project=editTemplateField(project,'point-two','english','next','Laying aside falsehood')
 project=createTemplateDraft(project,{id:'point-three',template:'point',selectedId:'point-two'})
 project=editTemplateField(project,'point-three','english','next','Speak truth each one of you with his neighbor')
 project=core.addBibleItem(project,{id:'long-heading-reading',title:'Ephesians 4:25',presetId:'wotbc-sermon-scripture',textStyle:{bodySize:78},range:{bookId:'Ephesians',start:{chapter:4,verse:25},end:{chapter:4,verse:25}},passagesByChannel:Object.fromEntries(['english','russian','media'].map(channel=>[channel,{translationId:channel==='english'?'BSB':'SYNO-W',reference:'Ephesians 4:25',attribution:'',verses:[{number:25,text:channel==='english'?'Therefore, laying aside falsehood, speak truth each one of you with his neighbor, for we are members of one another.':'Говорите истину каждый ближнему своему.'}]}]))})
}

let saved=JSON.parse(localStorage.getItem(key)||'null')||{syncId:'canvas-rehearsal',syncVersion:1,revision:1,status:'planning',project}
const originalFetch=window.fetch.bind(window)
window.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href),method=options.method||'GET'
 if(!url.pathname.startsWith('/api/community/'))return originalFetch(input,options)
 const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}})
 if(url.pathname.endsWith('/library/bible-passage')){
  if(method==='GET')return json({books:[{id:'John',name:'John',chapters:21}],translations:[{id:'BSB',name:'Berean Standard Bible',language:'en'},{id:'SYNO-W',name:'Синодальный перевод',language:'ru'}]})
  const {bookId,chapter,startVerse,endVerse,verseNumbers}=JSON.parse(options.body)
  const numbers=verseNumbers||Array.from({length:endVerse-startVerse+1},(_,i)=>startVerse+i)
  const reference=`John ${chapter}:${numbers.join(',')}`
  return json({passage:{sources:{english:'local rehearsal',russian:'local rehearsal'},title:reference,range:{bookId,start:{chapter,verse:startVerse},end:{chapter,verse:endVerse}},...(verseNumbers?{verseNumbers}:{}),passagesByChannel:Object.fromEntries(['english','russian','media'].map(id=>[id,{reference,translationId:id==='english'?'BSB':'SYNO-W',attribution:'',verses:numbers.map(number=>({number,text:id==='english'?`Example passage words for verse ${number}. Additional context for editing this demonstration.`:`Пример текста для стиха ${number}. Дополнительный контекст для редактирования.`}))}]))}})
 }
 if(method==='PUT'){
  const document=core.parseHeritageServiceDocumentSource(JSON.parse(options.body).documentSource)
  saved={...saved,syncVersion:saved.syncVersion+1,revision:document.project.revision,project:document.project};localStorage.setItem(key,JSON.stringify(saved))
  return json({serviceDocument:saved})
 }
 if(url.pathname.endsWith('/canvas-rehearsal'))return json({serviceDocument:saved})
 return json({items:[]})
}
