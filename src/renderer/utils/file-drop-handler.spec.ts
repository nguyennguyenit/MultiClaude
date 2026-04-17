import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolvePreferredDropTerminalId, writePathsToTerminal } from './file-drop-handler'
import { useAppStore, useImageStore } from '../stores'

describe('file-drop-handler', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    useAppStore.setState({ terminals: [] })
    useImageStore.setState({ images: {} })
  })

  it('prefers the drag target terminal over the active terminal', () => {
    expect(resolvePreferredDropTerminalId('terminal-active', 'terminal-hovered')).toBe('terminal-hovered')
    expect(resolvePreferredDropTerminalId('terminal-active', null)).toBe('terminal-active')
    expect(resolvePreferredDropTerminalId(null, null)).toBeNull()
  })

  it('writes every path straight to PTY in non-Claude mode and mirrors media into the strip', () => {
    const write = vi.fn()
    vi.stubGlobal('window', {
      electron: { terminal: { write } }
    })
    useAppStore.setState({
      terminals: [{ id: 'terminal-2', pid: 1, projectId: 'p', createdAt: new Date(), isClaudeMode: false } as never]
    })

    writePathsToTerminal('terminal-2', ['/tmp/needs quotes/image 1.png', '/tmp/notes.txt'])

    expect(write).toHaveBeenCalledWith('terminal-2', '"/tmp/needs quotes/image 1.png" ')
    expect(write).toHaveBeenCalledWith('terminal-2', '/tmp/notes.txt ')
    // Image path is mirrored into the attachment strip for the thumbnail preview.
    expect(useImageStore.getState().getImages('terminal-2')).toHaveLength(1)
  })

  it('Claude mode drops send all paths in one backslash-escaped write and track thumbnails', () => {
    const write = vi.fn()
    vi.stubGlobal('window', {
      electron: { terminal: { write } }
    })
    useAppStore.setState({
      terminals: [{ id: 'terminal-2', pid: 1, projectId: 'p', createdAt: new Date(), isClaudeMode: true } as never]
    })

    writePathsToTerminal('terminal-2', ['/tmp/a.png', '/tmp/needs space/b.mp4'])

    // Single plain write with backslash-escaped spaces so Claude renders
    // the paths inline in the prompt (quoted paths would hit its auto-
    // attach path and hide the text below the status bar).
    expect(write).toHaveBeenCalledWith('terminal-2', '/tmp/a.png /tmp/needs\\ space/b.mp4 ')
    // Both media files are mirrored into the attachment strip so the user
    // can still see what's queued and remove items via the tile buttons.
    expect(useImageStore.getState().getImages('terminal-2')).toHaveLength(2)
  })
})
