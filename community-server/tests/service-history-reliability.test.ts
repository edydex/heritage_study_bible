import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import sharp from 'sharp'
import core from '../packages/service-core/node.js'
import { serviceHistoryEndpoints } from '../src/endpoints/serviceHistory'
import { mutateServiceDocument, serviceSaveRequestHash } from '../src/endpoints/syncShow'
import { storeServiceDocumentAsset } from '../src/lib/syncshow/ServiceDocumentAssetStore'

type RecordValue=Record<string,any>
function matches(document:RecordValue,where:RecordValue={}) :boolean {
  return Object.entries(where).every(([key,value]:[string,any])=>key==='and' ? value.every((part:any)=>matches(document,part)) : value.in ? value.in.includes(document[key]) : document[key]===value.equals)
}
function fixture(assets={}) {
  const project=core.createServiceProject({id:'history-reliability',title:'Original title',serviceDate:'2026-10-04',preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null},channels:[{id:'english',label:'English',language:'en'}]})
  const source=core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({...project,assets,revision:1}))
  const journal={id:61,community:17,serviceDocument:49,syncId:project.id,syncVersion:1,revision:createHash('sha256').update(source).digest('hex'),documentSource:source,status:'planning',title:project.title,serviceDate:project.serviceDate,changedAt:'2026-10-01T12:00:00.000Z'}
  const newerSource=core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({...project,title:'Someone else saved later',revision:3}))
  const current={...journal,id:49,syncVersion:3,revision:createHash('sha256').update(newerSource).digest('hex'),documentSource:newerSource,title:'Someone else saved later'}
  const saved={id:71,community:17,serviceDocument:49,requestId:'acknowledged-request',requestHash:serviceSaveRequestHash({syncId:current.syncId,baseSyncVersion:1,baseRevision:journal.revision,revision:journal.revision,documentSource:journal.documentSource,status:journal.status} as never,'manual'),syncVersion:1,revision:journal.revision,saveKind:'manual',savedBy:'Pastor',savedAt:journal.changedAt}
  return {current,journal,saved}
}
function request(data:ReturnType<typeof fixture>,options:{member?:boolean;checkpoint?:RecordValue}={}) {
  const counts={commits:0,rollbacks:0,writes:0},sessions:RecordValue={}
  const collections:RecordValue={communities:[{id:17}],memberships:options.member===false?[]:[{id:3,user:9,community:17,role:'leader'}],
    'service-documents':[data.current],'syncshow-service-document-changes':[data.journal],'service-document-saves':[options.checkpoint||data.saved]}
  const payload:any={config:{cors:'*'},logger:{error:()=>{}},find:async({collection,where}:any)=>({docs:(collections[collection]||[]).filter((row:any)=>collection==='communities'||matches(row,where))}),
    update:async()=>{counts.writes++;throw new Error('A historical replay must not update content')},create:async()=>{counts.writes++;throw new Error('A historical replay must not create another save')},
    db:{sessions,beginTransaction:async()=>{sessions['1']={db:{execute:async()=>({rows:[]})}};return 1},commitTransaction:async()=>{counts.commits++},rollbackTransaction:async()=>{counts.rollbacks++}}}
  return {req:{payload,user:{id:9,collection:'users'},headers:new Headers(),routeParams:{syncId:data.current.syncId,syncVersion:'1'},url:'http://localhost/api/community/service-documents/history-reliability'},counts}
}
function write(data:ReturnType<typeof fixture>) {
  return {syncId:data.current.syncId,baseSyncVersion:1,baseRevision:data.journal.revision,revision:data.journal.revision,documentSource:data.journal.documentSource,status:data.journal.status}
}

