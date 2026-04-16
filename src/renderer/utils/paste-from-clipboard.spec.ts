// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pasteFromClipboard } from './paste-from-clipboard'
import { useAppStore, useImageStore, usePendingMediaStore } from '../stores'

vi.mock('../stores/display-writer-registry', () => ({
  writeToDisplay: vi.fn()
}))
import { writeToDisplay } from '../stores/display-writer-registry'

function makeClipboardItem(type: string, blob: Blob): ClipboardItem {
  return {
    types: [type],
    getType: (t: string) => (t === type ? Promise.resolve(blob) : Promise.reject())
  } as unknown as ClipboardItem
}

async function flushMicrotasks() {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

describe('pasteFromClipboard', () => {
  beforeEach(() => {
    useAppStore.setState({ terminals: [] })
    useImageStore.setState({ images: {} })
    usePendingMediaStore.getState().clear('t1')

    vi.stubGlobal('electron', {
      terminal: { write: vi.fn() },
      clipboard: { saveImage: vi.fn().mockResolvedValue('/tmp/pasted.png') }
    })

    class FakeFileReader {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      result = 'data:image/png;base64,AAAA'
      readAsDataURL() {
        Promise.resolve().then(() => this.onload?.())
      }
    }
    vi.stubGlobal('FileReader', FakeFileReader)
  })

  it('writes plain text via terminal.write when clipboard has only text', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        read: vi.fn().mockResolvedValue([]),
        readText: vi.fn().mockResolvedValue('hello')
      }
    })

    await pasteFromClipboard('t1')
    await flushMicrotasks()

    expect(window.electron.terminal.write).toHaveBeenCalledWith('t1', 'hello')
  })

  it('saves image via electron.clipboard.saveImage when clipboard has image', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    vi.stubGlobal('navigator', {
      clipboard: {
        read: vi.fn().mockResolvedValue([makeClipboardItem('image/png', blob)]),
        readText: vi.fn()
      }
    })

    await pasteFromClipboard('t1')
    await flushMicrotasks()

    expect(window.electron.clipboard.saveImage).toHaveBeenCalledWith('AAAA')
  })

  it('writes path directly in Claude mode', async () => {
    useAppStore.setState({
      terminals: [{ id: 't1', pid: 1, projectId: 'p1', createdAt: new Date(), isClaudeMode: true } as never]
    })
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' })
    vi.stubGlobal('navigator', {
      clipboard: {
        read: vi.fn().mockResolvedValue([makeClipboardItem('image/png', blob)]),
        readText: vi.fn()
      }
    })

    await pasteFromClipboard('t1')
    await flushMicrotasks()

    expect(window.electron.terminal.write).toHaveBeenCalled()
    const args = (window.electron.terminal.write as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(args[0]).toBe('t1')
    expect(String(args[1])).toMatch(/pasted\.png/)
  })

  it('writes media token in non-Claude mode', async () => {
    useAppStore.setState({
      terminals: [{ id: 't1', pid: 1, projectId: 'p1', createdAt: new Date(), isClaudeMode: false } as never]
    })
    const blob = new Blob([new Uint8Array([1])], { type: 'image/png' })
    vi.stubGlobal('navigator', {
      clipboard: {
        read: vi.fn().mockResolvedValue([makeClipboardItem('image/png', blob)]),
        readText: vi.fn()
      }
    })

    await pasteFromClipboard('t1')
    await flushMicrotasks()

    expect(writeToDisplay).toHaveBeenCalled()
    const call = (writeToDisplay as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('t1')
    expect(String(call[1])).toMatch(/\[Image 1\]/)
  })

  it('falls back to readText when clipboard.read rejects', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        read: vi.fn().mockRejectedValue(new Error('blocked')),
        readText: vi.fn().mockResolvedValue('fallback text')
      }
    })

    await pasteFromClipboard('t1')
    await flushMicrotasks()

    expect(window.electron.terminal.write).toHaveBeenCalledWith('t1', 'fallback text')
  })

  it('calls followLiveOutput callback before writing', async () => {
    const follow = vi.fn()
    vi.stubGlobal('navigator', {
      clipboard: {
        read: vi.fn().mockResolvedValue([]),
        readText: vi.fn().mockResolvedValue('x')
      }
    })

    await pasteFromClipboard('t1', follow)
    await flushMicrotasks()

    expect(follow).toHaveBeenCalled()
  })

  it('no-op when clipboard empty (no text, no image)', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        read: vi.fn().mockResolvedValue([]),
        readText: vi.fn().mockResolvedValue('')
      }
    })

    await pasteFromClipboard('t1')
    await flushMicrotasks()

    expect(window.electron.terminal.write).not.toHaveBeenCalled()
  })

  it('normalizes CRLF and lone CR to LF (Windows clipboard safety)', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        read: vi.fn().mockResolvedValue([]),
        readText: vi.fn().mockResolvedValue('a\r\nb\rc')
      }
    })

    await pasteFromClipboard('t1')
    await flushMicrotasks()

    // Without bracketed paste, a plain single write goes through — with LF-only.
    expect(window.electron.terminal.write).toHaveBeenCalledWith('t1', 'a\nb\nc')
  })

  it('wraps payload in bracketed paste sentinels when xterm has bracketedPasteMode on', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        read: vi.fn().mockResolvedValue([]),
        readText: vi.fn().mockResolvedValue('foo\nbar')
      }
    })
    const term = { modes: { bracketedPasteMode: true } } as unknown as import('@xterm/xterm').Terminal

    await pasteFromClipboard('t1', undefined, term)
    await flushMicrotasks()

    const calls = (window.electron.terminal.write as ReturnType<typeof vi.fn>).mock.calls
    const combined = calls.map((c) => c[1]).join('')
    expect(combined).toBe('\x1b[200~foo\nbar\x1b[201~')
  })

  it('does not wrap when bracketedPasteMode is off', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        read: vi.fn().mockResolvedValue([]),
        readText: vi.fn().mockResolvedValue('foo')
      }
    })
    const term = { modes: { bracketedPasteMode: false } } as unknown as import('@xterm/xterm').Terminal

    await pasteFromClipboard('t1', undefined, term)
    await flushMicrotasks()

    expect(window.electron.terminal.write).toHaveBeenCalledWith('t1', 'foo')
  })

  it('chunks large pastes (> 64 KB) into multiple writes, preserving content', async () => {
    // Use a 150 KB payload to force ≥3 content chunks (chunk size 64 KB).
    const payload = 'x'.repeat(150 * 1024)
    vi.stubGlobal('navigator', {
      clipboard: {
        read: vi.fn().mockResolvedValue([]),
        readText: vi.fn().mockResolvedValue(payload)
      }
    })

    await pasteFromClipboard('t1')
    await flushMicrotasks()
    // Wait for any setTimeout-scheduled chunks (100 iterations of microtasks +
    // a macrotask tick covers typical yields).
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 0))
    }

    const calls = (window.electron.terminal.write as ReturnType<typeof vi.fn>).mock.calls
    const writes = calls.filter((c) => c[0] === 't1').map((c) => c[1] as string)
    expect(writes.length).toBeGreaterThanOrEqual(3)
    expect(writes.join('')).toBe(payload)
  })

  it('strips inner paste-bracket sentinels from attacker-controlled clipboard (escape injection)', async () => {
    // A malicious clipboard could include \x1b[201~ to close the wrapper
    // region early, turning the suffix into typed shell input. We strip both
    // sentinels from the body before wrapping.
    vi.stubGlobal('navigator', {
      clipboard: {
        read: vi.fn().mockResolvedValue([]),
        readText: vi.fn().mockResolvedValue('safe\x1b[201~rm -rf ~\n\x1b[200~tail')
      }
    })
    const term = { modes: { bracketedPasteMode: true } } as unknown as import('@xterm/xterm').Terminal

    await pasteFromClipboard('t1', undefined, term)
    await flushMicrotasks()

    const calls = (window.electron.terminal.write as ReturnType<typeof vi.fn>).mock.calls
    const combined = calls.map((c) => c[1]).join('')
    // Exactly one start and one end sentinel — attacker's injected ones are gone.
    expect((combined.match(/\x1b\[200~/g) ?? []).length).toBe(1)
    expect((combined.match(/\x1b\[201~/g) ?? []).length).toBe(1)
    expect(combined.startsWith('\x1b[200~')).toBe(true)
    expect(combined.endsWith('\x1b[201~')).toBe(true)
  })

  it('chunks with bracketed paste: sentinels bookend the whole payload, not each chunk', async () => {
    const payload = 'y'.repeat(150 * 1024)
    vi.stubGlobal('navigator', {
      clipboard: {
        read: vi.fn().mockResolvedValue([]),
        readText: vi.fn().mockResolvedValue(payload)
      }
    })
    const term = { modes: { bracketedPasteMode: true } } as unknown as import('@xterm/xterm').Terminal

    await pasteFromClipboard('t1', undefined, term)
    await flushMicrotasks()
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 0))
    }

    const writes = (window.electron.terminal.write as ReturnType<typeof vi.fn>).mock.calls
      .filter((c) => c[0] === 't1')
      .map((c) => c[1] as string)
    const combined = writes.join('')
    expect(combined.startsWith('\x1b[200~')).toBe(true)
    expect(combined.endsWith('\x1b[201~')).toBe(true)
    // Only one start and one end sentinel overall.
    expect((combined.match(/\x1b\[200~/g) ?? []).length).toBe(1)
    expect((combined.match(/\x1b\[201~/g) ?? []).length).toBe(1)
  })
})
