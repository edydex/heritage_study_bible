/** Local display aids only. Never write these patterns into a ServiceProject. */
export const PRESENTATION_COLORS = [
  {name:'Red',color:'#ef4444',pattern:'Dots',marks:'<circle cx="3" cy="3" r="1.4"/>'},
  {name:'Blue',color:'#2563eb',pattern:'Horizontal waves',marks:'<path d="M-2 3 Q0 0 2 3 T6 3 T10 3" fill="none" stroke="currentColor"/>'},
  {name:'Green',color:'#16a34a',pattern:'Vertical waves',marks:'<path d="M3 -2 Q0 0 3 2 T3 6 T3 10" fill="none" stroke="currentColor"/>'},
  {name:'Yellow',color:'#eab308',pattern:'Diagonal lines',marks:'<path d="M-2 2L2 -2M0 8L8 0M6 10L10 6" stroke="currentColor"/>'},
  {name:'Orange',color:'#f97316',pattern:'Horizontal lines',marks:'<path d="M0 2H8M0 6H8" stroke="currentColor"/>'},
  {name:'Purple',color:'#9333ea',pattern:'Crosses',marks:'<path d="M4 1V7M1 4H7" stroke="currentColor"/>'},
  {name:'Teal',color:'#0d9488',pattern:'Vertical lines',marks:'<path d="M2 0V8M6 0V8" stroke="currentColor"/>'},
  {name:'White',color:'#ffffff',pattern:'White',marks:''},
  {name:'Gray',color:'#808080',pattern:'Small dots',marks:'<circle cx="2" cy="2" r=".7"/><circle cx="6" cy="6" r=".7"/>'},
  {name:'Black',color:'#111827',pattern:'Black',marks:'<path d="M0 0H8V8H0Z"/>'},
] as const
export type PaletteColor = typeof PRESENTATION_COLORS[number]
export function paletteColor(value?: string): PaletteColor {
  const hex=String(value || '#ffffff').toLowerCase()
  const exact=PRESENTATION_COLORS.find(item=>item.color===hex)
  if(exact)return exact
  const match=/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if(!match)return PRESENTATION_COLORS[7]
  const [r,g,b]=match.slice(1).map(part=>parseInt(part,16)/255)
  const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min
  if(delta<.12)return PRESENTATION_COLORS[max>.85?7:max<.22?9:8]
  let hue=(max===r?(g-b)/delta+(g<b?6:0):max===g?(b-r)/delta+2:(r-g)/delta+4)*60
  return PRESENTATION_COLORS[hue<15||hue>=345?0:hue<45?4:hue<75?3:hue<165?2:hue<195?6:hue<265?1:5]
}
export function patternImage(value?:string, soft=false) {
  const item=paletteColor(value),ink=soft?'#c2c2c2':'#111111'
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8" style="color:${ink};fill:${ink}"><path fill="white" d="M0 0H8V8H0Z"/>${item.marks}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
export function colorDescription(value:string) {
  const item=paletteColor(value)
  return `${item.name}${item.color===value.toLowerCase()?'':` (${value})`} · ${item.pattern}`
}
export function collectPresentationColors(value:unknown):string[] {
  const colors=new Set<string>()
  function visit(value:unknown,depth=0) {
    if(depth>12 || !value || typeof value!=='object')return
    for(const [key,child] of Object.entries(value)) {
      if(['color','foreground','background'].includes(key) && typeof child==='string' && /^#[\da-f]{6}$/i.test(child))colors.add(child.toLowerCase())
      else if(typeof child==='object')visit(child,depth+1)
    }
  }
  visit(value)
  return [...colors].sort((a,b)=>PRESENTATION_COLORS.indexOf(paletteColor(a))-PRESENTATION_COLORS.indexOf(paletteColor(b)) || a.localeCompare(b))
}

export function linePattern(value?:string) {
  return {Red:'1 2',Blue:'6 2',Green:'3 2',Yellow:'8 2 1 2',Orange:'8 3',Purple:'3 1 1 1',Teal:'2 4',White:'12 3',Black:'',Gray:'1 3'}[paletteColor(value).name]
}
