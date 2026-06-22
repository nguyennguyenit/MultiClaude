// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTerminalInit } from '../use-terminal-init'
import { MIN_SAFE_COLS } from '../use-terminal-fit'
import { _resetForTests as resetPtyResizeCoordinatorForTests } from '../../utils/pty-resize-coordinator'
import {
  attachTerminalOutputDispatcher,
  registerTerminalOutputHandler,
  resetTerminalOutputDispatcherForTests,
} from '../../utils/terminal-output-dispatcher'
import { useAppStore } from '../../stores'

const terminalMocks = vi.hoisted(() => ({
  latest: null as MockTerminal | null,
  latestOptions: null as Record<string, unknown> | null,
  proposed: { cols: 120, rows: 30 },
  fitThrows: false,
}))

class MockTerminal {
  cols = 120
  rows = 30
  element: HTMLElement | null = null
  textarea: HTMLTextAreaElement | null = null
  buffer = { active: { type: 'normal', viewportY: 0, baseY: 0 } }
  options = {}
  open = vi.fn()
  loadAddon = vi.fn()
  resize = vi.fn((cols: number, rows: number) => {
    this.cols = cols
    this.rows = rows
  })
  write = vi.fn((_data: string, cb?: () => void) => cb?.())
  onScroll = vi.fn(() => ({ dispose: vi.fn() }))
  onWriteParsed = vi.fn()
  attachCustomKeyEventHandler = vi.fn()
  onData = vi.fn()
  onResize = vi.fn((cb: (size: { cols: number; rows: number }) => void) => {
    this.resizeListener = cb
    return { dispose: vi.fn() }
  })
  resizeListener?: (size: { cols: number; rows: number }) => void
  emitResize(cols: number, rows: number) {
    this.cols = cols
    this.rows = rows
    this.resizeListener?.({ cols, rows })
  }
}

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(function Terminal(options: Record<string, unknown>) {
    terminalMocks.latestOptions = options
    terminalMocks.latest = new MockTerminal()
    return terminalMocks.latest
  }),
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(function FitAddon() {
    return {
      fit: vi.fn(() => {
        if (terminalMocks.fitThrows) throw new Error('fit failed')
        if (!terminalMocks.latest) return
        terminalMocks.latest.cols = terminalMocks.proposed.cols
        terminalMocks.latest.rows = terminalMocks.proposed.rows
      }),
      proposeDimensions: vi.fn(() => terminalMocks.proposed),
      dispose: vi.fn(),
    }
  }),
}))

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn(function WebLinksAddon() {}),
}))

function makeContainerRef() {
  const container = document.createElement('div')
  Object.defineProperty(container, 'offsetWidth', { value: 800 })
  Object.defineProperty(container, 'offsetHeight', { value: 400 })
  return { current: container }
}

function renderInit(onResize = vi.fn()) {
  return renderHook(() =>
    useTerminalInit({
      terminalRef: { current: null } as never,
      fitAddonRef: { current: null } as never,
      disposedRef: { current: false },
      containerRef: makeContainerRef() as never,
      terminalId: 'term-1',
      isActiveRef: { current: true },
      isHiddenRef: { current: false },
      scrollMachineRef: { current: { pendingWriteCount: 0, followOutputOnNextWrite: false, hiddenViewportIntent: null } } as never,
      userViewportInteractingRef: { current: false },
      viewportListenersRef: { current: null } as never,
      scrollDisposableRef: { current: null } as never,
      syncViewportState: vi.fn(),
      clearUserViewportInteraction: vi.fn(),
      markUserViewportInteraction: vi.fn(),
      shouldSendEnhancedEnter: () => false,
      attachClipboardListeners: vi.fn(),
      getCtrlVHandler: () => () => undefined,
      followLiveOutput: vi.fn(),
      reconcileWebGL: vi.fn(),
      syncFontAfterLoad: vi.fn(),
      registerTerminalDebugHandle: vi.fn(),
      onWriteParsed: vi.fn(),
      onResize,
    })
  )
}

