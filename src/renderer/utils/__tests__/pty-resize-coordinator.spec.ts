// @vitest-environment jsdom
/**
 * Tests for pty-resize-coordinator — the single chokepoint for SIGWINCH traffic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  sendPtyResize,
  clearPtyMaxCols,
  _getPtyMaxColsForTests,
  _resetForTests,
} from '../pty-resize-coordinator'

function stubElectronTerminal() {
  const resize = vi.fn()
  const resizeHeadless = vi.fn()
  vi.stubGlobal('electron', { terminal: { resize, resizeHeadless } })
  return { resize, resizeHeadless }
}

describe('pty-resize-coordinator', () => {
  beforeEach(() => {
    _resetForTests()
    vi.unstubAllGlobals()
  })

  it('normal-buffer resize updates only the headless mirror', () => {
    const ipc = stubElectronTerminal()
    const r = sendPtyResize({ terminalId: 't1', xtermCols: 80, rows: 24, isAlt: false })
    expect(r.sentCols).toBe(80)
    expect(r.decoupled).toBe(false)
    expect(r.skipped).toBe(true)
    expect(ipc.resize).not.toHaveBeenCalled()
    expect(ipc.resizeHeadless).toHaveBeenCalledWith('t1', 80, 24)
  })

  it('normal-buffer shrink does not send SIGWINCH to the PTY', () => {
    const ipc = stubElectronTerminal()
    sendPtyResize({ terminalId: 't1', xtermCols: 100, rows: 30, isAlt: false })
    const r = sendPtyResize({ terminalId: 't1', xtermCols: 30, rows: 30, isAlt: false })
    expect(r.sentCols).toBe(30)
    expect(r.decoupled).toBe(false)
    expect(r.skipped).toBe(true)
    expect(ipc.resize).not.toHaveBeenCalled()
    expect(ipc.resizeHeadless).toHaveBeenLastCalledWith('t1', 30, 30)
  })

  it('normal-buffer widen does not send SIGWINCH to the PTY', () => {
    const ipc = stubElectronTerminal()
    sendPtyResize({ terminalId: 't1', xtermCols: 80, rows: 24, isAlt: false })
    const r = sendPtyResize({ terminalId: 't1', xtermCols: 120, rows: 24, isAlt: false })
    expect(r.sentCols).toBe(120)
    expect(r.decoupled).toBe(false)
    expect(r.skipped).toBe(true)
    expect(ipc.resize).not.toHaveBeenCalled()
    expect(ipc.resizeHeadless).toHaveBeenLastCalledWith('t1', 120, 24)
  })

  it('skips Claude normal-buffer SIGWINCH to avoid inline redraw duplication', () => {
    const ipc = stubElectronTerminal()
    const r = sendPtyResize({
      terminalId: 't1',
      xtermCols: 40,
      rows: 20,
      isAlt: false,
      isClaudeMode: true,
    })

    expect(r.sentCols).toBe(40)
    expect(r.decoupled).toBe(false)
    expect(r.skipped).toBe(true)
    expect(ipc.resize).not.toHaveBeenCalled()
    expect(ipc.resizeHeadless).toHaveBeenCalledWith('t1', 40, 20)
  })

  it('alt-screen also syncs cols 1:1', () => {
    const ipc = stubElectronTerminal()
    sendPtyResize({ terminalId: 't1', xtermCols: 100, rows: 30, isAlt: false })
    const r = sendPtyResize({ terminalId: 't1', xtermCols: 40, rows: 30, isAlt: true, isClaudeMode: true })
    expect(r.sentCols).toBe(40)
    expect(r.decoupled).toBe(false)
    expect(r.skipped).toBe(false)
    expect(ipc.resize).toHaveBeenLastCalledWith('t1', 40, 30)
  })

  it('does not retain per-terminal high-water cols', () => {
    stubElectronTerminal()
    sendPtyResize({ terminalId: 't1', xtermCols: 80, rows: 24, isAlt: false })
    expect(_getPtyMaxColsForTests('t1')).toBeUndefined()
  })

  it('clearPtyMaxCols is safe after exact resizes', () => {
    stubElectronTerminal()
    sendPtyResize({ terminalId: 't1', xtermCols: 100, rows: 30, isAlt: false })
    clearPtyMaxCols('t1')
    expect(_getPtyMaxColsForTests('t1')).toBeUndefined()
  })

  it('exit alt-screen at narrow width: next normal-buffer resize remains exact', () => {
    const ipc = stubElectronTerminal()
    sendPtyResize({ terminalId: 't1', xtermCols: 100, rows: 30, isAlt: false })
    sendPtyResize({ terminalId: 't1', xtermCols: 40, rows: 30, isAlt: true })
    expect(ipc.resize).toHaveBeenLastCalledWith('t1', 40, 30)
    sendPtyResize({ terminalId: 't1', xtermCols: 40, rows: 30, isAlt: false })
    expect(ipc.resize).toHaveBeenCalledTimes(1)
    expect(ipc.resizeHeadless).toHaveBeenLastCalledWith('t1', 40, 30)
  })
})
