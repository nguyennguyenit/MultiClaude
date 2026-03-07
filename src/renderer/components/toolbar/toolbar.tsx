import { useUpdateStore } from '../../stores'
import { ToolbarButton } from './toolbar-button'

// Detect macOS for traffic light padding
const isMac = navigator.platform.toLowerCase().includes('mac')

interface ToolbarProps {
  onAddTerminal: () => void
  terminalCount: number
  terminalLimit: number
  onToggleGit: () => void
  onToggleGitHub: () => void
  onToggleSettings: () => void
  activePanel: string | null
}

function IconGitBranch() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 01-9 9" />
    </svg>
  )
}

function IconGitHub() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

function IconUpdate() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </svg>
  )
}

/** Compact 32px toolbar replacing the titlebar + activity bar */
export function Toolbar({
  onAddTerminal,
  terminalCount,
  terminalLimit,
  onToggleGit,
  onToggleGitHub,
  onToggleSettings,
  activePanel
}: ToolbarProps) {
  const { state: updateState } = useUpdateStore()
  const hasUpdate = updateState.status === 'available' || updateState.status === 'ready'
  return (
    <div className="toolbar">
      {/* Drag region sits behind interactive elements */}
      <div className="toolbar-drag" />

      {/* Left group: macOS traffic light padding */}
      <div className="toolbar-group" style={{ paddingLeft: isMac ? 72 : 0 }} />

      {/* Right group: panel toggles + update indicator */}
      <div className="toolbar-group" style={{ marginLeft: 'auto' }}>
        <ToolbarButton
          icon={<IconGitBranch />}
          title="Git Panel (Ctrl+B)"
          onClick={onToggleGit}
          active={activePanel === 'git'}
        />
        <ToolbarButton
          icon={<IconGitHub />}
          title="GitHub Panel"
          onClick={onToggleGitHub}
          active={activePanel === 'github'}
        />
        {hasUpdate && (
          <ToolbarButton
            icon={<IconUpdate />}
            title="Update available — click to open Settings"
            onClick={onToggleSettings}
            highlight
          />
        )}
      </div>
    </div>
  )
}
