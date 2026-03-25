import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import fallbackBibleData from '../data/bible-lsv.json'
import { loadTranslation, translations } from '../data/translations'
import {
  buildMassExportRows,
  formatMassExportMarkdown,
  formatMassExportPlain,
  parseMassVerseInput,
} from '../utils/massVerseExport'

const STORAGE_KEYS = {
  input: 'heritage-mass-export-input',
  translations: 'heritage-mass-export-translations',
  format: 'heritage-mass-export-format',
  preview: 'heritage-mass-export-preview',
}

function loadSavedString(key, fallbackValue) {
  try {
    const value = localStorage.getItem(key)
    return value || fallbackValue
  } catch {
    return fallbackValue
  }
}

function loadSavedTranslations(defaultValue) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.translations)
    if (!raw) return defaultValue
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return defaultValue
    const valid = parsed.filter(id => translations.some(translation => translation.id === id))
    return valid.length > 0 ? valid : defaultValue
  } catch {
    return defaultValue
  }
}

function groupTranslationsByLanguage() {
  const map = new Map()
  for (const translation of translations) {
    const language = translation.language || 'Other'
    if (!map.has(language)) map.set(language, [])
    map.get(language).push(translation)
  }
  return [...map.entries()].map(([language, entries]) => ({
    language,
    entries: entries.slice().sort((a, b) => a.name.localeCompare(b.name)),
  }))
}

