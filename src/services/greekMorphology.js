// Pilot: exact N1904 occurrences in Romans and Colossians only.
// English/Russian wording below explains published codes; it is not exegesis.
const SOURCE_SHA = '3beee6abb6302f691110fe0fc949fc195593b999cf2d0e463c9b573c1bb67150'
const REVISION = '713f28a3b7d4d66132f5aa809fa223fe79762e5d'
const CODE_GUIDE_URL = `https://github.com/biblicalhumanities/Nestle1904/blob/${REVISION}/morph/parsing.txt`
const AORIST_HELP = { title: 'Why aorist alone does not mean once for all', url: 'https://www.billmounce.com/newtestamentgreek1/exegetical-insight-chapter-23' }
const PILOT_BOOKS = new Set(['Romans', 'Colossians'])
const CHECKED_TRANSLATIONS = new Set(['LSV', 'BSB', 'KJV'])
const bilingual = (en, ru) => ({ en, ru })
const item = (en, ru, explanationEn, explanationRu) => ({ label: bilingual(en, ru), explanation: bilingual(explanationEn, explanationRu) })
const POS = {
  N: item('Noun', 'Существительное', 'Names a person, place, thing or idea.', 'Называет лицо, место, предмет или понятие.'),
  A: item('Adjective', 'Прилагательное', 'Describes a noun; it can also stand for a person or thing without a written noun.', 'Описывает существительное; может само обозначать лицо или предмет без написанного существительного.'),
  T: item('Article', 'Артикль', 'Marks a noun or a noun-like expression. Greek articles do not always become a separate translated word.', 'Оформляет существительное или выражение, употреблённое как существительное. В переводе не всегда имеет отдельное соответствие.'),
  V: item('Verb', 'Глагол', 'Expresses an action, event or state. Its form can mark time/aspect, voice, mood and agreement.', 'Выражает действие, событие или состояние. Форма может указывать время, вид, залог, наклонение и согласование.'),
  P: item('Personal pronoun', 'Личное местоимение', 'Refers to a participant such as I, you or he; its exact referent comes from the passage.', 'Указывает на участника: я, ты, он и т. п. Кого именно оно обозначает, определяется контекстом.'),
  R: item('Relative pronoun', 'Относительное местоимение', 'Connects a description to a person or thing: who, which or that.', 'Связывает описание с лицом или предметом: который, кто и т. п.'),
  C: item('Reciprocal pronoun', 'Взаимное местоимение', 'Expresses a relation such as one another.', 'Выражает взаимное отношение, например друг друга.'),
  D: item('Demonstrative pronoun', 'Указательное местоимение', 'Points to someone or something: this or that.', 'Указывает на лицо или предмет: этот, тот.'),
  K: item('Correlative pronoun', 'Соотносительное местоимение', 'Expresses a corresponding amount or kind, understood in relation to another expression.', 'Обозначает соотнесённое количество или качество; связь уточняется по другим словам.'),
  I: item('Interrogative pronoun', 'Вопросительное местоимение', 'Asks which person or thing is meant.', 'Спрашивает, какое лицо или какой предмет имеется в виду.'),
  X: item('Indefinite pronoun', 'Неопределённое местоимение', 'Refers to an unspecified person or thing, such as someone or something.', 'Обозначает неопределённое лицо или предмет: кто-то, что-то.'),
  Q: item('Correlative or interrogative pronoun', 'Соотносительное или вопросительное местоимение', 'The source uses a combined category; context helps determine the use.', 'Источник использует объединённую категорию; употребление уточняется по контексту.'),
  F: item('Reflexive pronoun', 'Возвратное местоимение', 'Refers back to a participant in its clause, such as himself.', 'Отсылает к участнику своего предложения: себя, самого себя и т. п.'),
  S: item('Possessive pronoun', 'Притяжательное местоимение', 'Marks a possessor. The owner and the thing possessed have separate grammatical features.', 'Обозначает принадлежность. Признаки обладателя и обозначаемого предмета различаются.'),
  ADV: item('Adverb', 'Наречие', 'Describes an action or another expression, for example how, when or to what extent.', 'Уточняет действие или другое выражение: как, когда, в какой степени.'),
  CONJ: item('Conjunction', 'Союз', 'Connects words or clauses; its precise relation is determined in context.', 'Связывает слова или предложения; точное значение связи определяется контекстом.'),
  COND: item('Conditional particle', 'Условная частица', 'Introduces or marks a condition. The whole construction determines its force.', 'Вводит или обозначает условие. Значение определяется всей конструкцией.'),
  PRT: item('Particle', 'Частица', 'A short word that adds a grammatical or discourse relation, emphasis or negation.', 'Краткое слово, выражающее грамматическую связь, оттенок, усиление или отрицание.'),
  PREP: item('Preposition', 'Предлог', 'Expresses a relation together with its complement and case; one Greek preposition can have several translated uses.', 'Выражает отношение вместе с зависимым словом и его падежом; один греческий предлог может переводиться по-разному.'),
  INJ: item('Interjection', 'Междометие', 'An exclamation or direct expression of feeling.', 'Возглас или непосредственное выражение чувства.'),
  HEB: item('Hebrew expression', 'Еврейское выражение', 'The source marks this as a Hebrew expression rather than an ordinary inflected Greek word.', 'Источник отмечает еврейское выражение, а не обычную изменяемую греческую форму.'),
  ARAM: item('Aramaic expression', 'Арамейское выражение', 'The source marks this as an Aramaic expression.', 'Источник отмечает арамейское выражение.'),
  PUNCT: item('Punctuation', 'Знак препинания', 'Punctuation, not an inflected word.', 'Знак препинания, а не изменяемое слово.'),
}

