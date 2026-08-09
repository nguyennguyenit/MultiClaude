// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, renderHook } from '@testing-library/react'
import type { Terminal as XTerm } from '@xterm/xterm'
import { useContextMenuStore } from '../../stores/context-menu-store'
import { normalizeTerminalCopySelection, useTerminalClipboard } from '../use-terminal-clipboard'

function terminalWithRows(wrappedRows: Record<number, boolean>, selectionPosition = { start: { x: 0, y: 0 }, end: { x: 0, y: 0 } }): XTerm {
  return {
    buffer: {
      active: {
        getLine: vi.fn((row: number) => ({ isWrapped: wrappedRows[row] === true }))
      }
    },
    getSelectionPosition: vi.fn(() => selectionPosition)
  } as unknown as XTerm
}

describe('normalizeTerminalCopySelection', () => {
  it('joins ck command examples wrapped by terminal-width formatting', () => {
    const selection = 'ck:cook /Users/plateau/Project/AdsSpyAI/plans/260702-2333-analysis-cache-ad-card-\n  reuse/plan.md --tdd'
    const terminal = terminalWithRows({})

    expect(normalizeTerminalCopySelection(selection, terminal)).toBe(
      'ck:cook /Users/plateau/Project/AdsSpyAI/plans/260702-2333-analysis-cache-ad-card-reuse/plan.md --tdd'
    )
  })

  it('keeps a separator when a wrapped ck command continues with an option', () => {
    const selection = 'ck:cook /tmp/plan.md\n  --tdd'
    const terminal = terminalWithRows({})

    expect(normalizeTerminalCopySelection(selection, terminal)).toBe('ck:cook /tmp/plan.md --tdd')
  })

  it('preserves ordinary multi-line terminal selections', () => {
    const selection = 'first line\n  second line'
    const terminal = terminalWithRows({})

    expect(normalizeTerminalCopySelection(selection, terminal)).toBe(selection)
  })

  it('preserves ck command selections that include unindented output', () => {
    const selection = 'ck:cook /tmp/plan.md\nDone'
    const terminal = terminalWithRows({})

    expect(normalizeTerminalCopySelection(selection, terminal)).toBe(selection)
  })

  it('removes newlines between xterm soft-wrapped rows', () => {
    const selection = 'long command part one\npart two\nnext command'
    const terminal = terminalWithRows({ 1: true, 2: false })

    expect(normalizeTerminalCopySelection(selection, terminal)).toBe('long command part onepart two\nnext command')
  })
})

describe('useTerminalClipboard', () => {
  beforeEach(() => {
    useContextMenuStore.getState().closeMenu()
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        writeText: vi.fn()
      }
    })
  })

  afterEach(() => {
    useContextMenuStore.getState().closeMenu()
  })

  it('writes normalized selection text from the context-menu Copy action', () => {
    const element = document.createElement('div')
    const terminal = {
      ...terminalWithRows({}),
      element,
      getSelection: vi.fn(() => 'ck:cook /tmp/ad-card-\n  reuse/plan.md --tdd')
    } as unknown as XTerm
    const { result } = renderHook(() => useTerminalClipboard({ terminalId: 'term-1' }))

    result.current.attachClipboardListeners(terminal)
    fireEvent.contextMenu(element)

    const copyItem = useContextMenuStore.getState().items.find((item) => item.id === 'copy')
    copyItem?.onSelect?.()

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ck:cook /tmp/ad-card-reuse/plan.md --tdd')
  })
})