describe('useTerminalInit resize pipeline', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('electron', {
      terminal: {
        resize: vi.fn(),
        resizeHeadless: vi.fn(),
        getSnapshot: vi.fn().mockResolvedValue({ data: '', cols: 0, rows: 0 }),
      },
      app: { openExternal: vi.fn() },
    })
    terminalMocks.latest = null
    terminalMocks.latestOptions = null
    terminalMocks.proposed = { cols: 120, rows: 30 }
    terminalMocks.fitThrows = false
    resetPtyResizeCoordinatorForTests()
    resetTerminalOutputDispatcherForTests()
    useAppStore.setState({ terminals: [] })
  })

  it('debounces xterm shrink and updates only headless cols in normal buffer', () => {
    const onResize = vi.fn()
    const { result } = renderInit(onResize)

    act(() => result.current.initTerminal())
    const resize = window.electron.terminal.resize as ReturnType<typeof vi.fn>
    const resizeHeadless = window.electron.terminal.resizeHeadless as ReturnType<typeof vi.fn>
    resize.mockClear()
    resizeHeadless.mockClear()

    act(() => {
      terminalMocks.latest?.emitResize(40, 20)
      vi.advanceTimersByTime(80)
    })

    expect(resize).not.toHaveBeenCalled()
    expect(resizeHeadless).toHaveBeenCalledWith('term-1', 40, 20)
    expect(onResize).toHaveBeenCalledWith(40, 20)
  })

  it('allows local cursor-line reflow so active input follows resize', () => {
    const { result } = renderInit()

    act(() => result.current.initTerminal())

    expect(terminalMocks.latestOptions?.windowsPty).toBeUndefined()
    expect(terminalMocks.latestOptions?.reflowCursorLine).toBe(true)
  })

  it('disables cursor-line reflow for Claude normal-buffer input frames', () => {
    useAppStore.setState({
      terminals: [{ id: 'term-1', title: 'Claude', cwd: '/', isClaudeMode: true, createdAt: new Date().toISOString() }] as never,
    })
    const { result } = renderInit()

    act(() => result.current.initTerminal())

    expect(terminalMocks.latestOptions?.reflowCursorLine).toBe(false)
  })

  it('skips Claude normal-buffer PTY resize to prevent inline redraw duplication', () => {
    useAppStore.setState({
      terminals: [{ id: 'term-1', title: 'Claude', cwd: '/', isClaudeMode: true, createdAt: new Date().toISOString() }] as never,
    })
    const onResize = vi.fn()
    const { result } = renderInit(onResize)

    act(() => result.current.initTerminal())
    const resize = window.electron.terminal.resize as ReturnType<typeof vi.fn>
    const resizeHeadless = window.electron.terminal.resizeHeadless as ReturnType<typeof vi.fn>
    resize.mockClear()
    resizeHeadless.mockClear()

    act(() => {
      terminalMocks.latest?.emitResize(40, 20)
      vi.advanceTimersByTime(80)
    })

    expect(resize).not.toHaveBeenCalled()
    expect(resizeHeadless).toHaveBeenCalledWith('term-1', 40, 20)
    expect(onResize).toHaveBeenCalledWith(40, 20)
  })

  it('skips normal-buffer PTY resize when only agentType identifies Claude', () => {
    useAppStore.setState({
      terminals: [{
        id: 'term-1',
        title: 'Claude',
        cwd: '/',
        isClaudeMode: false,
        agentType: 'claude',
        createdAt: new Date().toISOString()
      }] as never,
    })
    const { result } = renderInit()

    act(() => result.current.initTerminal())
    const resize = window.electron.terminal.resize as ReturnType<typeof vi.fn>
    resize.mockClear()

    act(() => {
      terminalMocks.latest?.emitResize(40, 20)
      vi.advanceTimersByTime(80)
    })

    expect(resize).not.toHaveBeenCalled()
  })

  it('skips normal-buffer PTY resize when a Claude session id is already bound', () => {
    useAppStore.setState({
      terminals: [{
        id: 'term-1',
        title: 'Claude',
        cwd: '/',
        isClaudeMode: false,
        claudeSessionId: 'session-123',
        createdAt: new Date().toISOString()
      }] as never,
    })
    const { result } = renderInit()

    act(() => result.current.initTerminal())
    const resize = window.electron.terminal.resize as ReturnType<typeof vi.fn>
    resize.mockClear()

    act(() => {
      terminalMocks.latest?.emitResize(40, 20)
      vi.advanceTimersByTime(80)
    })

    expect(resize).not.toHaveBeenCalled()
  })

  it('still sends Claude alt-buffer PTY resize for full-screen TUIs', () => {
    useAppStore.setState({
      terminals: [{ id: 'term-1', title: 'Claude', cwd: '/', isClaudeMode: true, createdAt: new Date().toISOString() }] as never,
    })
    const { result } = renderInit()

    act(() => result.current.initTerminal())
    const resize = window.electron.terminal.resize as ReturnType<typeof vi.fn>
    resize.mockClear()

    act(() => {
      if (terminalMocks.latest) terminalMocks.latest.buffer.active.type = 'alternate'
      terminalMocks.latest?.emitResize(40, 20)
      vi.advanceTimersByTime(80)
    })

    expect(resize).toHaveBeenCalledWith('term-1', 40, 20)
  })

  it('clamps initial fit below the safe width before syncing headless size', () => {
    terminalMocks.proposed = { cols: 12, rows: 20 }
    const { result } = renderInit()

    act(() => result.current.initTerminal())

    expect(terminalMocks.latest?.resize).toHaveBeenCalledWith(MIN_SAFE_COLS, 20)
    expect(window.electron.terminal.resize).not.toHaveBeenCalledWith('term-1', MIN_SAFE_COLS, 20)
    expect(window.electron.terminal.resizeHeadless).toHaveBeenCalledWith('term-1', MIN_SAFE_COLS, 20)
  })

  it('continues terminal setup when the initial fit fails', () => {
    terminalMocks.fitThrows = true
    const { result } = renderInit()

    act(() => result.current.initTerminal())

    expect(terminalMocks.latest?.open).toHaveBeenCalled()
    expect(terminalMocks.latest?.onResize).toHaveBeenCalled()
    expect(window.electron.terminal.resize).not.toHaveBeenCalled()
  })

  it('does not replay buffered live output already covered by the init snapshot', async () => {
    const getSnapshot = window.electron.terminal.getSnapshot as ReturnType<typeof vi.fn>
    getSnapshot.mockResolvedValue({ data: 'welcome', cols: 120, rows: 30, byteOffset: 7 })

    let publishOutput: ((payload: { terminalId: string; data: string; startOffset?: number; endOffset?: number }) => void) | null = null
    attachTerminalOutputDispatcher((callback) => {
      publishOutput = callback
      return vi.fn()
    })

    const { result } = renderInit()
    act(() => result.current.initTerminal())
    registerTerminalOutputHandler('term-1', data => terminalMocks.latest?.write(data))

    act(() => {
      publishOutput?.({ terminalId: 'term-1', data: 'welcome', startOffset: 0, endOffset: 7 })
    })
    expect(terminalMocks.latest?.write).not.toHaveBeenCalledWith('welcome')

    await act(async () => {
      vi.advanceTimersByTime(50)
      await Promise.resolve()
      await Promise.resolve()
    })

    const snapshotWrites = terminalMocks.latest?.write.mock.calls
      .filter(call => call[0] === 'welcome') ?? []

    expect(snapshotWrites).toHaveLength(1)
  })
})
