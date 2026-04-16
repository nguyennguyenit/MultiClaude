import type { PaneSplitDirection } from '@shared/types'

/**
 * Module-level registry for terminal-level split actions. App.tsx registers
 * the executeSplit handler on mount; `useTerminalClipboard` reads from here
 * when building the right-click context menu.
 *
 * Avoids prop-drilling executeSplit through
 * App → TerminalGrid → TerminalPane → useTerminal → useTerminalClipboard.
 */
interface ContextActionHandlers {
  executeSplit: ((direction: PaneSplitDirection, targetTerminalId?: string) => void) | null
  canSplit: boolean
  atLimit: boolean
  limit: number
}

const handlers: ContextActionHandlers = {
  executeSplit: null,
  canSplit: false,
  atLimit: false,
  limit: 0
}

export function registerSplitHandlers(next: ContextActionHandlers): void {
  handlers.executeSplit = next.executeSplit
  handlers.canSplit = next.canSplit
  handlers.atLimit = next.atLimit
  handlers.limit = next.limit
}

export function getSplitHandlers(): ContextActionHandlers {
  return handlers
}
