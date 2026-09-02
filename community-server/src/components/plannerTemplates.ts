import core from '../../packages/service-core/index.js'

export const SERMON_TEMPLATES = [
  { id: 'title', label: 'Title', hint: 'Picture first · optional title and dimming', icon: '▧' },
  { id: 'point', label: 'Main point', hint: 'Continue this sermon’s outline', icon: '☷' },
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

const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const numberedPoint = /^\s*([IVXLCDM]+|\d+)[.)]\s+/i

/** Only preceding slides in the current sermon/section may seed a new outline. */
export function precedingSermonOutline(project: any, selectedId: string | null) {
  const place = insertionPoint(project, selectedId)
  let scope = place.parentId
  let ancestor = scope
  while (ancestor) {
    if (project.items[ancestor]?.groupKind === 'sermon') { scope = ancestor; break }
    ancestor = (Object.values(project.items) as any[]).find(item => item.kind === 'group' && item.childIds.includes(ancestor))?.id
  }
  let latest: any = null, done = false
  function visit(id: string) {
    if (done) return
    const item = project.items[id]
    if (item.kind === 'group') {
      // Root-level sections and other sermons are independent outlines.
      if (scope && item.groupKind !== 'sermon') item.childIds.forEach(visit)
    } else if (item.sermonTemplate === 'title' || item.presetId === 'wotbc-sermon-title') latest = null
    else if (item.kind === 'sermon' && (item.sermonTemplate === 'point'
      || (item.presetId === 'wotbc-sermon' && Object.values(item.textByChannel || {}).some(text => numberedPoint.test(String(text)))))) latest = item
    if (id === selectedId) done = true
  }
  const roots = scope ? project.items[scope].childIds : project.rootItemIds
  roots.forEach(visit)
  return latest
}

function roman(value: number) {
  let result = ''
  for (const [number, letters] of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']] as const)
    while (value >= number) { result += letters; value -= number }
  return result
}
export function nextPointPrefix(body: string) {
  const last = body.split('\n').map(line => line.match(numberedPoint)?.[1]).filter(Boolean).pop()
  if (!last) return 'I. '
  if (/^\d+$/.test(last)) return `${Number(last) + 1}. `
  const digits: Record<string, number> = { I:1,V:5,X:10,L:50,C:100,D:500,M:1000 }
  const values = [...last.toUpperCase()].map(letter => digits[letter])
  const value = values.reduce((sum, digit, i) => sum + (digit < (values[i+1] || 0) ? -digit : digit), 0)
  return `${roman(Math.min(value + 1, 3999))}. `
}

/** Empty template fields are editor guides, never literal projected placeholder text. */
export function createTemplateDraft(project: any, options: {
  id: string; template: Exclude<SermonTemplateId, 'passage'>; selectedId: string | null
}) {
  const previous = options.template === 'point' ? precedingSermonOutline(project, options.selectedId) : null
  const textByChannel = Object.fromEntries(project.channelIds.map((id: string) => [id, previous?.textByChannel[id] || '']))
  const place = insertionPoint(project, options.selectedId)
  return core.addProjectItem(project, {
    id: options.id, kind: 'sermon', title: options.template === 'title' ? 'Sermon title' : options.template === 'point' ? 'Main point' : 'Quote / text',
    sermonTemplate: options.template, textByChannel,
    ...(previous ? Object.fromEntries(['titlesByChannel','spansByChannel','titleSpansByChannel'].filter(key => previous[key]).map(key => [key, copy(previous[key])])) : {}),
    ...(options.template === 'point' ? {pendingPointChannels: [...project.channelIds]} : {}),
    ...(options.template === 'title' ? {sermonPresentation: {showText: false, darkenBackground: false}} : {}),
    presetId: options.template === 'title' ? 'wotbc-sermon-title' : options.template === 'quote' ? 'wotbc-sermon-quote' : 'wotbc-sermon',
  }, place)
}

export function editTemplateField(project: any, itemId: string, channelId: string, field: 'heading' | 'body' | 'next', text: string, spans: any[] = []) {
  const next = copy(project), item = next.items[itemId]
  if (!item?.sermonTemplate || !project.channelIds.includes(channelId)) throw new Error('Choose an editable sermon template.')
  if (field === 'next' && !text.trim()) return project
  // Older WOTBC services call this output "Media" with language "und".
  // Their singers slides follow Russian, just like the existing template path.
  const source = project.channelIds.find((id: string) => id !== 'media' && project.channels[id].language === project.channels.media?.language)
    || (project.channelIds.includes('russian') ? 'russian' : 'english')
  const outputs = channelId === source && project.channelIds.includes('media') ? [channelId, 'media'] : [channelId]
  for (const id of outputs) {
    const target = field === 'heading' ? 'titlesByChannel' : 'textByChannel'
    const styles = field === 'heading' ? 'titleSpansByChannel' : 'spansByChannel'
    item[target] ||= {}; item[styles] ||= {}
    if (field === 'next') {
      const body = item.textByChannel[id] || ''
      const prefix = numberedPoint.test(text) ? '' : nextPointPrefix(body)
      const offset = body.length + (body ? 1 : 0) + prefix.length
      item.textByChannel[id] = body + (body ? '\n' : '') + prefix + text
      item.spansByChannel[id] = [...(item.spansByChannel[id] || []), ...spans.map(span => ({...span,start:span.start+offset,end:span.end+offset}))]
      item.pendingPointChannels = (item.pendingPointChannels || []).filter((value: string) => value !== id)
    } else {
      item[target][id] = text; item[styles][id] = spans
      if (field === 'body' && item.sermonTemplate === 'point') item.pendingPointChannels = (item.pendingPointChannels || []).filter((value: string)=>value!==id)
      if (field === 'heading' && !text) { delete item[target][id]; delete item[styles][id] }
    }
  }
  if (text.trim() && (field === 'heading' || field === 'next' || item.sermonTemplate === 'quote' || (field === 'body' && item.sermonTemplate === 'point'))) item.title = text.trim().split('\n')[0].slice(0, 200)
  return core.normalizeServiceProject(next)
}
