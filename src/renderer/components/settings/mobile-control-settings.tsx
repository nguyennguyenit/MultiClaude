import { useCallback, useEffect, useState } from 'react'
import type { MobileControlStatus } from '@main/notification/mobile-control-manager'
import { SettingsTitle } from './settings-typography'
import { ToggleSwitch } from './toggle-switch'

const EMPTY_STATUS: MobileControlStatus = {
  enabled: false,
  running: false,
  port: null,
  secretFingerprint: null,
  installStatus: { installed: false, eventCount: 0 },
  ccpokeDetected: false,
  ccpokeReasons: []
}

export function MobileControlSettings() {
  const [status, setStatus] = useState<MobileControlStatus>(EMPTY_STATUS)
  const [busy, setBusy] = useState(false)
  const [showRegenConfirm, setShowRegenConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const next = await window.electron.mobileControl.getStatus()
      setStatus(next)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const off = window.electron.mobileControl.onStatusChanged((next) => setStatus(next))
    return off
  }, [refresh])

  const toggle = async (next: boolean) => {
    setBusy(true)
    setError(null)
    try {
      const result = next
        ? await window.electron.mobileControl.enable()
        : await window.electron.mobileControl.disable()
      setStatus(result)
      if (next && !result.running && result.error) {
        setError(result.error)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const regenerate = async () => {
    setShowRegenConfirm(false)
    setBusy(true)
    setError(null)
    try {
      const result = await window.electron.mobileControl.regenerateSecret()
      setStatus(result)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-8 pb-16 max-w-2xl">
      <SettingsTitle description="Claude Code hook receiver for phone-side control">
        Mobile Control
      </SettingsTitle>

      <div className="settings-card rounded-xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-[var(--mc-text-primary)]">Enable Mobile Control</p>
            <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">
              Starts a loopback hook server and installs entries in ~/.claude/settings.json
            </p>
          </div>
          <div data-testid="mc-toggle">
            <ToggleSwitch
              checked={status.running}
              onChange={toggle}
              disabled={busy}
            />
          </div>
        </div>

        {status.running && (
          <div className="text-sm text-[var(--mc-text-muted)] flex flex-col gap-1" data-testid="mc-status-card">
            <div>🟢 Running on <code>127.0.0.1:{status.port ?? '—'}</code></div>
            <div>Secret fingerprint: <code>{status.secretFingerprint ?? '—'}</code></div>
            <div>Hooks installed: <code>{status.installStatus.eventCount}</code> / 3</div>
          </div>
        )}

        {error && (
          <div className="text-sm text-[var(--mc-status-error, #d66)]" data-testid="mc-error">
            ⚠️ {error}
          </div>
        )}

        {status.ccpokeDetected && (
          <div className="text-sm text-[var(--mc-status-warning, #c90)]" data-testid="mc-ccpoke-warning">
            ⚠️ ccpoke detected — you may see duplicate notifications:
            <ul className="list-disc ml-5 mt-1">
              {status.ccpokeReasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>
        )}

        {status.running && (
          <button
            type="button"
            className="self-start text-xs underline text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)]"
            onClick={() => setShowRegenConfirm(true)}
            disabled={busy}
            data-testid="mc-regen-secret"
          >
            Regenerate secret (requires Claude restart)
          </button>
        )}
      </div>

      {showRegenConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          data-testid="mc-regen-confirm"
        >
          <div className="settings-card rounded-xl p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-2">Regenerate secret?</h3>
            <p className="text-sm text-[var(--mc-text-muted)] mb-4">
              All currently-running Claude Code sessions using the old secret will fail
              hook delivery and must be restarted. Proceed?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="px-3 py-1.5 rounded border border-[var(--mc-border)]"
                onClick={() => setShowRegenConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded bg-[var(--mc-accent)] text-white"
                onClick={regenerate}
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
