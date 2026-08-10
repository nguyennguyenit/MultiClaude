// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebglAddon } from '@xterm/addon-webgl'
import type { Terminal as XTerm } from '@xterm/xterm'
import { DEFAULT_SETTINGS } from '@shared/constants'
import { useAppStore, useSettingsStore } from '../../stores'
import {
  getTerminalRendererStatus,
  resetTerminalRendererStatusStoreForTests,
  retryTerminalRenderer,
} from '../../stores/terminal-renderer-status-store'
import { useTerminalWebGL } from '../use-terminal-webgl'

const webglInstances = vi.hoisted(() => [] as Array<{
  dispose: ReturnType<typeof vi.fn>
  onContextLoss: ReturnType<typeof vi.fn>
}>)

vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: vi.fn(function WebglAddonMock() {
    const addon = {
      dispose: vi.fn(),
      onContextLoss: vi.fn(() => ({ dispose: vi.fn() })),
    }
    webglInstances.push(addon)
    return addon
  }),
}))

function terminalRecord(id: string, agentType: 'generic' | 'claude' | 'codex' = 'generic') {
  return {
    id,
    title: 'private title',
    cwd: '/private/path',
    isClaudeMode: false,
    agentType,
    createdAt: new Date(),
  }
}

function makeParams(options: { active?: boolean; hidden?: boolean } = {}) {
  const terminal = {
    loadAddon: vi.fn(),
    clearTextureAtlas: vi.fn(),
    refresh: vi.fn(),
    reset: vi.fn(),
    resize: vi.fn(),
    write: vi.fn((_data: string, callback?: () => void) => callback?.()),
    rows: 24,
    cols: 80,
  }
  return {
    terminal,
    params: {
      terminalRef: { current: terminal as unknown as XTerm },
      disposedRef: { current: false },
      terminalId: 'term-1',
      sessionToken: Symbol('session'),
      isActiveRef: { current: options.active ?? true },
      isHiddenRef: { current: options.hidden ?? false },
      onRefresh: vi.fn(),
      onRefreshVisibleRows: vi.fn(),
      performFit: vi.fn(() => true),
    },
  }
}

function flushAnimationFrame(): void {
  act(() => { vi.runAllTimers() })
}

function getAddon(index = 0) {
  return webglInstances[index]
}

function fireContextLoss(addon = getAddon()): void {
  const callback = addon.onContextLoss.mock.calls[0]?.[0] as (() => void) | undefined
  expect(callback).toBeTypeOf('function')
  act(() => callback?.())
}

