// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { PaneSwitcherHeader } from '../pane-switcher-header'
import { useAppStore } from '../../../stores'
import type { Terminal, ContextSnapshot } from '@shared/types'

function makeTerm(id: string, overrides: Partial<Terminal> = {}): Terminal {
  return {
    id,
    title: overrides.title ?? id,
    cwd: '/p',
    isClaudeMode: true,
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

function makeSnap(sid: string, total: number): ContextSnapshot {
  return {
    sessionId: sid,
    buckets: {
      'claude-md': { tokens: total, chars: 0, itemCount: 1 },
      'mentioned-file': { tokens: 0, chars: 0, itemCount: 0 },
      'tool-output': { tokens: 0, chars: 0, itemCount: 0 },
      'thinking-text': { tokens: 0, chars: 0, itemCount: 0 },
      'task-coordination': { tokens: 0, chars: 0, itemCount: 0 },
      'user-messages': { tokens: 0, chars: 0, itemCount: 0 }
    },
    total,
    updatedAt: Date.now()
  }
}

beforeEach(() => {
  useAppStore.setState({ terminals: [], activeTerminalId: null })
  vi.stubGlobal('electron', {
    context: {
      getSnapshot: vi.fn(async (sid: string) => makeSnap(sid, 1000)),
      onSnapshot: vi.fn(() => () => {})
    }
  })
})

describe('PaneSwitcherHeader', () => {
  it('renders one row per terminal', () => {
    act(() => {
      useAppStore.setState({
        terminals: [makeTerm('t1'), makeTerm('t2'), makeTerm('t3')],
        activeTerminalId: 't1'
      })
    })
    render(<PaneSwitcherHeader />)
    const rows = screen.getAllByRole('option')
    expect(rows.length).toBe(3)
  })

  it('highlights the active pane row', () => {
    act(() => {
      useAppStore.setState({
        terminals: [makeTerm('t1'), makeTerm('t2')],
        activeTerminalId: 't2'
      })
    })
    render(<PaneSwitcherHeader />)
    const rows = screen.getAllByRole('option')
    expect(rows[0].getAttribute('aria-selected')).toBe('false')
    expect(rows[1].getAttribute('aria-selected')).toBe('true')
  })

  it('clicking a row calls setActiveTerminal', () => {
    act(() => {
      useAppStore.setState({
        terminals: [makeTerm('t1'), makeTerm('t2')],
        activeTerminalId: 't1'
      })
    })
    render(<PaneSwitcherHeader />)
    const rows = screen.getAllByRole('option')
    act(() => { fireEvent.click(rows[1]) })
    expect(useAppStore.getState().activeTerminalId).toBe('t2')
  })

  it('shows agent badge based on terminal.agentType', () => {
    act(() => {
      useAppStore.setState({
        terminals: [
          makeTerm('t1', { agentType: 'claude' }),
          makeTerm('t2', { agentType: 'codex' }),
          makeTerm('t3', { agentType: 'gemini' }),
          makeTerm('t4', { agentType: 'aider' })
        ],
        activeTerminalId: 't1'
      })
    })
    render(<PaneSwitcherHeader />)
    expect(screen.getByTestId('pane-badge-t1').textContent).toMatch(/claude/i)
    expect(screen.getByTestId('pane-badge-t2').textContent).toMatch(/codex/i)
    expect(screen.getByTestId('pane-badge-t3').textContent).toMatch(/gemini/i)
    expect(screen.getByTestId('pane-badge-t4').textContent).toMatch(/aider/i)
  })

  it('keyboard ArrowDown/ArrowUp+Enter switches active pane', () => {
    act(() => {
      useAppStore.setState({
        terminals: [makeTerm('t1'), makeTerm('t2'), makeTerm('t3')],
        activeTerminalId: 't1'
      })
    })
    render(<PaneSwitcherHeader />)
    const list = screen.getByRole('listbox')
    act(() => {
      list.focus()
      fireEvent.keyDown(list, { key: 'ArrowDown' })
      fireEvent.keyDown(list, { key: 'Enter' })
    })
    expect(useAppStore.getState().activeTerminalId).toBe('t2')
  })

  it('renders a status dot reflecting terminal.taskStatus', () => {
    act(() => {
      useAppStore.setState({
        terminals: [
          makeTerm('t1', { taskStatus: 'running' }),
          makeTerm('t2', { taskStatus: 'done' }),
          makeTerm('t3', { taskStatus: 'failed' }),
          makeTerm('t4', { taskStatus: 'review' })
        ],
        activeTerminalId: 't1'
      })
    })
    render(<PaneSwitcherHeader />)
    expect(screen.getByTestId('pane-status-t1').getAttribute('data-status')).toBe('running')
    expect(screen.getByTestId('pane-status-t2').getAttribute('data-status')).toBe('done')
    expect(screen.getByTestId('pane-status-t3').getAttribute('data-status')).toBe('failed')
    expect(screen.getByTestId('pane-status-t4').getAttribute('data-status')).toBe('review')
  })
})
