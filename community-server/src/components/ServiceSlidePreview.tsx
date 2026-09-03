'use client'
import PreviewCanvas from './PreviewCanvas'
import SlideText from './SlideText'
import { plannerPreview } from './plannerPreview'
import { isSongTitleSlide, type PlannerSlide } from './plannerSlides'
import formatting from '../../packages/service-core/node/services/project/SlideFormatting.js'

/** Read-only rendering of compiled cues: no template guides and no editor mutations. */
export default function ServiceSlidePreview({project,rows,slide,channelId,mediaUrl,playVideo=false}: {
  project: Record<string,any>; rows: PlannerSlide[]; slide: PlannerSlide; channelId: string;
  mediaUrl: (assetId: string)=>string | undefined; playVideo?: boolean
}) {
  const item=project.items[slide.itemId]
  const preview=plannerPreview(rows,slide,channelId)
  const blocks=preview.output?.mode==='hide' ? [] : preview.output?.blocks || []
  const background=blocks.find((block:any)=>block.type==='image' && block.role==='background')
  const backgroundId=background?.assetId || (preview.output?.mode!=='hide' ? item.backgroundAssetId : undefined)
  return <PreviewCanvas kind={item.kind} presetId={preview.presetId} titleCard={isSongTitleSlide(slide)} singer={preview.singer} next={preview.next}
    backgroundUrl={backgroundId ? mediaUrl(backgroundId) : undefined} backgroundDimOpacity={item.sermonPresentation?.darkenBackground===false ? 0 : .55}>
    {blocks.map((block:any,index:number)=>{
      if (block.type==='image' && block.role==='background') return null
      if (block.type==='image' || block.type==='video') {
        const source=mediaUrl(block.assetId)
        if (!source) return <p key={index} className="heritage-service-planner__stage-status">Media unavailable</p>
        if (block.type==='image') return <img key={index} src={source} alt={block.altText || ''} loading="lazy" style={{objectFit:block.fit==='fill' ? 'cover' : block.fit==='stretch' ? 'fill' : 'contain'}} />
        return playVideo ? <video key={`${slide.id}:${index}`} src={source} controls preload="metadata" muted={block.muted} style={{objectFit:block.fit==='fill' ? 'cover' : block.fit==='stretch' ? 'fill' : 'contain'}} />
          : <div key={index} className="heritage-service-preview__video-poster" aria-label="Video slide">▷</div>
      }
      if (block.type==='bible') return <div key={index} className="heritage-service-planner__scripture-page" data-fit-text>
        <p className="heritage-service-planner__scripture-reference">{block.reference} <small>{block.translationId}</small></p>
        <SlideText text={formatting.scriptureFlowText(block.verses)} spans={block.spans} role="body" label={`${channelId} Scripture preview`} readOnly onCommit={()=>{}} />
      </div>
      return block.type==='text' ? <SlideText key={`${slide.id}:${channelId}:${index}`} text={block.text} spans={block.spans} role={block.role} label={`${channelId} slide preview`} readOnly onCommit={()=>{}} /> : null
    })}
  </PreviewCanvas>
}
