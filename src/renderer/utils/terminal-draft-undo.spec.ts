import { describe, expect, it } from 'vitest'
import { createTerminalDraftUndo } from './terminal-draft-undo'

describe('terminal draft undo', () => {
  it('undoes typed draft text one snapshot at a time', () => {
    const draft = createTerminalDraftUndo()

    draft.recordInput('a')
    draft.recordInput('b')
    draft.recordInput('c')

    expect(draft.canUndo()).toBe(true)
    expect(draft.undo()).toEqual({ draft: 'ab', sequence: '\x7f\x7f\x7fab' })
    expect(draft.undo()).toEqual({ draft: 'a', sequence: '\x7f\x7fa' })
    expect(draft.undo()).toEqual({ draft: '', sequence: '\x7f' })
    expect(draft.undo()).toBeNull()
  })

  it('treats grouped input as one undo unit', () => {
    const draft = createTerminalDraftUndo()

    draft.recordInput('run ')
    draft.recordInput('--help', { grouped: true })

    expect(draft.undo()).toEqual({ draft: 'run ', sequence: '\x7f\x7f\x7f\x7f\x7f\x7f\x7f\x7f\x7f\x7frun ' })
  })

  it('can undo a backspace by replacing the current draft', () => {
    const draft = createTerminalDraftUndo()

    draft.recordInput('a')
    draft.recordInput('b')
    draft.recordBackspace()

    expect(draft.current()).toBe('a')
    expect(draft.undo()).toEqual({ draft: 'ab', sequence: '\x7fab' })
  })

  it('resets undo history on submitted or cancelled input', () => {
    const draft = createTerminalDraftUndo()

    draft.recordInput('abc')
    draft.reset()

    expect(draft.current()).toBe('')
    expect(draft.canUndo()).toBe(false)
    expect(draft.undo()).toBeNull()
  })

  it('clears tracking for unsupported control data', () => {
    const draft = createTerminalDraftUndo()

    draft.recordInput('abc')
    draft.recordTerminalData('\x1b[D')

    expect(draft.current()).toBe('')
    expect(draft.canUndo()).toBe(false)
  })

  it('tracks terminal data after filtering commit and cancel controls', () => {
    const draft = createTerminalDraftUndo()

    draft.recordTerminalData('a')
    draft.recordTerminalData('\x7f')
    draft.recordTerminalData('bc')
    expect(draft.current()).toBe('bc')

    draft.recordTerminalData('\r')
    expect(draft.current()).toBe('')
    expect(draft.canUndo()).toBe(false)

    draft.recordTerminalData('x')
    draft.recordTerminalData('\x03')
    expect(draft.current()).toBe('')
    expect(draft.canUndo()).toBe(false)
  })
})
