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
})
