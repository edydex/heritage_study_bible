import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import VerseText from './VerseText'

describe('VerseText', () => {
  it('renders exact-word highlights using visible-text offsets', () => {
    const { container } = render(
      <p>
        <VerseText
          text="¶For <b>God</b> so loved || the world."
          highlights={[{ startOffset: 4, endOffset: 16, color: 'pink' }]}
        />
      </p>
    )

    expect([...container.querySelectorAll('mark')].map(mark => mark.textContent).join('')).toBe('God so loved')
    expect(container.querySelector('mark')).toHaveAttribute('data-highlight-color', 'pink')
    expect(container.textContent).toContain('For God so loved')
    expect(container.textContent).toContain('the world.')
  })
})
