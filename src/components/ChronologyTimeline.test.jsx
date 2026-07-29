import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ChronologyTimeline, { timelineBarGeometry, timelinePosition } from './ChronologyTimeline'

const sampleTimeline = {
  heading: 'Late Judah',
  rangeLabel: 'c. 609-586 BC',
  startYear: 609,
  endYear: 586,
  startLabel: '609 BC',
  endLabel: '586 BC',
  ticks: [{ year: 597, label: 'First exile', shortLabel: '597 exile' }],
  contexts: [
    {
      label: 'Jeremiah 25',
      dateLabel: 'Jehoiakim’s fourth year, c. 605 BC',
      startYear: 605,
      endYear: 605,
      certainty: 'anchored',
      group: 'Parallel accounts — Jehoiakim’s fourth year',
    },
    {
      label: '2 Kings 24:1',
      dateLabel: 'Jehoiakim’s fourth year, c. 605 BC',
      startYear: 605,
      endYear: 605,
      certainty: 'anchored',
      group: 'Parallel accounts — Jehoiakim’s fourth year',
    },
  ],
}

describe('ChronologyTimeline', () => {
  it('positions years correctly even when BC years descend', () => {
    expect(timelinePosition(609, 609, 586)).toBe(0)
    expect(timelinePosition(586, 609, 586)).toBe(100)
    expect(timelinePosition(597, 609, 586)).toBeCloseTo(52.17, 1)
    expect(timelinePosition(50, 35, 50)).toBe(100)
    expect(timelinePosition('unknown', 35, 50)).toBe(0)
  })

  it('keeps a single-year context visible as a short bar', () => {
    expect(timelineBarGeometry({ startYear: 605, endYear: 605 }, 609, 586)).toMatchObject({
      width: 2.25,
    })
  })

  it('labels the chart as attributed setting rather than fulfillment', () => {
    render(<ChronologyTimeline timeline={sampleTimeline} />)

    expect(screen.getByRole('region', { name: 'Late Judah' })).toBeInTheDocument()
    expect(screen.getByText('Setting, not fulfillment')).toBeInTheDocument()
    expect(screen.getByText('Jeremiah 25')).toBeInTheDocument()
    expect(screen.getByText('2 Kings 24:1')).toBeInTheDocument()
    expect(screen.getByText('Parallel accounts — Jehoiakim’s fourth year')).toBeInTheDocument()
    expect(screen.getAllByText('Dated')).toHaveLength(2)
    expect(document.querySelectorAll('[data-timeline-group]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-timeline-bar]')).toHaveLength(2)
  })

  it('ignores malformed remote context rows', () => {
    render(
      <ChronologyTimeline
        timeline={{
          ...sampleTimeline,
          contexts: [
            { label: 'Unsafe row', dateLabel: 'No date', startYear: 'unknown' },
            sampleTimeline.contexts[0],
          ],
        }}
      />
    )

    expect(screen.queryByText('Unsafe row')).not.toBeInTheDocument()
    expect(screen.getByText('Jeremiah 25')).toBeInTheDocument()
  })
})
