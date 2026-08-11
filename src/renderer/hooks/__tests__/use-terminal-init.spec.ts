// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Terminal as XTerm } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { TerminalSurface } from '../../terminal/terminal-surface'
import { TerminalScrollMachine } from '../../utils/terminal-scroll-machine'

const harness = vi.hoisted(() => ({
  terminals: [] as Array<Record<string, unknown>>,
  surfaces: [] as Array<Record<string, ReturnType<typeof vi.fn>>>,
  viewports: [] as HTMLElement[],
  scrollbars: [] as HTMLElement[],
  scrollCallbacks: [] as Array<() => void>,
}))

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(function TerminalMock(options: { smoothScrollDuration?: number } = {}) {
    const terminalElement = document.createElement('div')
    const viewport = document.createElement('div')
    const scrollbar = document.createElement('div')
    viewport.className = 'xterm-scrollable-element'
    scrollbar.className = 'scrollbar vertical'
    viewport.append(scrollbar)
    terminalElement.append(viewport)
    const terminal = {
      loadAddon: vi.fn(),
      write: vi.fn((_data: string, callback?: () => void) => callback?.()),
      attachCustomKeyEventHandler: vi.fn(),
      onScroll: vi.fn((callback: () => void) => {
        harness.scrollCallbacks.push(callback)
        return { dispose: vi.fn() }
      }),
      scrollToLine: vi.fn((viewportY: number) => {
        terminal.buffer.active.viewportY = viewportY
      }),
      buffer: { active: { baseY: 0, viewportY: 0 } },
      options,
      element: terminalElement,
      textarea: null,
      cols: 80,
      rows: 24,
    }
    harness.terminals.push(terminal)
    harness.viewports.push(viewport)
    harness.scrollbars.push(scrollbar)
    return terminal
  }),
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(function FitAddonMock() {
    return { fit: vi.fn(), dispose: vi.fn() }
  }),
}))

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn(function WebLinksAddonMock() {
    return { dispose: vi.fn() }
  }),
}))

vi.mock('../../terminal/xterm-surface', () => ({
  XtermSurface: vi.fn(function XtermSurfaceMock() {
    const surface = {
      mount: vi.fn(),
      write: vi.fn().mockResolvedValue(undefined),
      onComposition: vi.fn(() => vi.fn()),
      onInput: vi.fn(() => vi.fn()),
      onResize: vi.fn(() => vi.fn()),
    }
    harness.surfaces.push(surface)
    return surface
  }),
}))

vi.mock('../use-terminal-webgl', () => ({
  acquireSnapshotReplayLock: vi.fn().mockResolvedValue(vi.fn()),
}))

import { useTerminalInit } from '../use-terminal-init'
import {
  attachTerminalOutputDispatcher,
  claimTerminalOutputSession,
  registerTerminalOutputHandler,
  resetTerminalOutputDispatcherForTests,
  resumeAndFlush,
} from '../../utils/terminal-output-dispatcher'
import type { TerminalOutputChunk, TerminalSnapshot } from '@shared/types'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

function makeParams(sessionToken: symbol) {
  const container = { offsetWidth: 800, offsetHeight: 600 } as HTMLDivElement
  return {
    terminalRef: { current: null as XTerm | null },
    surfaceRef: { current: null as TerminalSurface | null },
    fitAddonRef: { current: null as FitAddon | null },
    disposedRef: { current: false },
    containerRef: { current: container },
    terminalId: 'same-id',
    sessionToken,
    initialOutput: 'fallback',
    initialViewportY: 7,
    isActiveRef: { current: true },
    isHiddenRef: { current: false },
    scrollMachineRef: { current: new TerminalScrollMachine() },
    userViewportInteractingRef: { current: false },
    viewportListenersRef: { current: null },
    scrollDisposableRef: { current: null },
    syncViewportState: vi.fn(),
    clearUserViewportInteraction: vi.fn(),
    markUserViewportInteraction: vi.fn(),
    shouldSendEnhancedEnter: vi.fn(() => false),
    attachClipboardListeners: vi.fn(),
    getCtrlVHandler: vi.fn(() => vi.fn()),
    followLiveOutput: vi.fn(),
    reconcileWebGL: vi.fn(),
    syncFontAfterLoad: vi.fn(),
    registerTerminalDebugHandle: vi.fn(),
    onResize: vi.fn(),
  }
}

