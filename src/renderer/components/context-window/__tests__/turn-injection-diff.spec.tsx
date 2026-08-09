// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { TurnInjectionDiff } from '../turn-injection-diff'
import type { TurnDeltaSummary, TurnDeltaDetail } from '@shared/types'

function makeSummary(turnId: number, total: number, claudeMd = 0, toolOutput = 0): TurnDeltaSummary {
  return {
    turnId,
    timestamp: 1_700_000_000_000 + turnId * 1000,
    totalDelta: total,
    perCategoryTokens: {
      'claude-md': claudeMd,
      'mentioned-file': 0,
      'tool-output': toolOutput,
      'thinking-text': 0,
      'task-coordination': 0,
      'user-messages': total - claudeMd - toolOutput
    }
  }
}

function makeDetail(turnId: number): TurnDeltaDetail {
  return {
    turnId,
    byCategory: {
      'claude-md': { tokens: 0, items: [] },
      'mentioned-file': { tokens: 0, items: [] },
      'tool-output': {
        tokens: 50,
        items: [{ label: 'Bash:ls', tokens: 50, contentHash: 'aaaaaaaaaaaaaaaa' }]
      },
      'thinking-text': { tokens: 0, items: [] },
      'task-coordination': { tokens: 0, items: [] },
      'user-messages': {
        tokens: 10,
        items: [{ label: 'user', tokens: 10, contentHash: 'bbbbbbbbbbbbbbbb' }]
      }
    }
  }
}

beforeEach(() => {
  vi.stubGlobal('electron', {
    context: {
      getTurnDetail: vi.fn(async (_sid: string, turnId: number) => makeDetail(turnId))
    }
  })
})

describe('TurnInjectionDiff', () => {
  it('renders empty state when no turns', () => {
    render(<TurnInjectionDiff sessionId="s1" turns={[]} />)
    expect(screen.getByTestId('turn-diff-empty')).toBeTruthy()
  })

  it('renders one row per turn summary', () => {
    const turns = [makeSummary(1, 100), makeSummary(2, 50), makeSummary(3, 1500)]
    render(<TurnInjectionDiff sessionId="s1" turns={turns} />)
    const rows = screen.getAllByTestId(/turn-diff-row-/)
    expect(rows.length).toBe(3)
  })

  it('applies spike highlight when delta exceeds 2k tokens', () => {
    const turns = [makeSummary(1, 500), makeSummary(2, 2500)]
    render(<TurnInjectionDiff sessionId="s1" turns={turns} />)
    expect(screen.getByTestId('turn-diff-row-1').className).not.toMatch(/is-spike/)
    expect(screen.getByTestId('turn-diff-row-2').className).toMatch(/is-spike/)
  })

  it('expands row to reveal category breakdown via cold-channel fetch', async () => {
    const turns = [makeSummary(1, 60, 0, 50)]
    render(<TurnInjectionDiff sessionId="s1" turns={turns} />)
    const row = screen.getByTestId('turn-diff-row-1')
    await act(async () => {
      fireEvent.click(row)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByText('Bash:ls')).toBeTruthy()
    expect(window.electron.context.getTurnDetail).toHaveBeenCalledWith('s1', 1)
  })
})
