/**
 * useTerminalScrollback — keeps the live xterm scrollback option in sync
 * with the user's scrollbackLines setting.
 *
 * xterm.js allows setting `terminal.options.scrollback` on an existing
 * instance, which immediately applies (buffer grows, or trims oldest lines
 * when shrunk). No PTY recreation required.
 */
import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { Terminal as XTerm } from '@xterm/xterm'
import { useSettingsStore } from '../stores'
import { clampScrollback } from './use-terminal-init'

interface UseTerminalScrollbackParams {
  terminalRef: RefObject<XTerm | null>
  disposedRef: RefObject<boolean>
}

export function useTerminalScrollback({ terminalRef, disposedRef }: UseTerminalScrollbackParams): void {
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe((state, prevState) => {
      if (!terminalRef.current || disposedRef.current) return
      if (state.pendingSettings.scrollbackLines === prevState.pendingSettings.scrollbackLines) return

      terminalRef.current.options.scrollback = clampScrollback(state.pendingSettings.scrollbackLines)
    })
    return unsubscribe
  }, [disposedRef, terminalRef])
}
