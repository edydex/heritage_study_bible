import assert from 'node:assert/strict'
import test from 'node:test'
import core from '../packages/service-core/index.js'
import formatting from '../packages/service-core/node/services/project/SlideFormatting.js'
import { preparePlannerPresentation } from '../src/components/plannerPresentation.ts'
import { plannerSlides, editPlannerSlide, movePlannerSlide } from '../src/components/plannerSlides.ts'
import { plannerPreview } from '../src/components/plannerPreview.ts'
import { plannerNavigator } from '../src/components/plannerNavigator.ts'
import { reflowScripture } from '../src/components/plannerScriptureReflow.ts'

function fixture() {
  return core.createServiceProject({id:'authoring',title:'Sunday',serviceDate:'2026-10-04',
    channels:[{id:'english',label:'English',language:'en'},{id:'russian',label:'Russian',language:'ru'},{id:'media',label:'Stage',language:'ru'}],
    preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null}})
}
function roundTrip(project:any) {
  return core.parseHeritageServiceDocumentSource(core.serializeHeritageServiceDocument(core.createHeritageServiceDocument({...project,revision:1}))).project
}
function bilingualSong() {
  let project:any=fixture(),resourceIds:Record<string,string>={}
  for(const [channel,title,words] of [['english','A Song','English'],['russian','Песня','Русский']]) {
    const result=core.addSongResource(project,core.parseSongDocument(`---\nid: ${channel}-song\ntitle: ${title}\nlanguage: ${channel==='english'?'en':'ru'}\n---\n\n^1\n${words} one\n\n---\n${words} two\n\n---\n${words} three\n`,{fileName:`${channel}.md`}))
    project=result.project;resourceIds[channel]=result.resourceId
  }
  return core.addProjectItem(project,{id:'song',kind:'song',title:'Song',primaryChannelId:'english',
    variants:{english:{mode:'content',resourceId:resourceIds.english},russian:{mode:'content',resourceId:resourceIds.russian},media:{mode:'derive',from:'russian',transform:{id:'first-lines',version:1,maxLines:2}}},
    arrangement:[{id:'verse',sectionId:'verse-1'}],titlePresetId:'wotbc-song-title',lyricsPresetId:'wotbc-song-stacked',
    songPresentation:{stackedTranslation:true,primaryChannelId:'russian',secondaryChannelId:'english',credits:''}})
}
function passage(project:any) {
  return core.addBibleItem(project,{id:'passage',title:'John 1:1-24',range:{bookId:'John',start:{chapter:1,verse:1},end:{chapter:1,verse:24}},presetId:'wotbc-sermon-scripture',
    passagesByChannel:Object.fromEntries(['english','russian','media'].map(channel=>[channel,{reference:'John 1:1-24',translationId:channel==='english'?'BSB':'SYNO-W',attribution:'',
      verses:Array.from({length:24},(_,i)=>({number:i+1,text:channel==='english'?'Exact Scripture words retained on every page. '.repeat(2):'Точные слова Писания сохраняются на каждой странице. '.repeat(2)}))}]))})
}

