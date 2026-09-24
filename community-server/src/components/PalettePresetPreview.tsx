'use client'
import PreviewCanvas from './PreviewCanvas'
import SlideText from './SlideText'
import CanvasSlide from './CanvasSlide'
import { preSermonReadingObjects } from './readingTemplates'

/** Use the same 16:9 renderer, typography and role layout as the real slides.
 * Sample words/art never enter the service when a template is added. */
export default function PalettePresetPreview({type,channel='english',songSections,reference,preSermon=false}: {
  type:string;channel?:string;reference?:string;preSermon?:boolean;
  songSections?:{language:string;label:string;lines:string[]}[]
}) {
  const ru=channel!=='english'
  const text=(value:string,role='body')=><SlideText text={value} role={role} label={`${role} preset sample`} readOnly onCommit={()=>{}} />
  const preset=type==='title'?'wotbc-sermon-title':type==='passage'?'wotbc-sermon-scripture':type==='quote'?'wotbc-sermon-quote'
    :type==='reading'?'wotbc-reading-title':type==='song'?'wotbc-song-lyrics':'wotbc-sermon'
  const passage=reference || (ru?'Иоанна 8:32':'John 8:32')
  const verse=reference ? (ru?'Текст выбранного отрывка появится здесь.':'Your selected passage appears here.') : ru?'и познаете истину, и истина сделает вас свободными.':'Then you will know the truth, and the truth will set you free.'
  const section=songSections?.find(s=>s.language===(ru?'ru':'en')) || songSections?.[0]
  return <div className="heritage-preset-sample" aria-hidden="true"><PreviewCanvas kind={type==='passage'?'bible':type==='song'?'song':type==='reading'?'notice':'sermon'} presetId={preset}
    template={type==='other'?'other':type==='quote'?'quote':undefined} backgroundUrl={type==='title'?'/planner/title-sample.svg':undefined} backgroundDimOpacity={0}>
    {type==='point'&&<>{text(ru?'От тьмы к свету':'From darkness to light','title')}{text(ru?'I. Ходите во свете\n    A. Познайте истину':'I. Walk in the light\n    A. Know the truth')}</>}
    {type==='passage'&&<>{text(ru?'I. Ходите во свете':'I. Walk in the light','title')}<div className="heritage-service-planner__scripture-page" data-fit-text>{text(`${passage} ${verse}`)}</div></>}
    {type==='quote'&&<>{text(ru?'I. Ходите во свете':'I. Walk in the light','title')}{text(ru?'«Истина сделает вас свободными».':'“The truth will set you free.”')}{text(ru?'Иоанна 8:32':'John 8:32','credit')}</>}
    {type==='reading'&&(preSermon ? <CanvasSlide mediaUrl={()=>undefined} objects={preSermonReadingObjects(passage,ru?'Синодальный перевод':'Bible reading',ru?'От тьмы к свету':'From darkness to light')}/>
      : text(`${passage}\n${ru?'Синодальный перевод':'Bible reading'}`,'caption'))}
    {type==='song'&&text(section?.lines.join('\n') || (ru?'Выберите песню':'Choose a song'),'lyrics')}
    {type==='other'&&<CanvasSlide mediaUrl={()=>undefined} objects={[
      {id:'sample-text',type:'text',text:ru?'Ваш текст':'Your text',fontSize:108,color:'#ffffff',align:'left',spans:[],frame:{x:.12,y:.27,width:.46,height:.24,rotation:0}},
      {id:'sample-brace',type:'brace',color:'#ffc000',filled:false,lineWidth:4,frame:{x:.61,y:.24,width:.1,height:.5,rotation:0}},
      {id:'sample-circle',type:'circle',color:'#ffc000',filled:false,lineWidth:4,frame:{x:.76,y:.33,width:.15,height:.27,rotation:0}}
    ]}/>}
  </PreviewCanvas></div>
}
