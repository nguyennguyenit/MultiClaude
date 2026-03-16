import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Terminal } from '@shared/types'

vi.mock('./terminal-pane', () => ({
  TerminalPane: ({ terminalId }: { terminalId: string }) => (
    <div data-terminal-id={terminalId}>terminal-{terminalId}</div>
  )
}))

vi.mock('./terminal-resize-handle', () => ({
  ResizeHandle: () => <div data-resize-handle="true" />
}))

import { TerminalGrid } from './terminal-grid'

describe('TerminalGrid', () => {
  it('keeps existing project grids mounted when the active project has no terminals', () => {
    const terminals: Terminal[] = [
      {
        id: 'term-a',
        title: 'Terminal A',
        cwd: '/tmp/project-a',
        isClaudeMode: false,
        projectId: 'project-a',
        createdAt: new Date().toISOString()
      }
    ]

    const html = renderToStaticMarkup(
      <TerminalGrid
        terminals={terminals}
        activeProjectId="project-b"
        activeProjectPath="/tmp/project-b"
        activeTerminalId={null}
        onTerminalClick={() => {}}
        onAddTerminal={() => {}}
      />
    )

    expect(html).toContain('Terminal grid for project project-a')
    expect(html).toContain('Terminal grid for project project-b')
    expect(html).toContain('data-terminal-id="term-a"')
    expect(html).toContain('Multi Terminals')
  })
})
