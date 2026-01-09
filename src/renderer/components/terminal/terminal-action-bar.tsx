import { useState, useCallback, useRef } from 'react'
import { useSettingsStore } from '../../stores'
import { ShellSelectorDropdown } from './shell-selector-dropdown'
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
  const [showShellSelector, setShowShellSelector] = useState(false)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const { wslInfo, settings } = useSettingsStore()

  // Show shell dropdown on Windows only (wslInfo is only set on Windows platform)
  const isWindows = wslInfo !== null

  // Handle click - default shell is handled by parent (App.tsx handleAddTerminal)
  const handleAddClick = useCallback(() => {
    onAddTerminal()
  }, [onAddTerminal])

  // Handle dropdown toggle (Windows only)
  const handleDropdownToggle = useCallback(() => {
    if (!isWindows) return
    setShowShellSelector((prev) => !prev)
  }, [isWindows])

  // Handle shell selection from dropdown
  const handleShellSelect = useCallback((shell: WindowsShell) => {
    onAddTerminal(shell)
    setShowShellSelector(false)
  }, [onAddTerminal])

  // All hooks MUST be called before any early returns (React Rules of Hooks)
  const handleKillAllClick = useCallback(() => {
    setShowKillConfirm(true)
  }, [])

  const handleConfirmKill = useCallback(() => {
    setShowKillConfirm(false)
    onKillAll()
  }, [onKillAll])

  const handleCancelKill = useCallback(() => {
    setShowKillConfirm(false)
  }, [])

  // Hide when no terminals (after all hooks)
  if (terminalCount === 0) return null

  return (
    <div className="h-10 px-4 flex items-center justify-between bg-[var(--mc-bg-secondary)] border-b border-[var(--mc-border)] relative z-10">
      {/* Left: Terminal count */}
      <div className="flex items-center gap-2 text-sm text-[var(--mc-text-secondary)]">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{terminalCount} / {terminalLimit} terminals</span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* New Terminal - split button with dropdown on Windows */}
        {/* New Terminal - split button with dropdown on Windows */}
        <div className="relative inline-flex shadow-sm isolate">
          <button
            ref={addButtonRef}
            type="button"
            onClick={handleAddClick}
            disabled={disabled || terminalCount >= terminalLimit}
            className={`relative items-center px-3 py-1.5 text-xs font-medium bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${isWindows ? 'rounded-l-md' : 'rounded-md'
              }`}
            title="Add new terminal"
          >
            + New
          </button>
          {isWindows && (
            <button
              type="button"
              onClick={handleDropdownToggle}
              disabled={disabled || terminalCount >= terminalLimit}
              className="relative -ml-px items-center px-2 py-1.5 text-xs rounded-r-md bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed border-l border-[var(--mc-bg-primary)]/20 transition-colors"
              title="Select shell type"
              aria-label="Select shell type"
              aria-haspopup="menu"
              aria-expanded={showShellSelector}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}

          {showShellSelector && (
            <ShellSelectorDropdown
              onSelect={handleShellSelect}
              onClose={() => setShowShellSelector(false)}
              anchorRef={addButtonRef}
            />
          )}
        </div>

        {/* YOLO Toggle */}
        <button
          type="button"
          onClick={() => onToggleYolo(!yoloEnabled)}
          disabled={disabled}
          className={`px-3 py-1 text-xs rounded flex items-center gap-1 transition-colors ${yoloEnabled
            ? 'bg-orange-500 text-white'
            : 'bg-[var(--mc-bg-tertiary)] text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)]'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={yoloEnabled ? 'YOLO Mode: On (Claude skips confirmations)' : 'YOLO Mode: Off'}
        >
          <span>⚡</span>
          <span>YOLO</span>
          <span className={`w-1.5 h-1.5 rounded-full ${yoloEnabled ? 'bg-white' : 'bg-[var(--mc-text-muted)]'}`} />
        </button>

        {/* Kill All */}
        <div className="relative">
          <button
            type="button"
            onClick={handleKillAllClick}
            disabled={disabled || terminalCount === 0}
            className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✕ Kill All
          </button>

          {/* Confirmation Popup */}
          {showKillConfirm && (
            <div className="absolute right-0 top-full mt-1 p-3 bg-[var(--mc-bg-tertiary)] border border-[var(--mc-border)] rounded shadow-lg z-50 min-w-[200px]">
              <p className="text-sm text-[var(--mc-text-primary)] mb-3">
                Kill all {terminalCount} terminals?
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleCancelKill}
                  className="px-3 py-1 text-xs rounded bg-[var(--mc-bg-secondary)] text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmKill}
                  className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                >
                  Kill All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
