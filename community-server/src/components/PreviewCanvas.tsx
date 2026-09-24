'use client'
import { useEffect, useRef } from 'react'
import './translation-cue.css'
import typography from '../../packages/service-core/node/services/project/SlideTypography.js'
import {usePresentationAccessibility} from './PresentationAccessibility'

export default function PreviewCanvas({ captionReservation = 0, textStyle, kind, presetId, template, titleCard, singer, next, backgroundUrl, backgroundDimOpacity = 0.55, children }: { captionReservation?: number; textStyle?: Record<string, any>; kind: string; presetId?: string; template?: string; titleCard?: boolean; singer?: boolean; next?: {state: string; text: string}; backgroundUrl?: string; backgroundDimOpacity?: number; children: React.ReactNode }) {
  const {monochrome}=usePresentationAccessibility()
  const stage = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = stage.current
    if (!element) return
    const fit = () => {
      if (element.querySelector('.heritage-canvas')) return
      const preset = typography.textPreset(presetId, textStyle)
      const logicalSize = preset.bodySize
      const scale = element.clientWidth / 1920
      const headingSize = titleCard ? (presetId === 'wotbc-song-title' ? 144 : 128) : template === 'title' ? logicalSize : preset.titleSize
      element.style.setProperty('--slide-heading-size', `${headingSize * scale}px`)
      element.style.setProperty('--slide-subtitle-size', `${(titleCard ? (presetId === 'wotbc-song-title' ? 128 : 92) : logicalSize * .65) * scale}px`)
      element.style.setProperty('--slide-credit-size', `${(titleCard ? 56 : presetId === 'wotbc-sermon-quote' ? logicalSize : 26) * scale}px`)
      if (captionReservation > 0 && !titleCard && template !== 'title') {
        const heading = element.querySelector<HTMLElement>('[data-role="title"]')
        let fittedHeading = headingSize * scale
        while (heading?.textContent?.trim() && fittedHeading > 3 && heading.offsetHeight > element.clientHeight * .16) {
          fittedHeading = Math.max(3, fittedHeading - scale)
          element.style.setProperty('--slide-heading-size', `${fittedHeading}px`)
        }
      }

      let size = element.clientWidth / 1920 * logicalSize
      element.style.setProperty('--slide-text-size', `${size}px`)
      const positionBody = () => {
        const content = element.querySelector<HTMLElement>('.heritage-service-planner__slide-content')!
        if ((presetId === 'wotbc-sermon-scripture' || presetId === 'wotbc-sermon') && !singer) {
          const heading = content.querySelector<HTMLElement>('[data-role="title"]')
          const passage = content.querySelector<HTMLElement>('.heritage-service-planner__scripture-page, .heritage-service-planner__template-body, [data-role="body"]')
          if (passage) {
            const top = Math.max(element.clientHeight * .16, heading ? heading.offsetTop + Math.max(heading.offsetHeight, heading.scrollHeight) + element.clientHeight * .02 : 0)
            passage.style.top = `${top}px`
            passage.style.maxHeight = `${Math.max(1, element.clientHeight - top - element.clientHeight * .02)}px`
          }
        }
      }
      positionBody()
      const overflows = () => {
        const content = element.querySelector<HTMLElement>('.heritage-service-planner__slide-content')!
        // contentEditable scrollHeight includes font descenders and the caret,
        // even when the text fits. Measure visible glyphs against the actual
        // slide region instead; otherwise a short empty quote can shrink.
        const bounds = (titleCard ? element : content).getBoundingClientRect()
        return [...element.querySelectorAll<HTMLElement>('[data-role]')].some(node => {
          if (!node.textContent?.trim()) return captionReservation > 0 && Boolean(node.dataset.placeholder)
            && node.getBoundingClientRect().bottom > bounds.bottom + 2
          const range = document.createRange()
          range.selectNodeContents(node)
          return [...range.getClientRects()].some(rect => rect.bottom > bounds.bottom + 2
            || rect.right > bounds.right + 2 || rect.left < bounds.left - 2)
        })
      }
      while ((!textStyle?.bodySize || captionReservation > 0) && size > 3 && overflows()) {
        size = Math.max(3, size - scale)
        element.style.setProperty('--slide-text-size', `${size}px`)
        if (captionReservation > 0) {
          const ratio = size / (logicalSize * scale)
          if (titleCard || template === 'title') element.style.setProperty('--slide-heading-size', `${headingSize * scale * ratio}px`)
          element.style.setProperty('--slide-subtitle-size', `${(titleCard ? (presetId === 'wotbc-song-title' ? 128 : 92) : logicalSize * .65) * scale * ratio}px`)
          element.style.setProperty('--slide-credit-size', `${(titleCard ? 56 : presetId === 'wotbc-sermon-quote' ? logicalSize : 26) * scale * ratio}px`)
        }
        positionBody()
      }
      // Match the text after fitting, including title/body preset overrides.
      // The footer clips its prefix to one line; it must never shrink to fit.
      const content = element.querySelector<HTMLElement>('.heritage-service-planner__slide-content')!
      const primary = content.querySelector<HTMLElement>('[data-role="lyrics"], [data-role="body"]')
        || content.querySelector<HTMLElement>('.heritage-service-planner__scripture-page p:not(.heritage-service-planner__scripture-reference)')
        || content.querySelector<HTMLElement>('[data-role="title"], [data-fit-text]')
      const computedTypography = getComputedStyle(primary || content)
      element.style.setProperty('--singer-next-font-size', primary ? computedTypography.fontSize : `${size}px`)
      element.style.setProperty('--singer-next-font-weight', computedTypography.fontWeight)
      element.style.setProperty('--singer-next-font-family', computedTypography.fontFamily)
    }
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    element.addEventListener('input', fit)
    element.addEventListener('input-fit', fit)
    fit()
    let active = true
    document.fonts?.ready.then(() => { if (active) fit() })
    return () => { active = false; observer.disconnect(); element.removeEventListener('input', fit); element.removeEventListener('input-fit', fit) }
  }, [children, kind, presetId, template, titleCard, singer, textStyle, captionReservation])
  return <div className="heritage-service-planner__canvas-space"><div className="heritage-service-planner__caption-layout" style={{'--caption-reservation':captionReservation} as React.CSSProperties}><div ref={stage} className="heritage-service-planner__stage" data-monochrome={monochrome || undefined} data-monochrome-background={monochrome && Boolean(backgroundUrl) || undefined} data-kind={kind} data-preset={presetId} data-template={!singer ? template : undefined} data-title-card={titleCard || undefined} data-singer={singer || undefined} style={{'--slide-body-align':textStyle?.bodyAlign || typography.textPreset(presetId).bodyAlign || 'center', '--slide-title-align':textStyle?.titleAlign || typography.textPreset(presetId).titleAlign || 'center', '--slide-credit-align':textStyle?.creditAlign || (titleCard ? 'center' : 'right'), ...(backgroundUrl ? { backgroundImage: `linear-gradient(rgba(0,0,0,${backgroundDimOpacity}), rgba(0,0,0,${backgroundDimOpacity})), url("${backgroundUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {})} as React.CSSProperties}><>{monochrome && backgroundUrl && <div className="presentation-monochrome-background" style={{backgroundImage:`url("${backgroundUrl}")`}} aria-hidden="true" />}<div className="heritage-service-planner__slide-content">{children}</div>
    {singer && next ? <aside className="heritage-service-planner__next-lines" aria-label="Next slide cue" data-state={next.state}>
      <p>{next.state === 'end' ? 'End of presentation' : next.text}</p>
    </aside> : null}
  </></div>{captionReservation>0 && <aside className="heritage-service-planner__caption-reservation">Live translation · {Math.round(captionReservation*100)}% reserved</aside>}</div></div>
}
