import React, {useState} from 'react'
import {createRoot} from 'react-dom/client'
import SlideText from '../../src/components/SlideText'
import OutlineSlideEditor from '../../src/components/OutlineSlideEditor'
import CanvasSlide from '../../src/components/CanvasSlide'
import {PresentationAccessibility} from '../../src/components/PresentationAccessibility'
const initial={heading:'Original heading',body:'Original body',outline:'1. First point\n2. Second point',objects:[
  {id:'a',type:'text',text:'First object',spans:[],frame:{x:.05,y:.05,width:.4,height:.3,rotation:0},fontSize:64,align:'left',color:'#ffffff'},
  {id:'b',type:'text',text:'Second object',spans:[],frame:{x:.55,y:.05,width:.4,height:.3,rotation:0},fontSize:64,align:'left',color:'#ffffff'}]}
function Rehearsal(){
 const [values,setValues]=useState(initial),[commits,setCommits]=useState([])
 const commit=(field,value)=>{setValues(previous=>({...previous,[field]:value}));setCommits(previous=>[...previous,field])}
 return <PresentationAccessibility><div style={{padding:20,font:'20px system-ui'}}>
  <SlideText text={values.heading} label="Heading" role="title" onCommit={text=>commit('heading',text)} />
  <SlideText text={values.body} label="Body" role="body" onCommit={text=>commit('body',text)} />
  <OutlineSlideEditor text={values.outline} channelId="english" onCommit={text=>commit('outline',text)} />
  <div style={{position:'relative',height:300,background:'#123'}}><CanvasSlide objects={values.objects} mediaUrl={()=>undefined} onChange={objects=>commit('objects',objects)} /></div>
  <button onClick={()=>setValues(initial)}>External Undo</button><button>Leave editor</button>
  <output aria-label="Committed content">{JSON.stringify(values)}</output><output aria-label="Commits">{JSON.stringify(commits)}</output>
 </div></PresentationAccessibility>
}
createRoot(document.getElementById('root')).render(<Rehearsal />)