test('a song slide chooses its singing language independently and retains it through edit, move and reopen',()=>{
  const original=bilingualSong(),resources=JSON.stringify(original.resources)
  let project:any=JSON.parse(JSON.stringify(original))
  let rows=plannerSlides(project),lyrics=rows.filter(row=>row.itemId==='song'&&row.index>0)
  assert.equal(lyrics.length,3)
  project.items.song.songPresentation.slidePrimaryChannelIds={[lyrics[1].cue!.sourceLeafKey]:'english'}
  project=roundTrip(project);rows=plannerSlides(project);lyrics=rows.filter(row=>row.index>0)
  assert.match(lyrics[0].cue!.channels.english.blocks[0].text,/Русский/)
  assert.match(lyrics[1].cue!.channels.russian.blocks[0].text,/English two/)
  assert.match(lyrics[1].cue!.channels.russian.blocks[1].text,/Русский/)
  assert.equal(plannerPreview(rows,lyrics[1],'media').output.blocks[0].text,'English two')
  project=editPlannerSlide(project,lyrics[1],'russian',0,'Edited primary')
  rows=plannerSlides(project);lyrics=rows.filter(row=>row.index>0)
  assert.equal(lyrics[1].cue!.channels.english.blocks[0].text,'Edited primary')
  project=movePlannerSlide(project,lyrics[1],lyrics[0]);rows=plannerSlides(roundTrip(project));lyrics=rows.filter(row=>row.index>0)
  assert.equal(lyrics[0].cue!.channels.russian.blocks[0].text,'Edited primary')
  assert.match(lyrics[1].cue!.channels.russian.blocks[0].text,/Русский one/)
  assert.equal(JSON.stringify(original.resources),resources)
  assert.throws(()=>core.normalizeServiceProject({...project,items:{...project.items,song:{...project.items.song,songPresentation:{...project.items.song.songPresentation,slidePrimaryChannelIds:{title:'media'}}}}}),/Invalid song presentation/)
})

test('song title translation can be hidden independently and a solo override edits the chosen source',()=>{
  let project:any=JSON.parse(JSON.stringify(bilingualSong()))
  project.items.song.songPresentation.showTitleTranslation=false
  project.items.song.songPresentation.slidePrimaryChannelIds={title:'english'}
  let rows=plannerSlides(roundTrip(project))
  assert.deepEqual(rows[0].cue!.channels.russian.blocks,[{type:'text',role:'title',text:'A Song'}])
  project.items.song.songPresentation.showTitleTranslation=true
  rows=plannerSlides(project)
  assert.equal(rows[0].cue!.channels.english.blocks[1].spans[0].foreground,'#ffc000')
  project.items.song.songPresentation.stackedTranslation=false
  project.items.song.songPresentation.slidePrimaryChannelIds[rows[2].cue!.sourceLeafKey]='russian'
  rows=plannerSlides(project)
  assert.equal(rows[2].cue!.channels.english.blocks.length,1)
  project=editPlannerSlide(project,rows[2],'english',0,'Solo Russian edit')
  rows=plannerSlides(roundTrip(project))
  assert.equal(rows[2].cue!.channels.english.blocks[0].text,'Solo Russian edit')
  assert.equal(rows[2].cue!.channels.russian.blocks[0].text,'Solo Russian edit')
})

test('long Scripture projects the full requested address once; reflow and source checksums remain exact',()=>{
  const original=passage(fixture())
  let project:any=roundTrip(preparePlannerPresentation(original).project)
  let pages=project.items.passage.childIds.map((id:string)=>project.items[id])
  assert.ok(pages.length>2)
  assert.equal(pages[0].passagesByChannel.english.displayReference,'John 1:1-24')
  pages.slice(1).forEach((item:any)=>assert.equal(item.passagesByChannel.english.displayReference,''))
  assert.match(formatting.scriptureDisplay(pages[0].passagesByChannel.english,'wotbc-sermon-scripture').text,/^John 1:1-24 /)
  assert.doesNotMatch(formatting.scriptureDisplay(pages[1].passagesByChannel.english,'wotbc-sermon-scripture').text,/John/)
  assert.notEqual(pages[0].passagesByChannel.english.reference,'John 1:1-24')
  project=roundTrip(reflowScripture(project,pages[1].id,60).project)
  pages=project.items.passage.childIds.map((id:string)=>project.items[id])
  assert.equal(pages[0].passagesByChannel.english.displayReference,'John 1:1-24')
  pages.slice(1).forEach((item:any)=>assert.equal(item.passagesByChannel.english.displayReference,''))
  assert.deepEqual(pages.flatMap((item:any)=>item.passagesByChannel.english.verses),original.items.passage.passagesByChannel.english.verses)
  pages.forEach((item:any)=>assert.ok(item.passagesByChannel.english.contentSha256))
})

