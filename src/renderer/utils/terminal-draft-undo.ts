const DEFAULT_MAX_HISTORY = 100
const DELETE_CHARACTER = '\x7f'
const COMMIT_OR_CANCEL_DATA = new Set(['\r', '\x03'])

export interface TerminalDraftUndoOptions {
  maxHistory?: number
}

export interface TerminalDraftInputOptions {
  grouped?: boolean
}

export interface TerminalDraftUndoResult {
  draft: string
  sequence: string
}

export interface TerminalDraftUndo {
  current: () => string
  canUndo: () => boolean
  recordInput: (data: string, options?: TerminalDraftInputOptions) => void
  recordBackspace: () => void
  recordTerminalData: (data: string) => void
  reset: () => void
  undo: () => TerminalDraftUndoResult | null
}

function charLength(value: string): number {
  return [...value].length
}

function dropLastChar(value: string): string {
  const chars = [...value]
  chars.pop()
  return chars.join('')
}

function isSimpleDraftInput(data: string): boolean {
  if (data.length === 0) return false
  return [...data].every((char) => {
    const code = char.codePointAt(0) ?? 0
    if (char === '\t') return true
    return code >= 0x20 && code !== 0x7f
  })
}

export function createTerminalDraftUndo(options: TerminalDraftUndoOptions = {}): TerminalDraftUndo {
  const maxHistory = Math.max(1, Math.floor(options.maxHistory ?? DEFAULT_MAX_HISTORY))
  const history: string[] = []
  let draft = ''

  const pushSnapshot = () => {
    if (history[history.length - 1] === draft) return
    history.push(draft)
    if (history.length > maxHistory) history.shift()
  }

  const reset = () => {
    history.length = 0
    draft = ''
  }

  const recordInput = (data: string, inputOptions: TerminalDraftInputOptions = {}) => {
    if (!isSimpleDraftInput(data)) {
      reset()
      return
    }

    pushSnapshot()
    draft += data

    if (inputOptions.grouped) return
  }

  const recordBackspace = () => {
    if (!draft) {
      history.length = 0
      return
    }

    pushSnapshot()
    draft = dropLastChar(draft)
  }

  const undo = (): TerminalDraftUndoResult | null => {
    const previous = history.pop()
    if (previous === undefined) return null

    const sequence = DELETE_CHARACTER.repeat(charLength(draft)) + previous
    draft = previous
    return { draft, sequence }
  }

  const recordTerminalData = (data: string) => {
    if (COMMIT_OR_CANCEL_DATA.has(data) || data.includes('\r')) {
      reset()
      return
    }

    if (data === DELETE_CHARACTER) {
      recordBackspace()
      return
    }

    recordInput(data, { grouped: charLength(data) > 1 })
  }

  return {
    current: () => draft,
    canUndo: () => history.length > 0,
    recordInput,
    recordBackspace,
    recordTerminalData,
    reset,
    undo,
  }
}
