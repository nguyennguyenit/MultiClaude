import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Terminal } from '@shared/types'
import { useAppStore } from '../../stores'
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
    useAppStore.getState().addTerminal(makeTerminal())
    useAppStore.getState().appendOutput('term-1', 'restored buffer')
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

})
