import { useEffect, useId, useRef, useState } from 'react'
import { loadGreekMorphology, decodeGreekMorphology } from '../services/greekMorphology'
import { loadGreekBriefGloss } from '../services/greekBriefGlosses'

const wording = {
  en: {
    title: 'Word form here', pilot: 'Romans & Colossians · review pilot', language: 'Grammar explanation language',
    intro: 'Grammar at this reference. Other forms of the same dictionary word can differ.',
    loading: 'Loading the word’s grammar…', error: 'The grammar could not load. Word occurrences are still available.', retry: 'Retry grammar',
    lemma: 'Dictionary form', common: 'Common translation', glossHelp: 'A brief English dictionary gloss. The wording used in a verse depends on its context.', glossSource: 'Dictionary gloss source', pos: 'Part of speech', source: 'Source analysis and limits', alternative: 'Other analysis supplied by the source',
    difference: 'The source supplies different functional and form tags for this word. Both are retained below; these are analyses of the same Greek text.',
    analysisHelp: 'Functional analysis considers how the verb is used. Form-oriented analysis emphasizes what its grammatical shape distinguishes. For example, present middle and passive forms share endings; context can help distinguish their use.',
    functionTag: 'Functional tag', formTag: 'Form tag', unknown: 'Some source tags are not explained yet:',
    limits: 'Grammar helps describe the wording. It does not, by itself, settle the meaning of a whole passage.',
    attribution: 'Greek text and tags: Nestle 1904 / Biblical Humanities, CC0. Grammar explanations are shared definitions of the source’s tags.',
    glossCredit: 'Brief dictionary glosses: Tyndale House and STEPBible.org',
    glossNotice: 'English glosses filtered and reformatted for Heritage. Multiple general senses are retained without choosing a sense for this verse.',
    codes: 'Source tagging conventions', grammar: 'Why aorist does not automatically mean “once for all”',
  },
  ru: {
    title: 'Форма слова здесь', pilot: 'Римлянам и Колоссянам · пробная версия для проверки', language: 'Язык объяснения грамматики',
    intro: 'Разбор формы в этом стихе. В других местах то же словарное слово может иметь другую форму.',
    loading: 'Загрузка грамматики слова…', error: 'Не удалось загрузить грамматику. Список употреблений слова остаётся доступным.', retry: 'Повторить загрузку грамматики',
    lemma: 'Словарная форма', common: 'Обычный перевод (англ.)', glossHelp: 'Краткое словарное значение на английском. Перевод слова в конкретном стихе зависит от контекста.', glossSource: 'Источник словарного значения', pos: 'Часть речи', source: 'Разбор источника и его ограничения', alternative: 'Другой разбор, указанный в источнике',
    difference: 'Источник указывает разные функциональные пометы и пометы формы. Оба разбора сохранены ниже: это разборы одного и того же греческого текста.',
    analysisHelp: 'Функциональный разбор учитывает употребление глагола. Разбор по форме прежде всего отмечает различия, видимые в его строении. Например, в настоящем времени окончания среднего и страдательного залога совпадают; контекст помогает различить их употребление.',
    functionTag: 'Функциональная помета', formTag: 'Помета формы', unknown: 'Некоторые пометы источника пока не объяснены:',
    limits: 'Грамматика помогает понять формулировку, но сама по себе не определяет смысл всего отрывка.',
    attribution: 'Греческий текст и пометы: Nestle 1904 / Biblical Humanities, CC0. Объяснения грамматики — общие определения помет источника.',
    glossCredit: 'Краткие словарные значения: Tyndale House и STEPBible.org',
    glossNotice: 'Английские значения отобраны и переформатированы для Heritage. Общие значения сохранены без выбора значения для данного стиха.',
    codes: 'Условные обозначения источника', grammar: 'Почему аорист сам по себе не означает «раз и навсегда»',
  },
}

