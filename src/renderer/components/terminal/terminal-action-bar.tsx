import { useState, useCallback } from 'react'
import type { WindowsShell } from '@shared/types'

interface TerminalActionBarProps {
  terminalCount: number
  terminalLimit: number
  yoloEnabled: boolean
  onAddTerminal: (shell?: WindowsShell) => void
  onToggleYolo: (enabled: boolean) => void
  onKillAll: () => void
  disabled?: boolean
}

/** Slim terminal status bar: count, add terminal, YOLO toggle, Kill All */
export function TerminalActionBar({
  terminalCount,
  terminalLimit,
  yoloEnabled,
  onAddTerminal,
  onToggleYolo,
  onKillAll,
  disabled
}: TerminalActionBarProps) {
  const [showKillConfirm, setShowKillConfirm] = useState(false)

  const handleConfirmKill = useCallback(() => {
    setShowKillConfirm(false)
    onKillAll()
  }, [onKillAll])

  // Hide when no terminals
  if (terminalCount === 0) return null

  return (
    <div className={`terminal-status-bar${showKillConfirm ? ' terminal-status-bar-confirm-open' : ''}`}>
      <span className="terminal-count-label">{terminalCount} / {terminalLimit} terminals</span>

      {/* Add new terminal button */}
      <button
        type="button"
        onClick={() => onAddTerminal()}
        disabled={disabled || terminalCount >= terminalLimit}
        className="status-btn primary"
        title={terminalCount >= terminalLimit ? `Terminal limit (${terminalLimit}) reached` : 'New Terminal (Ctrl+T)'}
      >
        + New
      </button>

      <div style={{ flex: 1 }} />

      {/* YOLO toggle - dot indicator shows state */}
      <button
        type="button"
        onClick={() => onToggleYolo(!yoloEnabled)}
        disabled={disabled}
        className="status-btn"
        style={yoloEnabled ? { color: '#f97316', borderColor: 'rgba(249,115,22,0.4)', background: 'rgba(249,115,22,0.08)' } : undefined}
        title={yoloEnabled ? 'YOLO Mode: ON — Click to disable' : 'YOLO Mode: OFF — Click to enable'}
      >
        ⚡ YOLO
      </button>

      {/* Kill All with confirmation */}
      <div className={`kill-confirm-anchor${showKillConfirm ? ' is-open' : ''}`}>
        <button
          type="button"
          onClick={() => setShowKillConfirm(prev => !prev)}
          disabled={disabled || terminalCount === 0}
          className="status-btn danger"
          aria-expanded={showKillConfirm}
          aria-haspopup="dialog"
          style={{ color: '#f7768e', borderColor: 'rgba(247,118,142,0.4)', background: 'rgba(247,118,142,0.08)' }}
        >
          Kill All
        </button>

        {showKillConfirm && (
          <div className="kill-confirm-popup" role="dialog" aria-label={`Kill all ${terminalCount} terminals`}>
            <p>Kill all {terminalCount} terminals?</p>
            <div className="kill-confirm-btns">
              <button type="button" onClick={() => setShowKillConfirm(false)} className="status-btn">
                Cancel
              </button>
              <button type="button" onClick={handleConfirmKill} className="status-btn danger confirm">
                Kill All
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
