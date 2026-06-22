// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Terminal as XTerm } from '@xterm/xterm'
import type { ResizeColsChange } from '../use-terminal-fit'

const mocks = vi.hoisted(() => ({
  refreshTerminal: vi.fn(),
  publishResizeEnd: vi.fn(),
  capturedFitParams: null as {
    terminalRef: { current: XTerm | null }
    onResizeEnd?: (source: 'pane-drag' | 'window', colsChange: ResizeColsChange) => void
  } | null,
}))

vi.mock('../use-terminal-webgl', () => ({
  useTerminalWebGL: vi.fn(() => ({
    reconcileWebGL: vi.fn(),
    clearTextureAtlas: vi.fn(),
    webglAddonRef: { current: null },
    webglLoadingRef: { current: false },
    reloadWebGLForTheme: vi.fn(),
    refreshTerminal: mocks.refreshTerminal,
  })),
}))

vi.mock('../use-terminal-fit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../use-terminal-fit')>()
  return {
    ...actual,
    useTerminalFit: vi.fn((params: {
      terminalRef: { current: XTerm | null }
      onResizeEnd?: (source: 'pane-drag' | 'window', colsChange: ResizeColsChange) => void
    }) => {
      mocks.capturedFitParams = params
      return {
        performFit: vi.fn(() => true),
        cancelScheduledFit: vi.fn(),
        fit: vi.fn(),
      }
    }),
  }
})

vi.mock('../../utils/terminal-resize-end-dispatcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/terminal-resize-end-dispatcher')>()
  return { ...actual, publishResizeEnd: mocks.publishResizeEnd }
})

vi.mock('../use-terminal-debug', () => ({
  useTerminalDebug: vi.fn(() => ({
    registerTerminalDebugHandle: vi.fn(),
    unregisterTerminalDebugHandle: vi.fn(),
  })),
}))

vi.mock('../use-terminal-keyboard', () => ({
  useTerminalKeyboard: vi.fn(() => ({
    processKeyboardEnhancementOutput: vi.fn(),
    shouldSendEnhancedEnter: vi.fn(() => false),
  })),
}))

vi.mock('../use-terminal-scroll', () => ({
  useTerminalScroll: vi.fn(() => ({
    write: vi.fn(),
    scrollToTop: vi.fn(),
    scrollToBottom: vi.fn(),
    followLiveOutput: vi.fn(),
    syncViewportState: vi.fn(),
    clearUserViewportInteraction: vi.fn(),
    markUserViewportInteraction: vi.fn(),
    onWriteParsed: vi.fn(),
    isAtBottom: true,
    hasScrollback: false,
  })),
}))

vi.mock('../use-terminal-font-theme', () => ({
  useTerminalFontTheme: vi.fn(() => ({ syncFontAfterLoad: vi.fn() })),
}))

vi.mock('../use-terminal-clipboard', () => ({
  useTerminalClipboard: vi.fn(() => ({
    attachClipboardListeners: vi.fn(),
    getCtrlVHandler: vi.fn(),
    followLiveOutputRef: { current: null },
  })),
}))

vi.mock('../use-terminal-visibility', () => ({
  useTerminalVisibility: vi.fn(),
}))

vi.mock('../use-terminal-scrollback', () => ({
  useTerminalScrollback: vi.fn(),
}))

vi.mock('../use-terminal-init', () => ({
  useTerminalInit: vi.fn(() => ({ initTerminal: vi.fn() })),
}))

import { useTerminal } from '../use-terminal'
import { useAppStore } from '../../stores/app-store'

function fakeTerminal(bufferType: 'normal' | 'alternate'): XTerm {
  return {
    cols: 80,
    rows: 24,
    buffer: { active: { type: bufferType, viewportY: 0, baseY: 0 } },
    textarea: document.createElement('textarea'),
    focus: vi.fn(),
    blur: vi.fn(),
    clear: vi.fn(),
  } as unknown as XTerm
}

describe('useTerminal resize policy', () => {
  beforeEach(() => {
    mocks.refreshTerminal.mockClear()
    mocks.publishResizeEnd.mockClear()
    mocks.capturedFitParams = null
    useAppStore.setState({ terminals: [] })
  })

  it('does not snapshot-replay a non-Claude normal-buffer prompt after pane resize-end', () => {
    renderHook(() => useTerminal({ terminalId: 'term-1' }))
    expect(mocks.capturedFitParams).not.toBeNull()

    mocks.capturedFitParams!.terminalRef.current = fakeTerminal('normal')

    act(() => {
      mocks.capturedFitParams!.onResizeEnd?.('pane-drag', { changed: true, direction: 'wider' })
    })

    expect(mocks.publishResizeEnd).toHaveBeenCalledWith('term-1', 'pane-drag')
    expect(mocks.refreshTerminal).not.toHaveBeenCalled()
  })

  it('snapshot-replays Claude normal-buffer after resize-end to repair xterm frame reflow', () => {
    useAppStore.setState({
      terminals: [{ id: 'term-1', title: 'Claude', cwd: '/', isClaudeMode: true, createdAt: new Date().toISOString() }] as never,
    })
    renderHook(() => useTerminal({ terminalId: 'term-1' }))
    expect(mocks.capturedFitParams).not.toBeNull()

    mocks.capturedFitParams!.terminalRef.current = fakeTerminal('normal')

    act(() => {
      mocks.capturedFitParams!.onResizeEnd?.('pane-drag', { changed: true, direction: 'narrower' })
    })

    expect(mocks.publishResizeEnd).toHaveBeenCalledWith('term-1', 'pane-drag')
    expect(mocks.refreshTerminal).toHaveBeenCalledWith(false, true)
  })

  it('does not snapshot-replay Claude normal-buffer when cols did not change', () => {
    useAppStore.setState({
      terminals: [{ id: 'term-1', title: 'Claude', cwd: '/', isClaudeMode: true, createdAt: new Date().toISOString() }] as never,
    })
    renderHook(() => useTerminal({ terminalId: 'term-1' }))
    expect(mocks.capturedFitParams).not.toBeNull()

    mocks.capturedFitParams!.terminalRef.current = fakeTerminal('normal')

    act(() => {
      mocks.capturedFitParams!.onResizeEnd?.('pane-drag', { changed: false, direction: 'none' })
    })

    expect(mocks.refreshTerminal).not.toHaveBeenCalled()
  })
})
