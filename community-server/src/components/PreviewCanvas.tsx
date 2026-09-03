'use client'
import { useEffect, useRef } from 'react'

export default function PreviewCanvas({ kind, presetId, template, titleCard, singer, next, backgroundUrl, backgroundDimOpacity = 0.55, children }: { kind: string; presetId?: string; template?: string; titleCard?: boolean; singer?: boolean; next?: {state: string; text: string}; backgroundUrl?: string; backgroundDimOpacity?: number; children: React.ReactNode }) {
  const stage = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = stage.current
    if (!element) return
    const fit = () => {
      const logicalSize = presetId === 'wotbc-sermon-title' ? 112 : presetId === 'wotbc-sermon-quote' ? 94 : presetId === 'wotbc-sermon-verse' ? 88 : titleCard ? 98 : kind === 'bible' ? 96 : kind === 'sermon' ? 82 : kind === 'song' ? (presetId === 'wotbc-song-lyrics' ? 106 : 98) : 76
      let size = element.clientWidth / 1920 * logicalSize
      element.style.setProperty('--slide-text-size', `${size}px`)
      const overflows = () => {
        const content = element.querySelector<HTMLElement>('.heritage-service-planner__slide-content')!
        const textOverflow = [...element.querySelectorAll<HTMLElement>('[data-fit-text]')].some(node => node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1)
        // Credits deliberately sit outside the centered title region.
        if (titleCard) return textOverflow || [...content.querySelectorAll<HTMLElement>('[data-role="title"], [data-role="subtitle"]')].reduce((height, node) => height + node.offsetHeight, 0) > content.clientHeight
        return textOverflow || content.scrollHeight > content.clientHeight + 1 || content.scrollWidth > content.clientWidth + 1
      }
      while (size > 6 && overflows()) {
        size *= 0.92
        element.style.setProperty('--slide-text-size', `${size}px`)
      }
      // Match the text after fitting, including title/body preset overrides.
      // The footer clips its prefix to one line; it must never shrink to fit.
      const content = element.querySelector<HTMLElement>('.heritage-service-planner__slide-content')!
      const primary = content.querySelector<HTMLElement>('[data-role="lyrics"], [data-role="body"]')
        || content.querySelector<HTMLElement>('.heritage-service-planner__scripture-page p:not(.heritage-service-planner__scripture-reference)')
        || content.querySelector<HTMLElement>('[data-role="title"], [data-fit-text]')
      const typography = getComputedStyle(primary || content)
      element.style.setProperty('--singer-next-font-size', primary ? typography.fontSize : `${size}px`)
      element.style.setProperty('--singer-next-font-weight', typography.fontWeight)
      element.style.setProperty('--singer-next-font-family', typography.fontFamily)
    }
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    element.addEventListener('input', fit)
    element.addEventListener('input-fit', fit)
    fit()
    return () => { observer.disconnect(); element.removeEventListener('input', fit); element.removeEventListener('input-fit', fit) }
  }, [children, kind, presetId, titleCard, singer])
  return <div className="heritage-service-planner__canvas-space"><div ref={stage} className="heritage-service-planner__stage" data-kind={kind} data-preset={presetId} data-template={!singer ? template : undefined} data-title-card={titleCard || undefined} data-singer={singer || undefined} style={backgroundUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,${backgroundDimOpacity}), rgba(0,0,0,${backgroundDimOpacity})), url("${backgroundUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}><div className="heritage-service-planner__slide-content">{children}</div>
    {singer && next ? <aside className="heritage-service-planner__next-lines" aria-label="Next slide cue" data-state={next.state}>
      <p>{next.state === 'end' ? 'End of presentation' : next.text}</p>
    </aside> : null}
  </div></div>
}
