import presentationText from '../../packages/service-core/node/services/project/PresentationText.js'
import { nextPointPrefix } from './plannerTemplates'

export type OutlineRow = {
  id: string; kind: 'point' | 'subpoint' | 'text'; parentId?: string;
  marker: string; prefix: string; text: string; spans: any[]; prefixSpans: any[]; guide?: boolean
}
const INDENT = '\u00a0\u00a0\u00a0\u00a0'
function sliceSpans(spans: any[], start: number, end: number) {
  return spans.filter(span => span.start < end && span.end > start)
    .map(span => ({...span, start:Math.max(start,span.start)-start, end:Math.min(end,span.end)-start}))
}

/** The saved format stays plain outline text plus emphasis spans, also understood by SyncShow. */
export function parseOutline(text: string, spans: any[] = []): OutlineRow[] {
  if (!text) return []
  const rows: (OutlineRow & {start: number})[] = []
  let parentId: string | undefined
  for (const range of presentationText.outlineParagraphs(text)) {
    const prefix=text.slice(range.start,range.prefixEnd), marker=prefix.trim();
    const main=/^(?:[IVXLCDM]+|\d+)[.)]/u.test(prefix), sub=Boolean(prefix)&&!main;
    const id=`line-${range.start}`;
    rows.push({id,kind:main?'point':sub?'subpoint':'text',parentId:sub?parentId:undefined,
      marker,prefix,text:text.slice(range.prefixEnd,range.end),spans:[],prefixSpans:[],start:range.start});
    if(main)parentId=id;
  }
  return rows.map(({start, ...row}) => ({...row,
    prefixSpans:sliceSpans(spans,start,start+row.prefix.length),
    spans:sliceSpans(spans,start+row.prefix.length,start+row.prefix.length+row.text.length)}))
}

function nextLetter(marker: string) {
  let number = [...marker.replace(/[.)]$/,'')].reduce((value,char)=>value*26+char.charCodeAt(0)-64,0)+1
  let result = ''
  while (number > 0) { number--; result = String.fromCharCode(65+number%26)+result; number=Math.floor(number/26) }
  return result + '.'
}
function guide(id: string, kind: 'point' | 'subpoint', marker: string, parentId?: string): OutlineRow {
  return {id,kind,parentId,marker,prefix:(kind==='subpoint' ? INDENT : '')+marker+' ',text:'',spans:[],prefixSpans:[],guide:true}
}

/** A populated row reveals one empty child/sibling, never a ladder of unused fields. */
export function outlineWithGuides(rows: OutlineRow[]) {
  const result: OutlineRow[] = []
  let point: OutlineRow | undefined, lastSub: OutlineRow | undefined
  function finishPoint() {
    if (point?.text.trim() && (!lastSub || lastSub.text.trim()))
      result.push(guide(`sub-after-${lastSub?.id || point.id}`,'subpoint',lastSub ? nextLetter(lastSub.marker) : 'A.',point.id))
  }
  for (const row of rows) {
    if (row.kind === 'point') { finishPoint(); point=row; lastSub=undefined }
    if (row.kind === 'subpoint' && row.parentId === point?.id) lastSub=row
    result.push(row)
  }
  finishPoint()
  if (!point || point.text.trim()) {
    const prefix = nextPointPrefix(rows.filter(row=>row.kind==='point').map(row=>row.marker+' '+row.text).join('\n'))
    result.push(guide(`point-after-${point?.id || 'start'}`,'point',prefix.trim()))
  }
  return result
}

/** Earlier unused sub-point slots are controls, not space on the projected slide. */
export function outlineEditorRows(rows: OutlineRow[], expandedId: string | null = null) {
  const visible = outlineWithGuides(rows)
  const result: { row: OutlineRow; addSubpoint?: OutlineRow }[] = []
  for (let index = 0; index < visible.length; index++) {
    const row = visible[index]
    const laterPoint = visible.slice(index + 1).some(next => next.kind === 'point' && next.text.trim())
    const laterChild = visible.slice(index + 1).some(next => next.kind === 'subpoint' && next.parentId === row.parentId && next.text.trim())
    if (row.kind === 'subpoint' && !row.text.trim() && laterPoint && !laterChild && row.id !== expandedId) {
      const anchor = [...result].reverse().find(entry => entry.row.id === row.parentId || entry.row.parentId === row.parentId)
      if (anchor) { anchor.addSubpoint = row; continue }
    }
    result.push({row})
  }
  return result
}

export function updateOutlineRow(rows: OutlineRow[], id: string, text: string, spans: any[] = []) {
  const visible = outlineWithGuides(rows)
  if (!visible.some(row=>row.id===id)) throw new Error('This outline field is no longer available.')
  return visible.map(row=>row.id===id ? {...row,text,spans,guide:false} : row).filter(row=>!row.guide)
}

export function serializeOutline(rows: OutlineRow[]) {
  let text = ''
  const spans: any[] = []
  for (const row of rows) {
    if (!row.text.trim()) continue
    if (text) text += '\n'
    const offset = text.length
    text += row.prefix + row.text
    spans.push(...row.prefixSpans.map(span=>({...span,start:span.start+offset,end:span.end+offset})),
      ...row.spans.map(span=>({...span,start:span.start+offset+row.prefix.length,end:span.end+offset+row.prefix.length})))
  }
  return {text,spans}
}