const CASE = {
  N: item('Nominative', 'Именительный', 'Often marks a subject or a predicate name. The actual role depends on the construction.', 'Часто обозначает подлежащее или именную часть сказуемого. Роль уточняется по конструкции.'),
  V: item('Vocative', 'Звательный', 'Used for directly addressing someone.', 'Используется при прямом обращении.'),
  G: item('Genitive', 'Родительный', 'Often marks possession or another relation, sometimes translated with of. It has other uses too.', 'Часто выражает принадлежность или другую связь. Имеет и другие значения; перевод зависит от контекста.'),
  D: item('Dative', 'Дательный', 'Can mark a recipient, means, sphere or another relation. It does not always mean to.', 'Может обозначать получателя, средство, сферу или другую связь. Не сводится к одному русскому падежу или предлогу.'),
  A: item('Accusative', 'Винительный', 'Often marks a direct object; it also has uses such as extent or duration.', 'Часто обозначает прямое дополнение; может также выражать протяжённость, длительность и другие отношения.'),
}
const NUMBER = {
  S: item('Singular', 'Единственное число', 'Grammatical agreement with one person or thing, or a singular collective expression.', 'Грамматическое согласование с одним лицом или предметом либо с собирательным выражением в единственном числе.'),
  P: item('Plural', 'Множественное число', 'Grammatical agreement with more than one person or thing.', 'Грамматическое согласование с несколькими лицами или предметами.'),
}
const GENDER = {
  M: item('Masculine', 'Мужской род', 'A grammatical agreement category; it does not by itself establish biological sex or identity.', 'Категория грамматического согласования; сама по себе не устанавливает биологический пол или личность.'),
  F: item('Feminine', 'Женский род', 'A grammatical agreement category; it does not by itself establish biological sex or identity.', 'Категория грамматического согласования; сама по себе не устанавливает биологический пол или личность.'),
  N: item('Neuter', 'Средний род', 'A grammatical agreement category; it does not by itself say whether a referent is a person.', 'Категория грамматического согласования; сама по себе не определяет, обозначает ли слово личность или предмет.'),
}
const PERSON = {
  1: item('First person', 'Первое лицо', 'The speaker: I or we. The form alone does not identify the speaker by name.', 'Говорящий: я или мы. Форма сама по себе не называет говорящего.'),
  2: item('Second person', 'Второе лицо', 'The person or people addressed: you.', 'Лицо или лица, к которым обращаются: ты или вы.'),
  3: item('Third person', 'Третье лицо', 'Someone or something being spoken about; the referent comes from context.', 'Лицо или предмет, о котором говорят; конкретное значение определяется контекстом.'),
}
const TENSE = {
  P: item('Present', 'Настоящее время', 'Often presents an action in progress or as a process. Context determines its time and whether it is repeated.', 'Часто представляет действие в развитии или как процесс. Время и повторяемость уточняются по контексту.'),
  I: item('Imperfect', 'Имперфект', 'Usually presents a past action as unfolding; it can have several contextual uses.', 'Обычно представляет прошедшее действие в развитии; конкретное употребление зависит от контекста.'),
  F: item('Future', 'Будущее время', 'Usually looks forward to an action or state. The whole clause determines its meaning.', 'Обычно относит действие или состояние к будущему. Значение определяется всем предложением.'),
  A: item('Aorist', 'Аорист', 'Often views an event as a whole; in the indicative it usually refers to the past. Aorist alone does not mean once for all, never repeated, or permanently completed.', 'Часто представляет событие в целом; в изъявительном наклонении обычно относится к прошлому. Сам аорист не означает раз и навсегда, невозможность повторения или вечную завершённость.'),
  R: item('Perfect', 'Перфект', 'Often presents a resulting state connected with an earlier action. Context determines the result and its duration.', 'Часто представляет состояние, связанное с предшествующим действием. Характер и длительность результата определяются контекстом.'),
  L: item('Pluperfect', 'Плюсквамперфект', 'Often presents a resulting state at a past point in the account.', 'Часто представляет результативное состояние в определённый момент прошлого.'),
  X: item('Tense not stated', 'Время не указано', 'The source does not supply a tense value; no value is inferred.', 'Источник не указывает время; приложение не добавляет предположение.'),
}
const VOICE = {
  A: item('Active', 'Действительный залог', 'The subject is presented as acting in this grammatical construction.', 'Подлежащее представлено действующим в данной грамматической конструкции.'),
  M: item('Middle', 'Средний залог', 'The subject has a particular involvement in the action. This does not automatically mean doing something to oneself.', 'Подлежащее особо вовлечено в действие. Это не всегда означает действие на самого себя.'),
  P: item('Passive', 'Страдательный залог', 'The subject is presented as affected by an action. The agent may be stated or unstated; the tag alone does not identify an unstated agent.', 'Подлежащее представлено испытывающим действие. Производитель действия может быть назван или не назван; метка сама по себе его не устанавливает.'),
  E: item('Middle or passive', 'Средний или страдательный', 'This source tag preserves both middle and passive possibilities. The form alone does not distinguish them; context and the verb matter.', 'Метка сохраняет обе возможности: средний и страдательный залог. Сама форма их не различает; важны глагол и контекст.'),
  D: item('Middle deponent', 'Средний отложительный', 'A traditional source label for a middle-form verb often translated actively. It does not automatically mean that the subject acts on itself.', 'Традиционная метка глагола со средними формами, который часто переводится действительным залогом. Не означает автоматически действие на самого себя.'),
  O: item('Passive deponent', 'Страдательный отложительный', 'A traditional source label for a passive-form verb often translated actively. A passive-looking form is not by itself a passive meaning.', 'Традиционная метка глагола со страдательными формами, который часто переводится действительным залогом. Страдательная форма сама по себе не доказывает страдательного значения.'),
  N: item('Middle or passive deponent', 'Средний или страдательный отложительный', 'The source uses a traditional combined deponent category. Keep both possibilities; this label is not an instruction to translate passively or to supply an unstated agent.', 'Источник использует традиционную объединённую категорию отложительного глагола. Сохраняются обе возможности; метка не требует страдательного перевода и не устанавливает неназванного деятеля.'),
  Q: item('Impersonal active', 'Безличный действительный', 'The source marks an active impersonal construction rather than an ordinary personal subject.', 'Источник отмечает безличную конструкцию действительного залога, а не обычное личное подлежащее.'),
  X: item('Voice not stated', 'Залог не указан', 'The source supplies no voice value; no value is inferred.', 'Источник не указывает залог; приложение не добавляет предположение.'),
}
const MOOD = {
  I: item('Indicative', 'Изъявительное', 'Presents a statement or question. Grammar alone does not establish whether a claim is true.', 'Оформляет утверждение или вопрос. Грамматика сама по себе не устанавливает истинность утверждения.'),
  S: item('Subjunctive', 'Сослагательное', 'Used in constructions such as purpose, conditions and prohibitions. Its force comes from the whole clause, not simply uncertainty.', 'Употребляется, например, в целях, условиях и запрещениях. Значение определяется всей конструкцией, а не просто неуверенностью.'),
  O: item('Optative', 'Желательное', 'Can express a wish, prayer or possibility, depending on context.', 'Может выражать желание, молитвенное пожелание или возможность; значение зависит от контекста.'),
  M: item('Imperative', 'Повелительное', 'Expresses a command, request or prohibition, depending on the passage.', 'Выражает повеление, просьбу или запрещение; оттенок определяется контекстом.'),
  N: item('Infinitive', 'Инфинитив', 'A non-finite verb form, often translated with to. It does not carry its own person or number.', 'Неличная форма глагола. Сама по себе не имеет лица и числа.'),
  P: item('Participle', 'Причастие', 'A verbal form describing a participant or circumstance, sometimes translated as a whole clause.', 'Глагольная форма, описывающая участника или обстоятельство; иногда переводится целым предложением.'),
  R: item('Imperative participle', 'Причастие с повелительным значением', 'The source marks a participle used with imperative force.', 'Источник отмечает причастие, употреблённое с повелительным значением.'),
}
const SUFFIX = {
  S: item('Superlative', 'Превосходная степень', 'Marks a superlative form; its comparison is interpreted in context.', 'Отмечает превосходную степень; сравнение уточняется по контексту.'),
  C: item('Comparative', 'Сравнительная степень', 'Marks a comparative form, such as greater or more.', 'Отмечает сравнительную степень: больше, более и т. п.'),
  ABB: item('Abbreviated', 'Сокращённая форма', 'The source marks an abbreviation.', 'Источник отмечает сокращённую форму.'),
  I: item('Interrogative use', 'Вопросительное употребление', 'The source marks an interrogative use of this form.', 'Источник отмечает вопросительное употребление формы.'),
  N: item('Negative use', 'Отрицательное употребление', 'The source marks a negative use; its scope is determined by the clause.', 'Источник отмечает отрицательное употребление; область отрицания определяется предложением.'),
  ATT: item('Attic form', 'Аттическая форма', 'Marks an Attic dialect form in the source annotation.', 'В разметке отмечена форма аттического диалекта.'),
  P: item('Particle attached', 'Присоединённая частица', 'The source marks an attached particle.', 'Источник отмечает присоединённую частицу.'),
  K: item('Crasis', 'Красис', 'Two words are combined into one written form.', 'Два слова соединены в одну письменную форму.'),
}
const VERB_EXTRA = {
  M: item('Middle significance', 'Среднее значение', 'The source adds a middle-significance annotation; retain it alongside the main voice code.', 'Источник добавляет помету среднего значения; она сохраняется вместе с основной меткой залога.'),
  C: item('Contracted form', 'Стяжённая форма', 'The source marks a contracted verbal form.', 'Источник отмечает стяжённую глагольную форму.'),
  T: item('Transitive', 'Переходный', 'The source marks transitive use.', 'Источник отмечает переходное употребление.'),
  A: item('Aeolic form', 'Эолийская форма', 'The source marks an Aeolic dialect form.', 'Источник отмечает форму эолийского диалекта.'),
  ATT: SUFFIX.ATT,
  AP: item('Apocopated form', 'Усечённая форма', 'The source marks a shortened ending.', 'Источник отмечает усечение окончания.'),
  IRR: item('Irregular form', 'Неправильная форма', 'The source marks an irregular or mixed form.', 'Источник отмечает неправильную или смешанную форму.'),
}
const INDECLINABLE = {
  'N-PRI': item('Indeclinable proper noun', 'Несклоняемое собственное имя', 'The source gives no case, number or gender in this code; do not infer those from an unchanged ending.', 'В этой метке источник не указывает падеж, число или род; их нельзя выводить из неизменяемого окончания.'),
  'A-NUI': item('Indeclinable numeral', 'Несклоняемое числительное', 'An indeclinable numeral; the code does not state ordinary case agreement.', 'Несклоняемое числительное; метка не указывает обычное падежное согласование.'),
  'N-LI': item('Indeclinable letter name', 'Несклоняемое название буквы', 'The source marks an indeclinable letter name.', 'Источник отмечает несклоняемое название буквы.'),
  'N-OI': item('Other indeclinable noun', 'Другое несклоняемое существительное', 'An indeclinable noun in the source classification.', 'Несклоняемое существительное в классификации источника.'),
}
const FIELD_LABELS = {
  tense: bilingual('Tense / aspect', 'Время / вид'), voice: bilingual('Voice', 'Залог'), mood: bilingual('Mood / form', 'Наклонение / форма'),
  person: bilingual('Person', 'Лицо'), number: bilingual('Number', 'Число'), gender: bilingual('Gender', 'Род'), case: bilingual('Case', 'Падеж'),
  possessorPerson: bilingual('Possessor’s person', 'Лицо обладателя'), possessorNumber: bilingual('Possessor’s number', 'Число обладателя'),
  suffix: bilingual('Additional marking', 'Дополнительная помета'), verbExtra: bilingual('Additional verb marking', 'Дополнительная глагольная помета'),
  formType: bilingual('Form type', 'Тип формы'),
}

