import { useEffect, useState } from 'react'
import type { OutputMode, TerminalPlatformDiagnostic } from '@shared/types'
import { useNotificationStore } from '../../stores/notification-store'
import { SettingsTitle } from './settings-typography'

export function DiagnosticsSettings() {
  const { pendingSettings, updateSettings } = useNotificationStore()
  const [terminalDiagnostics, setTerminalDiagnostics] = useState<TerminalPlatformDiagnostic[]>([])
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null)

  const refreshDiagnostics = async () => {
    try {
      setTerminalDiagnostics(await window.electron.terminal.getDiagnostics())
      setDiagnosticError(null)
    } catch {
      setDiagnosticError('Terminal diagnostics are unavailable.')
    }
  }

  useEffect(() => {
    void refreshDiagnostics()
  }, [])

  return (
    <div className="flex flex-col gap-8 pb-16 max-w-2xl">
      <SettingsTitle description="Advanced detection and troubleshooting controls">
        Diagnostics
      </SettingsTitle>
      <div className="settings-card rounded-xl flex flex-col gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--mc-text-primary)]">Detection Mode</p>
          <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">
            Override automatic terminal-output parsing only when troubleshooting notifications.
          </p>
        </div>
        <select
          aria-label="Detection Mode"
          value={pendingSettings.outputMode}
          onChange={(event) => updateSettings({ outputMode: event.target.value as OutputMode })}
          className="text-sm bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--mc-accent)] text-[var(--mc-text-primary)]"
        >
          <option value="auto">Auto (Recommended)</option>
          <option value="stream-json">JSON Stream</option>
          <option value="plain-text">Plain Text</option>
        </select>
      </div>
      <div className="settings-card rounded-xl flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-[var(--mc-text-primary)]">Terminal Stream</p>
            <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">
              Runtime metadata only. Terminal content is never included.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshDiagnostics()}
            className="text-sm border border-[var(--mc-border)] rounded px-3 py-2 text-[var(--mc-text-primary)]"
          >
            Refresh
          </button>
        </div>
        {diagnosticError && <p className="text-sm text-red-400">{diagnosticError}</p>}
        {!diagnosticError && terminalDiagnostics.length === 0 && (
          <p className="text-sm text-[var(--mc-text-muted)]">No active terminals.</p>
        )}
        {terminalDiagnostics.map(diagnostic => (
          <dl
            key={diagnostic.terminalId}
            className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-[var(--mc-border)] p-3 text-sm"
          >
            <dt className="text-[var(--mc-text-muted)]">Terminal</dt><dd className="truncate">{diagnostic.terminalId}</dd>
            <dt className="text-[var(--mc-text-muted)]">Provider</dt><dd>{diagnostic.provider ?? 'unmanaged'}</dd>
            <dt className="text-[var(--mc-text-muted)]">Engine / backend</dt><dd>{diagnostic.engine} / {diagnostic.backend} ({diagnostic.backendAvailable ? 'available' : 'unavailable'})</dd>
            <dt className="text-[var(--mc-text-muted)]">Sequence / watermark</dt><dd>{diagnostic.lastSequence} / {diagnostic.watermark}</dd>
            <dt className="text-[var(--mc-text-muted)]">Fallback</dt><dd>{diagnostic.fallbackReason ?? 'none'}</dd>
          </dl>
        ))}
      </div>
    </div>
  )
}
