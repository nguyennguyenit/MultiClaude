// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { Terminal } from '@shared/types'
import { useAppStore, useImageStore } from '../../stores'
import { resetBufferedTerminalOutputForTests } from '../../stores/terminal-output-buffer'

vi.mock('./terminal-view', () => ({
  TerminalView: ({ initialOutput }: { initialOutput?: string }) => (
    <div data-terminal-view="true" data-initial-output={initialOutput ?? ''} />
  )
}))

vi.mock('../../hooks/use-file-drop', () => ({
  useFileDrop: () => ({
    isDragOver: false,
    dropHandlers: {}
  })
}))

import { TerminalPane } from './terminal-pane'

const initialState = useAppStore.getState()

function makeTerminal(id = 'term-1'): Terminal {
  return {
    id,
    title: 'Terminal 1',
    cwd: '/tmp/project',
    isClaudeMode: false,
    projectId: 'project-1',
    createdAt: new Date().toISOString()
  }
}

describe('TerminalPane', () => {
  beforeEach(() => {
    resetBufferedTerminalOutputForTests()
    useAppStore.setState(initialState, true)
    useImageStore.setState({ images: {} })
    useAppStore.getState().addTerminal(makeTerminal())
    useAppStore.getState().appendOutput('term-1', 'restored buffer')
  })

  afterEach(() => {
    cleanup()
  })

  it('rehydrates buffered output from store when remounted without explicit initialOutput', () => {
    const html = renderToStaticMarkup(
      <TerminalPane
        terminalId="term-1"
        title="Terminal 1"
        isActive
        onActivate={() => {}}
        onClose={() => {}}
      />
    )

    expect(html).toContain('data-initial-output="restored buffer"')
  })

  it('prefers explicit initialOutput when provided', () => {
    const html = renderToStaticMarkup(
      <TerminalPane
        terminalId="term-1"
        title="Terminal 1"
        isActive
        initialOutput="explicit output"
        onActivate={() => {}}
        onClose={() => {}}
      />
    )

    expect(html).toContain('data-initial-output="explicit output"')
  })

  it('renders AttachmentStrip with image entries for this terminal', () => {
    useImageStore.getState().addImage('term-1', '/path/cat.png', 'image')
    ;(window as unknown as { electron: { media: { readDataUrl: (p: string) => Promise<string | null> } } }).electron = {
      media: { readDataUrl: () => Promise.resolve(null) }
    }
    const { container, getByTitle } = render(
      <TerminalPane
        terminalId="term-1"
        title="Terminal 1"
        isActive
        onActivate={() => {}}
        onClose={() => {}}
      />
    )
    expect(container.querySelector('.attachment-strip')).not.toBeNull()
    expect(getByTitle('cat.png')).toBeTruthy()
  })

  it('does not render AttachmentStrip when terminal has no entries', () => {
    ;(window as unknown as { electron: { media: { readDataUrl: (p: string) => Promise<string | null> } } }).electron = {
      media: { readDataUrl: () => Promise.resolve(null) }
    }
    const { container } = render(
      <TerminalPane
        terminalId="term-1"
        title="Terminal 1"
        isActive
        onActivate={() => {}}
        onClose={() => {}}
      />
    )
    expect(container.querySelector('.attachment-strip')).toBeNull()
  })

})
