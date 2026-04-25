// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { CompactionTimeline } from '../compaction-timeline'
import type { CompactionEvent } from '@shared/types'

function ev(id: string, before: number, after: number, conf: 'high' | 'low' = 'high'): CompactionEvent {
  return {
    id,
    timestamp: 1_700_000_000_000,
    beforeTokens: before,
    afterTokens: after,
    confidence: conf,
    summary: `summary for ${id}`
  }
}

describe('CompactionTimeline', () => {
  it('renders empty state', () => {
    render(<CompactionTimeline events={[]} />)
    expect(screen.getByTestId('compaction-empty')).toBeTruthy()
  })

  it('renders one row per event', () => {
    render(<CompactionTimeline events={[ev('a', 100_000, 30_000), ev('b', 80_000, 20_000)]} />)
    expect(screen.getAllByTestId(/compaction-event-/).length).toBe(2)
  })

  it('marks low-confidence rows differently from high-confidence', () => {
    render(<CompactionTimeline events={[ev('a', 100_000, 30_000, 'high'), ev('b', 80_000, 20_000, 'low')]} />)
    expect(screen.getByTestId('compaction-event-a').className).toMatch(/conf-high/)
    expect(screen.getByTestId('compaction-event-b').className).toMatch(/conf-low/)
  })

  it('expands row on click to reveal summary', () => {
    render(<CompactionTimeline events={[ev('a', 100_000, 30_000)]} />)
    const row = screen.getByTestId('compaction-event-a')
    act(() => { fireEvent.click(row) })
    expect(screen.getByText(/summary for a/)).toBeTruthy()
  })
})
