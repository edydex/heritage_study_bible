export const PLANNER_SONG_FRAME_NAME = 'heritage-planner-song'
export function plannerSongFrameMessage(event:Pick<MessageEvent,'source'|'origin'|'data'>, source:MessageEventSource | null | undefined, origin:string):{type:'dirty';dirty:boolean}|{type:'saved';syncId:string}|null {
  if (!source || event.source !== source || event.origin !== origin || !event.data || typeof event.data !== 'object') return null
  if (event.data.type === 'heritage-song:dirty' && typeof event.data.dirty === 'boolean') return {type:'dirty',dirty:event.data.dirty}
  if (event.data.type === 'heritage-song:saved' && typeof event.data.syncId === 'string' && /^[\w.:-]{1,128}$/.test(event.data.syncId)) return {type:'saved',syncId:event.data.syncId}
  return null
}
