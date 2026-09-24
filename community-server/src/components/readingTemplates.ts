import core from '../../packages/service-core/index.js'

export function preSermonReadingObjects(reference:string,edition:string,topic:string) {
  const box=(id:string,text:string,fontSize:number,y:number,height:number,bold=false)=>({id,type:'text',text,fontSize,
    frame:{x:.025,y,width:.95,height,rotation:0},align:'left',color:'#ffffff',spans:bold && text ? [{start:0,end:text.length,weight:'700'}] : []})
  return [box('reading-reference',reference,117,.24,.16,true),box('reading-edition',edition,96,.40,.16),box('reading-topic',topic,80,.74,.23)]
}

/** Slide 42: a left-aligned passage and edition, with the service topic below. */
export function setReadingTemplate(raw: any, itemId: string, template: string) {
  const project = JSON.parse(JSON.stringify(raw)), item = project.items[itemId]
  if (item?.presetId !== 'wotbc-reading-title') throw new Error('Choose the reading title slide.')
  const originalText = {...item.textByChannel}
  if (template === 'centered') {
    for (const channel of project.channelIds) {
      const objects = item.objectsByChannel?.[channel]
      if (objects) originalText[channel] = ['reading-reference','reading-edition'].map(id=>objects.find((object:any)=>object.id===id)?.text || '').join('\n')
    }
    delete item.sermonTemplate; delete item.objectsByChannel
    item.kind = 'notice'; item.textByChannel = originalText; delete item.spansByChannel
  } else if (template === 'pre-sermon') {
    item.kind = 'sermon'; item.sermonTemplate = 'other'
    item.objectsByChannel = Object.fromEntries(project.channelIds.map((channel:string)=>{
      const [reference, ...edition] = (originalText[channel] || '').split('\n')
      const welcome = Object.values(project.items).find((value:any)=>value.objectsByChannel?.[channel]?.some((object:any)=>object.id==='welcome-topic')) as any
      const topic = welcome?.objectsByChannel[channel].find((object:any)=>object.id==='welcome-topic')?.text || ''
      return [channel,preSermonReadingObjects(reference,edition.join('\n'),topic)]
    }))
  } else throw new Error('Choose a reading template.')
  return core.normalizeServiceProject(project)
}
