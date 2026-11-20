'use client'

// The volunteer page is read by volunteers, not staff: it follows the
// visitor's language choice shared with the public sign-up pages.
// Add a language by adding one entry here and in lib/servingEmail.ts.
const en = {
  languageName: 'English',
  title: 'Your serving schedule',
  hello: (name: string) => `Hello, ${name}!`,
  intro: (church: string) => `These are your upcoming serving dates at ${church}. Please accept or decline each one.`,
  loading: 'Loading your schedule…',
  invalid: 'This link is not valid. Ask your team leader for a new one.',
  failed: 'Something went wrong. Please try again.',
  none: 'You are not scheduled for any upcoming dates.',
  accept: 'I can serve', decline: 'I can’t serve', change: 'Change my answer', saving: 'Saving…',
  accepted: 'You accepted', declined: 'You declined', waiting: 'Please answer',
  cancelled: 'This service is no longer on the calendar.',
  noteLabel: 'Note for the team leader (optional)', notePlaceholder: 'For example: I will be away that weekend.',
  sendDecline: 'Send my answer', back: 'Back',
  yourNote: 'Your note',
  awayTitle: 'Dates you will be away',
  awayIntro: 'Let your team leaders know ahead of time so they do not schedule you.',
  awayNone: 'No away dates.',
  firstDay: 'First day', lastDay: 'Last day (optional)', reason: 'Note (optional)', addAway: 'Add these dates', remove: 'Remove',
  privacy: 'This page is private to you. Please do not share the link.',
}

export type ServingText = typeof en

const ru: ServingText = {
  languageName: 'Русский',
  title: 'Ваш график служения',
  hello: name => `Здравствуйте, ${name}!`,
  intro: church => `Здесь ваши ближайшие даты служения в церкви ${church}. Пожалуйста, ответьте на каждую.`,
  loading: 'Загружаем график…',
  invalid: 'Ссылка недействительна. Попросите у руководителя команды новую.',
  failed: 'Что-то пошло не так. Попробуйте ещё раз.',
  none: 'В ближайшие даты вы не назначены.',
  accept: 'Смогу', decline: 'Не смогу', change: 'Изменить ответ', saving: 'Сохраняем…',
  accepted: 'Вы согласились', declined: 'Вы отказались', waiting: 'Ждём ответа',
  cancelled: 'Этого служения больше нет в календаре.',
  noteLabel: 'Комментарий для руководителя (необязательно)', notePlaceholder: 'Например: в эти выходные меня не будет.',
  sendDecline: 'Отправить ответ', back: 'Назад',
  yourNote: 'Ваш комментарий',
  awayTitle: 'Когда вас не будет',
  awayIntro: 'Сообщите заранее, чтобы вас не назначали на эти дни.',
  awayNone: 'Нет отмеченных дней.',
  firstDay: 'Первый день', lastDay: 'Последний день (необязательно)', reason: 'Комментарий (необязательно)', addAway: 'Добавить даты', remove: 'Удалить',
  privacy: 'Эта страница только для вас. Пожалуйста, не пересылайте ссылку.',
}

const TEXT: Record<string, ServingText> = { en, ru }

export function servingText(language: string) {
  return TEXT[language] || en
}

// Server messages arrive in English; show the ones volunteers can meet in their language.
const SERVER_MESSAGES: Record<string, Record<string, string>> = {
  ru: {
    'This link is not valid. Ask your team leader for a new one.': 'Ссылка недействительна. Попросите у руководителя команды новую.',
    'This link has been replaced or removed. Ask your team leader for a new one.': 'Эта ссылка заменена или удалена. Попросите у руководителя команды новую.',
    'This serving date was removed from the schedule.': 'Эту дату служения убрали из графика.',
    'This date has already passed.': 'Эта дата уже прошла.',
    'Choose dates from today onward.': 'Выберите даты начиная с сегодняшнего дня.',
    'Remove some older away dates first.': 'Сначала удалите часть старых дат.',
    'Enter full dates, for example 2026-12-24.': 'Укажите полные даты.',
    'The last day cannot be before the first day.': 'Последний день не может быть раньше первого.',
    'Enter at most one year at a time.': 'Укажите не больше одного года за раз.',
    'Too many attempts. Please wait a little and try again.': 'Слишком много попыток. Подождите немного и попробуйте снова.',
  },
}

export function servingServerMessage(message: string, language: string) {
  return SERVER_MESSAGES[language]?.[message] || message
}
