export type WorkspaceLanguage = 'en' | 'ru'
export const WORKSPACE_LANGUAGE_EVENT = 'heritage-workspace-language'

export function workspaceLanguage(value: unknown): WorkspaceLanguage {
  return value === 'ru' ? 'ru' : 'en'
}

export const workspaceLanguageOptions = [
  { label: 'English', value: 'en' },
  { label: 'Русский', value: 'ru' },
]

/** Language follows invitation links through password setup without changing their token. */
export function workspaceLanguageURL(url: string, language: unknown) {
  const result = new URL(url)
  result.searchParams.set('language', workspaceLanguage(language))
  return result.href
}

export function escapeEmailHTML(value: unknown) {
  return String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

export function workspaceInvitationContent(options: {
  name: string; role: string; setupURL: string; loginURL: string; hours: number; language?: unknown
}) {
  const { name, role, setupURL, loginURL, hours } = options
  const ru = workspaceLanguage(options.language) === 'ru'
  const roleName = ru ? (role === 'admin' ? 'администратора церкви' : 'руководителя церкви')
    : (role === 'admin' ? 'church administrator' : 'church leader')
  const introduction = ru ? `Вас приглашают в рабочую область ${name} в качестве ${roleName}.`
    : `You have been invited as a ${roleName} at ${name}.`
  const action = ru ? 'Создать пароль для рабочей области' : 'Set your workspace password'
  const expires = ru ? `Ссылка действует ${hours} часа. Уже есть пароль? Войдите в рабочую область. Приглашение будет принято после входа.`
    : `This setup link expires in ${hours} hours. Already have a workspace password? Sign in to the church workspace. Your invitation is accepted when you sign in.`
  const explanation = ru ? 'Здесь можно готовить богослужения, работать с песнями и создавать слайды проповеди. Вход для синхронизации чтения в Heritage выполняется отдельно.'
    : 'The church workspace is where you prepare services, manage songs and create sermon slides. Heritage reader sign-in is separate.'
  const recovery = ru ? 'Если срок ссылки истёк, нажмите «Забыли пароль?» на странице входа.'
    : 'If the setup link expires, use Forgot Password on the workspace sign-in page.'
  return {
    subject: ru ? `Приглашение в рабочую область ${name}` : `You’re invited to the ${name} workspace`,
    text: `${introduction}\n\n${action}: ${setupURL}\n\n${expires}\n${loginURL}\n\n${explanation}\n\n${recovery}`,
    html: `<p>${escapeEmailHTML(introduction)}</p><p><a href="${escapeEmailHTML(setupURL)}">${action}</a></p><p>${escapeEmailHTML(expires)} <a href="${escapeEmailHTML(loginURL)}">${ru ? 'Войти' : 'Sign in'}</a></p><p>${explanation}</p><p>${recovery}</p>`,
  }
}

export function workspacePasswordEmail(options: { name: string; url: string; language?: unknown }) {
  const ru = workspaceLanguage(options.language) === 'ru'
  return {
    subject: ru ? `Создать пароль: ${options.name}` : `Set your password for ${options.name}`,
    html: `<p>${ru ? 'Вы запросили ссылку для смены пароля.' : 'You requested a password reset.'}</p><p><a href="${escapeEmailHTML(options.url)}">${ru ? 'Создать новый пароль' : 'Choose a new password'}</a></p><p>${ru ? 'Если вы не отправляли этот запрос, просто проигнорируйте письмо.' : 'If you did not request this, you can ignore this email.'}</p>`,
  }
}