test('a lost unchanged manual save response replays its exact version after another editor saves',async()=>{
  const data=fixture(),{req,counts}=request(data),before=JSON.stringify(data.current)
  const replay=await mutateServiceDocument(req as never,17,write(data) as never,'acknowledged-request',{editorSave:{saveKind:'manual',savedBy:'Pastor'}})
  assert.equal(replay.document.syncVersion,1)
  assert.equal(replay.document.documentSource,data.journal.documentSource)
  assert.equal(replay.document.id,data.current.id)
  assert.equal(JSON.stringify(data.current),before)
  assert.deepEqual(counts,{commits:1,rollbacks:0,writes:0})
})
test('unchanged manual checkpoints persist the canonical original save request hash',async()=>{
  const data=fixture(),{req,counts}=request(data)
  let recorded:RecordValue|undefined
  req.payload.create=async(input:any)=>{counts.writes++;recorded=input;return {id:72,...input.data}}
  const input={...write(data),baseSyncVersion:data.current.syncVersion,baseRevision:data.current.revision,revision:data.current.revision,documentSource:data.current.documentSource}
  const result=await mutateServiceDocument(req as never,17,input as never,'new-checkpoint',{editorSave:{saveKind:'manual',savedBy:'Pastor'}})
  assert.equal(result.document.syncVersion,data.current.syncVersion)
  assert.equal(recorded?.collection,'service-document-saves')
  assert.equal(recorded?.context.serviceDocumentSave,true)
  assert.equal(recorded?.data.requestId,'new-checkpoint')
  assert.equal(recorded?.data.requestHash,serviceSaveRequestHash(input as never,'manual'))
  assert.deepEqual(counts,{commits:1,rollbacks:0,writes:1})
})
test('checkpoint retries reject changed payloads and cannot replay another church save',async()=>{
  const data=fixture()
  for(const changed of [{...write(data),documentSource:data.current.documentSource},{...write(data),status:'ready'}, {...write(data),baseSyncVersion:2}, {...write(data),baseRevision:data.current.revision}]) {
    const {req,counts}=request(data)
    await assert.rejects(()=>mutateServiceDocument(req as never,17,changed as never,'acknowledged-request',{editorSave:{saveKind:'manual',savedBy:'Pastor'}}),(error:any)=>error.code==='IDEMPOTENCY_CONFLICT'&&error.status===409)
    assert.deepEqual(counts,{commits:0,rollbacks:1,writes:0})
  }
  const {req}=request(data,{checkpoint:{...data.saved,community:18}})
  await assert.rejects(()=>mutateServiceDocument(req as never,17,write(data) as never,'acknowledged-request',{editorSave:{saveKind:'manual',savedBy:'Pastor'}}),(error:any)=>error.code==='VERSION_CONFLICT'&&error.status===412)
})
test('historical preview media remains exact after removal from current revision and requires authorized history scope',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'heritage-history-media-')),previous=process.env.HERITAGE_SERMON_MEDIA_PATH
  process.env.HERITAGE_SERMON_MEDIA_PATH=directory
  try {
    const bytes=await sharp({create:{width:32,height:18,channels:4,background:'#123456'}}).png().toBuffer()
    const assetId=`sha256:${createHash('sha256').update(bytes).digest('hex')}`
    const stored=await storeServiceDocumentAsset({headers:new Headers({'content-type':'image/png','content-length':String(bytes.length)}),body:new ReadableStream({start(controller){controller.enqueue(bytes);controller.close()}})} as never,17,assetId,{requireDeclaredMetadata:false})
    const data=fixture({[assetId]:{...stored,storedName:`${stored.sha256}.png`,fileName:'historical.png'}}),handler=serviceHistoryEndpoints.find(endpoint=>endpoint.path.endsWith('/history/:syncVersion/assets/:assetId'))!.handler!
    assert.equal(Object.keys(core.parseHeritageServiceDocumentSource(data.current.documentSource).project.assets).length,0)
    const {req}=request(data)
    const response=await handler({...req,routeParams:{...req.routeParams,assetId}} as never)
    assert.equal(response.status,200)
    assert.equal(response.headers.get('content-type'),'image/png')
    assert.equal(response.headers.get('cache-control'),'private, no-store')
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes)
    const missing=await handler({...req,routeParams:{...req.routeParams,assetId:`sha256:${'b'.repeat(64)}`}} as never)
    assert.equal(missing.status,404)
    const foreign=request({...data,journal:{...data.journal,community:18}}).req
    const denied=await handler({...foreign,routeParams:{...foreign.routeParams,assetId}} as never)
    assert.equal(denied.status,404)
    const memberDenied=request(data,{member:false}).req
    assert.equal((await handler({...memberDenied,routeParams:{...memberDenied.routeParams,assetId}} as never)).status,403)
  } finally {
    if(previous===undefined)delete process.env.HERITAGE_SERMON_MEDIA_PATH;else process.env.HERITAGE_SERMON_MEDIA_PATH=previous
    await rm(directory,{recursive:true,force:true})
  }
})
