import serviceCore from '../../packages/service-core/index.js'
import { sermonTextSpans } from './plannerSermonStyle'
import formatting from '../../packages/service-core/node/services/project/SlideFormatting.js'

type RecordValue = Record<string, any>
export type PlannerSlide = {
  id: string
  itemId: string
  parentId: string | null
  depth: number
  index: number
  number: number
  title: string
  kind: string
  cue?: RecordValue
}

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

/** The same compiler used by SyncShow is the only source of slide order. */
export function plannerSlides(project: RecordValue): PlannerSlide[] {
  const timeline = serviceCore.compileServiceProject(project, { allowEmpty: true })
  const cues = timeline.cueIds.map((id: string) => timeline.cues[id])
  const result: PlannerSlide[] = []
  let number = 0
  const visit = (itemId: string, parentId: string | null, depth: number) => {
    const item = project.items[itemId]
    if (item.kind === 'group') {
      result.push({ id: itemId, itemId, parentId, depth, index: -1, number: 0, title: item.title, kind: 'group' })
      item.childIds.forEach((id: string) => visit(id, itemId, depth + 1))
      return
    }
    cues.filter((cue: RecordValue) => cue.itemId === itemId).forEach((cue: RecordValue, index: number) => {
      const firstLine = Object.values(cue.channels).flatMap((output: any) => output.blocks || [])
        .find((block: any) => block.type === 'text') as RecordValue | undefined
      result.push({
        id: cue.id, itemId, parentId, depth: depth + (item.kind === 'song' && index > 0 ? 1 : 0),
        index, number: ++number, kind: item.kind, cue,
        title: item.kind === 'song' && index > 0
          ? firstLine?.text?.split('\n').find(Boolean) || cue.title
          : item.title,
      })
    })
  }
  project.rootItemIds.forEach((id: string) => visit(id, null, 0))
  return result
}

function contentChannel(item: RecordValue, channelId: string): string {
  const variant = item.variants[channelId]
  if (!variant || variant.mode === 'hidden') throw new Error('This output is hidden.')
  return variant.mode === 'content' ? channelId : contentChannel(item, variant.from)
}

/** Copy-on-write: expand occurrences to single-slide sections in service-local
 * resources. Repeated choruses and other uses of the library song stay intact. */
function editableSong(project: RecordValue, itemId: string) {
  let next = copy(project)
  const item = next.items[itemId]
  const primaryId = item.primaryChannelId || Object.keys(item.variants).find(id => item.variants[id].mode === 'content')
  const primary = project.resources[item.variants[primaryId].resourceId].document
  const occurrences = item.arrangement.flatMap((entry: RecordValue) => {
    const section = primary.sections.find((value: RecordValue) => value.id === entry.sectionId)
    return section.slides.map((slide: RecordValue, index: number) => ({ entry, section, slide, index }))
  })
  const arrangement = occurrences.map((_: unknown, index: number) => ({ id: `slide-${index + 1}`, sectionId: `slide-${index + 1}` }))
  const resourceByChannel: Record<string, string> = {}
  for (const channelId of Object.keys(item.variants)) {
    const variant = item.variants[channelId]
    if (variant.mode !== 'content') continue
    const original = project.resources[variant.resourceId]
    const document = copy(original.document)
    document.sections = occurrences.map((occurrence: any, index: number) => {
      const section = document.sections.find((value: RecordValue) => value.id === occurrence.entry.sectionId)
      return { ...section, id: arrangement[index].sectionId, marker: arrangement[index].sectionId,
        slides: [{ ...section.slides[occurrence.index], id: 'slide-1' }] }
    })
    document.arrangement = document.sections.map((section: RecordValue) => section.id)
    const added = (serviceCore.addSongResource as any)(next, document, { provider: 'local', itemId, revision: original.sha256 })
    next = copy(added.project)
    resourceByChannel[channelId] = added.resourceId
  }
  const target = next.items[itemId]
  target.arrangement = arrangement
  delete target.sourceRangeReplacement
  for (const [channelId, resourceId] of Object.entries(resourceByChannel)) target.variants[channelId].resourceId = resourceId
  return copy(serviceCore.normalizeServiceProject(next))
}

export function editablePreviewBlock(project: RecordValue, slide: PlannerSlide, channelId: string, block: RecordValue) {
  const item = project.items[slide.itemId]
  if (item.kind === 'notice' || item.kind === 'sermon') return block.type === 'text'
  if (item.kind !== 'song' || item.variants[channelId]?.mode === 'derive') return false
  return ['lyrics', 'title', 'subtitle', 'credit'].includes(block.role)
}

