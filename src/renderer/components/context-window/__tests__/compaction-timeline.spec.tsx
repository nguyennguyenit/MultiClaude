// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { CompactionTimeline } from '../compaction-timeline'
import type { CompactionEvent } from '@shared/types'

function ev(id: string, observedTokens = 100_000): CompactionEvent {
  return {
    id,
    timestamp: 1_700_000_000_000,
    observedTokens,
    confidence: 'high',
    source: 'summary',
    summary: `summary for ${id}`
  }
}

describe('CompactionTimeline', () => {
  it('renders empty state', () => {
    render(<CompactionTimeline events={[]} />)
    expect(screen.getByTestId('compaction-empty').textContent).toMatch(/no explicit compaction event/i)
  })

  it('renders one row per event', () => {
    render(<CompactionTimeline events={[ev('a'), ev('b', 80_000)]} />)
    expect(screen.getAllByTestId(/compaction-event-/).length).toBe(2)
  })

  it('labels the explicit signal source without claiming a token drop', () => {
    render(<CompactionTimeline events={[ev('a', 100_000)]} />)
    const row = screen.getByTestId('compaction-event-a')
    expect(row.textContent).toMatch(/explicit summary/i)
    expect(row.textContent).toMatch(/100(?:\.0)?k observed/i)
    expect(row.textContent).not.toMatch(/→|−\d+%|inferred/i)
  })

  it('expands row on click to reveal summary', () => {
    render(<CompactionTimeline events={[ev('a')]} />)
    const row = screen.getByTestId('compaction-event-a')
    act(() => { fireEvent.click(row) })
    expect(screen.getByText(/summary for a/)).toBeTruthy()
  })
})
