import { useEffect, useState } from 'react'
import { useNotificationStore } from '../../stores/notification-store'
import { SettingsTitle } from './settings-typography'
import { ToggleSwitch } from './toggle-switch'

interface NotificationSettingsProps {
  onNavigateToMobile?: () => void
}

export function NotificationSettings({ onNavigateToMobile }: NotificationSettingsProps = {}) {
  const { pendingSettings, updateSettings } = useNotificationStore()
  const [mobileControlRunning, setMobileControlRunning] = useState(false)

  useEffect(() => {
    let cancelled = false
    void window.electron.mobileControl.getStatus().then((status) => {
      if (!cancelled) setMobileControlRunning(status.running)
    }).catch(() => { /* keep default false */ })
    const off = window.electron.mobileControl.onStatusChanged((next) => {
      setMobileControlRunning(next.running)
    })
    return () => {
      cancelled = true
      off()
    }
  }, [])

  const showMobileControlHint = !mobileControlRunning && pendingSettings.onReviewNeeded

  return (
    <div className="flex flex-col gap-8 pb-16 max-w-2xl">
      <SettingsTitle description="Manage how and when you receive notifications">
        Notifications
      </SettingsTitle>

      {/* Trigger Events card */}
      <div className="settings-card rounded-xl flex flex-col gap-4">
        <ToggleRow
          label="On Task Complete"
          description="Notify when a long-running task finishes successfully"
          checked={pendingSettings.onTaskComplete}
          onChange={(v) => updateSettings({ onTaskComplete: v })}
        />
        <ToggleRow
          label="On Task Failed"
          description="Notify when a task encounters an error"
          checked={pendingSettings.onTaskFailed}
          onChange={(v) => updateSettings({ onTaskFailed: v })}
        />
        <ToggleRow
          label="On Review Needed"
          description="Notify when a task requires manual confirmation"
          checked={pendingSettings.onReviewNeeded}
          onChange={(v) => updateSettings({ onReviewNeeded: v })}
        />
        {showMobileControlHint && (
          <div
            role="status"
            data-testid="mobile-control-hint"
            className="flex items-start gap-2 text-xs text-[var(--mc-text-muted)] bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded-md px-3 py-2"
          >
            <InfoIcon />
            <span>
              For precise approval detection (no false alarms on terminal resize),{' '}
              {onNavigateToMobile ? (
                <button
                  type="button"
                  onClick={onNavigateToMobile}
                  className="inline p-0 bg-transparent border-0 underline cursor-pointer text-[var(--mc-accent)] hover:text-[var(--mc-accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--mc-accent)] rounded-sm"
                >
                  enable Mobile Control
                </button>
              ) : (
                <span className="font-medium text-[var(--mc-text-secondary)]">enable Mobile Control</span>
              )}{' '}
              in Agents &amp; Integrations.
            </span>
          </div>
        )}
      </div>

      {/* Behavior card */}
      <div className="settings-card rounded-xl flex flex-col gap-4">
        <ToggleRow
          label="Only When Background"
          description="Skip notifications if the terminal is focused"
          checked={pendingSettings.notifyOnlyBackground}
          onChange={(v) => updateSettings({ notifyOnlyBackground: v })}
        />
        <ToggleRow
          label="Include Task Summary"
          description="Show command output summary in the notification"
          checked={pendingSettings.includeTaskSummary}
          onChange={(v) => updateSettings({ includeTaskSummary: v })}
        />
      </div>

    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-base font-semibold text-[var(--mc-text-primary)]">{label}</p>
        {description && (
          <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">{description}</p>
        )}
      </div>
      <ToggleSwitch ariaLabel={label} checked={checked} onChange={onChange} />
    </div>
  )
}

function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[var(--mc-text-muted)]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}
