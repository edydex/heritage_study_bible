import React,{useState} from 'react'
import {createRoot} from 'react-dom/client'
import PlanServiceClient from '../../src/components/PlanServiceClient'
import {authoringFixture} from './authoring-fixture'
import {plannerSlides} from '../../src/components/plannerSlides'
import core from '../../packages/service-core/index.js'
let savedProject={...authoringFixture(),revision:1}, version=1, saved, takes=0
const initialRow=plannerSlides(savedProject).find(row=>row.itemId==='sermon-point-2')
let liveCue=initialRow.id,liveText=initialRow.cue.channels.russian.blocks.filter(x=>x.type==='text').map(x=>x.text).join('\n')
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('')
async function envelope(project) {const documentSource=core.serializeHeritageServiceDocument(core.createHeritageServiceDocument(project));return{syncId:project.id,syncVersion:version,revision:await hash(documentSource),project,documentSource,status:'planning',changedAt:new Date().toISOString()}}
saved=await envelope(savedProject)
window.fetch=async(input,options={})=>{
 const url=new URL(input,location.origin),path=url.pathname
 if(options.method==='PUT') {savedProject=JSON.parse(JSON.parse(options.body).documentSource).project;version++;saved=await envelope(savedProject);window.dispatchEvent(new Event('qa-saved'));return Response.json({serviceDocument:saved})}
 if(path.includes('/library/bible-passage'))return Response.json({books:[],translations:[]})
 if(path.endsWith('/'+savedProject.id))return Response.json({serviceDocument:saved})
 if(path==='/api/community/service-documents')return Response.json({items:[{syncId:savedProject.id,title:savedProject.title,serviceDate:savedProject.serviceDate,status:'planning',syncVersion:version}],workspaceLanguage:'en'})
 return Response.json({items:[]})
}
const style=document.createElement('style');style.textContent=':root{font:16px system-ui;--theme-text:#222;--theme-elevation-50:#fafafa;--theme-elevation-100:#eee;--theme-elevation-150:#ddd;--theme-elevation-250:#bbb;--theme-success-100:#e0eee6;--theme-success-700:#235c40;--theme-success-800:#184958}body{margin:0}*{box-sizing:border-box}button,input,select{font:inherit}.qa{padding:14px;background:#14252b;color:white;display:flex;gap:16px;align-items:center}.qa output{white-space:pre-line}';document.head.append(style)
function Rehearsal(){const[,refresh]=useState(0);React.useEffect(()=>{
 const update=()=>refresh(x=>x+1)
 const receive=e=>{if(e.source!==window||e.data?.type!=='heritage-editor:take')return;const row=plannerSlides(savedProject).find(row=>row.id===e.data.cueId);if(!row)return;takes++;liveCue=row.id;liveText=row.cue.channels.russian.blocks.filter(x=>x.type==='text').map(x=>x.text).join('\n');update()}
 window.addEventListener('message',receive);window.addEventListener('qa-saved',update);return()=>{window.removeEventListener('message',receive);window.removeEventListener('qa-saved',update)}
},[])
return <><header className="qa"><strong>Local Adjust rehearsal</strong><button onClick={()=>{window.postMessage({type:'heritage-editor:show-mode',enabled:false},location.origin);window.postMessage({type:'heritage-editor:open',syncId:savedProject.id},location.origin);window.postMessage({type:'heritage-editor:show-mode',enabled:true,syncId:savedProject.id,currentCueId:liveCue},location.origin)}}>Open Adjust on live slide</button><output aria-label="Live output">{liveText}</output><output aria-label="Rehearsal state">Saved v{version} · {takes} takes</output></header><PlanServiceClient sermonSyncId={savedProject.id}/></>}
createRoot(document.getElementById('root')).render(<Rehearsal/>);
