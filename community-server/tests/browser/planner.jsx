import React,{useState} from 'react'
import {ConfigProvider,PreferencesProvider} from '@payloadcms/ui'
import {PersonalPresentationPreference} from '../../src/components/PresentationAccessibility'
import {createRoot} from 'react-dom/client'
import PlanServiceClient from '../../src/components/PlanServiceClient'
import PrepareSermonClient from '../../src/components/PrepareSermonClient'
import styles from '../../src/app/(payload)/custom.scss?raw'
const rehearsalReady=location.search.includes('passage-editing') && ['localhost','127.0.0.1'].includes(location.hostname) ? import('./passage-editing-fixture') : Promise.resolve()
const style=document.createElement('style')
style.textContent=`:root {font:16px system-ui;--theme-text:#222;--theme-elevation-50:#fafafa;--theme-elevation-100:#eee;--theme-elevation-150:#ddd;--theme-elevation-250:#bbb;--theme-success-100:#e0eee6;--theme-success-700:#235c40;--theme-success-800:#184958;}body{margin:0}*{box-sizing:border-box}button,input,select{font:inherit} ${styles.replace(/^\s*\/\/.*$/gm, "")}`
document.head.append(style)
function PreferenceRehearsal() {
 const [account,setAccount]=useState(false)
 return <ConfigProvider config={{collections:[],globals:[],routes:{api:'/api'}}}><PreferencesProvider>
  <div onClick={event=>{if(event.target.closest('a[href="/admin/account"]')){event.preventDefault();setAccount(true)}}}>
   {account ? <main aria-label="Account settings fixture"><PersonalPresentationPreference/><button onClick={()=>setAccount(false)}>Return to editor</button></main> : location.search.includes('workspace') ? <PrepareSermonClient/> : <PlanServiceClient sermonSyncId="canvas-rehearsal"/>}
  </div>
 </PreferencesProvider></ConfigProvider>
}
rehearsalReady.then(()=>createRoot(document.getElementById('root')).render(<div className="heritage-planner-frame">{location.search.includes('preferences') ? <PreferenceRehearsal/> : location.search.includes("workspace") ? <PrepareSermonClient /> : location.search.includes('device-locale') ? <PlanServiceClient /> : <PlanServiceClient sermonSyncId="canvas-rehearsal" />}</div>))
