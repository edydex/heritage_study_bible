import { existsSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { translations, DEFAULT_TRANSLATION } from './translations'

it('installs BSB, KJV and LSV English choices without bundling WEB', () => {
  expect(translations.filter(translation => translation.language === 'English').map(translation => translation.id).sort()).toEqual(['BSB', 'KJV', 'LSV'])
  expect(DEFAULT_TRANSLATION).toBe('BSB')
  for (const path of ['public/data/translations/WEB.json', 'public/data/translations/WEB', 'public/revelation_web.json', 'src/data/revelation-web.json']) expect(existsSync(path)).toBe(false)
  // Historical reading-plan counts and Psalm headings can still be rebuilt.
  const archive = JSON.parse(readFileSync('scripts/bible-sources/WEB.json', 'utf8'))
  expect(archive.books).toHaveLength(66)
})
