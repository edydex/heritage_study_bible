import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ChronologyTimeline, {
  situationalBarGeometry,
  timelineBarGeometry,
  timelinePosition,
} from './ChronologyTimeline'

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

const situationalTimeline = {
  presentation: 'situational',
  heading: 'Babylon’s siege and its aftermath',
  phases: [
    {
      id: 'siege',
      label: 'Final siege',
      anchor: {
        dateLabel: '588 BC (est.)',
        summary: 'Babylon began its final siege in Zedekiah’s ninth year.',
      },
    },
    {
      id: 'fall',
      label: 'Jerusalem falls',
      anchor: {
        dateLabel: '586 BC (est.)',
        summary: 'Jerusalem was breached in Zedekiah’s eleventh year.',
      },
    },
    { id: 'gedaliah', label: 'Gedaliah' },
    { id: 'flight', label: 'Flight to Egypt' },
  ],
  passages: [
    { label: 'Jer 39–41', source: 'jeremiah', start: 'fall', end: 'gedaliah' },
    { label: '2 Kin 25:1–26', source: 'kings', start: 'siege', end: 'flight' },
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

  it('positions passages against situations rather than years', () => {
    expect(
      situationalBarGeometry(
        { start: 'fall', end: 'gedaliah' },
        situationalTimeline.phases
      )
    ).toEqual({ left: 25, width: 50 })
  })

  it('keeps situational charts compact and moves explanation into More', () => {
    render(
      <ChronologyTimeline
        detailsText="These passages describe the same historical crisis."
        sources={[{ key: 'source', title: 'Timeline source', url: '' }]}
        timeline={situationalTimeline}
      />
    )

    expect(screen.getByRole('region', { name: 'Babylon’s siege and its aftermath' })).toBeInTheDocument()
    expect(screen.getByText('Passage')).toBeInTheDocument()
    expect(screen.getByText('Jer 39–41')).toBeInTheDocument()
    expect(screen.getByText('2 Kin 25:1–26')).toBeInTheDocument()
    expect(document.querySelector('[data-passage-column-header]')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-passage-column]')).toHaveLength(2)
    expect(screen.queryByText('These passages describe the same historical crisis.')).not.toBeInTheDocument()
    expect(screen.queryByText('Dated')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    expect(screen.getByRole('dialog', { name: 'Babylon’s siege and its aftermath' })).toBeInTheDocument()
    expect(screen.getByText('These passages describe the same historical crisis.')).toBeInTheDocument()
    expect(screen.getByText('Timeline source')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close timeline details' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('reveals one short dated anchor tooltip on click', () => {
    render(<ChronologyTimeline timeline={situationalTimeline} />)

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Final siege' }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('588 BC (est.)')
    expect(screen.getByRole('tooltip')).toHaveTextContent('Babylon began its final siege in Zedekiah’s ninth year.')
    expect(screen.getByRole('button', { name: 'Final siege' })).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Jerusalem falls' }))
    expect(screen.getByRole('tooltip')).toHaveTextContent('586 BC (est.)')
    expect(screen.queryByText('Babylon began its final siege in Zedekiah’s ninth year.')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close timeline anchor' }))
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('uses source-specific textures as a non-color cue', () => {
    render(<ChronologyTimeline timeline={situationalTimeline} />)

    const jeremiahBar = document.querySelector('[data-situation-bar="Jer 39–41"]')
    const kingsBar = document.querySelector('[data-situation-bar="2 Kin 25:1–26"]')

    expect(jeremiahBar).toHaveAttribute('data-timeline-texture', 'diagonal stripes')
    expect(kingsBar).toHaveAttribute('data-timeline-texture', 'vertical stripes')
    expect(jeremiahBar.style.backgroundImage).not.toBe('')
    expect(kingsBar.style.backgroundImage).not.toBe(jeremiahBar.style.backgroundImage)
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
