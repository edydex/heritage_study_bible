import core from '../../packages/service-core/index.js'
import formatting from '../../packages/service-core/node/services/project/SlideFormatting.js'
import { scripturePages } from './plannerPresentation'
import { scriptureTranslationScope } from './plannerScriptureTranslations'
import { isReadingGroup } from './plannerReadingGroups'

type Project = Record<string, any>
const clone = (value:any) => JSON.parse(JSON.stringify(value))
const numbers = (item:any):number[] => (Object.values(item.passagesByChannel)[0] as any).verses.map((verse:any)=>verse.number)
function reference(passage:any,item:any,verses:number[]) {
  return `${passage.reference.replace(/\s+\d+:.*$/,'')} ${item.range.start.chapter}:${formatting.verseSelectionLabel(verses)}`
}
function edited(item:any) {
  return Object.values(item.passagesByChannel).some((passage:any)=>passage.displayText!==undefined)
}
function compatible(previous:any, item:any) {
  // An authored excerpt, cue, duration or other page-specific instruction is a
  // deliberate boundary. Never silently move it to an earlier verse.
  return !edited(previous) && !edited(item) && !item.translationCues && item.plannedDurationSeconds===undefined
    && previous.presetId===item.presetId && previous.operatorNotes===item.operatorNotes
    && JSON.stringify(previous.textStyle)===JSON.stringify(item.textStyle)
    && previous.range.bookId===item.range.bookId && previous.range.end.chapter===item.range.start.chapter
    && numbers(previous).at(-1)! < numbers(item)[0]
    && JSON.stringify(Object.keys(previous.passagesByChannel))===JSON.stringify(Object.keys(item.passagesByChannel))
    && Object.keys(previous.passagesByChannel).every(channel=>{
      const a=previous.passagesByChannel[channel],b=item.passagesByChannel[channel]
      return a.translationId===b.translationId && a.attribution===b.attribution
    })
}
function combine(items:any[]) {
  const merged=clone(items[0])
  for (const channel of Object.keys(merged.passagesByChannel)) {
    const verses:any[]=[],spans:any[]=[]
    for(const item of items) {
      const passage=item.passagesByChannel[channel]
      const offset=verses.length ? formatting.scriptureFlowText(verses).length+1 : 0
      spans.push(...(passage.spans||[]).map((span:any)=>({...span,start:span.start+offset,end:span.end+offset})))
      verses.push(...passage.verses)
    }
    const passage=merged.passagesByChannel[channel]
    delete passage.contentSha256
    passage.verses=verses
    passage.spans=spans
    passage.reference=reference(passage,merged,verses.map(v=>v.number))
  }
  const all=numbers(merged)
  merged.range.end.verse=all.at(-1)
  merged.verseNumbers=all
  return merged
}
function pageFrom(merged:any,verses:number[],id:string,first:boolean) {
  const page=clone(merged)
  page.id=id; page.range.start.verse=verses[0];page.range.end.verse=verses.at(-1);page.verseNumbers=verses
  for (const passage of Object.values(page.passagesByChannel) as any[]) {
    const start=passage.verses.findIndex((v:any)=>v.number===verses[0])
    const offset=start ? formatting.scriptureFlowText(passage.verses.slice(0,start)).length+1 : 0
    passage.verses=passage.verses.filter((v:any)=>verses.includes(v.number))
    const length=formatting.scriptureFlowText(passage.verses).length
    passage.spans=(passage.spans||[]).filter((s:any)=>s.end>offset&&s.start<offset+length)
      .map((s:any)=>({...s,start:Math.max(0,s.start-offset),end:Math.min(length,s.end-offset)}))
    passage.reference=reference(passage,page,verses)
    delete passage.contentSha256
  }
  page.title=(Object.values(page.passagesByChannel)[0] as any).reference
  if(!first){delete page.translationCues;delete page.plannedDurationSeconds}
  return page
}

/** Reflow only this passage, greedily moving whole verses. Saved pages stay
 * untouched until a size is committed; Undo restores the complete old layout. */
export function reflowScripture(project:Project,selectedId:string,bodySize:number) {
  const scope=scriptureTranslationScope(project,selectedId)
  if(!scope)throw new Error('Select a Scripture slide to change its size.')
  const next=clone(project),original=next.items[selectedId],selectedVerse=numbers(original)[0]
  const parent=(Object.values(next.items) as any[]).find(item=>item.kind==='group'&&item.childIds.includes(selectedId))
  let siblings:string[]=parent ? parent.childIds : next.rootItemIds
  let selected=selectedId,protectedPages=0
  const segments:string[][]=[]
  for(const id of scope.itemIds) {
    const item=next.items[id]
    item.textStyle={...item.textStyle,bodySize}
    const last=segments.at(-1),previous=last?.at(-1)
    if(previous && siblings.indexOf(id)===siblings.indexOf(previous)+1 && compatible(next.items[previous],item))last!.push(id)
    else segments.push([id])
  }
  for(const ids of segments) {
    const items=ids.map(id=>next.items[id])
    if(items.some(edited)){protectedPages+=items.length;continue}
    const merged=combine(items),pages=scripturePages(merged)
    const index=siblings.indexOf(ids[0])
    // A formerly single page needs a standard pagination group so its pages
    // stay one passage for subsequent size/edition changes and SyncShow.
    const existingPageGroup=parent && (isReadingGroup(next,parent)
      || selectedId.startsWith(`${parent.id.slice(0,100)}-v`))
    const wrap=scope.itemIds.length===1 && pages.length>1 && !existingPageGroup
    let prefix=wrap ? original.id : (parent && parent.childIds.every((id:string)=>next.items[id]?.kind==='bible') ? parent.id : ids[0].replace(/-v\d+-\d+$/,''))
    if(wrap) {
      next.items[original.id]={id:original.id,kind:'group',groupKind:'section',title:original.title,
        operatorNotes:'',createdAt:original.createdAt,updatedAt:original.updatedAt,childIds:[]}
      siblings=next.items[original.id].childIds
    } else ids.forEach(id=>delete next.items[id])
    const newIds=pages.map((verses,i)=>{
      let id=!wrap && ids[i] ? ids[i] : `${prefix.slice(0,100)}-v${verses[0]}-${verses.at(-1)}`
      const base=id;let suffix=2
      while(next.items[id])id=`${base}-${suffix++}`
      next.items[id]=pageFrom(merged,verses,id,i===0)
      if(ids.includes(selectedId)&&verses.includes(selectedVerse))selected=id
      return id
    })
    if(wrap)siblings.push(...newIds)
    else siblings.splice(index,ids.length,...newIds)
  }
  // Keep existing sermon-link provenance and update only its page counters.
  const links=new Map<string,any[]>()
  const visit=(id:string)=>{const item=next.items[id];if(item.kind==='group')return item.childIds.forEach(visit)
    if(item.sermonReading){const key=`${item.sermonReading.sermonResourceId}:${item.sermonReading.referenceId}`;const entries=links.get(key)||[];entries.push(item);links.set(key,entries)}}
  next.rootItemIds.forEach(visit)
  links.forEach(items=>items.forEach((item,index)=>{item.sermonReading={...item.sermonReading,chunkIndex:index,chunkCount:items.length}}))
  return {project:core.normalizeServiceProject(next),selectedId:selected,protectedPages}
}
