import assert from 'node:assert/strict'
import test from 'node:test'
import core from '../packages/service-core/index.js'
import { parseOutline, outlineWithGuides, serializeOutline, updateOutlineRow, type OutlineRow } from '../src/components/plannerOutline.ts'
import { createTemplateDraft, editTemplateField } from '../src/components/plannerTemplates.ts'
import { plannerSlides } from '../src/components/plannerSlides.ts'

function enter(rows: OutlineRow[], marker: string, text: string, spans: any[]=[]) {
  const row=outlineWithGuides(rows).find(row=>row.marker===marker && row.guide)!
  assert.ok(row,`Missing ${marker} guide`)
  return updateOutlineRow(rows,row.id,text,spans)
}
const markers = (rows: OutlineRow[]) => outlineWithGuides(rows).map(row=>row.marker)

test('a single character immediately reveals the next sub-point and main point with stable identities',()=>{
  let rows: OutlineRow[]=[]
  assert.deepEqual(markers(rows),['I.'])
  const first=outlineWithGuides(rows)[0].id
  rows=enter(rows,'I.','L')
  assert.equal(rows[0].id,first)
  assert.deepEqual(markers(rows),['I.','A.','II.'])
  rows=updateOutlineRow(rows,first,'Love one another')
  assert.deepEqual(markers(rows),['I.','A.','II.'])
  rows=enter(rows,'A.','Be patient')
  assert.deepEqual(markers(rows),['I.','A.','B.','II.'])
  rows=enter(rows,'B.','Be kind')
  assert.deepEqual(markers(rows),['I.','A.','B.','C.','II.'])
  rows=enter(rows,'II.','Keep the unity')
  assert.deepEqual(markers(rows),['I.','A.','B.','C.','II.','A.','III.'])
  const saved=serializeOutline(rows)
  assert.equal(saved.text,'I. Love one another\n\u00a0\u00a0\u00a0\u00a0A. Be patient\n\u00a0\u00a0\u00a0\u00a0B. Be kind\nII. Keep the unity')
  assert.ok(!saved.text.includes('C.'))
  assert.deepEqual(serializeOutline(parseOutline(saved.text,saved.spans)),saved)
})

test('clearing a point restores its empty field without phantom children or projected numbers',()=>{
  let rows=enter([],'I.','X')
  rows=updateOutlineRow(rows,rows[0].id,'')
  assert.deepEqual(markers(rows),['I.'])
  assert.deepEqual(serializeOutline(rows),{text:'',spans:[]})
  rows=updateOutlineRow(rows,rows[0].id,'X')
  assert.deepEqual(markers(rows),['I.','A.','II.'])
  rows=enter(rows,'A.','child')
  const sub=rows[1]
  rows=updateOutlineRow(rows,sub.id,'')
  assert.deepEqual(markers(rows),['I.','A.','II.'])
  assert.equal(serializeOutline(rows).text,'I. X')
})

test('existing numbered outlines retain numbering, continuations, and exact emphasis offsets',()=>{
  const body='VIII. Existing point\n    A. Sub-point\nA continuation line\nIX. Next point'
  const spans=[{start:0,end:20,weight:'700',foreground:'#ffc000'},{start:body.indexOf('Sub-point'),end:body.indexOf('Sub-point')+9,underline:true}]
  const rows=parseOutline(body,spans)
  assert.deepEqual(serializeOutline(rows),{text:body,spans:[{...spans[0],end:6},{...spans[0],start:6},spans[1]]})
  assert.deepEqual(markers(rows),['VIII.','A.','B.','IX.','A.','X.'])
  assert.equal(rows[1].text,'Sub-point\nA continuation line')
  assert.equal(outlineWithGuides(parseOutline('I. Point\n    H. eighth\n    I. ninth')).filter(row=>row.guide)[0].marker,'J.')
  assert.equal(outlineWithGuides(parseOutline('1. First\n2. Second')).at(-1)!.marker,'3.')
  assert.equal(outlineWithGuides(parseOutline('I. Point\n    Z. Last')).find(row=>row.guide)!.marker,'AA.')
})

test('new emphasis and sub-points round-trip to audience and singers without editor guides',()=>{
  const base=core.createServiceProject({id:'outline',title:'Sunday',serviceDate:'2026-09-06',preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null},channels:[{id:'english',label:'English',language:'en'},{id:'russian',label:'Russian',language:'ru'},{id:'media',label:'Singers',language:'und'}]})
  let project=createTemplateDraft(base,{id:'point',template:'point',selectedId:null})
  let rows=enter([],'I.','Любите')
  rows=enter(rows,'A.','Терпение',[{start:0,end:8,weight:'700',underline:true}])
  const value=serializeOutline(rows)
  project=editTemplateField(project,'point','russian','body',value.text,value.spans)
  const reopened=core.normalizeHeritageServiceDocument(JSON.parse(core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({...project,revision:1})))).project
  const cue=plannerSlides(reopened)[0].cue!
  assert.equal(cue.channels.russian.blocks[0].text,value.text)
  assert.deepEqual(cue.channels.russian.blocks,cue.channels.media.blocks)
  assert.deepEqual(cue.channels.english.blocks,[])
  assert.deepEqual(cue.channels.russian.blocks[0].spans,value.spans)
  assert.ok(!value.text.includes('II.'))
  assert.deepEqual(reopened.items.point.pendingPointChannels,['english'])
})
