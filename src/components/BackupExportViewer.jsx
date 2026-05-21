import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cacheManifestFiles, loadContentManifest } from '../services/contentCache'
import { exportHeritageData, exportNotesMarkdown, importHeritageData } from '../services/persistentStorage'

function downloadTextFile(fileName, text, type = 'application/json') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function BackupExportViewer({ toolMeta }) {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [cacheProgress, setCacheProgress] = useState(null)
  const [manifestInfo, setManifestInfo] = useState(null)

  const handleExportJson = async () => {
    setBusy(true)
    setStatus('')
    try {
      const payload = await exportHeritageData()
      downloadTextFile(`heritage-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2))
      setStatus('Backup JSON exported.')
    } catch (error) {
      setStatus(error.message || 'Export failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleExportMarkdown = async () => {
    setBusy(true)
    setStatus('')
    try {
      const markdown = await exportNotesMarkdown()
      downloadTextFile(`heritage-notes-${new Date().toISOString().slice(0, 10)}.md`, markdown, 'text/markdown')
      setStatus('Readable Markdown exported.')
    } catch (error) {
      setStatus(error.message || 'Markdown export failed.')
    } finally {
      setBusy(false)
    }
  }

  const handleImportFile = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setStatus('')
    try {
      const text = await file.text()
      const count = await importHeritageData(JSON.parse(text))
      setStatus(`Imported ${count} stored value${count === 1 ? '' : 's'}. Reload the app to use imported settings everywhere.`)
    } catch (error) {
      setStatus(error.message || 'Import failed.')
    } finally {
      setBusy(false)
      event.target.value = ''
    }
  }

  const handleCheckManifest = async () => {
    setBusy(true)
    setStatus('')
    try {
      const manifest = await loadContentManifest()
      setManifestInfo(manifest)
      setStatus(`Content manifest loaded with ${manifest.files?.length || 0} tracked files.`)
    } catch (error) {
      setStatus(error.message || 'Could not load content manifest.')
    } finally {
      setBusy(false)
    }
  }

  const handleCacheContent = async () => {
    setBusy(true)
    setStatus('')
    setCacheProgress({ completed: 0, total: 0 })
    try {
      const result = await cacheManifestFiles(progress => setCacheProgress(progress))
      setManifestInfo(result.manifest)
      setStatus(`Cached ${result.completed} content file${result.completed === 1 ? '' : 's'}.`)
    } catch (error) {
      setStatus(error.message || 'Content cache failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-primary text-white shadow-lg sticky top-0 z-40">
        <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate('/resources/tools')}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <span className="text-lg">{'←'}</span>
          </button>
          <h1 className="text-base sm:text-lg font-bold heading-text truncate">
            {toolMeta?.title || 'Backup / Export'}
          </h1>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
          <h2 className="heading-text text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Your Data</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Export notes, verse bookmarks, commentary bookmarks, reading-plan progress, and app settings. JSON is for restore; Markdown is for human reading.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportJson}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              Export Backup JSON
            </button>
            <button
              onClick={handleExportMarkdown}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-60 transition-colors"
            >
              Export Markdown
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              Import Backup JSON
            </button>
            <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} className="hidden" />
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
          <h2 className="heading-text text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Offline Content Cache</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            This is the foundation for hosted content updates. The APK still bundles the app, and the cache can pull tracked data files from the published site when online.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCheckManifest}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-60 transition-colors"
            >
              Check Manifest
            </button>
            <button
              onClick={handleCacheContent}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              Cache Tracked Content
            </button>
          </div>
          {cacheProgress && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              Cached {cacheProgress.completed} / {cacheProgress.total || manifestInfo?.files?.length || 0}{cacheProgress.file ? ` — ${cacheProgress.file}` : ''}
            </p>
          )}
          {manifestInfo && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Manifest: schema v{manifestInfo.schemaVersion}, {manifestInfo.files?.length || 0} file{manifestInfo.files?.length === 1 ? '' : 's'} tracked.
            </p>
          )}
        </section>

        {status && (
          <div className="rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-sm text-blue-900 dark:text-blue-100">
            {status}
          </div>
        )}
      </main>
    </div>
  )
}

export default BackupExportViewer
