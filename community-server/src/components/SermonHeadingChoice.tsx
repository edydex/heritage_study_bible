'use client'
import {useWorkspaceText} from './useWorkspaceText'
export default function SermonHeadingChoice({item,options,channelId,onChange}:{item:any;options:any[];channelId:string;onChange:(choice:any)=>void}) {
  const t=useWorkspaceText()
  const value=item.sermonHeading ? item.sermonHeading.source==='title' ? 'title' : 'point:'+item.sermonHeading.key : 'auto'
  const missing=value!=='auto'&&!options.some(option=>option.value===value)
  return <label className="heritage-sermon-heading-choice">{t('Heading on this slide')}<select aria-label={t('Heading on this slide')} value={value} onChange={event=>onChange(event.target.value==='auto' ? null : event.target.value==='title' ? {source:'title'} : {source:'point',key:event.target.value.slice(6)})}>
    {missing&&<option value={value} disabled>{t('Selected point unavailable · using Automatic')}</option>}
    <option value="auto">{t('Automatic · latest point or title')}</option>
    {options.map(option=><option key={option.value} value={option.value}>{option.value==='title' ? t('Sermon title') : ''}{option.value==='title' ? ' · ' : ''}{option.textByChannel[channelId] || Object.values(option.textByChannel).find(Boolean)}</option>)}
  </select><small>{t('Applies to this slide in every language. Automatic keeps following the sermon.')}</small></label>
}