describe('useTerminalInit session ownership', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    harness.terminals.length = 0
    harness.surfaces.length = 0
    harness.viewports.length = 0
    harness.scrollbars.length = 0
    harness.scrollCallbacks.length = 0
    resetTerminalOutputDispatcherForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('prevents deferred session A hydration from painting, restoring, or resuming session B', async () => {
    const snapshot = deferred<TerminalSnapshot>()
    vi.stubGlobal('electron', {
      terminal: {
        resize: vi.fn(),
        write: vi.fn(),
        getSnapshot: vi.fn(() => snapshot.promise),
      },
      app: { openExternal: vi.fn() },
    })

    const tokenA = Symbol('A')
    const paramsA = makeParams(tokenA)
    claimTerminalOutputSession('same-id', tokenA)
    const hookA = renderHook(() => useTerminalInit(paramsA))
    act(() => hookA.result.current.initTerminal())

    await act(async () => { await vi.advanceTimersByTimeAsync(50) })
    expect(window.electron.terminal.getSnapshot).toHaveBeenCalledTimes(1)

    paramsA.disposedRef.current = true
    paramsA.terminalRef.current = null

    const tokenB = Symbol('B')
    claimTerminalOutputSession('same-id', tokenB)
    const receivedByB: string[] = []
    registerTerminalOutputHandler('same-id', data => receivedByB.push(data), undefined, tokenB)
    let emit!: (chunk: TerminalOutputChunk) => void
    attachTerminalOutputDispatcher(callback => {
      emit = callback
      return vi.fn()
    })
    emit({ terminalId: 'same-id', streamEpoch: 'epoch-b', sequence: 1, data: 'B-live' })

    await act(async () => {
      snapshot.resolve({
        terminalId: 'same-id',
        streamEpoch: 'epoch-a',
        watermark: 0,
        ansi: 'A-snapshot',
        cols: 80,
        rows: 24,
        buffer: 'normal',
      })
      await Promise.resolve()
    })

    expect(harness.surfaces[0].write).not.toHaveBeenCalled()
    expect(harness.terminals[0].scrollToLine).not.toHaveBeenCalled()
    expect(receivedByB).toEqual([])

    resumeAndFlush('same-id', tokenB)
    expect(receivedByB).toEqual(['B-live'])
  })

  it('preserves upward scrollbar intent when live output transiently reaches bottom', () => {
    vi.stubGlobal('PointerEvent', MouseEvent)
    vi.stubGlobal('electron', {
      terminal: {
        resize: vi.fn(),
        write: vi.fn(),
        getSnapshot: vi.fn(),
      },
      app: { openExternal: vi.fn() },
    })

    const params = makeParams(Symbol('scroll-drag'))
    params.markUserViewportInteraction.mockImplementation((_durationMs, direction) => {
      params.userViewportInteractingRef.current = true
      params.scrollMachineRef.current.userScrollDirection = direction ?? null
    })
    params.clearUserViewportInteraction.mockImplementation(() => {
      params.userViewportInteractingRef.current = false
      params.scrollMachineRef.current.userScrollDirection = null
    })

    const { result } = renderHook(() => useTerminalInit(params))
    act(() => result.current.initTerminal())

    const terminal = harness.terminals[0] as {
      buffer: { active: { baseY: number; viewportY: number } }
      scrollToLine: ReturnType<typeof vi.fn>
    }
    terminal.buffer.active = { baseY: 100, viewportY: 40 }
    params.scrollMachineRef.current.readingViewportIntent = {
      viewportY: 40,
      stickToBottom: false,
    }

    act(() => {
      harness.scrollbars[0].dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        clientX: 400,
        clientY: 100,
      }))
      window.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        clientX: 400,
        clientY: 50,
      }))
    })

    terminal.buffer.active.viewportY = 100
    act(() => harness.scrollCallbacks[0]())

    expect(params.scrollMachineRef.current.readingViewportIntent).toEqual({
      viewportY: 40,
      stickToBottom: false,
    })
    expect(terminal.scrollToLine).toHaveBeenLastCalledWith(40)
  })
})
