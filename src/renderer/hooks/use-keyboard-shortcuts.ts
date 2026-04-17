import { useEffect } from 'react'
import { useAppStore } from '../stores'
import { getGlobalShortcut } from '../utils'
import type { NewTerminalLayout } from '../utils/shortcut-utils'
import type { PaneSplitDirection } from '@shared/types'

interface KeyboardShortcutsOptions {
  onAddTerminal: (options?: { layout?: NewTerminalLayout }) => void
  onCloseTerminal: () => void
  onSelectProject?: (id: string) => void
  onToggleGitHubPanel?: () => void
  onSplit?: (direction: PaneSplitDirection) => void
}

/**
 * Global keyboard shortcuts hook
 * - Alt+1~9: Switch to project by index
 * - Ctrl+T: New terminal, rebuild balanced grid
 * - Ctrl+N: New terminal, rebuild evenly-stacked vertical layout
 * - Ctrl+W: Close active terminal
 * - Ctrl+G: Toggle GitHub panel
 */
export function useKeyboardShortcuts({
  onAddTerminal,
  onCloseTerminal,
  onSelectProject,
  onToggleGitHubPanel,
  onSplit
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const shortcut = getGlobalShortcut(e)
      if (!shortcut) return

      // Don't hijack the split-pane hotkey while typing in a text input —
      // preserves native word-extend-selection (Cmd+Shift+Arrow) in chat,
      // search and settings fields.
      if (shortcut.type === 'split-pane' && isEditableTarget(e.target)) return

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
          onAddTerminal({ layout: shortcut.layout })
          return
        case 'close-terminal':
          onCloseTerminal()
          return
        case 'toggle-github-panel':
          onToggleGitHubPanel?.()
          return
        case 'split-pane':
          onSplit?.(shortcut.direction)
          return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onAddTerminal, onCloseTerminal, onSelectProject, onToggleGitHubPanel, onSplit])
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  if (target.isContentEditable) return true
  // Fallback for environments where `isContentEditable` doesn't reflect the
  // attribute (e.g. jsdom on a detached element) — accept `contenteditable`
  // ('') and `contenteditable="true"`.
  const attr = target.getAttribute('contenteditable')
  return attr === '' || attr === 'true'
}
