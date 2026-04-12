import { useState, useCallback } from 'react'
import type { WindowsShell } from '@shared/types'

interface TerminalActionBarProps {
  terminalCount: number
  terminalLimit: number
  yoloEnabled: boolean
  onAddTerminal: (shell?: WindowsShell) => void
  onToggleYolo: (enabled: boolean) => void
  onKillAll: () => void
  onCycleLayout?: () => void
  disabled?: boolean
}

/** Icon-only action button for the bottom bar */
function ActionBarBtn({
  icon,
  title,
  onClick,
  disabled,
  className = '',
  'aria-pressed': ariaPressed
}: {
  icon: string
  title: string
  onClick: () => void
  disabled?: boolean
  className?: string
  'aria-pressed'?: boolean
}) {
  return (
    <button
      type="button"
      className={`action-bar-btn${className ? ` ${className}` : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={ariaPressed}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
    </button>
  )
}

/** 24px icon-only bottom action bar (VS Code Antigravity style) */
export function TerminalActionBar({
  terminalCount,
  terminalLimit,
  yoloEnabled,
  onAddTerminal,
  onToggleYolo,
  onKillAll,
  onCycleLayout,
  disabled
}: TerminalActionBarProps) {
  const [showKillConfirm, setShowKillConfirm] = useState(false)

  const handleConfirmKill = useCallback(() => {
    setShowKillConfirm(false)
    onKillAll()
  }, [onKillAll])

  // Reserve layout space even when no terminals open (prevents layout shift on first terminal open).
  // Use visibility:hidden so the 24px bottom bar height is always accounted for in the flex layout.
  if (terminalCount === 0) return <div className="action-bar" style={{ visibility: 'hidden' }} />

  return (
    <div className={`action-bar${showKillConfirm ? ' action-bar-confirm-open' : ''}`}>
      {/* Left group: shell indicator + terminal controls */}
      <div className="action-bar-group">
        <span className="action-bar-shell-indicator" title="Current shell">&gt;_</span>
        <div className="action-bar-separator" />
        <ActionBarBtn
          icon="+"
          title={terminalCount >= terminalLimit ? `Terminal limit (${terminalLimit}) reached` : 'New Terminal (Ctrl+T)'}
          onClick={() => onAddTerminal()}
          disabled={disabled || terminalCount >= terminalLimit}
        />
        {onCycleLayout && (
          <ActionBarBtn icon="⊞" title="Toggle Layout" onClick={onCycleLayout} />
        )}
        <div className="action-bar-separator" />
        <div className={`kill-confirm-anchor${showKillConfirm ? ' is-open' : ''}`}>
          <ActionBarBtn
            icon="🗑"
            title="Kill All Terminals"
            onClick={() => setShowKillConfirm(p => !p)}
            disabled={disabled}
            className="danger"
          />
          {showKillConfirm && (
            <div className="kill-confirm-popup" role="dialog" aria-label={`Kill all ${terminalCount} terminals`}>
              <p>Kill all {terminalCount} terminals?</p>
              <div className="kill-confirm-btns">
                <button type="button" onClick={() => setShowKillConfirm(false)}>Cancel</button>
                <button type="button" onClick={handleConfirmKill} className="confirm">Kill All</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right group: count + YOLO */}
      <div className="action-bar-group">
        <span className="action-bar-count">{terminalCount} / {terminalLimit}</span>
        <div className="action-bar-separator" />
        <ActionBarBtn
          icon="⚡"
          title={yoloEnabled ? 'YOLO Mode ON — click to disable' : 'YOLO Mode OFF — click to enable'}
          onClick={() => onToggleYolo(!yoloEnabled)}
          disabled={disabled}
          className={yoloEnabled ? 'yolo-active' : ''}
          aria-pressed={yoloEnabled}
        />
      </div>
    </div>
  )
}
