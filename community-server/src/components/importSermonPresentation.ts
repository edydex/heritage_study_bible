import core from '../../packages/service-core/index.js'
import { insertionPoint } from './plannerTemplates'

/** Copy an exact saved deck into a service. Media and resources remain pinned
 * by hash; new placement identities prevent collisions when adding it twice. */
export function importSermonPresentation(target: any, source: any, sermon: any, selectedId: string | null, uuid = () => globalThis.crypto.randomUUID()) {
  const project = JSON.parse(JSON.stringify(core.normalizeServiceProject(target)))
  const deck = core.normalizeServiceProject(source)
  if (!deck.rootItemIds.length) throw new Error('This sermon has no saved slides yet. Open Prepare a sermon and add slides first.')
  if (JSON.stringify(project.channelIds) !== JSON.stringify(deck.channelIds)) throw new Error('This sermon uses different output channels. Match its channels before adding it.')
  for (const table of ['resources', 'assets']) {
    for (const [id, value] of Object.entries(deck[table])) {
      const existing = project[table][id]
      if (existing && (existing.sha256 !== (value as any).sha256 || existing.size !== (value as any).size)) throw new Error('A media or resource identity conflicts with this service.')
      if (!existing) project[table][id] = JSON.parse(JSON.stringify(value))
    }
  }
  const used = new Set(Object.keys(project.items))
  const fresh = () => { let id; do { id = `sermon-${uuid()}` } while (used.has(id)); used.add(id); return id }
  const ids = new Map<string, string>(Object.keys(deck.items).map(id => [id, fresh()]))
  for (const original of Object.values(deck.items) as any[]) {
    const item = JSON.parse(JSON.stringify(original))
    item.id = ids.get(original.id)
    if (item.childIds) item.childIds = item.childIds.map((id: string) => ids.get(id))
    if (item.arrangement) item.arrangement = item.arrangement.map((entry: any) => ({ ...entry, id: fresh() }))
    project.items[item.id] = item
  }
  // Add the group before normalizing so the copied items are never orphaned.
  const id = fresh(), place = insertionPoint(project, selectedId)
  project.items[id] = { id, kind: 'group', groupKind: 'sermon', title: sermon.titles[sermon.defaultLanguage], childIds: deck.rootItemIds.map((id: string) => ids.get(id)), operatorNotes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  const siblings = place.parentId ? project.items[place.parentId].childIds : project.rootItemIds
  siblings.splice(place.index, 0, id)
  const pinned = core.addSermonResource(project, sermon)
  const next = JSON.parse(JSON.stringify(pinned.project))
  next.items[id].sermonResourceId = pinned.resourceId
  return { project: core.normalizeServiceProject(next), selectedId: id }
}
