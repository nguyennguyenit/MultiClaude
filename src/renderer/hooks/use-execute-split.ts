import { useCallback, useRef } from 'react'
import type { PaneSplitDirection, ShellInfo, Terminal, WindowsShell } from '@shared/types'
import { closeLeafAndCollapse, findLeaf, splitLeaf } from '@shared/utils/pane-tree'
import { usePaneTreeStore } from '../stores/pane-tree-store'

export interface ExecuteSplitDeps {
  projectId: string | null
  projectPath?: string
  activeTerminalId: string | null
  terminalLimit: number
  terminalCount: number
  selectedShell: ShellInfo | null
  windowsShellFallback?: WindowsShell
  addTerminal: (terminal: Terminal) => void
  notifyLimit: (limit: number) => void
  notifyError: (message: string) => void
  createTerminal?: (options: {
    cwd?: string
    projectId?: string
    shellPath?: string
    shell?: WindowsShell
  }) => Promise<Terminal>
}

/** Pure helper — exported for unit tests. Returns the reason a split cannot
 * proceed, or null if the split is allowed. */
export function splitGateReason(
  activeTerminalId: string | null,
  count: number,
  limit: number
): 'no-active' | 'limit' | null {
  if (!activeTerminalId) return 'no-active'
  if (count >= limit) return 'limit'
  return null
}

/**
 * Hook factory: returns an `executeSplit(direction, targetTerminalId?)`
 * callback that creates a new terminal in the active project and splits the
 * given pane (or the active pane if `targetTerminalId` is omitted). Right-click
 * menus pass the right-clicked terminal id so the split source matches the
 * pointer, not the focused terminal.
 */
export function useExecuteSplit(deps: ExecuteSplitDeps): {
  executeSplit: (direction: PaneSplitDirection, targetTerminalId?: string) => Promise<void>
  canSplit: boolean
  reason: 'no-active' | 'limit' | null
} {
  const {
    projectId,
    projectPath,
    activeTerminalId,
    terminalLimit,
    terminalCount,
    selectedShell,
    windowsShellFallback,
    addTerminal,
    notifyLimit,
    notifyError,
    createTerminal
  } = deps

  const reason = splitGateReason(activeTerminalId, terminalCount, terminalLimit)
  const canSplit = reason === null

  // In-flight create counter so rapid concurrent calls (multiple hotkey
  // presses, split-button spam) don't all pass the React-state gate before
  // `addTerminal` increments terminalCount. Each caller reserves a slot
  // synchronously and releases it after the IPC settles.
  const inFlightRef = useRef(0)

  const executeSplit = useCallback(
    async (direction: PaneSplitDirection, targetTerminalId?: string): Promise<void> => {
      if (terminalCount + inFlightRef.current >= terminalLimit) {
        notifyLimit(terminalLimit)
        return
      }
      const sourceTerminalId = targetTerminalId ?? activeTerminalId
      if (!sourceTerminalId) return

      const isUnix = selectedShell?.kind === 'unix'
      const isWin = selectedShell && !isUnix

      const create = createTerminal ?? window.electron?.terminal?.create
      if (!create) return

      inFlightRef.current += 1
      let terminal: Terminal
      try {
        terminal = await create({
          cwd: projectPath,
          projectId: projectId ?? undefined,
          shellPath: isUnix ? selectedShell?.path : undefined,
          shell: isWin
            ? toWindowsShell(selectedShell)
            : windowsShellFallback
        })
      } catch (err) {
        inFlightRef.current -= 1
        console.error('[useExecuteSplit] create terminal failed:', err)
        notifyError('Failed to create terminal. Please try again.')
        return
      }
      inFlightRef.current -= 1

      addTerminal(terminal)

      if (projectId) {
        const currentTree = usePaneTreeStore.getState().getTree(projectId)
        if (currentTree) {
          // The TERMINAL_CREATED broadcast can race ahead of the IPC return,
          // letting reconcile auto-append this leaf before we get here. Strip
          // any pre-existing instance so we don't duplicate it via splitLeaf.
          const cleaned = closeLeafAndCollapse(currentTree, terminal.id) ?? currentTree
          if (findLeaf(cleaned, sourceTerminalId)) {
            usePaneTreeStore
              .getState()
              .setTree(projectId, splitLeaf(cleaned, sourceTerminalId, direction, terminal.id))
          }
        }
      }
    },
    [
      activeTerminalId,
      terminalCount,
      terminalLimit,
      selectedShell,
      windowsShellFallback,
      projectId,
      projectPath,
      addTerminal,
      notifyLimit,
      notifyError,
      createTerminal
    ]
  )

  return { executeSplit, canSplit, reason }
}

function toWindowsShell(shell: ShellInfo | null): WindowsShell | undefined {
  if (!shell) return undefined
  if (shell.kind === 'cmd') return { type: 'cmd' }
  if (shell.kind === 'powershell') return { type: 'powershell' }
  if (shell.kind === 'wsl') return { type: 'wsl', distro: shell.name }
  return undefined
}
