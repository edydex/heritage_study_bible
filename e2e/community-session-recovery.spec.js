import { expect, test } from '@playwright/test'

test('a saved church with no session offers email sign-in while retaining public resources', async ({ page }) => {
  const community = {
    manifestUrl: 'https://church.example/.well-known/heritage-community.json',
    manifest: {
      id: 'recovery-church', name: 'Recovery Church', apiBaseUrl: 'https://church.example/api',
      auth: { requestUrl: 'https://church.example/api/community/auth/magic-link' },
    },
    contentPreview: { manifest: { id: 'recovery-content', name: 'Recovery Church' } },
    status: 'joined', primary: true, member: { displayName: 'Test Reader', email: 'reader@example.com' },
  }
  await page.addInitScript(record => {
    localStorage.setItem('heritage-communities-v1', JSON.stringify([record]))
    localStorage.setItem('heritage-content-servers-v2', JSON.stringify([{ ...record.contentPreview, enabled: true }]))
  }, community)
  await page.route('https://church.example/**', route => route.abort())
  const signIns = []
  await page.route(community.manifest.auth.requestUrl, route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: {
      'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'content-type',
    } })
    signIns.push(route.request().postDataJSON())
    return route.fulfill({ status: 200, json: { expiresAt: '2030-01-01T00:00:00Z' }, headers: { 'Access-Control-Allow-Origin': '*' } })
  })
  await page.goto('/#/community')
  await expect(page.getByText('Member sign-in needed')).toBeVisible()
  await expect(page.getByText('Signed in as Test Reader')).toHaveCount(0)
  await expect(page.getByText('No upcoming events.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Songs Find the songs your congregation sings.' })).toBeVisible()
  expect(signIns).toHaveLength(0)
  await page.getByRole('button', { name: 'Sign in again', exact: true }).click()
  await expect(page.getByLabel('Church sign-in email')).toHaveValue('reader@example.com')
  await page.getByRole('button', { name: 'Send church sign-in link' }).click()
  await expect(page.getByText('Waiting for email sign-in')).toBeVisible()
  expect(signIns).toHaveLength(1)
  expect(signIns[0]).toMatchObject({ email: 'reader@example.com', flow: 'community' })
  await expect(page.getByText('Saved listings remain available when the church server cannot be reached. Sign in to download member-only books for offline reading and listening.')).toBeVisible()
})
