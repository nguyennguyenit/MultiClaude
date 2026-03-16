import { useEffect } from 'react'
import { useAppStore } from '../stores'
import { getGlobalShortcut } from '../utils'

interface KeyboardShortcutsOptions {
  onAddTerminal: () => void
  onCloseTerminal: () => void
  onSelectProject?: (id: string) => void
  onToggleGitPanel?: () => void
}

/**
 * Global keyboard shortcuts hook
 * - Alt+1~9: Switch to project by index
 * - Ctrl+N/T: Create new terminal
 * - Ctrl+W: Close active terminal
 * - Ctrl+B: Toggle Git panel
 */
export function useKeyboardShortcuts({
  onAddTerminal,
  onCloseTerminal,
  onSelectProject,
  onToggleGitPanel
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const shortcut = getGlobalShortcut(e)
      if (!shortcut) return

      e.preventDefault()

      switch (shortcut.type) {
        case 'switch-project': {
          const { projects } = useAppStore.getState()
          const project = projects[shortcut.index]
          if (project) {
            if (onSelectProject) {
              onSelectProject(project.id)
            } else {
              useAppStore.getState().setActiveProject(project.id)
            }
          }
          return
        }
        case 'new-terminal':
          onAddTerminal()
          return
        case 'close-terminal':
          onCloseTerminal()
          return
        case 'toggle-git-panel':
          onToggleGitPanel?.()
          return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onAddTerminal, onCloseTerminal, onSelectProject, onToggleGitPanel])
}
