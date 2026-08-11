// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { TerminalView } from './terminal-view'
import { registerTerminalOutputHandler } from '../../utils/terminal-output-dispatcher'

const terminalHook = vi.hoisted(() => ({
  initTerminal: vi.fn(),
  write: vi.fn(),
  fit: vi.fn(),
  focus: vi.fn(),
  blur: vi.fn(),
  showCursor: vi.fn(),
  restoreActiveRender: vi.fn(),
  refresh: vi.fn(),
  scrollToTop: vi.fn(),
  scrollToBottom: vi.fn(),
  getViewportSnapshot: vi.fn(() => ({ viewportY: null, isAtBottom: true })),
  terminalRef: { current: null },
  containerRef: { current: null },
  sessionToken: Symbol('terminal-view-test-session')
}))

vi.mock('../../hooks/use-terminal', () => ({
  useTerminal: () => terminalHook
}))

vi.mock('../../utils/terminal-output-dispatcher', () => ({
  registerTerminalOutputHandler: vi.fn(() => vi.fn())
}))

describe('TerminalView activation render restore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('repaints the terminal when it becomes active', () => {
    render(<TerminalView terminalId="term-1" isActive />)

    expect(terminalHook.focus).toHaveBeenCalled()
    expect(terminalHook.restoreActiveRender).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)

    expect(terminalHook.restoreActiveRender).toHaveBeenCalledTimes(1)
    expect(terminalHook.showCursor).toHaveBeenCalled()
  })

  it('repaints the active terminal when the app window regains focus', () => {
    render(<TerminalView terminalId="term-1" isActive />)
    vi.clearAllMocks()

    window.dispatchEvent(new Event('focus'))

    expect(terminalHook.focus).toHaveBeenCalled()
    expect(terminalHook.restoreActiveRender).toHaveBeenCalled()
    expect(terminalHook.showCursor).toHaveBeenCalled()
  })

  it('lets the visibility lifecycle own repaint when an active pane project is revealed', () => {
    const view = render(<TerminalView terminalId="term-1" isActive={false} hidden />)
    vi.clearAllMocks()

    view.rerender(<TerminalView terminalId="term-1" isActive hidden={false} />)

    expect(terminalHook.focus).toHaveBeenCalled()
    expect(terminalHook.restoreActiveRender).not.toHaveBeenCalled()

    vi.advanceTimersByTime(100)

    expect(terminalHook.showCursor).toHaveBeenCalled()
  })

  it('does not repaint inactive terminals on window focus', () => {
    render(<TerminalView terminalId="term-1" isActive={false} />)
    vi.clearAllMocks()

    window.dispatchEvent(new Event('focus'))

    expect(terminalHook.restoreActiveRender).not.toHaveBeenCalled()
  })

  it('registers output delivery with the renderer session token', () => {
    render(<TerminalView terminalId="term-1" isActive />)

    expect(registerTerminalOutputHandler).toHaveBeenCalledWith(
      'term-1',
      expect.any(Function),
      expect.any(Function),
      terminalHook.sessionToken,
    )
  })
})
