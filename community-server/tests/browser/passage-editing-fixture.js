// Opt-in, localhost-only manual rehearsal; never imported by the application.
import core from '../../packages/service-core/index.js'
import {createTemplateDraft} from '../../src/components/plannerTemplates'
const key='heritage-passage-editing-rehearsal-v1'
let project=core.createServiceProject({id:'canvas-rehearsal',title:'Editing rehearsal',serviceDate:'2026-09-22',preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null},channels:[{id:'english',label:'English',language:'en'},{id:'russian',label:'Russian',language:'ru'},{id:'media',label:'Stage',language:'ru'}]})
project=createTemplateDraft(project,{id:'title',template:'title',selectedId:null})
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
  return json({passage:{title:reference,range:{bookId,start:{chapter,verse:startVerse},end:{chapter,verse:endVerse}},...(verseNumbers?{verseNumbers}:{}),passagesByChannel:Object.fromEntries(['english','russian','media'].map(id=>[id,{reference,translationId:id==='english'?'BSB':'SYNO-W',attribution:'',verses:numbers.map(number=>({number,text:id==='english'?`Example passage words for verse ${number}. Additional context for editing this demonstration.`:`Пример текста для стиха ${number}. Дополнительный контекст для редактирования.`}))}]))}})
 }
 if(method==='PUT'){
  const document=core.parseHeritageServiceDocumentSource(JSON.parse(options.body).documentSource)
  saved={...saved,syncVersion:saved.syncVersion+1,revision:document.project.revision,project:document.project};localStorage.setItem(key,JSON.stringify(saved))
  return json({serviceDocument:saved})
 }
 if(url.pathname.endsWith('/canvas-rehearsal'))return json({serviceDocument:saved})
 return json({items:[]})
}