export function decodeGreekMorphology(code, locale = 'en') {
  const language = locale === 'ru' ? 'ru' : 'en'
  const raw = typeof code === 'string' ? code : ''
  const segments = raw.split('-'), pos = segments.shift()
  const definition = POS[pos]
  const result = { code: raw, recognized: Boolean(definition), partOfSpeech: definition ? { code: pos, label: definition.label[language], explanation: definition.explanation[language] } : null,
    features: [], unknownParts: [], notes: [], ambiguous: false, sourceUrl: CODE_GUIDE_URL }
  const unknown = value => { result.unknownParts.push(value); result.recognized = false }
  const add = (key, value, dictionary) => {
    const entry = dictionary[value]
    if (!entry) return unknown(`${key}:${value}`)
    let explanation = entry.explanation[language]
    if (key.startsWith('possessor')) explanation += language === 'ru' ? ' Это признак обладателя, а не обозначаемого предмета.' : ' This describes the possessor, not the possessed item.'
    result.features.push({ key, code: value, label: FIELD_LABELS[key][language], value: entry.label[language], explanation,
      ...(key === 'tense' && ['A', '2A'].includes(value) ? { references: [AORIST_HELP] } : {}) })
  }
  if (!definition) unknown(raw || '(empty)')
  else if (INDECLINABLE[`${pos}-${segments[0]}`]) add('formType', `${pos}-${segments.shift()}`, INDECLINABLE)
  else if (pos === 'V') {
    const main = segments.shift() || '', match = /^(2?[PIFARLX])([A-Z])([A-Z])$/.exec(main)
    if (!match) unknown(main || '(missing verb analysis)')
    else {
      const [, tense, voice, mood] = match
      if (tense.startsWith('2')) {
        const base = TENSE[tense.slice(1)]
        if (!['2F', '2A', '2R', '2L'].includes(tense) || !base) unknown(`tense:${tense}`)
        else add('tense', tense, { [tense]: item(`${base.label.en} (second formation)`, `${base.label.ru} (второй тип)`, `${base.explanation.en} “Second” names a different formation, not a second occurrence of the event.`, `${base.explanation.ru} «Второй тип» обозначает другую модель образования, а не второе совершение действия.`) })
      } else add('tense', tense, TENSE)
      add('voice', voice, VOICE); add('mood', mood, MOOD)
      result.ambiguous = ['E', 'N'].includes(voice)
      if (['I', 'S', 'O', 'M'].includes(mood)) {
        const agreement = segments.shift() || '', parsed = /^([123])([SP])$/.exec(agreement)
        if (parsed) { add('person', parsed[1], PERSON); add('number', parsed[2], NUMBER) } else unknown(agreement || '(missing person/number)')
      } else if (['P', 'R'].includes(mood)) {
        const agreement = segments.shift() || '', parsed = /^([NVGDA])([SP])([MFN])$/.exec(agreement)
        if (parsed) { add('case', parsed[1], CASE); add('number', parsed[2], NUMBER); add('gender', parsed[3], GENDER) } else unknown(agreement || '(missing participle agreement)')
      }
    }
  } else if (['N', 'A', 'T'].includes(pos)) {
    const main = segments.shift() || '', match = /^([NVGDA])([SP])([MFN])$/.exec(main)
    if (match) { add('case', match[1], CASE); add('number', match[2], NUMBER); add('gender', match[3], GENDER) } else unknown(main || '(missing nominal agreement)')
  } else if (pos === 'S') {
    const main = segments.shift() || '', match = /^([123])([SP])([NVGDA])([SP])([MFN])$/.exec(main)
    if (match) { add('possessorPerson', match[1], PERSON); add('possessorNumber', match[2], NUMBER); add('case', match[3], CASE); add('number', match[4], NUMBER); add('gender', match[5], GENDER) } else unknown(main || '(missing possessive agreement)')
  } else if (['P', 'R', 'C', 'D', 'K', 'I', 'X', 'Q', 'F'].includes(pos)) {
    const main = segments.shift() || '', match = /^([123])?([NVGDA])([SP])([MFN])?$/.exec(main)
    if (match) { if (match[1]) add('person', match[1], PERSON); add('case', match[2], CASE); add('number', match[3], NUMBER); if (match[4]) add('gender', match[4], GENDER) } else unknown(main || '(missing pronoun agreement)')
  }
  for (const suffix of segments) add(pos === 'V' ? 'verbExtra' : 'suffix', suffix, pos === 'V' ? VERB_EXTRA : SUFFIX)
  if (!result.recognized) result.notes.push(language === 'ru' ? 'Метка источника сохранена. Неизвестные части не расшифровываются предположительно.' : 'The source tag is retained. Unknown parts are not guessed.')
  return result
}

