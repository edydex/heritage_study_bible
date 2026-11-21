'use client'

import { useEffect, useState } from 'react'

// Public sign-up pages are read by visitors, not staff, so they follow the
// visitor's browser language (with a switch) instead of the workspace setting.
// Add a language by adding one entry here and in eventRegistrationEmail.ts.
const en = {
  languageName: 'English',
  title: 'Sign up',
  name: 'Your name', email: 'Email', phone: 'Phone', phoneOptional: 'Phone (optional)', partySize: 'Number of people',
  submit: 'Sign up', joinWaitlist: 'Join the waitlist', sending: 'Sending…',
  price: (amount: string) => `Price: ${amount} per person`,
  spotsLeft: (count: number) => count === 1 ? '1 place left.' : `${count} places left.`,
  waitlistNotice: 'This event is full. You can join the waitlist and we will email you if a place opens up.',
  full: 'This event is full.',
  closed: 'Sign-up for this event has closed.',
  cancelled: 'This event has been cancelled.',
  opensAt: (when: string) => `Sign-up opens ${when}.`,
  payLater: 'You will see how to pay after you sign up.',
  confirmedTitle: 'You are signed up!',
  confirmedBody: (name: string, people: number) => people > 1 ? `Thank you, ${name}. You signed up ${people} people.` : `Thank you, ${name}.`,
  waitlistedTitle: 'You are on the waitlist',
  waitlistedBody: 'The event is full right now. We will email you if a place opens up.',
  reference: 'Your reference',
  amountDue: (amount: string) => `Amount due: ${amount}`,
  paymentNote: (reference: string) => `Please include ${reference} in the payment note so we can match your payment.`,
  zelleHint: 'send with your bank’s Zelle',
  enterAmount: (amount: string) => `enter ${amount}`,
  emailSent: 'We emailed you a confirmation with a private link to cancel if your plans change.',
  noEmail: 'Keep this page or the link below: it is your private link to cancel if your plans change.',
  saveLink: 'My private sign-up link',
  loadFailed: 'Could not load the sign-up form. Please refresh the page.',
  submitFailed: 'Could not send your sign-up. Please try again.',
  manageTitle: 'Your sign-up', manageLoading: 'Loading your sign-up…', manageInvalid: 'This link is not valid or the sign-up was removed.',
  statusConfirmed: 'Confirmed', statusWaitlisted: 'On the waitlist', statusCancelled: 'Cancelled',
  people: 'People', paid: 'Payment received', cancel: 'Cancel my sign-up', cancelling: 'Cancelling…',
  confirmCancel: 'Cancel this sign-up? Your place may go to someone else.', cancelledDone: 'Your sign-up is cancelled.',
}
export type PublicText = typeof en

const ru: PublicText = {
  languageName: 'Русский',
  title: 'Регистрация',
  name: 'Ваше имя', email: 'Email', phone: 'Телефон', phoneOptional: 'Телефон (необязательно)', partySize: 'Количество человек',
  submit: 'Зарегистрироваться', joinWaitlist: 'Встать в лист ожидания', sending: 'Отправка…',
  price: amount => `Цена: ${amount} с человека`,
  spotsLeft: count => `Осталось мест: ${count}.`,
  waitlistNotice: 'Мест нет. Вы можете встать в лист ожидания — мы напишем, если место освободится.',
  full: 'Мест нет.',
  closed: 'Регистрация на это событие закрыта.',
  cancelled: 'Это событие отменено.',
  opensAt: when => `Регистрация откроется ${when}.`,
  payLater: 'Как оплатить, вы увидите после регистрации.',
  confirmedTitle: 'Вы зарегистрированы!',
  confirmedBody: (name, people) => people > 1 ? `Спасибо, ${name}. Вы зарегистрировали ${people} чел.` : `Спасибо, ${name}.`,
  waitlistedTitle: 'Вы в листе ожидания',
  waitlistedBody: 'Сейчас мест нет. Мы напишем вам, если место освободится.',
  reference: 'Ваш номер',
  amountDue: amount => `К оплате: ${amount}`,
  paymentNote: reference => `Пожалуйста, укажите ${reference} в комментарии к платежу, чтобы мы нашли вашу оплату.`,
  zelleHint: 'через Zelle в вашем банке',
  enterAmount: amount => `введите ${amount}`,
  emailSent: 'Мы отправили вам письмо с подтверждением и личной ссылкой для отмены.',
  noEmail: 'Сохраните эту страницу или ссылку ниже — это ваша личная ссылка для отмены.',
  saveLink: 'Моя личная ссылка на регистрацию',
  loadFailed: 'Не удалось загрузить форму регистрации. Обновите страницу.',
  submitFailed: 'Не удалось отправить регистрацию. Попробуйте ещё раз.',
  manageTitle: 'Ваша регистрация', manageLoading: 'Загрузка…', manageInvalid: 'Ссылка недействительна или регистрация удалена.',
  statusConfirmed: 'Подтверждена', statusWaitlisted: 'В листе ожидания', statusCancelled: 'Отменена',
  people: 'Человек', paid: 'Оплата получена', cancel: 'Отменить регистрацию', cancelling: 'Отмена…',
  confirmCancel: 'Отменить регистрацию? Ваше место может достаться другому человеку.', cancelledDone: 'Ваша регистрация отменена.',
}

const TEXT: Record<string, PublicText> = { en, ru }
export const PUBLIC_LANGUAGES = Object.keys(TEXT)

export function publicText(language: string) {
  return TEXT[language] || en
}

const STORAGE_KEY = 'church-signup-language'

export function usePublicLanguage(): [string, (language: string) => void, string[]] {
  const [language, setLanguageState] = useState('en')
  useEffect(() => {
    let chosen = ''
    try { chosen = localStorage.getItem(STORAGE_KEY) || '' } catch { /* storage can be disabled */ }
    const browser = (navigator.languages || [navigator.language]).map(code => code.slice(0, 2)).find(code => TEXT[code])
    setLanguageState(TEXT[chosen] ? chosen : browser || 'en')
  }, [])
  const setLanguage = (next: string) => {
    setLanguageState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* storage can be disabled */ }
  }
  return [language, setLanguage, PUBLIC_LANGUAGES]
}
