import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { loadMergedSong } from '../services/songCatalog'

function sourceNames(sources = []) {
  return sources.map(source => source.name).join(', ')
}

function explanationFor(result, language) {
  if (result.error) return `Could not load this source: ${result.error.message}`
  if (result.reference.kind === 'built-in') {
    const rightsLabel = language === 'ru'
      ? result.reference.song.russianRightsLabel
      : result.reference.song.rightsLabel
    if (result.reference.song.rightsStatus === 'public-domain-text') {
      return `${rightsLabel} Heritage has verified the source record, but its built-in transcription in this language is not complete yet; a Community may add and publish its reviewed wording now.`
    }
    return rightsLabel
  }
  const document = result.document || {}
  const rights = document.rights && typeof document.rights === 'object' ? document.rights : {}
  return (
    document.rightsNotes ||
    rights.statement ||
    document.rightsStatement ||
    document.copyright ||
    result.reference.description ||
    'This source has a song listing but has not supplied words in this language.'
  )
}

function linksFor(result) {
  const document = result.document || {}
  const item = result.reference.item || {}
  return [
    { label: 'Text/source record', url: document.sourceUrl || item.sourceUrl },
    { label: 'Permission record', url: document.permissionUrl || item.permissionUrl },
  ].filter(link => link.url)
}

function BuiltInSongViewer() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const [language, setLanguage] = useState('en')
  const [variantIndex, setVariantIndex] = useState(0)
  const [song, setSong] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    setLanguage('en')
    setVariantIndex(0)

    loadMergedSong(itemId, {
      onProgress: result => {
        if (cancelled || !result) return
        setSong(result)
        setLoading(false)
      },
    })
      .then(result => {
        if (cancelled) return
        setSong(result)
        if (result && !result.languages.en.length && result.languages.ru.length) setLanguage('ru')
      })
      .catch(error => {
        if (!cancelled) setLoadError(error.message || 'The song could not be loaded.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [itemId])

  useEffect(() => setVariantIndex(0), [language])

  const variants = song?.languages?.[language] || []
  const selectedVariant = variants[variantIndex] || variants[0]
  const sourceExplanations = useMemo(() => {
    if (!song) return []
    return song.loaded.map(result => ({
      source: result.reference.source,
      explanation: explanationFor(result, language),
      links: linksFor(result),
      error: Boolean(result.error),
    }))
  }, [language, song])
  const russian = language === 'ru'

  if (loading) {
    return (
      <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading song versions…</p>
      </div>
    )
  }

  if (!song || loadError) {
    return (
      <div className="min-h-screen bg-background dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-center">
          <h1 className="font-semibold text-gray-900 dark:text-gray-100">Song not found</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{loadError || 'This song is no longer in an installed catalog.'}</p>
          <button onClick={() => navigate('/resources/songs')} className="mt-4 text-sm font-semibold text-primary dark:text-blue-300 underline">
            Back to Songs
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-primary text-white sticky top-0 z-40 shadow-lg">
        <div className="h-14 px-4 sm:px-6 flex items-center gap-3">
          <button onClick={() => navigate('/resources/songs')} className="p-1.5 rounded-lg hover:bg-white/20" aria-label="Back">←</button>
          <h1 className="min-w-0 flex-1 truncate text-base sm:text-lg font-bold">
            {russian && song.russianTitle ? song.russianTitle : song.title}
          </h1>
          <div className="flex rounded-lg bg-white/15 p-0.5 text-xs font-semibold" aria-label="Song language">
            <button onClick={() => setLanguage('en')} className={`rounded-md px-2 py-1 ${!russian ? 'bg-white text-primary' : ''}`}>
              EN{song.languages.en.length ? ` ${song.languages.en.length}` : ''}
            </button>
            <button onClick={() => setLanguage('ru')} className={`rounded-md px-2 py-1 ${russian ? 'bg-white text-primary' : ''}`}>
              RU{song.languages.ru.length ? ` ${song.languages.ru.length}` : ''}
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-6 pb-20">
        <article className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-sm">
          {(song.author || song.year) && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {[song.author, song.year].filter(Boolean).join(' · ')}
            </p>
          )}
          {song.description && (
            <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{song.description}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {song.sourceNames.map((name, index) => (
              <span key={name} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                index === 0
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {name}{index === 0 ? ' · preferred' : ''}
              </span>
            ))}
          </div>
          {song.pendingSourceCount > 0 && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400" role="status">
              Showing available words now; checking {song.pendingSourceCount} connected {song.pendingSourceCount === 1 ? 'source' : 'sources'} in the background…
            </p>
          )}

          {variants.length > 1 && (
            <section className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
              <h2 className="text-sm font-semibold text-blue-950 dark:text-blue-100">
                These sources have different {russian ? 'Russian' : 'English'} words
              </h2>
              <p className="mt-1 text-xs text-blue-800 dark:text-blue-200">
                Choose which wording to read. The preferred source follows your Heritage → main Community → earlier Community order.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {variants.map((variant, index) => (
                  <button
                    key={variant.signature}
                    onClick={() => setVariantIndex(index)}
                    className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold ${
                      index === variantIndex
                        ? 'border-primary bg-primary text-white'
                        : 'border-blue-300 bg-white text-blue-900 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-100'
                    }`}
                  >
                    {sourceNames(variant.sources)}
                  </button>
                ))}
              </div>
            </section>
          )}

          {selectedVariant ? (
            <>
              {selectedVariant.sources.length > 1 && (
                <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
                  Same wording in {sourceNames(selectedVariant.sources)}. Showing the {selectedVariant.preferredSource.name} copy.
                </div>
              )}

              <div className="mt-6 space-y-5">
                {selectedVariant.sections.map((section, index) => (
                  <section key={`${selectedVariant.signature}-${index}`}>
                    <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">{section.label}</h2>
                    <p className="mt-1 whitespace-pre-line text-base leading-relaxed text-gray-800 dark:text-gray-200">
                      {section.lines.join('\n')}
                    </p>
                  </section>
                ))}
              </div>

              {selectedVariant.rights?.label && (
                <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200">
                  {selectedVariant.rights.label}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-4">
                {selectedVariant.rights?.sourceUrl && (
                  <a href={selectedVariant.rights.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary dark:text-blue-300 underline">
                    Text/source record
                  </a>
                )}
                {selectedVariant.rights?.permissionUrl && (
                  <a href={selectedVariant.rights.permissionUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary dark:text-blue-300 underline">
                    Permission record
                  </a>
                )}
              </div>
            </>
          ) : song.pendingSourceCount > 0 ? (
            <section className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
              Checking {song.pendingSourceCount} connected {song.pendingSourceCount === 1 ? 'source' : 'sources'} for {russian ? 'Russian' : 'English'} words…
            </section>
          ) : (
            <section className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
              <h2 className="font-semibold text-amber-950 dark:text-amber-100">
                No {russian ? 'Russian' : 'English'} words are available from these sources
              </h2>
              <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
                This is source-specific, not a blanket copyright block:
              </p>
              <div className="mt-3 space-y-3">
                {sourceExplanations.map(record => (
                  <div key={record.source.id} className="rounded-lg bg-white/70 p-3 text-sm text-amber-950 dark:bg-gray-900/30 dark:text-amber-100">
                    <p><strong>{record.source.name}:</strong> {record.explanation}</p>
                    {record.links.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-4">
                        {record.links.map(link => (
                          <a key={link.label} href={link.url} target="_blank" rel="noreferrer" className="font-semibold underline">
                            {link.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </article>
      </main>
    </div>
  )
}

export default BuiltInSongViewer
