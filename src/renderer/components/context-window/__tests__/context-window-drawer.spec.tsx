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
  })

  it('closing the drawer sets isOpen false via close button', () => {
    render(<ContextWindowDrawer />)
    const close = document.querySelector('.slide-panel-close') as HTMLButtonElement
    act(() => { close.click() })
    expect(useContextWindowStore.getState().isOpen).toBe(false)
  })
})
