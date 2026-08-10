import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  OutputMode,
  TerminalPlatformDiagnostic,
  TerminalRendererPolicy,
} from '@shared/types'
import { useAppStore } from '../../stores/app-store'
import { useNotificationStore } from '../../stores/notification-store'
import { useSettingsStore } from '../../stores/settings-store'
import {
  retryTerminalRenderer,
  useTerminalRendererStatusStore,
  type TerminalRendererStatus,
} from '../../stores/terminal-renderer-status-store'
import {
  resolveTerminalRenderer,
  type RendererFallbackReason,
} from '../../utils/terminal-renderer-policy'
import { SettingsTitle } from './settings-typography'

const RENDERER_POLICIES: ReadonlyArray<{
  value: TerminalRendererPolicy
  label: string
  description: string
}> = [
  {
    value: 'automatic',
    label: 'Automatic (Recommended)',
    description: 'WebGL for regular shells; safer non-WebGL rendering for Claude and Codex.',
  },
  {
    value: 'prefer-gpu',
    label: 'Prefer GPU',
    description: 'Attempts WebGL for all terminals and falls back automatically.',
  },
  {
    value: 'safe-dom',
    label: 'Compatibility',
    description: 'Disables WebGL for maximum compatibility.',
  },
]

const RENDERER_REASON_COPY: Record<RendererFallbackReason, string> = {
  'automatic-agent-safe': 'Automatic uses safer rendering for this agent.',
  'policy-safe': 'Compatibility disables WebGL.',
  'webgl-unavailable': 'WebGL is unavailable in this environment.',
  'webgl-load-failed': 'WebGL could not start.',
  'webgl-context-lost': 'WebGL context lost.',
}

const RECOVERABLE_REASONS: ReadonlySet<RendererFallbackReason> = new Set([
  'webgl-load-failed',
  'webgl-context-lost',
])

function mainFallbackCopy(reason: string | null): string {
  if (reason === null) return 'none'
  if (reason === 'Canonical xterm headless mirror unavailable.') {
    return 'Canonical terminal mirror unavailable.'
  }
  return 'Backend unavailable'
}

interface DiagnosticRowProps {
  terminalId: string
  terminalAgentType: Parameters<typeof resolveTerminalRenderer>[0]['agentType']
  terminalIsClaudeMode: boolean
  policy: TerminalRendererPolicy
  main?: TerminalPlatformDiagnostic
  renderer?: TerminalRendererStatus
}

function DiagnosticRow({
  terminalId,
  terminalAgentType,
  terminalIsClaudeMode,
  policy,
  main,
  renderer,
}: DiagnosticRowProps) {
  const desired = resolveTerminalRenderer({
    policy,
    agentType: terminalAgentType,
    isClaudeMode: terminalIsClaudeMode,
  }).desired
  const canRetry = renderer?.fallbackReason !== null
    && renderer?.fallbackReason !== undefined
    && RECOVERABLE_REASONS.has(renderer.fallbackReason)
    && desired === 'webgl'

  return (
    <div
      data-renderer-terminal-id={terminalId}
      data-renderer-effective={renderer?.effective ?? 'unavailable'}
      data-renderer-fallback={renderer?.fallbackReason ?? 'none'}
      className="rounded-lg border border-[var(--mc-border)] p-3 text-sm"
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        <dt className="text-[var(--mc-text-muted)]">Terminal</dt>
        <dd className="truncate">{terminalId}</dd>
        <dt className="text-[var(--mc-text-muted)]">Renderer</dt>
        <dd>{renderer ? (renderer.effective === 'webgl' ? 'WebGL' : 'DOM') : 'Unavailable'}</dd>
        <dt className="text-[var(--mc-text-muted)]">Renderer fallback</dt>
        <dd>
          {renderer
            ? (renderer.fallbackReason ? RENDERER_REASON_COPY[renderer.fallbackReason] : 'none')
            : 'Renderer status unavailable.'}
        </dd>
        {main ? (
          <>
            <dt className="text-[var(--mc-text-muted)]">Provider</dt><dd>{main.provider ?? 'unmanaged'}</dd>
            <dt className="text-[var(--mc-text-muted)]">Engine / backend</dt>
            <dd>{main.engine} / {main.backend} ({main.backendAvailable ? 'available' : 'unavailable'})</dd>
            <dt className="text-[var(--mc-text-muted)]">Sequence / watermark</dt>
            <dd>{main.lastSequence} / {main.watermark}</dd>
            <dt className="text-[var(--mc-text-muted)]">Backend fallback</dt>
            <dd>{mainFallbackCopy(main.fallbackReason)}</dd>
          </>
        ) : (
          <>
            <dt className="text-[var(--mc-text-muted)]">Terminal stream</dt>
            <dd>Backend metadata unavailable</dd>
          </>
        )}
      </dl>
      {canRetry && (
        <button
          type="button"
          aria-label={`Retry GPU for ${terminalId}`}
          onClick={() => { retryTerminalRenderer(terminalId) }}
          className="mt-3 text-sm border border-[var(--mc-border)] rounded px-3 py-2 text-[var(--mc-text-primary)]"
        >
          Retry GPU
        </button>
      )}
    </div>
  )
}