test('sermon hints describe a passage or new point and a title choice disables hints throughout its sermon',()=>{
  let project:any=fixture()
  project=core.addProjectItem(project,{id:'title',kind:'sermon',title:'Sermon title',sermonTemplate:'title',presetId:'wotbc-sermon-title',titlesByChannel:{english:'Sermon title',russian:'Проповедь'},textByChannel:{english:'',russian:''},sermonPresentation:{showText:true,darkenBackground:true,showNextSlideHints:false}})
  project=core.addProjectItem(project,{id:'point',kind:'sermon',title:'Point',sermonTemplate:'point',presetId:'wotbc-sermon',textByChannel:{english:'I. Previous point\nII. New point',russian:'I. Пункт\nII. Новый пункт'}})
  project=passage(project)
  project=roundTrip(preparePlannerPresentation(project).project)
  let rows=plannerSlides(project)
  assert.ok(rows.every(row=>row.cue?.showNextSlideHints===false))
  assert.deepEqual(plannerPreview(rows,rows[0],'media').next,{state:'blank',text:''})
  project=JSON.parse(JSON.stringify(project))
  project.items.title.sermonPresentation.showNextSlideHints=true
  rows=plannerSlides(project)
  assert.equal(plannerPreview(rows,rows[0],'english').next.text,'II. New point')
  assert.equal(plannerPreview(rows,rows.find(row=>row.itemId==='point'),'english').next.text,'John 1:1-24')
  const passageSlide=rows.find(row=>row.kind==='bible')!
  assert.match(plannerPreview(rows,passageSlide,'english').next.text,/^John 1:/)
  assert.throws(()=>core.normalizeServiceProject({...project,items:{...project.items,title:{...project.items.title,sermonPresentation:{showText:true,darkenBackground:true,showNextSlideHints:'off'}}}}),/Sermon image options/)
})

test('twenty slides remain expanded; longer services open only the active section and retain slide numbering',()=>{
  let project:any=fixture()
  for(const section of ['welcome','sermon']) {
    project=core.addProjectItem(project,{id:section,kind:'group',groupKind:'section',title:section,childIds:[]})
    for(let i=0;i<10;i++)project=core.addProjectItem(project,{id:`${section}-${i}`,kind:'notice',title:`${section} ${i}`,textByChannel:{english:`${section} ${i}`}},{parentId:section})
  }
  let rows=plannerSlides(project)
  assert.deepEqual(plannerNavigator(project,rows),rows)
  project=core.addProjectItem(project,{id:'sermon-10',kind:'notice',title:'Last slide',textByChannel:{english:'Last slide'}},{parentId:'sermon'})
  rows=plannerSlides(project)
  assert.equal(plannerNavigator(project,rows).length,2)
  let visible=plannerNavigator(project,rows,rows.find(row=>row.itemId==='sermon-8')!.id)
  assert.equal(visible.filter(row=>row.cue).length,11)
  assert.equal(visible.find(row=>row.itemId==='welcome')!.sectionExpanded,false)
  assert.equal(visible.find(row=>row.itemId==='sermon')!.sectionExpanded,true)
  assert.equal(visible.find(row=>row.itemId==='sermon-8')!.number,19)
  project=JSON.parse(JSON.stringify(bilingualSong()))
  for(let i=0;i<18;i++)project=core.addProjectItem(project,{id:`blank-${i}`,kind:'blank',title:'Blank'})
  rows=plannerSlides(project)
  visible=plannerNavigator(project,rows)
  assert.equal(visible.filter(row=>row.itemId==='song').length,1)
  visible=plannerNavigator(project,rows,rows.find(row=>row.itemId==='song'&&row.index===2)!.id)
  assert.equal(visible.filter(row=>row.itemId==='song').length,4)
})
