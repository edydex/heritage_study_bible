// Real built Payload UI, using a disposable loopback server and no sign-in.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

const origin = new URL(process.env.WORKSPACE_LOGIN_TEST_ORIGIN || 'http://127.0.0.1:4280')
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname), 'Use an isolated loopback Community server')
assert.equal(origin.protocol, 'http:')
assert.equal(origin.username + origin.password, '')
const evidence = process.env.WORKSPACE_LOGIN_EVIDENCE || '/private/tmp/heritage-login-guidance-evidence'
await mkdir(evidence, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  for (const language of ['en', 'ru']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const response = await page.goto(`${origin.origin}/admin/login?language=${language}`)
    assert.equal(response.status(), 200)
    assert.equal(new URL(page.url()).pathname, '/admin/login')
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    const guide = page.getByRole('region', { name: language === 'ru' ? 'Вход в рабочую область' : 'Church workspace sign-in', exact: true })
    await expect(guide).toBeVisible()
    await expect(guide.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(guide).toContainText(language === 'ru'
      ? 'Откройте письмо, чтобы создать пароль'
      : 'Open the workspace invitation email to set your password')
    await expect(guide).toContainText(language === 'ru'
      ? '«Забыли пароль?»'
      : 'Forgot Password')
    await expect(guide).toContainText(language === 'ru'
      ? 'Синхронизация чтения в Heritage использует отдельный вход.'
      : 'Heritage reading sync has a separate sign-in.')
    await expect(guide.getByRole('link', { name: language === 'ru' ? 'Вернуться на сайт церкви' : 'Back to the church website', exact: true })).toHaveAttribute('href', '/')
    await expect(page.locator('form input[type="email"]').first()).toBeVisible()
    await expect(page.locator('form input[type="password"]').first()).toBeVisible()
    await page.screenshot({ path: `${evidence}/workspace-login-${language}.png` })
    assert.deepEqual(errors, [], `Rendered ${language} sign-in has no client errors`)
    await context.close()
  }
} finally {
  await browser.close()
}
console.log(JSON.stringify({ passed: true, checks: ['login-entry', 'hydrated-english-russian', 'invitation-password-setup', 'password-recovery-guidance', 'reader-sign-in-distinction', 'real-payload-login-form'], evidence }))
