import { useEffect, useState } from 'react'
import { ToolbarButton } from './toolbar-button'
import logoImg from '../../assets/logo.png'
import type { WindowState } from '@shared/types'

// Detect macOS for traffic light padding
const isMac = navigator.platform.toLowerCase().includes('mac')
const DEFAULT_WINDOW_STATE: WindowState = {
  isMaximized: false,
  isFullScreen: false,
  isExpanded: false
}

interface ToolbarProps {
  onAddTerminal: () => void
  terminalCount: number
  terminalLimit: number
  onToggleGitHub: () => void
  onToggleSettings: () => void
  activePanel: string | null
}

function IconGitHub() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

function IconSettings() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

import { WindowControls } from './window-controls'

/** Compact 32px toolbar replacing the titlebar + activity bar */
export function Toolbar({
  onAddTerminal: _onAddTerminal,
  terminalCount: _terminalCount,
  terminalLimit: _terminalLimit,
  onToggleGitHub,
  onToggleSettings,
  activePanel
}: ToolbarProps) {
  const [windowState, setWindowState] = useState(DEFAULT_WINDOW_STATE)

  useEffect(() => {
    if (!isMac) return

    let isSubscribed = true

    window.electron.window.getState()
      .then((state) => {
        if (isSubscribed) {
          setWindowState(state)
        }
      })
      .catch(() => {})

    const unsubscribe = window.electron.window.onStateChanged((state) => {
      if (isSubscribed) {
        setWindowState(state)
      }
    })

    return () => {
      isSubscribed = false
      unsubscribe()
    }
  }, [])

  return (
    <div className="toolbar">
      {/* Drag region sits behind interactive elements */}
      <div className="toolbar-drag" />

      {/* Left group: keep clear of traffic lights unless the macOS window is expanded */}
      <div
        className="toolbar-group toolbar-group-left"
        style={{ paddingLeft: isMac && !windowState.isExpanded ? 80 : 8 }}
      >
        <div className="toolbar-brand">
          <img src={logoImg} alt="MultiClaude" className="toolbar-brand-logo" />
          <span className="toolbar-brand-name">MultiClaude</span>
        </div>
      </div>

      {/* Right group: panel toggles + update indicator + custom window controls */}
      <div className="toolbar-group" style={{ marginLeft: 'auto' }}>
        <ToolbarButton
          icon={<IconGitHub />}
          title="GitHub Panel (Ctrl+G)"
          onClick={onToggleGitHub}
          active={activePanel === 'github'}
        />
        <ToolbarButton
          icon={<IconSettings />}
          title="Settings"
          onClick={onToggleSettings}
          active={activePanel === 'settings'}
          testId="settings-button"
        />
        {/* Only show custom window controls on non-macOS platforms since macOS has native traffic lights on the left */}
        {!isMac && <WindowControls />}
      </div>
    </div>
  )
}
