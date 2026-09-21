'use client'
import SlideText from './SlideText'
import OutlineSlideEditor from './OutlineSlideEditor'

export default function TemplateSlideEditor({ item, channelId, uploading, onImage, onEdit }: {
  item: Record<string, any>; channelId: string; uploading: boolean; onImage: () => void;
  onEdit: (field: 'heading' | 'body' | 'next', text: string, spans: any[]) => void
}) {
  const isTitle = item.sermonTemplate === 'title'
  const showText = !isTitle || item.sermonPresentation?.showText !== false
  const body = item.textByChannel[channelId] || ''
  return <>
    {isTitle && !item.backgroundAssetId ? <button type="button" className="heritage-service-planner__image-placeholder" disabled={uploading} onClick={onImage}>
      <span aria-hidden="true">▧</span>{uploading ? 'Uploading image…' : 'Choose title image'}
    </button> : null}
    {showText ? <>
      <SlideText text={item.titlesByChannel?.[channelId] || ''} spans={item.titleSpansByChannel?.[channelId]} role="title"
        label={`${channelId} ${isTitle ? 'sermon title' : 'heading'}`} placeholder={isTitle ? 'Sermon title' : 'Heading (optional)'} canFormat onCommit={(text, spans) => onEdit('heading', text, spans)} />
      <div className="heritage-service-planner__template-body" data-fit-text>
        {item.sermonTemplate === 'point' ? <OutlineSlideEditor text={body} spans={item.spansByChannel?.[channelId]} channelId={channelId} onCommit={(text,spans)=>onEdit('body',text,spans)} /> : <SlideText text={body} spans={item.spansByChannel?.[channelId]} role={isTitle ? 'subtitle' : 'body'}
          label={`${channelId} ${isTitle ? 'subtitle' : 'slide text'}`} placeholder={isTitle ? 'Subtitle (optional)' : 'Click to add your text'} canFormat onCommit={(text, spans) => onEdit('body', text, spans)} />}
      </div>
    </> : null}
  </>
}
