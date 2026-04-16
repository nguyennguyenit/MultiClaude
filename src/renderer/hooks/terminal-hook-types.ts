/**
 * Shared types for terminal sub-hooks.
 * Sub-hooks are orchestrated by use-terminal.ts and should not import from each other.
 */
import type { RefObject } from 'react'
import type { Terminal as XTerm } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { TerminalScrollMachine } from '../utils/terminal-scroll-machine'

export interface TerminalRefs {
  terminalRef: RefObject<XTerm | null>
  fitAddonRef: RefObject<FitAddon | null>
  disposedRef: RefObject<boolean>
}

export interface ScrollControls {
  scrollMachineRef: RefObject<TerminalScrollMachine>
  isAtBottom: boolean
  setIsAtBottom: (value: boolean) => void
  setHasScrollback: (value: boolean) => void
}

/** Generic DOM event listener entry for bulk cleanup */
export interface ViewportEventListener {
  target: EventTarget
  type: string
  handler: EventListener
}