function MassVerseExportViewer({ toolMeta }) {
  const navigate = useNavigate()
  const defaultTranslations = useMemo(() => {
    const base = ['LSV', 'SYNO-W'].filter(id => translations.some(translation => translation.id === id))
    if (base.length > 0) return base
    return [translations[0]?.id].filter(Boolean)
  }, [])

  const [inputText, setInputText] = useState(() => loadSavedString(STORAGE_KEYS.input, ''))
  const [selectedTranslationIds, setSelectedTranslationIds] = useState(() => loadSavedTranslations(defaultTranslations))
  const [outputFormat, setOutputFormat] = useState(() => {
    const saved = loadSavedString(STORAGE_KEYS.format, 'plain')
    return saved === 'markdown' ? 'markdown' : 'plain'
  })
  const [previewMode, setPreviewMode] = useState(() => {
    const saved = loadSavedString(STORAGE_KEYS.preview, 'parallel')
    return saved === 'stacked' ? 'stacked' : 'parallel'
  })
  const [translationDataById, setTranslationDataById] = useState({})
  const [translationLoadWarnings, setTranslationLoadWarnings] = useState([])
  const [loadingTranslations, setLoadingTranslations] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')

  const translationGroups = useMemo(() => groupTranslationsByLanguage(), [])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.input, inputText) } catch {}
  }, [inputText])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.translations, JSON.stringify(selectedTranslationIds)) } catch {}
  }, [selectedTranslationIds])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.format, outputFormat) } catch {}
  }, [outputFormat])

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.preview, previewMode) } catch {}
  }, [previewMode])

  useEffect(() => {
    let cancelled = false

    const loadAll = async () => {
      if (!selectedTranslationIds.length) {
        setTranslationDataById({})
        setTranslationLoadWarnings([])
        return
      }

      setLoadingTranslations(true)
      const warnings = []
      const loadedEntries = await Promise.all(
        selectedTranslationIds.map(async (translationId) => {
          try {
            const data = await loadTranslation(translationId)
            return [translationId, data]
          } catch {
            warnings.push(`Failed to load translation data for ${translationId}.`)
            return [translationId, null]
          }
        })
      )

      if (cancelled) return

      setTranslationDataById(Object.fromEntries(loadedEntries))
      setTranslationLoadWarnings(warnings)
      setLoadingTranslations(false)
    }

    loadAll()

    return () => { cancelled = true }
  }, [selectedTranslationIds])

  useEffect(() => {
    if (!copyStatus) return undefined
    const timer = window.setTimeout(() => setCopyStatus(''), 2200)
    return () => window.clearTimeout(timer)
  }, [copyStatus])

  const referenceBibleData = translationDataById[selectedTranslationIds[0]] || fallbackBibleData
  const parseResult = useMemo(
    () => parseMassVerseInput(inputText, { bibleData: referenceBibleData }),
    [inputText, referenceBibleData]
  )
  const rows = useMemo(
    () => buildMassExportRows(parseResult.entries, selectedTranslationIds, translationDataById),
    [parseResult.entries, selectedTranslationIds, translationDataById]
  )
  const outputText = useMemo(() => {
    if (outputFormat === 'markdown') {
      return formatMassExportMarkdown(rows, selectedTranslationIds)
    }
    return formatMassExportPlain(rows, selectedTranslationIds)
  }, [outputFormat, rows, selectedTranslationIds])

  const warnings = [...parseResult.warnings, ...translationLoadWarnings]

  const toggleTranslation = (translationId) => {
    setSelectedTranslationIds(prev => {
      const alreadySelected = prev.includes(translationId)
      if (alreadySelected) {
        if (prev.length === 1) return prev
        return prev.filter(id => id !== translationId)
      }
      return [...prev, translationId]
    })
  }

  const copyOutput = async () => {
    if (!outputText.trim()) {
      setCopyStatus('Nothing to copy yet.')
      return
    }
    try {
      await navigator.clipboard.writeText(outputText)
      setCopyStatus('Copied export to clipboard.')
    } catch {
      setCopyStatus('Failed to copy.')
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
            <span className="text-lg">{'\u2190'}</span>
          </button>
          <h1 className="text-base sm:text-lg font-bold heading-text truncate">
            {toolMeta?.title || 'Mass Verse Export'}
          </h1>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl px-4 py-6 pb-16 space-y-5">
        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Input References</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            Supports forgiving input and shorthand, including cross-chapter ranges.
          </p>
          <textarea
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            placeholder="John 3:16 Gen 1:1-2, 6-7&#10;Rom 8-9&#10;Gen 1:31-2:3"
            className="w-full min-h-[130px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Translations</h3>
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {translationGroups.map(group => (
                  <div key={group.language} className="rounded-lg border border-gray-200 dark:border-gray-700 p-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                      {group.language}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {group.entries.map(translation => {
                        const active = selectedTranslationIds.includes(translation.id)
                        return (
                          <button
                            key={translation.id}
                            onClick={() => toggleTranslation(translation.id)}
                            className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                              active
                                ? 'border-primary bg-primary/10 dark:bg-blue-900/20'
                                : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{translation.abbr}</span>
                              {active && <span className="text-primary dark:text-blue-400 text-sm">✓</span>}
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{translation.name}</p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Output Format</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setOutputFormat('plain')}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      outputFormat === 'plain'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    Plain
                  </button>
                  <button
                    onClick={() => setOutputFormat('markdown')}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      outputFormat === 'markdown'
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    Markdown
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Preview Layout</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPreviewMode('parallel')}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      previewMode === 'parallel'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    Parallel
                  </button>
                  <button
                    onClick={() => setPreviewMode('stacked')}
                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      previewMode === 'stacked'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    Stacked
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Visual only. Export structure remains column-oriented for multi-translation output.
                </p>
              </div>

              <button
                onClick={copyOutput}
                className="w-full rounded-lg bg-primary text-white py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Copy Output
              </button>
              {copyStatus && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{copyStatus}</p>
              )}
            </div>
          </div>
        </section>

        {warnings.length > 0 && (
          <section className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">
              Parse Warnings
            </h3>
            <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-200">
              {warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>• {warning}</li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Live Preview</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {rows.length} reference{rows.length === 1 ? '' : 's'} parsed
            </p>
          </div>

          {loadingTranslations && (
            <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse mb-3">
              Loading translation data...
            </p>
          )}

          {rows.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Add references above to see parsed output.
            </p>
          ) : previewMode === 'parallel' ? (
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-700">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-200 min-w-[220px]">Reference</th>
                    {selectedTranslationIds.map(translationId => (
                      <th key={translationId} className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-200 min-w-[260px]">
                        {translationId}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.englishRef}-${index}`} className="border-t border-gray-200 dark:border-gray-700 align-top">
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-pre-line">
                        {row.englishRef}
                        {'\n'}
                        {row.localizedLine}
                      </td>
                      {selectedTranslationIds.map(translationId => (
                        <td key={`${row.englishRef}-${translationId}-${index}`} className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-pre-line">
                          {(row.translationCells[translationId] || []).join('\n')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((row, index) => (
                <div
                  key={`${row.englishRef}-stack-${index}`}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-pre-line">
                    {row.englishRef}
                    {'\n'}
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400">{row.localizedLine}</span>
                  </p>
                  <div className="mt-3 space-y-3">
                    {selectedTranslationIds.map(translationId => (
                      <div key={`${row.englishRef}-${translationId}-stack-${index}`}>
                        <p className="text-xs font-semibold text-primary dark:text-blue-400 mb-1">{translationId}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                          {(row.translationCells[translationId] || []).join('\n')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Copyable Output</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {outputFormat === 'markdown' ? 'Markdown table' : 'Plain text'}
            </span>
          </div>
          <textarea
            readOnly
            value={outputText}
            className="w-full min-h-[220px] rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-xs sm:text-sm text-gray-800 dark:text-gray-200 font-mono"
          />
        </section>
      </main>
    </div>
  )
}

export default MassVerseExportViewer

