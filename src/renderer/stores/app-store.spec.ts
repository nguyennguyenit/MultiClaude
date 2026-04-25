import { beforeEach, describe, expect, it } from 'vitest'
import { TERMINAL_OUTPUT_BUFFER_MAX, TERMINAL_OUTPUT_BUFFER_TRIM_TO } from '@shared/constants'
import type { Terminal } from '@shared/types'
import { useAppStore } from './app-store'
import { resetBufferedTerminalOutputForTests } from './terminal-output-buffer'

const initialState = useAppStore.getState()

function makeTerminal(id = 'term-1', projectId = 'project-1'): Terminal {
  return {
    id,
    title: 'Terminal 1',
    cwd: '/tmp/project',
    isClaudeMode: false,
    projectId,
    createdAt: new Date().toISOString()
  }
}

describe('useAppStore terminal output buffering', () => {
  beforeEach(() => {
    resetBufferedTerminalOutputForTests()
    useAppStore.setState(initialState, true)
  })

  it('updateTerminalTaskStatus sets taskStatus on the matching terminal only', () => {
    useAppStore.getState().addTerminal(makeTerminal('term-a'))
    useAppStore.getState().addTerminal(makeTerminal('term-b'))

    useAppStore.getState().updateTerminalTaskStatus('term-a', 'running')
    expect(useAppStore.getState().terminals.find((t) => t.id === 'term-a')?.taskStatus).toBe('running')
    expect(useAppStore.getState().terminals.find((t) => t.id === 'term-b')?.taskStatus).toBeUndefined()

    useAppStore.getState().updateTerminalTaskStatus('term-a', 'failed')
    expect(useAppStore.getState().terminals.find((t) => t.id === 'term-a')?.taskStatus).toBe('failed')
  })

  it('keeps terminal metadata stable when appending output', () => {
    useAppStore.getState().addTerminal(makeTerminal())

    const terminalsBeforeAppend = useAppStore.getState().terminals

    useAppStore.getState().appendOutput('term-1', 'hello world')

    expect(useAppStore.getState().getTerminalOutput('term-1')).toBe('hello world')
    expect(useAppStore.getState().terminals).toBe(terminalsBeforeAppend)
  })

  it('clears buffered output when removing a terminal', () => {
    useAppStore.getState().addTerminal(makeTerminal())
    useAppStore.getState().appendOutput('term-1', 'buffered output')

    useAppStore.getState().removeTerminal('term-1')

    expect(useAppStore.getState().getTerminalOutput('term-1')).toBe('')
  })

  it('clears keyboard enhancement state when removing a terminal', () => {
    useAppStore.getState().addTerminal(makeTerminal())
    useAppStore.getState().setTerminalKeyboardEnhancement('term-1', {
      supported: true,
      flags: 9,
      stack: [0],
      pendingSequence: ''
    })

    useAppStore.getState().removeTerminal('term-1')

    expect(useAppStore.getState().getTerminalKeyboardEnhancement('term-1')).toBeNull()
  })

  it('trims buffered output to the configured limit', () => {
    useAppStore.getState().addTerminal(makeTerminal())

    const oversizedChunk = 'x'.repeat(TERMINAL_OUTPUT_BUFFER_MAX + 25)
    useAppStore.getState().appendOutput('term-1', oversizedChunk)

    expect(useAppStore.getState().getTerminalOutput('term-1')).toHaveLength(TERMINAL_OUTPUT_BUFFER_TRIM_TO)
  })

  it('restores the last active terminal when switching back to a project', () => {
    useAppStore.getState().addTerminal(makeTerminal('term-a', 'project-a'))
    useAppStore.getState().addTerminal(makeTerminal('term-b', 'project-a'))
    useAppStore.getState().addTerminal(makeTerminal('term-c', 'project-b'))

    useAppStore.getState().setActiveTerminal('term-a')
    useAppStore.getState().switchToProject('project-b')
    useAppStore.getState().setActiveTerminal('term-c')

    useAppStore.getState().switchToProject('project-a')

    expect(useAppStore.getState().activeProjectId).toBe('project-a')
    expect(useAppStore.getState().activeTerminalId).toBe('term-a')
  })

  it('falls back to another terminal in the same project when the last active one is removed', () => {
    useAppStore.getState().setActiveProject('project-a')
    useAppStore.getState().addTerminal(makeTerminal('term-a', 'project-a'))
    useAppStore.getState().addTerminal(makeTerminal('term-b', 'project-a'))

    useAppStore.getState().setActiveTerminal('term-b')
    useAppStore.getState().removeTerminal('term-b')

    expect(useAppStore.getState().activeTerminalId).toBe('term-a')

    useAppStore.getState().switchToProject('project-a')

    expect(useAppStore.getState().activeTerminalId).toBe('term-a')
  })

  it('updates Claude mode metadata for an existing terminal', () => {
    useAppStore.getState().addTerminal(makeTerminal())

    const state = useAppStore.getState() as typeof useAppStore.getState extends () => infer T
      ? T & { updateTerminalClaudeMode?: (id: string, isClaudeMode: boolean) => void }
      : never

    expect(typeof state.updateTerminalClaudeMode).toBe('function')

    state.updateTerminalClaudeMode?.('term-1', true)

    expect(useAppStore.getState().terminals[0]?.isClaudeMode).toBe(true)
  })
})
