import { useEffect, useState } from 'react'
import { loadGreekMorphology, decodeGreekMorphology } from '../services/greekMorphology'

const wording = {
  en: {
    title: 'Word form here', pilot: 'Romans & Colossians · review pilot', language: 'Grammar explanation language',
    intro: 'These tags describe the Greek word at this reference. Other occurrences of its dictionary form can have different grammar.',
    loading: 'Loading the word’s grammar…', error: 'The grammar could not load. Word occurrences are still available.', retry: 'Retry grammar',
    lemma: 'Dictionary form', pos: 'Part of speech', source: 'Source analysis and limits', alternative: 'Other analysis supplied by the source',
    difference: 'The source supplies different functional and form tags for this word. Both are retained below; these are analyses of the same Greek text.',
    analysisHelp: 'Functional analysis considers how the verb is used. Form-oriented analysis emphasizes what its grammatical shape distinguishes. For example, present middle and passive forms share endings; context can help distinguish their use.',
    functionTag: 'Functional tag', formTag: 'Form tag', unknown: 'Some source tags are not explained yet:',
    context: 'Reading this form in context', limits: 'Grammar helps describe the wording. It does not, by itself, settle the meaning of a whole passage.',
    attribution: 'Greek text and tags: Nestle 1904 / Biblical Humanities, CC0. Explanations are shared grammar notes, not a new interpretation generated for each word.',
    codes: 'Source tagging conventions', grammar: 'Why aorist does not automatically mean “once for all”',
  },
  ru: {
    title: 'Форма слова здесь', pilot: 'Римлянам и Колоссянам · пробная версия для проверки', language: 'Язык объяснения грамматики',
    intro: 'Эти пометы описывают греческое слово в указанном стихе. В других местах то же словарное слово может иметь другую грамматическую форму.',
    loading: 'Загрузка грамматики слова…', error: 'Не удалось загрузить грамматику. Список употреблений слова остаётся доступным.', retry: 'Повторить загрузку грамматики',
    lemma: 'Словарная форма', pos: 'Часть речи', source: 'Разбор источника и его ограничения', alternative: 'Другой разбор, указанный в источнике',
    difference: 'Источник указывает разные функциональные пометы и пометы формы. Оба разбора сохранены ниже: это разборы одного и того же греческого текста.',
    analysisHelp: 'Функциональный разбор учитывает употребление глагола. Разбор по форме прежде всего отмечает различия, видимые в его строении. Например, в настоящем времени окончания среднего и страдательного залога совпадают; контекст помогает различить их употребление.',
    functionTag: 'Функциональная помета', formTag: 'Помета формы', unknown: 'Некоторые пометы источника пока не объяснены:',
    context: 'Эта форма в контексте', limits: 'Грамматика помогает понять формулировку, но сама по себе не определяет смысл всего отрывка.',
    attribution: 'Греческий текст и пометы: Nestle 1904 / Biblical Humanities, CC0. Используются общие объяснения грамматики, а не новое автоматически созданное толкование каждого слова.',
    codes: 'Условные обозначения источника', grammar: 'Почему аорист сам по себе не означает «раз и навсегда»',
  },
}

function readingNote(item, language) {
  const lemma = item.lemma?.normalize('NFD').replace(/\p{M}/gu, '')
  if (lemma !== 'ρυομαι') return null
  if (item.book === 'Colossians' && item.chapter === 1 && item.verse === 13) return language === 'ru'
    ? 'Здесь ἐρύσατο представляет избавление как событие в прошлом: «Он избавил». Сам аорист не означает «раз и навсегда» и не говорит, что действие было мгновенным или что Бог больше не будет избавлять. Вывод о смысле всего отрывка требует контекста.'
    : 'Here ἐρύσατο presents the rescue as past: “he rescued/delivered.” Aorist alone does not say this was the final act of rescue or that it was instantaneous. Read the surrounding sentence before drawing conclusions about its scope.'
  if (item.book === 'Romans' && item.chapter === 7 && item.verse === 24) return language === 'ru'
    ? 'Здесь ῥύσεται — форма будущего времени в вопросе: «кто избавит меня?» Это то же словарное слово, что и ἐρύσατο в Колоссянам 1:13, но другая временная форма. Сам грамматический разбор не даёт ответа на этот вопрос.'
    : 'Here ῥύσεται is future in the question “who will rescue/deliver me?” It shares a dictionary form with ἐρύσατο in Colossians 1:13, but has a different tense form. The grammar alone does not answer the question being asked.'
  return null
}

