import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('../../../',import.meta.url))
export default defineConfig({root,plugins:[react()],resolve:{dedupe:['react','react-dom'],alias:{'@':root+'community-server/src'}},build:{outDir:process.env.CANVAS_TEST_BUILD || root+'node_modules/.cache/heritage-canvas-harness',emptyOutDir:true,commonjsOptions:{include:[/node_modules/,/service-core/]},rollupOptions:{input:root+'community-server/tests/browser/planner.html'}},preview:{host:'127.0.0.1',port:4199,strictPort:true}})
