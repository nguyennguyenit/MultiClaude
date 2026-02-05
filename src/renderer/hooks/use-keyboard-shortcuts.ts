import { useEffect } from 'react'
import { useAppStore } from '../stores'

interface KeyboardShortcutsOptions {
  onAddTerminal: () => void
  onCloseTerminal: () => void
  onSelectProject?: (id: string) => void
}

/**
 * Global keyboard shortcuts hook
 * - Alt+1~9: Switch to project by index
 * - Ctrl+N/T: Create new terminal
 * - Ctrl+W: Close active terminal
 * - Ctrl+B: Cycle Activity Bar state (collapsed → expanded → hidden)
 */
export function useKeyboardShortcuts({
  onAddTerminal,
  onCloseTerminal,
  onSelectProject
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+1~9: Switch project by index
      if (e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const index = parseInt(e.key) - 1
        const { projects } = useAppStore.getState()

        if (projects[index]) {
          if (onSelectProject) {
            onSelectProject(projects[index].id)
          } else {
            useAppStore.getState().setActiveProject(projects[index].id)
          }
        }
        return
      }

      // Ctrl+N: New terminal (Cmd+N on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        onAddTerminal()
        return
      }

      // Ctrl+T: New terminal alternative (Cmd+T on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault()
        onAddTerminal()
        return
      }

      // Ctrl+W: Close active terminal (Cmd+W on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault()
        onCloseTerminal()
        return
      }

      // Ctrl+B: Cycle Activity Bar state (Cmd+B on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        useAppStore.getState().cycleActivityBarState()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onAddTerminal, onCloseTerminal, onSelectProject])
}
