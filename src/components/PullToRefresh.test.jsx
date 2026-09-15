import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import PullToRefresh from './PullToRefresh'

it('refreshes only after a deliberate downward pull from the top', () => {
  const refresh = vi.fn()
  render(<PullToRefresh onRefresh={refresh}><div data-testid="content">Song list</div></PullToRefresh>)
  const target = screen.getByTestId('content')
  const pull = (x, y) => {
    fireEvent.touchStart(target, { touches: [{ clientX: 20, clientY: 10 }] })
    fireEvent.touchMove(target, { touches: [{ clientX: x, clientY: y }], cancelable: true })
    fireEvent.touchEnd(target)
  }
  pull(21, 40)
  pull(180, 30)
  target.scrollTop = 30
  pull(21, 200)
  expect(refresh).not.toHaveBeenCalled()
  target.scrollTop = 0
  pull(21, 200)
  expect(refresh).toHaveBeenCalledTimes(1)
})
