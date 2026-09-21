import core from '../../packages/service-core/index.js'
import { editableSong, plannerSlides, type PlannerSlide } from './plannerSlides'

type Project = Record<string, any>
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

function groupContains(rows: PlannerSlide[], group: PlannerSlide, row: PlannerSlide) {
  const start = rows.indexOf(group), end = rows.indexOf(row)
  return end > start && rows.slice(start + 1, end + 1).every(value => value.depth > group.depth)
}

/** Section headings select their descendants; Shift ranges select numbered slides. */
export function selectedPlannerSlides(rows: PlannerSlide[], ids: string[]) {
  const selected = new Set(ids)
  const groups = rows.filter(row => row.kind === 'group' && selected.has(row.id))
  return rows.filter(row => row.cue && (selected.has(row.id) || groups.some(group => groupContains(rows, group, row))))
}

export function plannerRangeSelection(rows: PlannerSlide[], anchorId: string, targetId: string) {
  const anchor = rows.findIndex(row => row.id === anchorId), target = rows.findIndex(row => row.id === targetId)
  if (anchor < 0 || target < 0) return [targetId]
  return rows.slice(Math.min(anchor, target), Math.max(anchor, target) + 1).filter(row => row.cue).map(row => row.id)
}

function parentOf(project: Project, itemId: string): string | null {
  return (Object.values(project.items) as any[]).find(item => item.kind === 'group' && item.childIds.includes(itemId))?.id || null
}
function siblings(project: Project, parentId: string | null): string[] {
  return parentId ? project.items[parentId].childIds : project.rootItemIds
}

/** A touched multi-slide item becomes a section of independently movable native
 * slides. Nothing is rasterized: translations, exact resources and media remain
 * shared until edited. Untouched songs retain their original representation. */
function materialize(project: Project, itemIds: Set<string>, fresh: (prefix: string) => string) {
  let next = copy(project)
  const oldRows = plannerSlides(project)
  const itemForRow = new Map(oldRows.filter(row => row.cue).map(row => [row.id, row.itemId]))
  for (const itemId of itemIds) {
    const rows = oldRows.filter(row => row.itemId === itemId && row.cue)
    if (rows.length <= 1) continue
    const original = next.items[itemId]
    if (original.kind !== 'song' && original.kind !== 'imported-deck') throw new Error('This item cannot be separated into slides.')
    if (original.kind === 'song') next = editableSong(next, itemId)
    const expanded = next.items[itemId]
    const childIds = rows.map(row => {
      const id = fresh(original.kind === 'song' ? 'song' : 'deck')
      const item = { ...copy(expanded), id }
      delete item.plannedDurationSeconds
      delete item.sourceRangeReplacement
      if (item.kind === 'song') {
        const isTitle = original.showTitle !== false && row.index === 0
        item.showTitle = isTitle
        item.arrangement = isTitle ? [] : [expanded.arrangement[row.index - (original.showTitle === false ? 0 : 1)]]
      } else item.slides = [expanded.slides[row.index]]
      next.items[id] = item
      itemForRow.set(row.id, id)
      return id
    })
    next.items[itemId] = { id:itemId, kind:'group', groupKind:'section', title:original.title,
      createdAt:original.createdAt, updatedAt:original.updatedAt, operatorNotes:original.operatorNotes,
      ...(original.plannedDurationSeconds !== undefined ? {plannedDurationSeconds:original.plannedDurationSeconds} : {}), childIds }
    next = copy(core.normalizeServiceProject(next))
  }
  return { project: next, itemForRow }
}

export type SelectionResult = { project: Project; selectedIds: string[]; activeId: string | null }

/** One atomic batch; Move To is the final one-based starting position. */
export function changePlannerSelection(project: Project, ids: string[], operation: 'move' | 'duplicate' | 'delete', destination?: number,
  randomUUID: () => string = () => globalThis.crypto.randomUUID()): SelectionResult {
  const rows = plannerSlides(project), slides = rows.filter(row => row.cue)
  if (!ids.length || ids.some(id => !rows.some(row => row.id === id))) throw new Error('Select slides from the current service first.')
  const chosen = selectedPlannerSlides(rows, ids), chosenIds = new Set(chosen.map(row => row.id))
  const groups = rows.filter(row => row.kind === 'group' && ids.includes(row.id))
    .filter(row => !rows.some(parent => parent.kind === 'group' && ids.includes(parent.id) && groupContains(rows, parent, row)))
  const singles = chosen.filter(row => !groups.some(group => groupContains(rows, group, row)))
  const remaining = slides.filter(row => !chosenIds.has(row.id))
  const maxStart = remaining.length + 1
  if (operation === 'move' && (!Number.isInteger(destination) || destination! < 1 || destination! > maxStart)) {
    throw new Error(`Enter a whole slide number from 1 to ${maxStart}.`)
  }
  const anchor = operation === 'move' ? remaining[destination! - 1] : undefined
  const used = new Set(Object.keys(project.items))
  const fresh = (prefix: string) => {
    for (let attempt=0; attempt<100; attempt++) { const id=`${prefix}-${randomUUID()}`; if (!used.has(id)) { used.add(id); return id } }
    throw new Error('Could not generate an independent slide identity.')
  }
  const expanded = materialize(project, new Set([...singles.map(row => row.itemId), ...(anchor && anchor.index > 0 ? [anchor.itemId] : [])]), fresh)
  let next = expanded.project
  const units = rows.filter(row => groups.includes(row) || singles.includes(row)).map(row => row.kind === 'group' ? row.itemId : expanded.itemForRow.get(row.id)!)
  const anchorItemId = anchor ? expanded.itemForRow.get(anchor.id)! : null
  let selectedItems = units
  if (operation === 'delete') {
    for (const itemId of units) next = copy(core.removeProjectItemAndDescendants(next, itemId))
    selectedItems = []
  } else {
    // Copies belong immediately after the last selected item, including when
    // that item is an empty section or the last child of a section.
    const lastUnit = units.at(-1)!
    const copyParentId = parentOf(next, lastUnit)
    if (operation === 'duplicate') {
      selectedItems = units.map(itemId => {
        next = copy(core.duplicateProjectItem(next, {itemId, title:next.items[itemId].title,
          targetParentId:null, targetIndex:next.rootItemIds.length, randomUUID:() => fresh('copy')}))
        return next.rootItemIds.at(-1)
      })
    }
    for (const itemId of selectedItems) {
      const list = siblings(next, parentOf(next, itemId)); list.splice(list.indexOf(itemId), 1)
    }
    const targetList = siblings(next, operation === 'duplicate' ? copyParentId : anchorItemId ? parentOf(next, anchorItemId) : null)
    const targetIndex = operation === 'duplicate' ? targetList.indexOf(lastUnit) + 1 : anchorItemId ? targetList.indexOf(anchorItemId) : targetList.length
    targetList.splice(targetIndex, 0, ...selectedItems)
    next = copy(core.normalizeServiceProject(next))
  }
  const after = plannerSlides(next), selectedIds = after.filter(row => selectedItems.includes(row.itemId)).map(row => row.id)
  const active = after.find(row => row.cue && selectedItems.includes(row.itemId))
    || after.find(row => selectedItems.includes(row.itemId))
    || after.filter(row => row.cue)[Math.min(Math.max(0, (chosen[0]?.number || 1) - 1), after.filter(row => row.cue).length - 1)]
  return { project: next, selectedIds: selectedIds.length ? selectedIds : active ? [active.id] : [], activeId: active?.id || null }
}