function Analysis({ analysis, words }) {
  return <>
    {analysis.partOfSpeech && <details className="rounded border border-gray-200 dark:border-gray-700 px-3 py-2">
      <summary className="cursor-pointer"><span className="text-gray-600 dark:text-gray-300">{words.pos}: </span><strong>{analysis.partOfSpeech.label}</strong></summary>
      <p className="mt-2 text-sm leading-relaxed">{analysis.partOfSpeech.explanation}</p>
    </details>}
    {analysis.features.map(feature => <details key={feature.key} className="rounded border border-gray-200 dark:border-gray-700 px-3 py-2">
      <summary className="cursor-pointer"><span className="text-gray-600 dark:text-gray-300">{feature.label}: </span><strong>{feature.value}</strong></summary>
      <p className="mt-2 text-sm leading-relaxed">{feature.explanation}</p>
    </details>)}
    {analysis.notes?.map((note, index) => <p key={index} className="text-sm leading-relaxed">{note}</p>)}
    {analysis.unknownParts?.length > 0 && <p className="text-sm">{words.unknown} {analysis.unknownParts.join(', ')}</p>}
  </>
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
      const note = readingNote(item, locale), analysis = decodeGreekMorphology(item.funcMorph, locale)
      return <article key={item.key} className="mt-4 border-t border-blue-200 dark:border-blue-800 pt-3" data-grammar-reference={`${item.book}:${item.chapter}:${item.verse}`}>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><strong lang="grc" className="text-xl">{item.text}</strong><span className="text-sm">{locale === 'ru' ? ({ Romans: 'Римлянам', Colossians: 'Колоссянам' }[item.book]) : item.book} {item.chapter}:{item.verse}</span></p>
        <p className="text-sm mt-1">{words.lemma}: <span lang="grc">{item.lemma}</span></p>
        <div className="mt-3 space-y-2"><Analysis analysis={analysis} words={words} /></div>
        {note && <div className="mt-3 text-sm leading-relaxed"><h4 className="font-semibold">{words.context}</h4><p className="mt-1">{note}</p></div>}
        <details className="mt-3 text-xs leading-relaxed">
          <summary className="cursor-pointer underline">{words.source}</summary>
          <p className="mt-2">{words.functionTag}: <code>{item.funcMorph}</code> · {words.formTag}: <code>{item.formMorph}</code></p>
          <p className="mt-2">{words.analysisHelp}</p>
          {item.tagsDiffer && <><p className="mt-2">{words.difference}</p><p className="font-semibold mt-2">{words.alternative}</p><div className="mt-2 space-y-2 text-sm"><Analysis analysis={decodeGreekMorphology(item.formMorph, locale)} words={words} /></div></>}
          <p className="mt-2">{words.limits}</p><p className="mt-2">{words.attribution}</p>
          <p className="mt-2"><a className="underline" href="https://github.com/biblicalhumanities/Nestle1904/tree/713f28a3b7d4d66132f5aa809fa223fe79762e5d/morph" target="_blank" rel="noopener noreferrer">{words.codes}</a></p>
          <p className="mt-2"><a className="underline" href="https://www.billmounce.com/newtestamentgreek1/exegetical-insight-chapter-23" target="_blank" rel="noopener noreferrer">{words.grammar}</a></p>
        </details>
      </article>
    })}
  </section>
}
