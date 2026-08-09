// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ContextWindowDrawer } from '../context-window-drawer'
import { useAppStore, useContextWindowStore } from '../../../stores'
import type { ContextSnapshot, Terminal } from '@shared/types'

function makeSnap(sid: string): ContextSnapshot {
  return {
    sessionId: sid,
    buckets: {
      'claude-md': { tokens: 100, chars: 400, itemCount: 2 },
      'mentioned-file': { tokens: 50, chars: 200, itemCount: 1 },
      'tool-output': { tokens: 300, chars: 1200, itemCount: 3 },
      'thinking-text': { tokens: 200, chars: 800, itemCount: 4 },
      'task-coordination': { tokens: 10, chars: 40, itemCount: 1 },
      'user-messages': { tokens: 25, chars: 100, itemCount: 2 }
    },
    total: 685,
    updatedAt: Date.now()
  }
}

function makeTerm(id: string, claudeSessionId?: string): Terminal {
  return {
    id, title: id, cwd: '/p', isClaudeMode: true,
    claudeSessionId, createdAt: new Date().toISOString()
  }
}

beforeEach(() => {
  useContextWindowStore.setState({ isOpen: true })
  useAppStore.setState({ terminals: [], activeTerminalId: null })
  vi.stubGlobal('electron', {
    context: {
      getSnapshot: vi.fn(async (sid: string) => makeSnap(sid)),
      onSnapshot: vi.fn(() => () => {})
    }
  })
})

describe('ContextWindowDrawer', () => {
  it('shows empty state when no active sessionId', () => {
    render(<ContextWindowDrawer />)
    expect(screen.getByTestId('context-empty')).toBeTruthy()
  })

  it('renders all 6 category rows once a snapshot arrives', async () => {
    act(() => {
      useAppStore.setState({
        terminals: [makeTerm('t1', 'sess-abc')],
        activeTerminalId: 't1'
      })
    })
    render(<ContextWindowDrawer />)
    // Wait a tick for getSnapshot promise
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    // Labels from CATEGORY_META
    expect(screen.getByText('CLAUDE.md')).toBeTruthy()
    expect(screen.getByText('Tool output')).toBeTruthy()
    expect(screen.getByText('User messages')).toBeTruthy()
    expect(screen.getByText('Cumulative estimate')).toBeTruthy()
    expect(screen.getByTitle(/not provider-reported active context usage/i)).toBeTruthy()
  })

  it('closing the drawer sets isOpen false via close button', () => {
    render(<ContextWindowDrawer />)
    const close = document.querySelector('.slide-panel-close') as HTMLButtonElement
    act(() => { close.click() })
    expect(useContextWindowStore.getState().isOpen).toBe(false)
  })

  it('exposes ARIA landmarks: complementary region + one progressbar per category', async () => {
    act(() => {
      useAppStore.setState({
        terminals: [makeTerm('t1', 'sess-xyz')],
        activeTerminalId: 't1'
      })
    })
    render(<ContextWindowDrawer />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })

    const region = screen.getByRole('complementary', { name: /context window breakdown/i })
    expect(region).toBeTruthy()
    const bars = screen.getAllByRole('progressbar')
    expect(bars.length).toBe(6)
    // Each progressbar has a non-negative aria-valuenow within aria-valuemax
    for (const bar of bars) {
      const now = Number(bar.getAttribute('aria-valuenow'))
      const max = Number(bar.getAttribute('aria-valuemax'))
      expect(Number.isFinite(now)).toBe(true)
      expect(now).toBeGreaterThanOrEqual(0)
      expect(now).toBeLessThanOrEqual(max)
    }
  })
})