let dataPromise
function validRange(start, end, text) {
  return Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end > start && end <= text.length
}
function validateData(data) {
  if (data?.schemaVersion !== 1 || data.sourceId !== 'N1904' || data.sourceSha256 !== SOURCE_SHA || data.revision !== REVISION
    || data.scope?.words !== 8675 || data.scope?.differentAnalysisTags !== 71 || data.codes?.length !== 491
    || data.books?.length !== 2 || !Array.isArray(data.lemmas)) throw new Error('Morphology pilot source does not match.')
  if (data.codes.some(code => !decodeGreekMorphology(code).recognized)) throw new Error('Morphology pilot contains an unknown source code.')
  let count = 0, differences = 0
  const names = new Set()
  for (const book of data.books) {
    if (!PILOT_BOOKS.has(book.name) || names.has(book.name)) throw new Error('Morphology pilot book does not match.')
    names.add(book.name)
    for (const entry of Object.values(book.verses || {})) {
      if (typeof entry.text !== 'string' || !Array.isArray(entry.words)) throw new Error('Morphology pilot verse is invalid.')
      const tokens = [...entry.text.matchAll(/\S+/gu)]
      if (tokens.length !== entry.words.length) throw new Error('Morphology pilot token count differs.')
      entry.words.forEach((row, index) => {
        const [start, end, lemma, functional, form] = row
        if (row.length !== 5 || !validRange(start, end, entry.text) || start !== tokens[index].index || end !== start + tokens[index][0].length
          || !Number.isInteger(lemma) || !data.lemmas[lemma]?.lemma || !Number.isInteger(functional) || !data.codes[functional]
          || !Number.isInteger(form) || !data.codes[form]) throw new Error('Morphology pilot word identity differs.')
        count++; if (functional !== form) differences++
      })
    }
  }
  if (count !== 8675 || differences !== 71) throw new Error('Morphology pilot inventory differs.')
  return data
}
async function loadData() {
  if (!dataPromise) dataPromise = fetch(`${import.meta.env.BASE_URL}data/original-languages/greek-morphology-pilot.json`)
    .then(response => { if (!response.ok) throw new Error('Greek word forms could not load.'); return response.json() })
    .then(validateData).catch(error => { dataPromise = undefined; throw error })
  return dataPromise
}

