type Project = Record<string, any>

/** A reading's first numbered slide is also its visual parent in the outline. */
export function isReadingGroup(project: Project, item: any): boolean {
  return (
    item?.kind === 'group' &&
    project.items[item.childIds?.[0]]?.presetId === 'wotbc-reading-title'
  )
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
      if (item.kind === 'bible' || item.kind === 'blank') pages.push(id)
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

export function appendBlankSlide(project: Project, itemId: string) {
  const next = JSON.parse(JSON.stringify(project)),
    item = next.items[itemId]
  const id = `${itemId}-blank`
  if (next.items[id]) return next
  const parent = (Object.values(next.items) as any[]).find(
    (value) => value.kind === 'group' && value.childIds.includes(itemId),
  )
  const siblings = parent ? parent.childIds : next.rootItemIds
  next.items[id] = {
    id,
    kind: 'blank',
    title: 'Blank',
    channelIds: [...next.channelIds],
    presetId: 'blank-black',
    operatorNotes: '',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
  siblings.splice(siblings.indexOf(itemId) + 1, 0, id)
  return next
}
