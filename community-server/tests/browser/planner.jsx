import React from 'react'
import {createRoot} from 'react-dom/client'
import PlanServiceClient from '../../src/components/PlanServiceClient'
import styles from '../../src/app/(payload)/custom.scss?raw'
const style=document.createElement('style')
style.textContent=`:root {font:16px system-ui;--theme-text:#222;--theme-elevation-50:#fafafa;--theme-elevation-100:#eee;--theme-elevation-150:#ddd;--theme-elevation-250:#bbb;--theme-success-100:#e0eee6;--theme-success-700:#235c40;}body{margin:0}*{box-sizing:border-box}button,input,select{font:inherit} ${styles.replace(/^\s*\/\/.*$/gm, "")}`
document.head.append(style)
createRoot(document.getElementById('root')).render(<div className="heritage-planner-frame"><PlanServiceClient sermonSyncId="canvas-rehearsal" /></div>)