export function editPlannerSlide(project: RecordValue, slide: PlannerSlide, channelId: string, blockIndex: number, text: string, spans?: RecordValue[]) {
  const block = slide.cue?.channels[channelId]?.blocks[blockIndex]
  if (block?.type === 'bible' && spans !== undefined) {
    if (text !== formatting.scriptureFlowText(block.verses)) throw new Error('Scripture text stays pinned. Only its formatting can change.')
    const next = copy(project)
    next.items[slide.itemId].passagesByChannel[channelId].spans = spans
    return copy(serviceCore.normalizeServiceProject(next))
  }
  if (!text.trim() && block?.role !== 'credit') throw new Error('Slide text cannot be empty. Use Delete in the slide menu instead.')
  if (!block || !editablePreviewBlock(project, slide, channelId, block)) throw new Error('This content is generated from its source.')
  let next = copy(project)
  let item = next.items[slide.itemId]
  if (item.kind === 'song') {
    if (block.role === 'credit' && item.songPresentation) {
      item.songPresentation.credits = text
      return copy(serviceCore.normalizeServiceProject(next))
    }
    if (slide.index > 0) next = editableSong(next, item.id)
    item = next.items[slide.itemId]
    let sourceChannel = contentChannel(item, channelId)
    if (item.songPresentation?.stackedTranslation && slide.index > 0) {
      sourceChannel = blockIndex === 0 ? item.songPresentation.primaryChannelId : item.songPresentation.secondaryChannelId
    }
    // Full title cards can display the other language's title as well.
    if (slide.index === 0) {
      sourceChannel = Object.keys(item.variants).find(id => item.variants[id].mode === 'content'
        && next.resources[item.variants[id].resourceId].document.title === block.text) || sourceChannel
    }
    const original = next.resources[item.variants[sourceChannel].resourceId]
    const document = copy(original.document)
    if (slide.index === 0) document.title = text
    else document.sections[slide.index - 1].slides[0].lines = text.split('\n')
    const added = (serviceCore.addSongResource as any)(next, document, { provider: 'local', itemId: item.id, revision: original.sha256 })
    next = copy(added.project)
    next.items[item.id].variants[sourceChannel].resourceId = added.resourceId
  } else {
    const field = block.role === 'title' ? 'titlesByChannel' : 'textByChannel'
    item[field] = { ...item[field], [channelId]: text }
    // Character offsets and sermon projections refer to the previous text.
    if (field === 'textByChannel') {
      delete item.spansByChannel?.[channelId]
      delete item.sourceBodyProjection
      if (item.presetId === 'wotbc-sermon') item.spansByChannel = { ...item.spansByChannel, [channelId]: sermonTextSpans(text) }
    }
    if (spans !== undefined) {
      const styles = field === 'titlesByChannel' ? 'titleSpansByChannel' : 'spansByChannel'
      item[styles] = { ...item[styles], [channelId]: spans }
    } else if (field === 'titlesByChannel') delete item.titleSpansByChannel?.[channelId]
  }
  next.items[slide.itemId].updatedAt = new Date().toISOString()
  return copy(serviceCore.normalizeServiceProject(next))
}

export function movePlannerSlide(project: RecordValue, from: PlannerSlide, to: PlannerSlide, after = false) {
  if (from.id === to.id) return project
  if (from.kind === 'song' && from.index > 0) {
    if (to.itemId !== from.itemId) throw new Error('Move lyrics within their song. Drag the song title to move the whole song.')
    const next = editableSong(project, from.itemId)
    const ordered = next.items[from.itemId].arrangement
    let target = Math.max(0, to.index - 1 + Number(after))
    const [entry] = ordered.splice(from.index - 1, 1)
    if (target > from.index - 1) target--
    ordered.splice(target, 0, entry)
    return copy(serviceCore.normalizeServiceProject(next))
  }
  if (from.itemId === to.itemId) return project
  const siblings: string[] = to.parentId === null ? project.rootItemIds : project.items[to.parentId].childIds
  const ordered = siblings.filter(id => id !== from.itemId)
  return serviceCore.moveProjectItem(project, {
    itemId: from.itemId, targetParentId: to.parentId,
    targetIndex: ordered.indexOf(to.itemId) + Number(after),
  })
}

export function deletePlannerSlide(project: RecordValue, slide: PlannerSlide) {
  if (slide.kind === 'song' && slide.index > 0) {
    const next = editableSong(project, slide.itemId)
    if (next.items[slide.itemId].arrangement.length === 1) throw new Error('This is the last lyric slide. Delete the song using its title row instead.')
    next.items[slide.itemId].arrangement.splice(slide.index - 1, 1)
    return copy(serviceCore.normalizeServiceProject(next))
  }
  return serviceCore.removeProjectItemAndDescendants(project, slide.itemId)
}
