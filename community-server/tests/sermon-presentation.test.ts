import assert from 'node:assert/strict'
import test from 'node:test'
import core from '../packages/service-core/index.js'
import { importSermonPresentation } from '../src/components/importSermonPresentation.ts'
import { preparePlannerPresentation } from '../src/components/plannerPresentation'
import { createTemplateDraft } from '../src/components/plannerTemplates'
import { createTemplateSlide } from '../src/components/plannerTemplates.ts'
import { plannerSlides } from '../src/components/plannerSlides.ts'
import { createSermonRevision } from '../src/lib/syncshow/SermonDocument.ts'
function project(id: string) { return core.createServiceProject({ id, title: 'Sunday', serviceDate: '2026-09-20', preferredProfileId: 'main-sanctuary', presetPack: {id:'main-sanctuary',version:1,sha256:null}, channels: [{id:'english',label:'English',language:'en'},{id:'russian',label:'Russian',language:'ru'},{id:'media',label:'Singers',language:'ru'}] }) }
const sermon = createSermonRevision({schemaVersion:3,kind:'syncshow-sermon',id:'sermon-check',titles:{en:'Walk in love'},defaultLanguage:'en',speaker:{id:null,name:'Test pastor'},serviceDate:'2026-09-20',series:null,outline:[],sources:[],references:[],media:[],body:[],publication:{status:'draft',visibility:'private',publishedAt:null,canonicalUrl:null}}).document
test('a whole sermon can be added twice with independent slides and pinned content', () => {
  const image = {id:`sha256:${'a'.repeat(64)}`,sha256:'a'.repeat(64),kind:'image',fileName:'title.jpg',storedName:`${'a'.repeat(64)}.jpg`,mediaType:'image/jpeg',size:1000,width:1920,height:1080,orientation:1,altText:'Title',attribution:''}
  let deck = createTemplateSlide(project('deck'), { id:'title',template:'title',english:{heading:'Walk in love',body:''},russian:{heading:'Живите в любви',body:''},selectedId:null,asset:image })
  deck = createTemplateSlide(deck, { id:'point',template:'point',english:{heading:'Love',body:'Be patient'},russian:{heading:'Любовь',body:'Будьте терпеливы'},selectedId:'title' })
  const before = JSON.stringify(deck)
  const first = importSermonPresentation(project('service'), deck, sermon, null)
  const second = importSermonPresentation(first.project, deck, sermon, first.selectedId)
  const reopened = core.parseHeritageServiceDocumentSource(core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({...second.project, revision: 1}))).project
  assert.equal(JSON.stringify(deck), before)
  assert.equal(Object.values(reopened.items).filter((item: any) => item.kind !== 'group').length, 4)
  const rows = plannerSlides(reopened).filter(row => row.cue)
  assert.equal(rows.length, 4)
  assert.ok(JSON.stringify(rows).includes('Будьте терпеливы'))
  assert.ok(JSON.stringify(rows).includes('Be patient'))
  assert.ok(reopened.assets[image.id])
  assert.equal(Object.values(reopened.resources).filter((item: any) => item.kind === 'sermon').length, 1)
  assert.throws(() => importSermonPresentation(project('target'), project('empty'), sermon, null), /no saved slides/)
})


test('prepared sermon sections import as a single title parent, and the next sermon is a sibling', () => {
  let deck=createTemplateDraft(project('prepared'),{id:'title',template:'title',selectedId:null})
  deck=createTemplateDraft(deck,{id:'point',template:'point',selectedId:'title'})
  deck=preparePlannerPresentation(deck).project
  const first=importSermonPresentation(project('service'),deck,sermon,null)
  const second=importSermonPresentation(first.project,deck,sermon,plannerSlides(first.project)[1].itemId)
  assert.equal(second.project.rootItemIds.length,2)
  const rows=plannerSlides(second.project)
  assert.equal(rows.filter(row=>row.kind==='group').length,0)
  assert.equal(rows.filter(row=>row.sermonTitle).length,2)
  assert.equal(rows.length,4)
  assert.ok(second.project.items[second.project.rootItemIds[0]].sermonResourceId)
})
