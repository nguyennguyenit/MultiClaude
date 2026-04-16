/**
 * useTerminalKeyboard — manages keyboard-enhancement state for a single xterm terminal.
 *
 * Responsibilities:
 *   - Track kitty-style keyboard enhancement protocol state per terminal
 *   - Strip enhancement responses from output stream (processKeyboardEnhancementOutput)
 *   - Report per-terminal keyboard enhancement state to AppStore
 *   - Expose shouldSendEnhancedEnter for initTerminal to attach custom key handler
 *
 * Sub-hooks must NOT import from each other; all orchestration lives in use-terminal.ts.
 */
import { useCallback, useRef } from 'react'
import type { RefObject } from 'react'
import type { Terminal as XTerm } from '@xterm/xterm'
import { useAppStore } from '../stores'
import {
  INITIAL_KEYBOARD_ENHANCEMENT_STATE,
  isTerminalKeyboardEnhancementEnabled,
  isTerminalKeyboardEnhancementStateEqual,
  processTerminalKeyboardEnhancementData,
  type TerminalKeyboardEnhancementState
} from '../utils/keyboard-enhancement-utils'

interface UseTerminalKeyboardParams {
  terminalRef: RefObject<XTerm | null>
  disposedRef: RefObject<boolean>
  terminalId: string
  /** Called when the user triggers an action that should re-anchor to live output */
  onFollowOutput: () => void
}

interface UseTerminalKeyboardResult {
  /**
   * Strip keyboard-enhancement protocol responses from a raw PTY data chunk,
   * send any protocol responses back to the PTY, and return the visible portion.
   */
  processKeyboardEnhancementOutput: (data: string) => string
  /**
   * Returns true when the terminal should send the kitty-enhanced Enter sequence
   * instead of the plain CR/LF.
   */
  shouldSendEnhancedEnter: () => boolean
  /** Stable ref to the current keyboard enhancement state — read by initTerminal */
  keyboardEnhancementStateRef: RefObject<TerminalKeyboardEnhancementState>
}

export function useTerminalKeyboard(params: UseTerminalKeyboardParams): UseTerminalKeyboardResult {
  const { terminalId } = params

  const keyboardEnhancementStateRef = useRef<TerminalKeyboardEnhancementState>(
    useAppStore.getState().getTerminalKeyboardEnhancement(terminalId) ?? INITIAL_KEYBOARD_ENHANCEMENT_STATE
  )

  const syncKeyboardEnhancementState = useCallback((nextState: TerminalKeyboardEnhancementState) => {
    if (isTerminalKeyboardEnhancementStateEqual(keyboardEnhancementStateRef.current, nextState)) return

    keyboardEnhancementStateRef.current = nextState
    useAppStore.getState().setTerminalKeyboardEnhancement(terminalId, nextState)
  }, [terminalId])

  const processKeyboardEnhancementOutput = useCallback((data: string) => {
    const result = processTerminalKeyboardEnhancementData(data, keyboardEnhancementStateRef.current)

    syncKeyboardEnhancementState(result.nextState)

    for (const response of result.responses) {
      window.electron.terminal.write(terminalId, response)
    }

    return result.visibleData
  }, [syncKeyboardEnhancementState, terminalId])

  const shouldSendEnhancedEnter = useCallback(() => {
    if (isTerminalKeyboardEnhancementEnabled(keyboardEnhancementStateRef.current)) return true

    return useAppStore.getState().terminals.some(
      terminal => terminal.id === terminalId && terminal.isClaudeMode
    )
  }, [terminalId])

  return { processKeyboardEnhancementOutput, shouldSendEnhancedEnter, keyboardEnhancementStateRef }
}
