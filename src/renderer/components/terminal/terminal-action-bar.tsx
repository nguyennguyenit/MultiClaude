import { useState, useCallback, useRef } from 'react'
import { ShellSelectorDropdown } from './shell-selector-dropdown'
import { SplitButton } from './split-button'
import type { PaneSplitDirection, ShellInfo } from '@shared/types'

interface TerminalActionBarProps {
  terminalCount: number
  terminalLimit: number
  yoloEnabled: boolean
  availableShells: ShellInfo[]
  selectedShell: ShellInfo | null
  onShellSelect: (shell: ShellInfo | null) => void
  onAddTerminal: (shell?: ShellInfo) => void
  onToggleYolo: (enabled: boolean) => void
  onKillAll: () => void
  onCycleLayout?: () => void
  onSplit?: (direction: PaneSplitDirection) => void
  canSplit?: boolean
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
  availableShells,
  selectedShell,
  onShellSelect,
  onAddTerminal,
  onToggleYolo,
  onKillAll,
  onCycleLayout,
  onSplit,
  canSplit = false,
  disabled
}: TerminalActionBarProps) {
  const [showKillConfirm, setShowKillConfirm] = useState(false)
  const [shellOpen, setShellOpen] = useState(false)
  const shellBtnRef = useRef<HTMLButtonElement>(null)

  const handleConfirmKill = useCallback(() => {
    setShowKillConfirm(false)
    onKillAll()
  }, [onKillAll])

  // Reserve layout space even when no terminals open (prevents layout shift on first terminal open).
  // Use visibility:hidden so the 24px bottom bar height is always accounted for in the flex layout.
  if (terminalCount === 0) return <div className="action-bar" style={{ visibility: 'hidden' }} />

  const shellLabel = selectedShell ? `>_ ${selectedShell.name} ▾` : '>_ ▾'

  return (
    <div className={`action-bar${showKillConfirm ? ' action-bar-confirm-open' : ''}`}>
      {/* Left group: shell indicator + terminal controls */}
      <div className="action-bar-group">
        <div className="shell-btn-anchor">
          <button
            ref={shellBtnRef}
            type="button"
            className="action-bar-shell-btn"
            title={availableShells.length === 0 ? 'No shells detected' : 'Select shell (restart app to pick up newly installed shells)'}
            aria-haspopup="listbox"
            aria-expanded={shellOpen}
            onClick={() => setShellOpen(p => !p)}
            disabled={availableShells.length === 0}
          >
            {shellLabel}
          </button>
          {shellOpen && (
            <ShellSelectorDropdown
              shells={availableShells}
              selectedShell={selectedShell}
              anchorRef={shellBtnRef}
              onSelect={(shell) => { onShellSelect(shell); setShellOpen(false) }}
              onClose={() => setShellOpen(false)}
            />
          )}
        </div>
        <div className="action-bar-separator" />
        <ActionBarBtn
          icon="⚡"
          title={yoloEnabled ? 'YOLO Mode ON — click to disable' : 'YOLO Mode OFF — click to enable'}
          onClick={() => onToggleYolo(!yoloEnabled)}
          disabled={disabled}
          className={yoloEnabled ? 'yolo-active' : ''}
          aria-pressed={yoloEnabled}
        />
        <div className="action-bar-separator" />
        <SplitButton
          atLimit={disabled === true || terminalCount >= terminalLimit}
          splitDisabled={disabled === true || terminalCount >= terminalLimit || !canSplit || !onSplit}
          terminalLimit={terminalLimit}
          onAddTerminal={() => onAddTerminal()}
          onSplit={(dir) => onSplit?.(dir)}
        />
        {onCycleLayout && (
          <ActionBarBtn icon="⊞" title="Toggle Layout" onClick={onCycleLayout} />
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right group: count + Kill All */}
      <div className="action-bar-group">
        <span className="action-bar-count">{terminalCount} / {terminalLimit}</span>
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
              <p>Terminate {terminalCount} terminals?</p>
              <div className="kill-confirm-btns">
                <button type="button" onClick={() => setShowKillConfirm(false)}>Cancel</button>
                <button type="button" onClick={handleConfirmKill} className="confirm">Kill All</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
