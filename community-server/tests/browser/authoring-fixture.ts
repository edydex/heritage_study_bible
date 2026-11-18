// Disposable rendering fixture. Contains sample content only and is never
// imported by the application or written to the production Community.
import core from '../../packages/service-core/index.js'
import { preparePlannerPresentation } from '../../src/components/plannerPresentation'

export function authoringFixture() {
  let project:any=core.createServiceProject({id:'authoring-rehearsal',title:'Slide authoring rehearsal',serviceDate:'2026-10-04',
    channels:[{id:'english',label:'English',language:'en'},{id:'russian',label:'Russian',language:'ru'},{id:'media',label:'Stage',language:'ru'}],
    preferredProfileId:'main-sanctuary',presetPack:{id:'main-sanctuary',version:1,sha256:null}})
  const resources:Record<string,string>={}
  for (const [channel,title,line] of [['english','We sing together','English congregation line'],['russian','Поём вместе','Русская строка для собрания']]) {
    const result=core.addSongResource(project,core.parseSongDocument(`---\nid: sample-${channel}\ntitle: ${title}\nlanguage: ${channel==='english'?'en':'ru'}\n---\n\n^1\n${line} one\n---\n${line} two\n---\n${line} three\n`,{fileName:`sample-${channel}.md`}))
    project=result.project;resources[channel]=result.resourceId
  }
  project=core.addProjectItem(project,{id:'sample-song',kind:'song',title:'We sing together',primaryChannelId:'english',arrangement:[{id:'verse',sectionId:'verse-1'}],
    variants:{english:{mode:'content',resourceId:resources.english},russian:{mode:'content',resourceId:resources.russian},media:{mode:'derive',from:'russian',transform:{id:'first-lines',version:1,maxLines:2}}},
    titlePresetId:'wotbc-song-title',lyricsPresetId:'wotbc-song-stacked',songPresentation:{stackedTranslation:true,primaryChannelId:'russian',secondaryChannelId:'english',credits:'Sample writer'}})
  project=core.addProjectItem(project,{id:'sermon-title',kind:'sermon',title:'The Word became flesh',sermonTemplate:'title',presetId:'wotbc-sermon-title',titlesByChannel:{english:'The Word became flesh',russian:'Слово стало плотью'},textByChannel:{english:'John 1',russian:'Иоанна 1'},sermonPresentation:{showText:true,darkenBackground:true}})
  for(let i=1;i<=12;i++)project=core.addProjectItem(project,{id:`sermon-point-${i}`,kind:'sermon',title:`Point ${i}`,sermonTemplate:'point',presetId:'wotbc-sermon',textByChannel:{english:`${i}. Consider the next part of the passage`,russian:`${i}. Рассмотрим следующую часть отрывка`}})
  project=core.addBibleItem(project,{id:'long-passage',title:'John 1:1–24',presetId:'wotbc-sermon-scripture',range:{bookId:'John',start:{chapter:1,verse:1},end:{chapter:1,verse:24}},
    passagesByChannel:Object.fromEntries(['english','russian','media'].map(channel=>[channel,{reference:'John 1:1–24',translationId:channel==='english'?'BSB':'SYNO-W',attribution:'',verses:Array.from({length:24},(_,i)=>({number:i+1,text:(channel==='english'?'Sample reading words for this Scripture rehearsal. ':'Пример текста для репетиции чтения Писания. ').repeat(3)}))}]))})
  return preparePlannerPresentation(project).project
}
