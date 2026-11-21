import { isScripturePageGroup } from './plannerScriptureGroups'

type Project = Record<string, any>

/** A reading's first numbered slide is also its visual parent in the outline. */
export function isReadingGroup(project: Project, item: any): boolean {
  return (
    item?.kind === 'group' &&
    project.items[item.childIds?.[0]]?.presetId === 'wotbc-reading-title'
  )
}

/** Song sections use ordinary groups, so older SyncShow versions can load them. */
export function isSongGroup(project: Project, item: any): boolean {
  const first = project.items[item?.childIds?.[0]]
  return item?.kind === 'group' && item.groupKind === 'section'
    && first?.kind === 'song' && first.showTitle !== false && first.title === item.title
}

export function sectionOwner(project: Project, selectedId: string | null): string | null {
  let current = selectedId
  while (current) {
    const item = project.items[current]
    if (isReadingGroup(project, item) || isSongGroup(project, item) || isScripturePageGroup(project, item)) return current
    current = (Object.values(project.items) as any[]).find(
      value => value.kind === 'group' && value.childIds.includes(current))?.id || null
  }
  return null
}

export function readingOwner(
  project: Project,
  selectedId: string | null,
): string | null {
  let current = selectedId
  while (current) {
    if (isReadingGroup(project, project.items[current])) return current
    current =
      (Object.values(project.items) as any[]).find(
        (item) => item.kind === 'group' && item.childIds.includes(current),
      )?.id || null
  }
  return null
}

/** Repair the old title -> section -> pages wrapper in a draft. Other items
 * accidentally inserted inside that reading keep their order, as siblings. */
export function flattenReadingGroups(project: Project): boolean {
  let changed = false
  for (const group of Object.values(project.items) as any[]) {
    if (!isReadingGroup(project, group)) continue
    const [titleId, ...children] = group.childIds
    const pages: string[] = [],
      following: string[] = []
    const collect = (id: string) => {
      const item = project.items[id]
      if (!item) throw new Error('A reading contains a missing slide.')
      if (item.kind === 'bible' || item.kind === 'blank' || item.presetId === 'wotbc-reading-title') pages.push(id)
      else if (
        item.kind === 'group' &&
        item.id === group.id.replace(/-reading$/, '')
      ) {
        item.childIds.forEach(collect)
        delete project.items[id]
        changed = true
      } else following.push(id)
    }
    children.forEach(collect)
    const ids = [titleId, ...pages]
    if (JSON.stringify(ids) !== JSON.stringify(group.childIds)) {
      group.childIds = ids
      changed = true
    }
    if (following.length) {
      const parent = (Object.values(project.items) as any[]).find(
        (item) => item.kind === 'group' && item.childIds.includes(group.id),
      )
      const siblings = parent ? parent.childIds : project.rootItemIds
      siblings.splice(siblings.indexOf(group.id) + 1, 0, ...following)
    }
  }
  return changed
}

/** Adopt only the deterministic automatic blank immediately following its owner.
 * Manual or moved blanks remain independent. This also repairs saved old plans. */
export function attachSectionBlanks(project: Project): boolean {
  let changed = false
  for (const item of Object.values(project.items) as any[]) {
    if (item.kind !== 'song' && !isReadingGroup(project, item) && !isSongGroup(project, item)) continue
    const blankId = `${item.id}-blank`
    if (project.items[blankId]?.kind !== 'blank') continue
    const parent = (Object.values(project.items) as any[]).find(
      value => value.kind === 'group' && value.childIds.includes(item.id))
    const siblings = parent ? parent.childIds : project.rootItemIds
    const index = siblings.indexOf(item.id)
    if (siblings[index + 1] !== blankId) continue
    if (item.kind === 'group') {
      siblings.splice(index + 1, 1)
      item.childIds.push(blankId)
    } else if (parent && isSongGroup(project, parent)) {
      continue // Already inside its song section.
    } else {
      let groupId = `${item.id}-section`, suffix = 2
      while (project.items[groupId]) groupId = `${item.id}-section-${suffix++}`
      project.items[groupId] = { id: groupId, kind: 'group', groupKind: 'section',
        title: item.title, childIds: [item.id, blankId], operatorNotes: '',
        createdAt: item.createdAt, updatedAt: item.updatedAt }
      siblings.splice(index, 2, groupId)
    }
    changed = true
  }
  return changed
}

export function appendBlankSlide(project: Project, itemId: string) {
  // Automatic closing blanks belong to service readings/songs, never sermon slides.
  const source = project.items[itemId]
  if (source?.kind === 'sermon' || source?.kind === 'bible'
    && ['wotbc-sermon-scripture', 'wotbc-sermon-verse'].includes(source.presetId)) return project
  const next = JSON.parse(JSON.stringify(project)), item = next.items[itemId]
  const id = `${itemId}-blank`
  if (!next.items[id]) {
    const parent = (Object.values(next.items) as any[]).find(
      value => value.kind === 'group' && value.childIds.includes(itemId))
    const siblings = parent ? parent.childIds : next.rootItemIds
    next.items[id] = { id, kind: 'blank', title: 'Blank', channelIds: [...next.channelIds],
      presetId: 'blank-black', operatorNotes: '', createdAt: item.createdAt, updatedAt: item.updatedAt }
    siblings.splice(siblings.indexOf(itemId) + 1, 0, id)
  }
  attachSectionBlanks(next)
  return next
}