function Analysis({ analysis, words }) {
  const [openKey, setOpenKey] = useState(null), [pinnedKey, setPinnedKey] = useState(null)
  const grid = useRef(null), id = useId()
  const features = [
    ...(analysis.partOfSpeech ? [{ key: 'pos', label: words.pos, value: analysis.partOfSpeech.label, explanation: analysis.partOfSpeech.explanation }] : []),
    ...analysis.features,
  ]
  useEffect(() => {
    if (!openKey) return
    const outside = event => {
      if (!grid.current?.contains(event.target)) { setOpenKey(null); setPinnedKey(null) }
    }
    const dismiss = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpenKey(null); setPinnedKey(null)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', dismiss, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', dismiss, true)
    }
  }, [openKey])
  return <>
    <div ref={grid} data-grammar-grid className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {features.map(feature => {
        const open = openKey === feature.key, tooltipId = `${id}-${feature.key}`
        return <div key={feature.key} className="word-grammar-feature relative min-w-0"
          onPointerEnter={event => { if (event.pointerType !== 'touch' && !pinnedKey) setOpenKey(feature.key) }}
          onPointerLeave={event => { if (!pinnedKey && !event.currentTarget.contains(document.activeElement)) setOpenKey(null) }}
          onFocus={() => { setOpenKey(feature.key); setPinnedKey(null) }}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpenKey(null); setPinnedKey(null) } }}>
          <button type="button" aria-expanded={open} aria-describedby={open ? tooltipId : undefined}
            onClick={() => { const next = pinnedKey === feature.key ? null : feature.key; setPinnedKey(next); setOpenKey(next) }}
            className={`w-full h-full min-h-[4.5rem] rounded-lg border px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${open ? 'border-blue-400 bg-blue-100/60 dark:border-blue-500 dark:bg-blue-900/40' : 'border-gray-200 bg-white/60 dark:border-gray-700 dark:bg-gray-900/40'}`}>
            <span className="flex items-start justify-between gap-2 text-xs text-gray-600 dark:text-gray-300"><span>{feature.label}: </span><span aria-hidden="true" className="opacity-60">ⓘ</span></span>
            <strong className="block mt-1 text-sm leading-snug">{feature.value}</strong>
          </button>
          {open && <div id={tooltipId} role="tooltip" className="word-grammar-tooltip absolute top-full z-30 mt-2 w-80 max-w-[calc(100vw-4rem)] rounded-lg border border-gray-200 bg-white p-3 text-sm leading-relaxed text-gray-900 shadow-lg dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
            <strong className="block mb-1">{feature.value}</strong>{feature.explanation}
          </div>}
        </div>
      })}
    </div>
    {analysis.notes?.map((note, index) => <p key={index} className="text-sm leading-relaxed">{note}</p>)}
    {analysis.unknownParts?.length > 0 && <p className="text-sm">{words.unknown} {analysis.unknownParts.join(', ')}</p>}
  </>
}

function DictionaryGloss({ lemma, strongs, words }) {
  const [entry, setEntry] = useState(null)
  useEffect(() => {
    let live = true
    setEntry(null)
    loadGreekBriefGloss(lemma, strongs).then(value => { if (live) setEntry(value) }).catch(() => { /* Grammar and occurrences remain usable without the optional gloss. */ })
    return () => { live = false }
  }, [lemma, strongs])
  if (!entry?.glosses?.length) return null
  return <span data-dictionary-gloss className="inline-flex flex-wrap items-baseline gap-x-1" title={words.glossHelp}>
    <span className="text-gray-600 dark:text-gray-300">{words.common}:</span> <span lang="en" className="font-medium">{entry.glosses.join('; ')}</span>
    <a href={entry.source.url} target="_blank" rel="noopener noreferrer" aria-label={words.glossSource} title={`${words.glossHelp} ${entry.source.attribution}`} className="ml-1 underline text-xs text-gray-600 dark:text-gray-300">STEPBible</a>
  </span>
}

