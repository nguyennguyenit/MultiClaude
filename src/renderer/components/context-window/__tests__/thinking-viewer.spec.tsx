// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ThinkingViewer } from '../thinking-viewer'
import type { ThinkingBlock } from '@shared/types'

function block(turnId: number, count = 1): ThinkingBlock {
  return {
    turnId,
    timestamp: 1_700_000_000_000 + turnId,
    count,
    signatures: Array.from({ length: count }, (_, i) => `sig${turnId}_${i}xxxxxxxx`.slice(0, 16))
  }
}

describe('ThinkingViewer', () => {
  it('renders empty state', () => {
    render(<ThinkingViewer blocks={[]} />)
    expect(screen.getByTestId('thinking-empty')).toBeTruthy()
  })

  it('renders one row per turn without fabricating token volume', () => {
    render(<ThinkingViewer blocks={[block(1, 2), block(2, 1)]} />)
    expect(screen.getAllByTestId(/thinking-row-/).length).toBe(2)
    expect(screen.getByTestId('thinking-row-1').textContent).toMatch(/2/)
    expect(screen.getByTestId('thinking-row-1').textContent).not.toMatch(/~|token/i)
  })

  it('expands to show signature prefixes (signed-only badge)', () => {
    render(<ThinkingViewer blocks={[block(1, 1)]} />)
    const row = screen.getByTestId('thinking-row-1')
    act(() => { fireEvent.click(row) })
    expect(screen.getByText(/signed/i)).toBeTruthy()
  })

  it('shows truncation notice when more than 30 turns are present', () => {
    const many = Array.from({ length: 30 }, (_, i) => block(i + 1, 1))
    render(<ThinkingViewer blocks={many} olderTruncatedCount={12} />)
    expect(screen.getByTestId('thinking-truncated').textContent).toMatch(/12/)
  })

  it('reverses chronological order so most recent turn shows first', () => {
    render(<ThinkingViewer blocks={[block(1, 1), block(2, 1), block(3, 1)]} />)
    const rows = screen.getAllByTestId(/thinking-row-/)
    expect(rows[0].getAttribute('data-testid')).toBe('thinking-row-3')
    expect(rows[2].getAttribute('data-testid')).toBe('thinking-row-1')
  })
})
