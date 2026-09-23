import { isReadingGroup, isSongGroup } from './plannerReadingGroups'

type Project = Record<string, any>
export const isSermonTitle = (item: any): boolean => item?.kind === 'sermon'
  && (item.sermonTemplate === 'title' || item.presetId === 'wotbc-sermon-title')
export const isSermonGroup = (project: Project, item: any): boolean => item?.kind === 'group'
  && item.groupKind === 'sermon' && isSermonTitle(project.items[item.childIds[0]])

function endsSermon(project: Project, item: any) {
  return item.kind === 'song' || isSongGroup(project, item) || isReadingGroup(project, item)
    || item.presetId === 'wotbc-reading-title'
    || item.kind === 'bible' && !['wotbc-sermon-scripture','wotbc-sermon-verse'].includes(item.presetId)
    || item.kind === 'group' && item.groupKind === 'sermon'
}

/** The slide order defines sermon boundaries, represented by standard groups
 * understood by SyncShow. No cue, slide, source text or media is removed. */
export function groupSermonSections(project: Project): boolean {
  let changed = false
  const visit = (ids: string[]) => {
    const pending = [...ids], result: string[] = []
    let active: any = null
    while (pending.length) {
      const id = pending.shift()!, item = project.items[id]
      if (isSermonGroup(project, item)) {
        // A song/reading inserted or moved into an existing sermon closes it.
        const boundary = item.childIds.findIndex((child: string, index: number) => index > 0
          && (isSermonTitle(project.items[child]) || endsSermon(project, project.items[child])))
        if (boundary >= 0) { pending.unshift(...item.childIds.splice(boundary)); changed = true }
        for (const child of item.childIds) if (project.items[child].kind === 'group') visit(project.items[child].childIds)
        result.push(id); active = item
      } else if (isSermonTitle(item)) {
        let groupId = `${id}-sermon`, suffix = 2
        while (project.items[groupId]) groupId = `${id}-sermon-${suffix++}`
        active = {id:groupId,kind:'group',groupKind:'sermon',title:item.title,childIds:[id],
          operatorNotes:'',createdAt:item.createdAt,updatedAt:item.updatedAt}
        project.items[groupId] = active
        result.push(groupId); changed = true
      } else {
        if (item.kind === 'group') visit(item.childIds)
        if (endsSermon(project,item)) active = null
        if (active) { active.childIds.push(id); changed = true }
        else result.push(id)
      }
    }
    ids.splice(0,ids.length,...result)
  }
  visit(project.rootItemIds)
  return changed
}
