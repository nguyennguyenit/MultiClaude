import { useState, useCallback } from 'react'
import { useSettingsStore } from '../../stores'
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
  const { settings } = useSettingsStore()

  // Handle click - use default shell from settings
  const handleAddClick = useCallback(() => {
    onAddTerminal(settings.windowsShell)
  }, [onAddTerminal, settings.windowsShell])

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
    <div className="h-10 px-4 flex items-center justify-between bg-[var(--mc-bg-secondary)] border-b border-[var(--mc-border)]">
      {/* Left: Terminal count */}
      <div className="flex items-center gap-2 text-sm text-[var(--mc-text-secondary)]">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{terminalCount} / {terminalLimit} terminals</span>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* New Terminal */}
        <button
          type="button"
          onClick={handleAddClick}
          disabled={disabled || terminalCount >= terminalLimit}
          className="px-3 py-1 text-xs rounded bg-[var(--mc-accent)] text-[var(--mc-bg-primary)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Add new terminal"
        >
          + New
        </button>

        {/* YOLO Toggle */}
        <button
          type="button"
          onClick={() => onToggleYolo(!yoloEnabled)}
          disabled={disabled}
          className={`px-3 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
            yoloEnabled
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
