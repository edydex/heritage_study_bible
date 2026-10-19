'use client'
import SlideText from './SlideText'
import presentationText from '../../packages/service-core/node/services/project/PresentationText.js'
export default function OutlineSlidePreview({text,spans=[]}:{text:string;spans?:any[]}) {
  return <div className="heritage-service-planner__outline heritage-outline-preview" data-role="body">
    {presentationText.outlineParagraphs(text).map((row:any)=><div key={row.start} className="heritage-service-planner__outline-row">
      <span className="heritage-service-planner__outline-marker"><SlideText text={text.slice(row.start,row.prefixEnd)} spans={presentationText.sliceSpans(spans,row.start,row.prefixEnd)} role="outline-marker" label="Outline marker" readOnly onCommit={()=>{}} /></span>
      <SlideText text={text.slice(row.prefixEnd,row.end)} spans={presentationText.sliceSpans(spans,row.prefixEnd,row.end)} role="outline-text" label="Outline point" readOnly onCommit={()=>{}} />
    </div>)}
  </div>
}
