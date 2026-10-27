import assert from 'node:assert/strict'
import test from 'node:test'
import core from '../packages/service-core/index.js'
import {conflictDraftSignature,conflictSavedVersion,sameConflictSavedVersion} from '../src/components/serviceSaveConflict'
const project={...core.createServiceProject({id:'conflict',title:'Conflict fixture',serviceDate:'2026-10-04',preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null},channels:[{id:'english',label:'English',language:'en'}]}),revision:1}
const documentSource=core.serializeHeritageServiceDocument(core.createHeritageServiceDocument(project))
const envelope={syncId:'conflict',syncVersion:2,revision:'revision',documentSource,status:'planning',changedAt:new Date().toISOString(),project:{id:'untrusted-embedded-project'}}

test('conflict review uses canonical source and rejects a response outside the requested document',()=>{
  const saved=conflictSavedVersion(envelope,'conflict')
  assert.equal(saved.project.id,'conflict')
  assert.throws(()=>conflictSavedVersion(envelope,'other'),/unexpected document/)
  assert.throws(()=>conflictSavedVersion({...envelope,syncVersion:0},'conflict'),/unexpected document/)
  assert.throws(()=>conflictSavedVersion({...envelope,status:'invalid'},'conflict'),/unexpected document/)
})
test('conflict choices require the reviewed saved version and latest local draft including status',()=>{
  const saved=conflictSavedVersion(envelope,'conflict')
  assert.ok(sameConflictSavedVersion(saved,{...saved}))
  assert.equal(sameConflictSavedVersion(saved,{...saved,syncId:'other'}),false)
  assert.equal(sameConflictSavedVersion(saved,{...saved,syncVersion:3}),false)
  assert.equal(sameConflictSavedVersion(saved,{...saved,revision:'changed'}),false)
  assert.equal(sameConflictSavedVersion(saved,{...saved,documentSource:'changed'}),false)
  assert.equal(sameConflictSavedVersion(saved,{...saved,status:'ready'}),false)
  const signature=conflictDraftSignature({project:saved.project,status:'planning'})
  assert.equal(signature,conflictDraftSignature({project:structuredClone(saved.project),status:'planning'}))
  assert.notEqual(signature,conflictDraftSignature({project:{...saved.project,title:'Newer local edit'},status:'planning'}))
  assert.notEqual(signature,conflictDraftSignature({project:saved.project,status:'ready'}))
})
