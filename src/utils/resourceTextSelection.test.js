import { expect, it } from 'vitest'
import { captureResourceTextSelection, findResourceBookmarkOffset } from './resourceTextSelection'

it('captures an exact place through nested text and restores it after nearby edits', () => {
  const root = document.createElement('div')
  root.innerHTML = '<p data-book-paragraph="2">Knowledge of <em>God</em> and ourselves.</p>'
  document.body.append(root)
  const range = document.createRange()
  range.selectNodeContents(root.querySelector('em'))
  const selection = window.getSelection()
  selection.removeAllRanges(); selection.addRange(range)
  const bookmark = captureResourceTextSelection(selection, root)
  expect(bookmark).toMatchObject({ paragraphIndex: 2, startOffset: 13, selectedText: 'God', prefix: 'Knowledge of ' })
  expect(findResourceBookmarkOffset(bookmark, 'True Knowledge of God and ourselves.')).toBe(18)
  expect(findResourceBookmarkOffset(bookmark, 'A different paragraph')).toBeNull()
  selection.removeAllRanges(); root.remove()
})
