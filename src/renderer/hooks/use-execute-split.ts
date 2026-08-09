import { useCallback, useRef } from 'react'
import type { PaneSplitDirection, ShellInfo, Terminal, WindowsShell } from '@shared/types'
import { beginRendererCreate } from '../utils/renderer-create-tracker'
import { closeLeafAndCollapse, findLeaf, splitLeaf } from '@shared/utils/pane-tree'
import { usePaneTreeStore } from '../stores/pane-tree-store'

/**
 * Max time to wait for the main process to answer `terminal:create`. If the
 * main side hangs or crashes mid-create, the renderer would otherwise await
 * forever — leaving the in-flight counter pinned and silently refusing future
 * splits. Exported for test override.
 */
export const CREATE_TIMEOUT_MS = 10_000

const CREATE_TIMEOUT_SENTINEL = Symbol('create-timeout')

async function createWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T | typeof CREATE_TIMEOUT_SENTINEL> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<typeof CREATE_TIMEOUT_SENTINEL>((resolve) => {
    timer = setTimeout(() => resolve(CREATE_TIMEOUT_SENTINEL), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export interface ExecuteSplitDeps {
  projectId: string | null
  projectPath?: string
  activeTerminalId: string | null
  terminalLimit: number
  terminalCount: number
  selectedShell: ShellInfo | null
  defaultShellFallback?: ShellInfo
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
    defaultShellFallback,
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
      const releaseRendererCreate = beginRendererCreate()
      const createPromise = create({
        cwd: projectPath,
        projectId: projectId ?? undefined,
        shellPath: isUnix ? selectedShell?.path : undefined,
        shell: isWin
          ? toWindowsShell(selectedShell)
          : defaultShellFallback && defaultShellFallback.kind !== 'unix'
            ? toWindowsShell(defaultShellFallback)
            : undefined
      })
      let terminal: Terminal
      try {
        const result = await createWithTimeout(createPromise, CREATE_TIMEOUT_MS)
        if (result === CREATE_TIMEOUT_SENTINEL) {
          inFlightRef.current -= 1
          releaseRendererCreate()
          notifyError('Terminal creation timed out. Please try again.')
          // If main eventually answers after we gave up, the PTY is alive on
          // the main side — destroy it so we don't leak a phantom pane via
          // reconcile auto-append.
          void createPromise
            .then((late) => {
              if (late?.id) void window.electron?.terminal?.destroy?.(late.id)
            })
            .catch(() => {
              // Original rejection — nothing to clean up.
            })
          return
        }
        terminal = result
      } catch (err) {
        inFlightRef.current -= 1
        releaseRendererCreate()
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
          } else if (
            activeTerminalId &&
            activeTerminalId !== sourceTerminalId &&
            findLeaf(cleaned, activeTerminalId)
          ) {
            // Right-click-targeted pane closed between menu open and click —
            // preserve user's direction intent by splitting the active pane
            // and tell them the source is gone.
            notifyError('Source pane was closed — splitting active pane instead')
            usePaneTreeStore
              .getState()
              .setTree(projectId, splitLeaf(cleaned, activeTerminalId, direction, terminal.id))
          }
          // else: both source AND active are gone — let reconcile auto-append.
        }
      }

      // Release AFTER setTree so the global onCreated broadcast handler still
      // sees us as in-flight if it fires between the IPC return and our
      // setTree call (the very race this counter exists to defend against).
      releaseRendererCreate()
    },
    [
      activeTerminalId,
      terminalCount,
      terminalLimit,
      selectedShell,
      defaultShellFallback,
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
