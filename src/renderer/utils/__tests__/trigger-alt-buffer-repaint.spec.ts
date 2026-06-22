// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { triggerAltBufferRepaint } from '../trigger-alt-buffer-repaint'
import { sendPtyResize, _resetForTests } from '../pty-resize-coordinator'

function stubElectronTerminal() {
  const resize = vi.fn()
  vi.stubGlobal('electron', { terminal: { resize } })
  return resize
}

describe('triggerAltBufferRepaint', () => {
  beforeEach(() => {
    _resetForTests()
    vi.unstubAllGlobals()
  })

  it('does not send a duplicate normal-buffer resize at resize end', () => {
    const ipc = stubElectronTerminal()
    sendPtyResize({ terminalId: 't1', xtermCols: 120, rows: 30, isAlt: false })
    ipc.mockClear()

    triggerAltBufferRepaint('t1', {
      cols: 40,
      rows: 30,
      buffer: { active: { type: 'normal' } },
      write: vi.fn(),
    } as never)

    expect(ipc).not.toHaveBeenCalledWith('t1', 40, 30)
  })

  it('does not clear or repaint normal-buffer panes at resize end', () => {
    const ipc = stubElectronTerminal()
    const write = vi.fn()

    triggerAltBufferRepaint('t1', {
      cols: 40,
      rows: 30,
      buffer: { active: { type: 'normal' } },
      write,
    } as never)

    expect(write).not.toHaveBeenCalled()
    expect(ipc).not.toHaveBeenCalled()
  })
})
