import assert from 'node:assert/strict'
import test from 'node:test'
import {
  workspaceSignInHref, workspaceSignInRedirect, translationAccessProblem, TranslationAccessError,
  type WorkspacePath,
} from '../src/lib/workspaceNavigation.ts'

test('anonymous custom workspace pages return to their own destination after sign-in', () => {
  const paths: WorkspacePath[] = ['/admin', '/admin/live-translation', '/admin/plan-service', '/admin/prepare-sermon', '/admin/sermon-publications']
  for (const path of paths) {
    const href = workspaceSignInRedirect(null, path)
    assert.equal(new URL(href!, 'https://church.example').pathname, '/admin/login')
    assert.equal(new URL(href!, 'https://church.example').searchParams.get('redirect'), path)
    // This UI guard does not reinterpret or replace the existing API role checks.
    assert.equal(workspaceSignInRedirect({ id: 7 }, path), null)
  }
})

test('the selected service survives sign-in without accepting a caller-supplied destination', () => {
  const href = workspaceSignInHref('/admin/live-translation', { service: 'sunday:en-ru', redirect: 'https://untrusted.example', token: 'do-not-forward' })
  assert.equal(new URL(href, 'https://church.example').searchParams.get('redirect'), '/admin/live-translation?service=sunday%3Aen-ru')
  assert.ok(!href.includes('untrusted'))
  assert.ok(!href.includes('do-not-forward'))
})

test('sermon selection and ambiguous query values remain data for the existing parser', () => {
  for (const value of ['sermon-1', '//untrusted.example/?x=#frag', ['one', 'two']]) {
    const href = workspaceSignInHref('/admin/sermon-publications', { sermon: value })
    const target = new URL(new URL(href, 'https://church.example').searchParams.get('redirect')!, 'https://church.example')
    assert.equal(target.origin, 'https://church.example')
    assert.equal(target.pathname, '/admin/sermon-publications')
    assert.deepEqual(target.searchParams.getAll('sermon'), typeof value === 'string' ? [value] : value)
  }
})

test('only an expired or missing sign-in offers another sign-in; setup and role failures do not', () => {
  assert.deepEqual(translationAccessProblem(new TranslationAccessError(401, 'Sign in to control live translation.')), {
    message: 'Sign in to control live translation.', signInRequired: true,
  })
  for (const cause of [
    new TranslationAccessError(403, 'A church manager account is required.'),
    new TranslationAccessError(503, 'The translation processor is unavailable. Check server setup.'),
    new Error('Could not connect.'),
  ]) {
    assert.equal(translationAccessProblem(cause).signInRequired, false)
    assert.equal(translationAccessProblem(cause).message, cause.message)
  }
})