describe('useTerminalWebGL', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(WebglAddon).mockClear()
    webglInstances.length = 0
    resetTerminalRendererStatusStoreForTests()
    useSettingsStore.setState({
      pendingSettings: { ...DEFAULT_SETTINGS, terminalRendererPolicy: 'automatic' },
    })
    useAppStore.setState({ terminals: [terminalRecord('term-1')] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads lazily only after a generic terminal is active and visible', () => {
    const { terminal, params } = makeParams({ active: false })
    const { result } = renderHook(() => useTerminalWebGL(params))
    flushAnimationFrame()
    expect(WebglAddon).not.toHaveBeenCalled()

    params.isActiveRef.current = true
    act(() => result.current.reconcileWebGL())
    flushAnimationFrame()

    expect(WebglAddon).toHaveBeenCalledTimes(1)
    expect(terminal.loadAddon).toHaveBeenCalledWith(getAddon())
    expect(getTerminalRendererStatus('term-1')).toMatchObject({
      effective: 'webgl',
      fallbackReason: null,
    })
  })

  it('keeps a healthy addon sticky across inactive and hidden transitions', () => {
    const { params } = makeParams()
    const { result } = renderHook(() => useTerminalWebGL(params))
    flushAnimationFrame()
    const addon = getAddon()

    params.isActiveRef.current = false
    params.isHiddenRef.current = true
    act(() => result.current.reconcileWebGL())

    expect(addon.dispose).not.toHaveBeenCalled()
    expect(WebglAddon).toHaveBeenCalledTimes(1)
    expect(getTerminalRendererStatus('term-1')?.effective).toBe('webgl')
  })

  it.each([
    ['safe-dom', 'generic', 'policy-safe'],
    ['automatic', 'claude', 'automatic-agent-safe'],
    ['automatic', 'codex', 'automatic-agent-safe'],
  ] as const)('uses DOM for policy=%s agent=%s', (policy, agentType, reason) => {
    useSettingsStore.setState({
      pendingSettings: { ...DEFAULT_SETTINGS, terminalRendererPolicy: policy },
    })
    useAppStore.setState({ terminals: [terminalRecord('term-1', agentType)] })
    const { params } = makeParams()

    renderHook(() => useTerminalWebGL(params))
    flushAnimationFrame()

    expect(WebglAddon).not.toHaveBeenCalled()
    expect(getTerminalRendererStatus('term-1')).toMatchObject({
      effective: 'dom',
      fallbackReason: reason,
    })
  })

  it('reconciles a live generic-to-Codex classification change to DOM', () => {
    const { params } = makeParams()
    renderHook(() => useTerminalWebGL(params))
    flushAnimationFrame()
    const addon = getAddon()

    act(() => useAppStore.setState({ terminals: [terminalRecord('term-1', 'codex')] }))

    expect(addon.dispose).toHaveBeenCalledTimes(1)
    expect(getTerminalRendererStatus('term-1')?.fallbackReason)
      .toBe('automatic-agent-safe')
  })

  it('rechecks policy inside a queued animation frame', () => {
    const { params } = makeParams()
    renderHook(() => useTerminalWebGL(params))

    act(() => useSettingsStore.setState({
      pendingSettings: { ...DEFAULT_SETTINGS, terminalRendererPolicy: 'safe-dom' },
    }))
    flushAnimationFrame()

    expect(WebglAddon).not.toHaveBeenCalled()
    expect(getTerminalRendererStatus('term-1')?.fallbackReason).toBe('policy-safe')
  })

  it('disposes a failed candidate, suppresses re-entry, and hides raw errors', () => {
    const { terminal, params } = makeParams()
    terminal.loadAddon.mockImplementationOnce(() => {
      throw new Error('/private/GPU device')
    })
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { result } = renderHook(() => useTerminalWebGL(params))
    flushAnimationFrame()

    expect(getAddon().dispose).toHaveBeenCalledTimes(1)
    expect(result.current.webglAddonRef.current).toBeNull()
    expect(getTerminalRendererStatus('term-1')?.fallbackReason).toBe('webgl-load-failed')
    act(() => result.current.reconcileWebGL())
    flushAnimationFrame()
    expect(WebglAddon).toHaveBeenCalledTimes(1)
    expect(warning).not.toHaveBeenCalled()
  })

  it('suppresses before disposing on context loss without snapshot replay', () => {
    const { params } = makeParams()
    const { result } = renderHook(() => useTerminalWebGL(params))
    flushAnimationFrame()
    const addon = getAddon()

    fireContextLoss(addon)

    expect(addon.dispose).toHaveBeenCalledTimes(1)
    expect(params.onRefresh).not.toHaveBeenCalled()
    expect(params.onRefreshVisibleRows).toHaveBeenCalled()
    expect(params.performFit).toHaveBeenCalledWith(false)
    expect(getTerminalRendererStatus('term-1')?.fallbackReason).toBe('webgl-context-lost')

    act(() => {
      result.current.reloadWebGLForTheme()
      result.current.reconcileWebGL()
    })
    flushAnimationFrame()
    expect(WebglAddon).toHaveBeenCalledTimes(1)
  })

  it('retries only the faulted eligible terminal and preserves policy', () => {
    const { params } = makeParams()
    renderHook(() => useTerminalWebGL(params))
    flushAnimationFrame()
    fireContextLoss()

    expect(retryTerminalRenderer('other')).toBe(false)
    expect(retryTerminalRenderer('term-1')).toBe(true)
    flushAnimationFrame()

    expect(WebglAddon).toHaveBeenCalledTimes(2)
    expect(useSettingsStore.getState().pendingSettings.terminalRendererPolicy)
      .toBe('automatic')
  })

  it('does not clear a renderer fault during policy preview/cancel transitions', () => {
    const { params } = makeParams()
    const { result } = renderHook(() => useTerminalWebGL(params))
    flushAnimationFrame()
    fireContextLoss()

    act(() => useSettingsStore.setState({
      pendingSettings: { ...DEFAULT_SETTINGS, terminalRendererPolicy: 'safe-dom' },
    }))
    act(() => useSettingsStore.setState({
      pendingSettings: { ...DEFAULT_SETTINGS, terminalRendererPolicy: 'automatic' },
    }))
    act(() => result.current.reconcileWebGL())
    flushAnimationFrame()

    expect(WebglAddon).toHaveBeenCalledTimes(1)
    expect(getTerminalRendererStatus('term-1')?.fallbackReason).toBe('webgl-context-lost')
  })

  it('does not publish ownership until listener setup succeeds', () => {
    const failedCandidate = {
      dispose: vi.fn(),
      onContextLoss: vi.fn(() => { throw new Error('sensitive listener failure') }),
    }
    vi.mocked(WebglAddon).mockImplementationOnce(function FailedWebglAddonMock() {
      webglInstances.push(failedCandidate)
      return failedCandidate as never
    })
    const { params } = makeParams()
    const { result } = renderHook(() => useTerminalWebGL(params))
    flushAnimationFrame()

    expect(result.current.webglAddonRef.current).toBeNull()
    expect(getAddon().dispose).toHaveBeenCalledTimes(1)
    expect(getTerminalRendererStatus('term-1')?.fallbackReason).toBe('webgl-load-failed')
  })

  it('synchronously releases status/action and disposes on unmount', () => {
    const { params } = makeParams()
    const { unmount } = renderHook(() => useTerminalWebGL(params))
    flushAnimationFrame()
    const addon = getAddon()

    unmount()

    expect(addon.dispose).toHaveBeenCalledTimes(1)
    expect(getTerminalRendererStatus('term-1')).toBeUndefined()
    expect(retryTerminalRenderer('term-1')).toBe(false)
  })
})
