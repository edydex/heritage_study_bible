'use client'
import { useEffect, useLayoutEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import SlideText from './SlideText'
import {usePresentationAccessibility,PresentationColorInput} from './PresentationAccessibility'
import {patternImage,linePattern} from './presentationPalette'
import layout from '../../packages/service-core/node/services/project/CanvasLayout.js'
import './canvas-slide.css'

type ObjectValue = Record<string, any>
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))
export function newCanvasObject(type: string, extra: ObjectValue = {}) {
  return { id: `object-${crypto.randomUUID()}`, type, frame: { x:.15, y:.2, width:type==='brace' ? .1 : type==='circle' ? .225 : .4, height:type==='text' ? .24 : .4, rotation:0 },
    ...(type === 'text' ? {text:'',spans:[],fontSize:64,align:'left',color:'#ffffff'} : type === 'image' ? {} : {color:'#ffc000',lineWidth:4,filled:false}), ...extra }
}
export default function CanvasSlide({ objects, mediaUrl, onChange, onImage, uploading = false }: {
  objects: ObjectValue[]; mediaUrl: (id:string)=>string | undefined;
  onChange?: (objects:ObjectValue[])=>void; onImage?: ()=>void; uploading?: boolean
}) {
  const {monochrome}=usePresentationAccessibility()
  const patternPrefix=useId()
  const canvas = useRef<HTMLDivElement>(null)
  const [values,setValues] = useState(objects)
  const current = useRef(objects)
  const [selectedId,setSelectedId] = useState<string | null>(null)
  const [tools,setTools] = useState<HTMLElement | null>(null)
  const gesture = useRef<any>(null)
  const selected = values.find(value=>value.id===selectedId)
  const editable = Boolean(onChange)
  useLayoutEffect(()=>{current.current=objects;setValues(objects)},[objects])
  useEffect(()=>{if(editable)setTools(document.getElementById('heritage-canvas-tools'))},[editable])
  useEffect(() => {
    const root = canvas.current
    if (!root) return
    const fit = () => {
      const scale = root.clientWidth / 1920
      for (const node of root.querySelectorAll<HTMLElement>('[data-canvas-font]')) {
        const text = node.querySelector<HTMLElement>('[data-fit-text]')
        if (!text) continue
        let size = Number(node.dataset.canvasFont)
        text.style.setProperty('font-size', `${size * scale}px`, 'important')
        while (size > 1 && (text.scrollHeight > text.clientHeight + 1 || text.scrollWidth > text.clientWidth + 1)) {
          size = Math.max(1, size - 2)
          text.style.setProperty('font-size', `${size * scale}px`, 'important')
        }
      }
    }
    const observer = new ResizeObserver(fit)
    observer.observe(root)
    root.addEventListener('input-fit', fit)
    fit()
    return () => { observer.disconnect(); root.removeEventListener('input-fit', fit) }
  }, [values])

  function commit(next:ObjectValue[]) { current.current=next;setValues(next);onChange?.(next) }
  function patch(change:ObjectValue) { if(selected)commit(values.map(object=>object.id===selected.id ? {...object,...change} : object)) }
  function frame(change:ObjectValue) {
    if(!selected)return
    const next={...selected.frame,...change}
    next.width=clamp(next.width,.01,1);next.height=clamp(next.height,.01,1)
    next.x=clamp(next.x,0,1-next.width);next.y=clamp(next.y,0,1-next.height)
    patch({frame:next})
  }
  function begin(event:React.PointerEvent,object:ObjectValue,kind:string) {
    if(!editable || event.button!==0)return
    event.preventDefault();event.stopPropagation();setSelectedId(object.id)
    const rect=canvas.current!.getBoundingClientRect(), f=object.frame
    gesture.current={object,kind,rect,x:event.clientX,y:event.clientY,before:current.current,
      angle:Math.atan2(event.clientY-(rect.top+(f.y+f.height/2)*rect.height),event.clientX-(rect.left+(f.x+f.width/2)*rect.width))}
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function move(event:React.PointerEvent) {
    const g=gesture.current;if(!g)return
    const f={...g.object.frame},dx=(event.clientX-g.x)/g.rect.width,dy=(event.clientY-g.y)/g.rect.height
    if(g.kind==='move') {f.x=clamp(f.x+dx,0,1-f.width);f.y=clamp(f.y+dy,0,1-f.height)}
    if(g.kind==='resize') {
      const angle=f.rotation*Math.PI/180, px=event.clientX-g.x, py=event.clientY-g.y
      const dw=(px*Math.cos(angle)+py*Math.sin(angle))/g.rect.width
      const dh=(-px*Math.sin(angle)+py*Math.cos(angle))/g.rect.height
      f.width=clamp(f.width+dw,.01,1-f.x);f.height=clamp(f.height+dh,.01,1-f.y)
    }
    if(g.kind==='rotate') {
      const angle=Math.atan2(event.clientY-(g.rect.top+(f.y+f.height/2)*g.rect.height),event.clientX-(g.rect.left+(f.x+f.width/2)*g.rect.width))
      f.rotation=((f.rotation+(angle-g.angle)*180/Math.PI+540)%360)-180
    }
    current.current=g.before.map((object:ObjectValue)=>object.id===g.object.id?{...object,frame:f}:object);setValues(current.current)
  }
  function end(event:React.PointerEvent,cancel=false) {
    const g=gesture.current;if(!g)return
    gesture.current=null
    if(cancel) {current.current=g.before;setValues(g.before)} else commit(current.current)
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function add(type:string,extra:ObjectValue={}) {const value=newCanvasObject(type,extra);commit([...values,value]);setSelectedId(value.id)}
  function layer(direction:number) {
    if(!selected)return
    const next=[...values], index=next.indexOf(selected),target=clamp(index+direction,0,next.length-1)
    next.splice(index,1);next.splice(target,0,selected);commit(next)
  }
  const toolbar=editable && tools ? createPortal(<div className="heritage-canvas-tools">
    <h3>Slide objects</h3>
    <div className="heritage-canvas-tools__add" role="toolbar" aria-label="Add slide object">
      <button type="button" disabled={values.length>=64} onClick={()=>add('text')}>Add text</button>
      <button type="button" disabled={uploading || values.length>=64} onClick={onImage}>{uploading?'Uploading…':'Add image'}</button>
      <button type="button" disabled={values.length>=64} onClick={()=>add('brace')}>Add brace {'}'}</button>
      <button type="button" disabled={values.length>=64} onClick={()=>add('circle')}>Outline circle</button>
      <button type="button" disabled={values.length>=64} onClick={()=>add('circle',{filled:true})}>Filled circle</button>
    </div>
    <details className="heritage-canvas-tools__help"><summary>Editing tips</summary><p>Select an object to move, resize or rotate it. Click inside text to type; select words to format them. Text shrinks to fit its box.</p></details>
    {selected && <div className="heritage-canvas-tools__properties" aria-label="Selected object properties">
      {(['x','y','width','height'] as const).map(key=><label key={key}>{({x:'Left',y:'Top',width:'Width',height:'Height'})[key]} %<input type="number" min={key==='width'||key==='height'?1:0} max="100" step="1" value={Math.round(selected.frame[key]*100)} onChange={event=>{if(event.currentTarget.value)frame({[key]:Number(event.currentTarget.value)/100})}} /></label>)}
      <label>Rotation °<input type="number" min="-180" max="180" value={Math.round(selected.frame.rotation)} onChange={event=>frame({rotation:clamp(Number(event.currentTarget.value),-180,180)})} /></label>
      {selected.type!=='image' && <label>Object color<PresentationColorInput label="Object color" value={selected.color} onChange={color=>patch({color})} /></label>}
      {selected.type==='text' && <><label>Font size (maximum)<input type="number" min="16" max="240" value={selected.fontSize} onChange={event=>patch({fontSize:clamp(Number(event.currentTarget.value),16,240)})} /></label><label>Align<select value={selected.align} onChange={event=>patch({align:event.currentTarget.value})}><option>left</option><option>center</option><option>right</option></select></label></>}
      {['brace','circle'].includes(selected.type) && <label>Line width<input type="number" min="1" max="30" value={selected.lineWidth} onChange={event=>patch({lineWidth:clamp(Number(event.currentTarget.value),1,30)})} /></label>}
      {selected.type==='circle' && <label><input type="checkbox" checked={selected.filled} onChange={event=>patch({filled:event.currentTarget.checked})} />Filled</label>}
      <button type="button" onClick={()=>layer(1)}>Bring forward</button><button type="button" onClick={()=>layer(-1)}>Send backward</button>
      <button type="button" onClick={()=>{commit(values.filter(object=>object.id!==selected.id));setSelectedId(null)}}>Delete object</button>
    </div>}
  </div>,tools):null
  return <>{toolbar}<div className="heritage-canvas" ref={canvas} aria-label="Freeform slide" onPointerDown={event=>{if(event.target===event.currentTarget)setSelectedId(null)}}>
    {values.map((object,index)=>{
      const f=object.frame,isSelected=editable && selectedId===object.id
      return <div key={object.id} className="heritage-canvas__object" data-object-type={object.type} data-canvas-font={object.type==='text' ? object.fontSize : undefined} data-selected={isSelected || undefined}
        style={{left:`${f.x*100}%`,top:`${f.y*100}%`,width:`${f.width*100}%`,height:`${f.height*100}%`,transform:`rotate(${f.rotation}deg)`,color:monochrome?'#111111':object.color,fontSize:`${(object.fontSize || 64)/19.2}cqw`,textAlign:object.align}}
        tabIndex={editable?0:undefined} role={editable?'group':undefined} aria-label={`${object.type} object ${index+1}`}
        onPointerDown={event=>{if(!editable)return;setSelectedId(object.id);if(object.type!=='text')begin(event,object,'move')}}
        onPointerMove={move} onPointerUp={event=>end(event)} onPointerCancel={event=>end(event,true)}
        onKeyDown={event=>{if(event.target!==event.currentTarget || !editable)return;const delta=event.shiftKey ? .01 : .001;const changes:any={ArrowLeft:{x:f.x-delta},ArrowRight:{x:f.x+delta},ArrowUp:{y:f.y-delta},ArrowDown:{y:f.y+delta}};if(changes[event.key]){event.preventDefault();frame(changes[event.key])}}}>
        {object.type==='text'?<SlideText baseColor={object.color} text={object.text} spans={object.spans} role="canvas-text" label={`Text object ${index+1}`} placeholder="Click to type" readOnly={!editable} canFormat={editable} onCommit={(text,spans)=>commit(current.current.map(value=>value.id===object.id?{...value,text,spans}:value))} />
          :object.type==='image'?<img draggable={false} src={mediaUrl(object.assetId)} alt={object.altText || 'Slide image'} />
          :<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{monochrome && <defs><pattern id={`${patternPrefix}-${index}`} patternUnits="userSpaceOnUse" width="8" height="8"><image href={patternImage(object.color).slice(5,-2)} width="8" height="8" /></pattern></defs>}{object.type==='brace'?<path d={layout.BRACE_PATH} fill="none" stroke="currentColor" strokeDasharray={monochrome?linePattern(object.color):undefined} strokeWidth={`${object.lineWidth/19.2}cqw`} vectorEffect="non-scaling-stroke" />:<ellipse cx="50" cy="50" rx="47" ry="47" fill={object.filled?(monochrome?`url(#${patternPrefix}-${index})`:'currentColor'):'none'} stroke="currentColor" strokeDasharray={monochrome?linePattern(object.color):undefined} strokeWidth={`${object.lineWidth/19.2}cqw`} vectorEffect="non-scaling-stroke" />}</svg>}
        {isSelected && (['move','resize','rotate'] as const).map(kind=><button key={kind} type="button" className={`heritage-canvas__handle heritage-canvas__handle--${kind}`} aria-label={`${kind[0].toUpperCase()+kind.slice(1)} selected object`} onPointerDown={event=>begin(event,object,kind)}>{kind==='move'?'✥':kind==='resize'?'↘':'↻'}</button>)}
      </div>
    })}
  </div></>
}
