import singerPresentation from '../../packages/service-core/node/services/project/SingerPresentation.js'
import type { PlannerSlide } from './plannerSlides'

/** Use the complete service timeline, including blanks and item boundaries. */
export function plannerPreview(rows: PlannerSlide[], active: PlannerSlide | undefined, channelId: string) {
  const singer = channelId === 'media'
  const outputFor = (slide: PlannerSlide | undefined) => {
    const cue = slide?.cue
    const output = cue?.channels?.[channelId]
    if (output?.mode !== 'condensed' || !output.sourceChannelId) return { output, presetId: cue?.presetId }
    const source = singerPresentation.singerSourceCue(cue, output.sourceChannelId)
    return { output: source.channels[output.sourceChannelId], presetId: source.presetId }
  }
  const current = singer ? outputFor(active) : { output: active?.cue?.channels?.[channelId], presetId: active?.cue?.presetId }
  const slides = rows.filter(row => row.cue)
  const index = active ? slides.findIndex(row => row.id === active.id) : -1
  const nextSlide = index >= 0 ? slides[index + 1] : undefined
  const nextOutput = outputFor(nextSlide).output
  const nextText = nextOutput?.mode === 'hide' ? '' : (nextOutput?.blocks || []).map((block: any) =>
    block.type === 'text' ? block.text
      : block.type === 'bible' ? block.verses.map((verse: any) => `${verse.number} ${verse.text}`).join(' ') : ''
  ).filter(Boolean).join('\n')
  return { ...current, singer,
    next: { state: !nextSlide ? 'end' : nextText.trim() ? 'text' : 'blank',
      text: singerPresentation.singerNextLine(nextText) } }
}
