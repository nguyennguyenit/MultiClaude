export interface TerminalKeyboardEnhancementState {
  supported: boolean
  flags: number
  stack: number[]
  pendingSequence: string
}

export interface ProcessKeyboardEnhancementResult {
  visibleData: string
  responses: string[]
  nextState: TerminalKeyboardEnhancementState
}

export const INITIAL_KEYBOARD_ENHANCEMENT_STATE: TerminalKeyboardEnhancementState = {
  supported: false,
  flags: 0,
  stack: [],
  pendingSequence: ''
}

const KEYBOARD_ENHANCEMENT_SEQUENCE_REGEX = /\x1b\[\?u|\x1b\[>(\d+)u|\x1b\[<(\d*)u/g
const PARTIAL_SEQUENCE_REGEX = /\x1b(?:\[[><?]?[0-9;]*)?$/

function cloneState(state: TerminalKeyboardEnhancementState): TerminalKeyboardEnhancementState {
  return {
    supported: state.supported,
    flags: state.flags,
    stack: [...state.stack],
    pendingSequence: state.pendingSequence
  }
}

export function isTerminalKeyboardEnhancementEnabled(state: TerminalKeyboardEnhancementState): boolean {
  return state.supported || state.flags > 0
}

export function getCsiUEnterSequence(event: Pick<KeyboardEvent, 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>): string | null {
  if (!event.shiftKey) return null

  const modifier =
    (event.shiftKey ? 1 : 0) |
    (event.altKey ? 2 : 0) |
    (event.ctrlKey ? 4 : 0) |
    (event.metaKey ? 8 : 0)

  return `\x1b[13;${modifier + 1}u`
}

export function isTerminalKeyboardEnhancementStateEqual(
  left: TerminalKeyboardEnhancementState,
  right: TerminalKeyboardEnhancementState
): boolean {
  if (
    left.supported !== right.supported ||
    left.flags !== right.flags ||
    left.pendingSequence !== right.pendingSequence
  ) {
    return false
  }

  if (left.stack.length !== right.stack.length) {
    return false
  }

  return left.stack.every((value, index) => value === right.stack[index])
}

export function processTerminalKeyboardEnhancementData(
  data: string,
  state: TerminalKeyboardEnhancementState
): ProcessKeyboardEnhancementResult {
  const nextState = cloneState(state)
  const responses: string[] = []
  const combinedData = `${state.pendingSequence}${data}`

  const partialSequenceMatch = combinedData.match(PARTIAL_SEQUENCE_REGEX)
  const partialSequence = partialSequenceMatch && partialSequenceMatch[0].startsWith('\x1b[')
    ? partialSequenceMatch[0]
    : combinedData.endsWith('\x1b')
      ? '\x1b'
      : ''

  const visibleChunk = partialSequence
    ? combinedData.slice(0, combinedData.length - partialSequence.length)
    : combinedData

  const visibleData = visibleChunk.replace(KEYBOARD_ENHANCEMENT_SEQUENCE_REGEX, (_match, pushedFlags, popCount) => {
    nextState.supported = true

    if (pushedFlags !== undefined) {
      nextState.stack.push(nextState.flags)
      nextState.flags = Number.parseInt(pushedFlags, 10) || 0
      return ''
    }

    if (popCount !== undefined) {
      const count = popCount ? Math.max(1, Number.parseInt(popCount, 10) || 1) : 1
      for (let index = 0; index < count; index += 1) {
        nextState.flags = nextState.stack.pop() ?? 0
      }
      return ''
    }

    responses.push(`\x1b[?${nextState.flags}u`)
    return ''
  })

  nextState.pendingSequence = partialSequence

  return {
    visibleData,
    responses,
    nextState
  }
}
