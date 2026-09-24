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
