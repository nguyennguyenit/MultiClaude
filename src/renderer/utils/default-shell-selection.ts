import type { ShellInfo } from '@shared/types'

interface ReconcileSavedDefaultShellOptions {
  hasLoadedShells: boolean
  shells: ShellInfo[]
  savedDefault?: ShellInfo
  setSelectedShell: (shell: ShellInfo | null) => void
  persistDefaultShell: (shell: ShellInfo | null) => Promise<void> | void
}

export async function reconcileSavedDefaultShell({
  hasLoadedShells,
  shells,
  savedDefault,
  setSelectedShell,
  persistDefaultShell
}: ReconcileSavedDefaultShellOptions): Promise<void> {
  if (!hasLoadedShells) {
    return
  }

  if (!savedDefault) {
    setSelectedShell(null)
    return
  }

  const matchingShell = shells.find((shell) => shell.path === savedDefault.path) ?? null
  setSelectedShell(matchingShell)

  if (!matchingShell) {
    await persistDefaultShell(null)
  }
}
