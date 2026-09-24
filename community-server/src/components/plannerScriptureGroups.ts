/** A passage's internal pagination wrapper is not a separate presented slide.
 * Recognize its contents rather than generated IDs, which change on duplication. */
export function isScripturePageGroup(project:Record<string,any>,item:any):boolean {
  if(item?.kind!=='group' || item.groupKind!=='section' || !item.childIds?.length)return false
  const pages=item.childIds.map((id:string)=>project.items[id]),first=pages[0]
  return first?.kind==='bible' && pages.every((page:any,index:number)=>page?.kind==='bible'
    && page.range.bookId===first.range.bookId && page.range.start.chapter===first.range.start.chapter
    && page.range.end.chapter===first.range.start.chapter
    && (!index || page.range.start.verse>pages[index-1].range.end.verse))
}

/** Earlier versions inserted new slides inside pagination wrappers. Only repair
 * wrappers proven by their generated page IDs; preserve every slide and its order.
 * Unrelated slides become siblings, never part of a passage's size/edition scope. */
export function repairScripturePageGroups(project:Record<string,any>):boolean {
  let changed=false
  for(const group of Object.values(project.items) as any[]) {
    if(group.kind!=='group' || group.groupKind!=='section' || !group.childIds.length)continue
    const prefix=`${group.id.slice(0,100)}-v`
    const generated=(id:string)=>project.items[id]?.kind==='bible'
      && id.startsWith(prefix) && /^\d+-\d+(?:-\d+)?$/.test(id.slice(prefix.length))
    if(!generated(group.childIds[0]) || group.childIds.every(generated))continue
    const parent=(Object.values(project.items) as any[]).find(item=>item.kind==='group' && item.childIds.includes(group.id))
    const siblings=parent ? parent.childIds : project.rootItemIds
    const replacements:string[]=[],run:string[]=[]
    let count=0
    const flush=()=>{
      if(!run.length)return
      if(!count++) {group.childIds=[...run];replacements.push(group.id)}
      else {
        let id=`${group.id.slice(0,100)}-continued-${count}`
        while(project.items[id])id+='-2'
        const next={...group,id,childIds:[...run]};delete next.plannedDurationSeconds
        project.items[id]=next;replacements.push(id)
      }
      run.length=0
    }
    const children=[...group.childIds]
    for(const id of children) {
      if(generated(id))run.push(id)
      else {flush();replacements.push(id)}
    }
    flush()
    siblings.splice(siblings.indexOf(group.id),1,...replacements)
    changed=true
  }
  return changed
}
