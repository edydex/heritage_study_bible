import assert from 'node:assert/strict'
import test from 'node:test'
import { plannerSongFrameMessage } from '../src/lib/plannerSongFrame'
test('song return accepts only the mounted same-origin frame and bounded song IDs',()=>{
  const source = {} as Window, other = {} as Window, origin = 'https://church.example'
  const event = {source,origin,data:{type:'heritage-song:saved',syncId:'song:123'}}
  assert.deepEqual(plannerSongFrameMessage(event,source,origin),{type:'saved',syncId:'song:123'})
  assert.equal(plannerSongFrameMessage({...event,source:other},source,origin),null)
  assert.equal(plannerSongFrameMessage({...event,origin:'https://elsewhere.example'},source,origin),null)
  assert.equal(plannerSongFrameMessage(event,null,origin),null)
  for(const syncId of ['','../song','a'.repeat(129),23]) assert.equal(plannerSongFrameMessage({...event,data:{...event.data,syncId}},source,origin),null)
  assert.deepEqual(plannerSongFrameMessage({...event,data:{type:'heritage-song:dirty',dirty:true}},source,origin),{type:'dirty',dirty:true})
  assert.equal(plannerSongFrameMessage({...event,data:{type:'heritage-song:dirty',dirty:'true'}},source,origin),null)
})
