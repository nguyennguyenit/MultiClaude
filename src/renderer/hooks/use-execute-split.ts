import { useCallback } from 'react'
import type { PaneSplitDirection, ShellInfo, Terminal, WindowsShell } from '@shared/types'
import { splitLeaf } from '@shared/utils/pane-tree'
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
 * Hook factory: returns an `executeSplit(direction)` callback that creates a
 * new terminal in the active project and splits the active pane.
 */
export function useExecuteSplit(deps: ExecuteSplitDeps): {
  executeSplit: (direction: PaneSplitDirection) => Promise<void>
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

  const executeSplit = useCallback(
    async (direction: PaneSplitDirection): Promise<void> => {
      if (reason === 'limit') {
        notifyLimit(terminalLimit)
        return
      }
      if (reason !== null) return
      if (!activeTerminalId) return

      const isUnix = selectedShell?.kind === 'unix'
      const isWin = selectedShell && !isUnix

      const create = createTerminal ?? window.electron?.terminal?.create
      if (!create) return

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
        console.error('[useExecuteSplit] create terminal failed:', err)
        notifyError('Failed to create terminal. Please try again.')
        return
      }

      addTerminal(terminal)

      if (projectId) {
        const currentTree = usePaneTreeStore.getState().getTree(projectId)
        if (currentTree) {
          usePaneTreeStore
            .getState()
            .setTree(projectId, splitLeaf(currentTree, activeTerminalId, direction, terminal.id))
        }
      }
    },
    [
      reason,
      activeTerminalId,
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