export async function loadGreekMorphology(word, lemma) {
  if (!word || !PILOT_BOOKS.has(word.book) || (word.translationId !== 'ORIGINAL' && !CHECKED_TRANSLATIONS.has(word.translationId))) return []
  let anchors
  if (word.translationId === 'ORIGINAL') {
    if (typeof word.word !== 'string' || !word.word) return []
    anchors = [{ chapter: word.chapter, verse: word.verse, startOffset: word.startOffset, endOffset: word.endOffset, text: word.word }]
  } else if (Array.isArray(word.studySourceAnchors) && word.studySourceAnchors.length) anchors = word.studySourceAnchors
  else if (Array.isArray(word.sourceAnchors) && word.sourceAnchors.length) anchors = word.sourceAnchors
  else {
    const ranges = word.sourceRanges || (word.sourceRange ? [word.sourceRange] : [])
    if (!Array.isArray(ranges)) return []
    anchors = ranges.map(range => ({ chapter: word.chapter, verse: word.verse, startOffset: range?.[0], endOffset: range?.[1] }))
  }
  if (!anchors.length) return []
  const lemmaText = typeof lemma === 'string' ? lemma : lemma?.lemma
  if (lemma != null && (typeof lemmaText !== 'string' || !lemmaText)) return []
  const data = await loadData(), book = data.books.find(value => value.name === word.book)
  const result = new Map()
  for (const anchor of anchors) {
    if (!Number.isInteger(anchor.chapter) || !Number.isInteger(anchor.verse)) return []
    const entry = book.verses[`${anchor.chapter}:${anchor.verse}`]
    if (!entry || !validRange(anchor.startOffset, anchor.endOffset, entry.text)
      || (anchor.text != null && anchor.text !== entry.text.slice(anchor.startOffset, anchor.endOffset))) return []
    if (word.translationId === 'ORIGINAL' && ![...entry.text.matchAll(/[\p{L}\p{M}]+(?:[’'][\p{L}\p{M}]+)*/gu)]
      .some(match => match.index === anchor.startOffset && match.index + match[0].length === anchor.endOffset && match[0] === word.word)) return []
    for (const [startOffset, endOffset, lemmaId, functional, form] of entry.words) {
      if (startOffset >= anchor.endOffset || endOffset <= anchor.startOffset) continue
      const actualLemma = data.lemmas[lemmaId]
      if (lemmaText && actualLemma.lemma.normalize('NFC') !== lemmaText.normalize('NFC')) continue
      const key = `N1904:${word.book}:${anchor.chapter}:${anchor.verse}:${startOffset}:${endOffset}`
      result.set(key, { key, book: word.book, chapter: anchor.chapter, verse: anchor.verse, startOffset, endOffset,
        text: entry.text.slice(startOffset, endOffset), lemma: actualLemma.lemma, strongs: actualLemma.strongs,
        funcMorph: data.codes[functional], formMorph: data.codes[form], tagsDiffer: functional !== form,
        source: { sourceId: data.sourceId, sourceSha256: data.sourceSha256, revision: data.revision, ...data.provenance } })
    }
  }
  return [...result.values()].sort((a, b) => a.chapter - b.chapter || a.verse - b.verse || a.startOffset - b.startOffset)
}
