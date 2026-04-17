import { useEffect, useState } from 'react'
import { useNotificationStore } from '../../stores/notification-store'
import { TelegramConfigModal } from './telegram-config-modal'
import { DiscordConfigModal } from './discord-config-modal'
import { SOUND_PRESETS } from '@shared/constants'
import type { SoundPreset, OutputMode, RemoteControlStatus } from '@shared/types'
import { SettingsTitle } from './settings-typography'
import { ToggleSwitch } from './toggle-switch'

interface NotificationSettingsProps {
  onNavigateToMobile?: () => void
}

export function NotificationSettings({ onNavigateToMobile }: NotificationSettingsProps = {}) {
  const { pendingSettings, updateSettings, refreshIntegrationSettings, remoteControlStatus } = useNotificationStore()
  const [telegramModalOpen, setTelegramModalOpen] = useState(false)
  const [discordModalOpen, setDiscordModalOpen] = useState(false)
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

  const handleTelegramSave = async (botToken: string, chatId: string) => {
    await window.electron.notification.setTelegram(botToken, chatId)
    await refreshIntegrationSettings()
  }

  const handleTelegramClear = async () => {
    await window.electron.notification.clearTelegram()
    await refreshIntegrationSettings()
  }

  const handleDiscordSave = async (webhookUrl: string) => {
    await window.electron.notification.setDiscord(webhookUrl)
    await refreshIntegrationSettings()
  }

  const handleDiscordClear = async () => {
    await window.electron.notification.clearDiscord()
    await refreshIntegrationSettings()
  }

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
                  className="underline text-[var(--mc-accent)] hover:text-[var(--mc-accent-hover)] focus:outline-none"
                >
                  enable Mobile Control
                </button>
              ) : (
                <span className="font-medium text-[var(--mc-text-secondary)]">enable Mobile Control</span>
              )}{' '}
              in the Mobile tab.
            </span>
          </div>
        )}
      </div>

      {/* Behavior card */}
      <div className="settings-card rounded-xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-[var(--mc-text-primary)]">Detection Mode</p>
            <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">How the app detects completion</p>
          </div>
          <select
            value={pendingSettings.outputMode}
            onChange={(e) => updateSettings({ outputMode: e.target.value as OutputMode })}
            className="text-sm bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--mc-accent)] min-w-[140px] text-[var(--mc-text-primary)]"
          >
            <option value="auto">Auto (Recommended)</option>
            <option value="stream-json">JSON Stream</option>
            <option value="plain-text">Plain Text</option>
          </select>
        </div>
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
        <div className="flex flex-col gap-3">
          <ToggleRow
            label="Enable Sound"
            checked={pendingSettings.soundEnabled}
            onChange={(v) => updateSettings({ soundEnabled: v })}
          />
          {pendingSettings.soundEnabled && (
            <div className="flex items-center justify-between pl-1">
              <p className="text-sm text-[var(--mc-text-secondary)]">Sound Preset</p>
              <select
                value={pendingSettings.soundPreset}
                onChange={(e) => updateSettings({ soundPreset: e.target.value as SoundPreset })}
                className="text-sm bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--mc-accent)] min-w-[140px] text-[var(--mc-text-primary)]"
              >
                {SOUND_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Integrations card */}
      <div className="settings-card rounded-xl flex flex-col gap-4">
        {/* Telegram */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-[#26A5E4]/10 rounded-lg flex-shrink-0">
              <TelegramIcon />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold text-[var(--mc-text-primary)]">Telegram</p>
                {pendingSettings.telegramConfigured && (
                  <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${pendingSettings.telegramEnabled ? 'text-green-400 bg-green-400/10' : 'text-[var(--mc-text-muted)] bg-[var(--mc-bg-hover)]'}`}>
                    {pendingSettings.telegramEnabled ? 'Active' : pendingSettings.telegramConfigured ? 'Configured' : null}
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">Send notifications to a Telegram chat</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ToggleSwitch
              checked={pendingSettings.telegramEnabled}
              onChange={(v) => updateSettings({ telegramEnabled: v })}
              disabled={!pendingSettings.telegramConfigured}
            />
            <button
              onClick={() => setTelegramModalOpen(true)}
              className="text-sm px-3 py-1.5 bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded hover:bg-[var(--mc-bg-hover)] transition-colors text-[var(--mc-text-primary)]"
            >
              Configure
            </button>
          </div>
        </div>

        {/* Remote Control toggle - only show when Telegram is configured and enabled */}
        {pendingSettings.telegramConfigured && pendingSettings.telegramEnabled && (
          <div className="flex items-center justify-between pl-11">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[var(--mc-text-secondary)]">Remote Control</p>
                <RemoteControlBadge status={remoteControlStatus} />
              </div>
              <p className="text-xs text-[var(--mc-text-muted)] mt-0.5">Control terminals from Telegram</p>
            </div>
            <ToggleSwitch
              checked={pendingSettings.remoteControlEnabled}
              onChange={(v) => updateSettings({ remoteControlEnabled: v })}
            />
          </div>
        )}

        {/* Discord */}
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center bg-[#5865F2]/10 rounded-lg flex-shrink-0">
            <DiscordIcon />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-[var(--mc-text-primary)]">Discord</p>
              {pendingSettings.discordConfigured && (
                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${pendingSettings.discordEnabled ? 'text-green-400 bg-green-400/10' : 'text-[var(--mc-text-muted)] bg-[var(--mc-bg-hover)]'}`}>
                  {pendingSettings.discordEnabled ? 'Active' : pendingSettings.discordConfigured ? 'Configured' : null}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">Send notifications to a Discord channel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ToggleSwitch
            checked={pendingSettings.discordEnabled}
            onChange={(v) => updateSettings({ discordEnabled: v })}
            disabled={!pendingSettings.discordConfigured}
          />
          <button
            onClick={() => setDiscordModalOpen(true)}
            className="text-sm px-3 py-1.5 bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded hover:bg-[var(--mc-bg-hover)] transition-colors text-[var(--mc-text-primary)]"
          >
            Configure
            </button>
          </div>
        </div>
      </div>{/* end Integrations card */}

      <TelegramConfigModal
        isOpen={telegramModalOpen}
        onClose={() => setTelegramModalOpen(false)}
        onSave={handleTelegramSave}
        onClear={handleTelegramClear}
        isConfigured={pendingSettings.telegramConfigured}
      />
      <DiscordConfigModal
        isOpen={discordModalOpen}
        onClose={() => setDiscordModalOpen(false)}
        onSave={handleDiscordSave}
        onClear={handleDiscordClear}
        isConfigured={pendingSettings.discordConfigured}
      />
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
      <ToggleSwitch checked={checked} onChange={onChange} />
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

function TelegramIcon() {
  return (
    <svg className="w-5 h-5 text-[#26A5E4]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161l-1.97 9.297c-.146.658-.537.818-1.084.508l-3-2.211-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.332-.373-.119l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.538-.194 1.006.131.833.924z" />
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg className="w-5 h-5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

function RemoteControlBadge({ status }: { status: RemoteControlStatus }) {
  if (status === 'disconnected') return null

  const config: Record<string, { color: string; label: string }> = {
    connected: { color: 'text-green-400 bg-green-400/10', label: 'Connected' },
    reconnecting: { color: 'text-yellow-400 bg-yellow-400/10', label: 'Reconnecting' },
    error: { color: 'text-red-400 bg-red-400/10', label: 'Error' }
  }

  const { color, label } = config[status] ?? config.error

  return (
    <span className={`text-[10px] uppercase font-bold ${color} px-1.5 py-0.5 rounded`}>
      {label}
    </span>
  )
}
