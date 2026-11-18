import type { PlannerSlide } from './plannerSlides'

type Project = Record<string, any>
export type NavigatorSlide = PlannerSlide & { sectionSize?: number; sectionExpanded?: boolean }

/** Long services become a section outline. The active section and its parents
 * open automatically; compilation, numbering and multi-slide selection stay intact. */
export function plannerNavigator(project: Project, rows: PlannerSlide[], activeId?: string | null): NavigatorSlide[] {
  if (rows.filter(row => row.cue).length <= 20) return rows
  const parents = new Map<string, string>()
  Object.values(project.items).forEach((item:any) => {
    if (item.kind === 'group') item.childIds.forEach((id:string) => parents.set(id, item.id))
  })
  const heads = new Map<string, PlannerSlide>()
  for (const row of rows) {
    const sections = [row.sectionItemId, row.kind === 'group' || row.kind === 'song' ? row.itemId : null].filter(Boolean) as string[]
    for (const section of sections) if (!heads.has(section)) heads.set(section, row)
  }
  const sections = (row:PlannerSlide):string[] => {
    const ids = row.kind === 'song' ? [row.itemId] : []
    let parent = row.kind === 'group' ? row.itemId : parents.get(row.itemId)
    while (parent) { if (heads.has(parent)) ids.push(parent); parent=parents.get(parent) }
    return ids
  }
  const active = rows.find(row => row.id === activeId || row.itemId === activeId)
  const expanded = new Set(active ? sections(active) : [])
  return rows.flatMap(row => {
    const owners = sections(row)
    // A section's own heading remains visible while that section is closed.
    if (owners.some(id => heads.get(id)?.id !== row.id && !expanded.has(id))) return []
    const section = [...heads.entries()].find(([,head])=>head.id===row.id)?.[0]
    if (!section) return [row]
    const count = rows.filter(value=>value.cue && sections(value).includes(section)).length
    return [{...row, sectionSize:count, sectionExpanded:expanded.has(section)}]
  })
}
