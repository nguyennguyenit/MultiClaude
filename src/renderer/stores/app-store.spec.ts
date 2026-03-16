import { beforeEach, describe, expect, it } from 'vitest'
import { TERMINAL_OUTPUT_BUFFER_MAX, TERMINAL_OUTPUT_BUFFER_TRIM_TO } from '@shared/constants'
import type { Terminal } from '@shared/types'
import { useAppStore } from './app-store'

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

describe('useAppStore terminal output buffering', () => {
  beforeEach(() => {
    useAppStore.setState(initialState, true)
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

  it('trims buffered output to the configured limit', () => {
    useAppStore.getState().addTerminal(makeTerminal())

    const oversizedChunk = 'x'.repeat(TERMINAL_OUTPUT_BUFFER_MAX + 25)
    useAppStore.getState().appendOutput('term-1', oversizedChunk)

    expect(useAppStore.getState().getTerminalOutput('term-1')).toHaveLength(TERMINAL_OUTPUT_BUFFER_TRIM_TO)
  })
})