export function DiagnosticsSettings() {
  const { pendingSettings: notificationSettings, updateSettings } = useNotificationStore()
  const rendererPolicy = useSettingsStore(state => state.pendingSettings.terminalRendererPolicy)
  const setTerminalRendererPolicy = useSettingsStore(state => state.setTerminalRendererPolicy)
  const terminals = useAppStore(state => state.terminals)
  const rendererStatuses = useTerminalRendererStatusStore(state => state.statuses)
  const rendererSessionCount = useTerminalRendererStatusStore(state => state.sessionCount)
  const [terminalDiagnostics, setTerminalDiagnostics] = useState<TerminalPlatformDiagnostic[]>([])
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null)

  const refreshDiagnostics = useCallback(async () => {
    try {
      setTerminalDiagnostics(await window.electron.terminal.getDiagnostics())
      setDiagnosticError(null)
    } catch {
      setDiagnosticError('Terminal diagnostics are unavailable.')
    }
  }, [])

  useEffect(() => {
    void refreshDiagnostics()
  }, [refreshDiagnostics])

  const mainByTerminalId = useMemo(
    () => new Map(terminalDiagnostics.map(diagnostic => [diagnostic.terminalId, diagnostic])),
    [terminalDiagnostics],
  )

  return (
    <div className="flex flex-col gap-8 pb-16 max-w-2xl">
      <SettingsTitle description="Advanced detection and troubleshooting controls">
        Diagnostics
      </SettingsTitle>

      <div className="settings-card rounded-xl flex flex-col gap-3">
        <div>
          <p id="terminal-renderer-policy-label" className="text-base font-semibold text-[var(--mc-text-primary)]">
            Terminal renderer policy
          </p>
          <p id="terminal-renderer-policy-help" className="text-sm text-[var(--mc-text-muted)] mt-0.5">
            Choose how terminal panes attempt hardware-accelerated rendering.
          </p>
        </div>
        <div
          role="radiogroup"
          aria-labelledby="terminal-renderer-policy-label"
          aria-describedby="terminal-renderer-policy-help"
          className="flex flex-col gap-2"
        >
          {RENDERER_POLICIES.map(option => (
            <label key={option.value} className="flex items-start gap-3 rounded-lg border border-[var(--mc-border)] p-3">
              <input
                type="radio"
                aria-label={option.label}
                aria-describedby={`terminal-renderer-policy-${option.value}-description`}
                name="terminal-renderer-policy"
                value={option.value}
                checked={rendererPolicy === option.value}
                onChange={() => setTerminalRendererPolicy(option.value)}
                className="mt-1 accent-[var(--mc-accent)]"
              />
              <span>
                <span className="block font-medium text-[var(--mc-text-primary)]">{option.label}</span>
                <span
                  id={`terminal-renderer-policy-${option.value}-description`}
                  className="block text-sm text-[var(--mc-text-muted)]"
                >
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="settings-card rounded-xl flex flex-col gap-3">
        <div>
          <p className="text-base font-semibold text-[var(--mc-text-primary)]">Detection Mode</p>
          <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">
            Override automatic terminal-output parsing only when troubleshooting notifications.
          </p>
        </div>
        <select
          aria-label="Detection Mode"
          value={notificationSettings.outputMode}
          onChange={(event) => updateSettings({ outputMode: event.target.value as OutputMode })}
          className="text-sm bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[var(--mc-accent)] text-[var(--mc-text-primary)]"
        >
          <option value="auto">Auto (Recommended)</option>
          <option value="stream-json">JSON Stream</option>
          <option value="plain-text">Plain Text</option>
        </select>
      </div>

      <div
        data-testid="terminal-stream-diagnostics"
        data-renderer-registry-count={rendererSessionCount}
        className="settings-card rounded-xl flex flex-col gap-3"
      >
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
        {terminals.length === 0 && (
          <p className="text-sm text-[var(--mc-text-muted)]">No active terminals.</p>
        )}
        {terminals.map(terminal => (
          <DiagnosticRow
            key={terminal.id}
            terminalId={terminal.id}
            terminalAgentType={terminal.agentType}
            terminalIsClaudeMode={terminal.isClaudeMode}
            policy={rendererPolicy}
            main={mainByTerminalId.get(terminal.id)}
            renderer={rendererStatuses[terminal.id]}
          />
        ))}
      </div>
    </div>
  )
}
