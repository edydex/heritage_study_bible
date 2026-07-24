import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { HERITAGE_BUILT_IN_SONGS } from '../data/builtInSongs'
import { HYMNS } from './HymnsViewer'

function BuiltInSongViewer() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const [language, setLanguage] = useState('en')
  const song = useMemo(
    () => HERITAGE_BUILT_IN_SONGS.find(item => item.id === itemId),
    [itemId],
  )
  const legacyText = useMemo(
    () => HYMNS.find(item => item.id === itemId),
    [itemId],
  )

  useEffect(() => setLanguage('en'), [itemId])

  if (!song) return null

  const stanzas = song.stanzas.length ? song.stanzas : (legacyText?.stanzas || [])
  const russian = language === 'ru'

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900">
      <header className="bg-primary text-white sticky top-0 z-40 shadow-lg">
        <div className="h-14 px-4 sm:px-6 flex items-center gap-3">
          <button onClick={() => navigate('/resources/songs')} className="p-1.5 rounded-lg hover:bg-white/20" aria-label="Back">←</button>
          <h1 className="min-w-0 flex-1 truncate text-base sm:text-lg font-bold">
            {russian ? song.russianTitle : song.title}
          </h1>
          <div className="flex rounded-lg bg-white/15 p-0.5 text-xs font-semibold" aria-label="Song language">
            <button onClick={() => setLanguage('en')} className={`rounded-md px-2 py-1 ${!russian ? 'bg-white text-primary' : ''}`}>EN</button>
            <button onClick={() => setLanguage('ru')} className={`rounded-md px-2 py-1 ${russian ? 'bg-white text-primary' : ''}`}>RU</button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-6 pb-20">
        <article className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-sm">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {song.author} · {song.year}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{song.description}</p>

          <div className={`mt-5 rounded-lg border p-3 text-sm ${
            song.rightsStatus === 'metadata-only'
              ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
          }`}>
            {russian ? song.russianRightsLabel : song.rightsLabel}
          </div>

          {russian ? (
            <div className="mt-6 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-5">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">{song.russianTitle}</h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                The Russian lyrics are intentionally not copied from another songbook until WOTBC records permission for that translation.
              </p>
            </div>
          ) : stanzas.length ? (
            <div className="mt-6 space-y-5">
              {stanzas.map((stanza, index) => (
                <section key={`${song.id}-${index}`}>
                  <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400">Verse {index + 1}</h2>
                  <p className="mt-1 whitespace-pre-line text-base leading-relaxed text-gray-800 dark:text-gray-200">{stanza}</p>
                </section>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-5 text-sm text-gray-600 dark:text-gray-300">
              This built-in listing does not include lyrics or music because Heritage has not verified redistribution permission.
            </div>
          )}

          <a href={song.sourceUrl} target="_blank" rel="noreferrer" className="mt-6 inline-block text-sm font-semibold text-primary dark:text-blue-300 underline">
            Rights/source record
          </a>
        </article>
      </main>
    </div>
  )
}

export default BuiltInSongViewer