export default function GreekWordForm({ word, lemma, defaultLanguage = 'en' }) {
  const [language, setLanguage] = useState(() => {
    try { return localStorage.getItem('heritage-grammar-language') || defaultLanguage } catch { return defaultLanguage }
  })
  const locale = language === 'ru' ? 'ru' : 'en', words = wording[locale]
  const [items, setItems] = useState(null), [error, setError] = useState(false), [retry, setRetry] = useState(0)
  const eligible = ['Romans', 'Colossians'].includes(word.book) && (word.translationId === 'ORIGINAL' || word.sourceRange || word.studySourceAnchors?.length || word.sourceAnchors?.length || word.sourceRanges?.length)
  useEffect(() => {
    let live = true
    setItems(null); setError(false)
    if (eligible) loadGreekMorphology(word, lemma).then(value => { if (live) setItems(value) }).catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [word, lemma, retry, eligible])
  if (!eligible || items?.length === 0) return null
  const chooseLanguage = value => {
    setLanguage(value)
    try { localStorage.setItem('heritage-grammar-language', value) } catch { /* Explanation choice also works without storage. */ }
  }
  return <section lang={locale} aria-label={words.title} className="mt-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-3 sm:p-4" data-word-grammar>
    <div className="flex flex-wrap justify-between items-start gap-3">
      <div><h3 className="font-semibold">{words.title}</h3><p className="text-xs mt-1 text-gray-600 dark:text-gray-300">{words.pilot}</p></div>
      <div role="group" aria-label={words.language} className="flex gap-1 text-sm">
        {[['en', 'English'], ['ru', 'Русский']].map(([id, label]) => <button key={id} type="button" lang={id} aria-pressed={locale === id} onClick={() => chooseLanguage(id)} className={`rounded px-2 py-1 border ${locale === id ? 'border-blue-700 bg-blue-700 text-white' : 'border-gray-300 dark:border-gray-600'}`}>{label}</button>)}
      </div>
    </div>
    <p className="mt-3 text-sm leading-relaxed">{words.intro}</p>
    {!items && !error && <p role="status" className="mt-3 text-sm">{words.loading}</p>}
    {error && <p role="status" className="mt-3 text-sm">{words.error} <button className="underline" onClick={() => setRetry(value => value + 1)}>{words.retry}</button></p>}
    {items?.map(item => {
      const analysis = decodeGreekMorphology(item.funcMorph, locale)
      return <article key={item.key} className="mt-4 border-t border-blue-200 dark:border-blue-800 pt-3" data-grammar-reference={`${item.book}:${item.chapter}:${item.verse}`}>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><strong lang="grc" className="text-xl">{item.text}</strong><span className="text-sm">{locale === 'ru' ? ({ Romans: 'Римлянам', Colossians: 'Колоссянам' }[item.book]) : item.book} {item.chapter}:{item.verse}</span></p>
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm mt-1">
          <p>{words.lemma}: <span lang="grc">{item.lemma}</span></p>
          <DictionaryGloss lemma={item.lemma} strongs={item.strongs} words={words} />
        </div>
        <div className="mt-3"><Analysis analysis={analysis} words={words} /></div>
        <details className="mt-3 text-xs leading-relaxed">
          <summary className="cursor-pointer underline">{words.source}</summary>
          <p className="mt-2">{words.functionTag}: <code>{item.funcMorph}</code> · {words.formTag}: <code>{item.formMorph}</code></p>
          <p className="mt-2">{words.analysisHelp}</p>
          {item.tagsDiffer && <><p className="mt-2">{words.difference}</p><p className="font-semibold mt-2">{words.alternative}</p><div className="mt-2 space-y-2 text-sm"><Analysis analysis={decodeGreekMorphology(item.formMorph, locale)} words={words} /></div></>}
          <p className="mt-2">{words.limits}</p><p className="mt-2">{words.attribution}</p>
          <p className="mt-2"><a className="underline" href="https://STEPBible.github.io/STEPBible-Data" target="_blank" rel="noopener noreferrer">{words.glossCredit}</a> · <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>. {words.glossNotice}</p>
          <p className="mt-2"><a className="underline" href="https://github.com/biblicalhumanities/Nestle1904/tree/713f28a3b7d4d66132f5aa809fa223fe79762e5d/morph" target="_blank" rel="noopener noreferrer">{words.codes}</a></p>
          <p className="mt-2"><a className="underline" href="https://www.billmounce.com/newtestamentgreek1/exegetical-insight-chapter-23" target="_blank" rel="noopener noreferrer">{words.grammar}</a></p>
        </details>
      </article>
    })}
  </section>
}
