import assert from 'node:assert/strict'
import test from 'node:test'
import {managerServiceDocumentEndpoints} from '../src/endpoints/serviceDocuments.ts'

const handler=managerServiceDocumentEndpoints.find(e=>e.path==='/community/service-documents/library/songs/:syncId/layout' && e.method==='post')!.handler
function fixture(options:{member?:boolean,song?:boolean,user?:boolean}={}){
 const writes:any[]=[],finds:any[]=[]
 const payload={config:{cors:'*'},logger:{error:()=>{}},auth:async()=>({user:null}),find:async(query:any)=>{
  finds.push(query)
  if(query.collection==='communities')return {docs:[{id:7}]}
  if(query.collection==='memberships')return {docs:options.member===false?[]:[{id:9,role:'leader'}]}
  if(query.collection==='songs')return {docs:options.song===false?[]:[{id:12,syncId:'praise'}]}
  throw Error('Unexpected read')
 },update:async(query:any)=>{writes.push(query);return {id:12}}}
 const request=(style:any)=>({headers:new Headers({'content-type':'application/json'}),url:'https://example.test/api/community/service-documents/library/songs/praise/layout',payload,user:options.user===false?null:{id:9},routeParams:{syncId:'praise'},text:async()=>JSON.stringify(style)})
 return {writes,finds,request}
}
test('a manager saves layout only on a song belonging to the configured church',async()=>{
 const f=fixture(),r=await handler(f.request({bodySize:98,bodyAlign:'center'}) as never)
 assert.equal(r.status,200);assert.deepEqual(f.writes[0].data,{projectionStyle:{bodySize:98,bodyAlign:'center'}})
 assert.deepEqual(f.finds.find(q=>q.collection==='songs').where.and,[{community:{equals:7}},{syncId:{equals:'praise'}},{status:{not_equals:'archived'}}])
})
test('non-managers, missing songs and invalid font preferences cannot write',async()=>{
 for(const [options,style,status] of [[{member:false},{bodySize:90},403],[{user:false},{bodySize:90},401],[{song:false},{bodySize:90},404],[{},{bodySize:900},400]] as const){
  const f=fixture(options),r=await handler(f.request(style) as never);assert.equal(r.status,status);assert.equal(f.writes.length,0)
 }
})
