import core from '../../packages/service-core/index.js'
import { insertionPoint } from './plannerTemplates'

export function extractReusableSlide(raw: any, itemId: string) {
  let project = JSON.parse(JSON.stringify(core.normalizeServiceProject(raw)))
  if (
    !project.items[itemId] ||
    !['picture', 'blank', 'notice', 'sermon'].includes(
      project.items[itemId].kind,
    )
  )
    throw new Error('Select a picture, text, or Other slide to save in Media.')
  project.revision = Math.max(1, project.revision)
  delete project.planning
  project.items = { [itemId]: project.items[itemId] }
  project.rootItemIds = [itemId]
  project = core.pruneUnreachableProjectRecords(project, {
    assetIds: Object.keys(project.assets),
    resourceIds: Object.keys(project.resources),
  })
  return core.serializeHeritageServiceDocument(
    core.createHeritageServiceDocument(project),
  )
}

export function insertReusableSlide(
  raw: any,
  source: string,
  selectedId: string | null,
  id = `media-${globalThis.crypto.randomUUID()}`,
) {
  const project = JSON.parse(JSON.stringify(core.normalizeServiceProject(raw)))
  const template = core.parseHeritageServiceDocumentSource(source).project
  if (template.rootItemIds.length !== 1)
    throw new Error('A reusable slide must contain exactly one slide.')
  const original = template.items[template.rootItemIds[0]]
  if (!['picture', 'blank', 'notice', 'sermon'].includes(original.kind))
    throw new Error('Unsupported reusable slide.')
  if (
    JSON.stringify(project.channelIds) !== JSON.stringify(template.channelIds)
  )
    throw new Error('This slide uses different output channels.')
  const place = insertionPoint(project, selectedId, true)
  for (const table of ['assets', 'resources'])
    for (const [key, value] of Object.entries(template[table])) {
      if (
        project[table][key] &&
        JSON.stringify(project[table][key]) !== JSON.stringify(value)
      )
        throw new Error('Media identity conflicts with this service.')
      project[table][key] = value
    }
  project.items[id] = { ...original, id }
  for (const objects of Object.values(project.items[id].objectsByChannel || {}) as any[])
    for (const object of objects) if (object.id === 'welcome-topic') object.align = 'left'
  const siblings = place.parentId
    ? project.items[place.parentId].childIds
    : project.rootItemIds
  siblings.splice(place.index, 0, id)
  return { project: core.normalizeServiceProject(project), selectedId: id }
}
