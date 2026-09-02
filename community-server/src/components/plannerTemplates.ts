import core from '../../packages/service-core/index.js'

export const SERMON_TEMPLATES = [
  { id: 'title', label: 'Title', hint: 'Image, sermon title, and subtitle', icon: '▧' },
  { id: 'point', label: 'Main point', hint: 'Heading with an outline or explanation', icon: '☷' },
  { id: 'passage', label: 'Bible passage', hint: 'Exact verses with editable emphasis', icon: '¶' },
  { id: 'quote', label: 'Quote / text', hint: 'A quotation or a single thought', icon: '“' },
] as const
export type SermonTemplateId = typeof SERMON_TEMPLATES[number]['id']
export type TemplateText = { heading: string; body: string }

export function insertionPoint(project: any, selectedId: string | null) {
  const selected = selectedId ? project.items[selectedId] : null
  if (selected?.kind === 'group') return { parentId: selected.id, index: selected.childIds.length }
  const parent = Object.values(project.items).find((item: any) => item.kind === 'group' && item.childIds.includes(selectedId)) as any
  const siblings = parent ? parent.childIds : project.rootItemIds
  return { parentId: parent?.id || null, index: selected ? siblings.indexOf(selected.id) + 1 : siblings.length }
}

export function createTemplateSlide(project: any, options: {
  id: string; template: Exclude<SermonTemplateId, 'passage'>; english: TemplateText; russian: TemplateText;
  selectedId: string | null; asset?: any
}) {
  const { template } = options
  const english = { heading: options.english.heading.trim(), body: options.english.body.trim() }
  const russian = { heading: options.russian.heading.trim(), body: options.russian.body.trim() }
  const primary = (template === 'title' ? english.heading : english.body) ? english : russian
  if (template === 'title' ? !primary.heading : !primary.body) throw new Error(template === 'title' ? 'Enter a sermon title.' : 'Enter the slide text.')
  if (template === 'title' && !options.asset) throw new Error('Choose a title image.')
  const next = JSON.parse(JSON.stringify(project))
  if (options.asset) next.assets[options.asset.id] = options.asset
  const values: Record<string, TemplateText> = { english: english.heading || english.body ? english : primary, russian: russian.heading || russian.body ? russian : primary }
  values.media = values.russian
  const textByChannel: Record<string, string> = {}, titlesByChannel: Record<string, string> = {}, spansByChannel: Record<string, any[]> = {}
  for (const id of project.channelIds) {
    const value = values[id] || primary
    if (template === 'title') {
      const heading = value.heading || primary.heading
      textByChannel[id] = heading + (value.body ? '\n\n' + value.body : '')
      if (value.body) spansByChannel[id] = [{ start: heading.length + 2, end: textByChannel[id].length, fontScale: 0.65, weight: '400' }]
    } else {
      textByChannel[id] = value.body || primary.body
      if (value.heading) titlesByChannel[id] = value.heading
    }
  }
  const place = insertionPoint(project, options.selectedId)
  return core.addProjectItem(next, {
    id: options.id, kind: 'sermon', title: (primary.heading || primary.body.split('\n')[0]).slice(0, 200),
    textByChannel, ...(Object.keys(titlesByChannel).length ? { titlesByChannel } : {}),
    ...(Object.keys(spansByChannel).length ? { spansByChannel } : {}),
    ...(options.asset ? { backgroundAssetId: options.asset.id } : {}),
    presetId: template === 'title' ? 'wotbc-sermon-title' : template === 'quote' ? 'wotbc-sermon-quote' : 'wotbc-sermon',
  }, { parentId: place.parentId, index: place.index })
}
