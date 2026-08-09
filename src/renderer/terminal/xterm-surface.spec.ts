// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { XtermSurface } from './xterm-surface'

function makeTerminal() {
  const textarea = document.createElement('textarea')
  return {
    open: vi.fn(),
    write: vi.fn((_data: string, callback?: () => void) => callback?.()),
    reset: vi.fn(),
    resize: vi.fn(),
    focus: vi.fn(),
    getSelection: vi.fn(() => 'selected'),
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    onResize: vi.fn(() => ({ dispose: vi.fn() })),
    dispose: vi.fn(),
    textarea,
  }
}

describe('XtermSurface', () => {
  it('separates incremental writes from full snapshot replacement', async () => {
    const terminal = makeTerminal()
    const surface = new XtermSurface(terminal as never)

    await surface.write('live')
    await surface.replaceSnapshot({
      terminalId: 'term-1',
      streamEpoch: 'epoch-1',
      watermark: 1,
      ansi: 'snapshot',
      cols: 100,
      rows: 30,
      buffer: 'normal',
    })

    expect(terminal.write.mock.calls.map(call => call[0])).toEqual(['live', 'snapshot'])
    expect(terminal.reset).toHaveBeenCalledOnce()
    expect(terminal.resize).toHaveBeenCalledWith(100, 30)
  })

  it('forwards input and Vietnamese IME composition without owning a PTY', () => {
    const terminal = makeTerminal()
    const surface = new XtermSurface(terminal as never)
    const composition = vi.fn()
    const cleanup = surface.onComposition(composition)

    terminal.textarea.dispatchEvent(new CompositionEvent('compositionstart', { data: 'Tiế' }))
    terminal.textarea.dispatchEvent(new CompositionEvent('compositionend', { data: 'Tiếng Việt' }))

    expect(composition.mock.calls).toEqual([[true], [false]])
    expect(surface.capabilities).toEqual({
      selection: true,
      clipboard: true,
      imeComposition: true,
    })
    cleanup()
  })

  it('disposes registered input and composition listeners with the renderer', () => {
    const terminal = makeTerminal()
    const surface = new XtermSurface(terminal as never)
    surface.onInput(vi.fn())
    surface.onComposition(vi.fn())
    surface.onResize(vi.fn())

    surface.dispose()

    expect(terminal.onData.mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(terminal.onResize.mock.results[0].value.dispose).toHaveBeenCalledOnce()
    expect(terminal.dispose).toHaveBeenCalledOnce()
  })
})
