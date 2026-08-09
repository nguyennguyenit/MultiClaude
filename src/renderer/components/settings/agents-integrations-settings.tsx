import { useState } from 'react'
import type { RemoteControlStatus } from '@shared/types'
import { useNotificationStore } from '../../stores/notification-store'
import { DiscordConfigModal } from './discord-config-modal'
import { MobileControlSettings } from './mobile-control-settings'
import { SettingsTitle } from './settings-typography'
import { TelegramConfigModal } from './telegram-config-modal'
import { ToggleSwitch } from './toggle-switch'

export function AgentsIntegrationsSettings() {
  const {
    pendingSettings,
    updateSettings,
    refreshIntegrationSettings,
    remoteControlStatus,
  } = useNotificationStore()
  const [telegramModalOpen, setTelegramModalOpen] = useState(false)
  const [discordModalOpen, setDiscordModalOpen] = useState(false)

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
      <SettingsTitle description="Configure provider hooks, messaging channels, and remote control">
        Agents &amp; Integrations
      </SettingsTitle>

      <div className="settings-card rounded-xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-[var(--mc-text-primary)]">Telegram</p>
            <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">Notifications and remote terminal control</p>
          </div>
          <div className="flex items-center gap-3">
            <ToggleSwitch
              ariaLabel="Enable Telegram"
              checked={pendingSettings.telegramEnabled}
              onChange={(value) => updateSettings({ telegramEnabled: value })}
              disabled={!pendingSettings.telegramConfigured}
            />
            <button
              type="button"
              onClick={() => setTelegramModalOpen(true)}
              className="text-sm px-3 py-1.5 bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded hover:bg-[var(--mc-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--mc-accent)] text-[var(--mc-text-primary)]"
            >
              Configure
            </button>
          </div>
        </div>

        {pendingSettings.telegramConfigured && pendingSettings.telegramEnabled && (
          <div className="flex items-center justify-between pl-4 border-l border-[var(--mc-border)]">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[var(--mc-text-secondary)]">Remote Control</p>
                <RemoteControlBadge status={remoteControlStatus} />
              </div>
              <p className="text-xs text-[var(--mc-text-muted)] mt-0.5">Control terminals from Telegram</p>
            </div>
            <ToggleSwitch
              ariaLabel="Enable Telegram remote control"
              checked={pendingSettings.remoteControlEnabled}
              onChange={(value) => updateSettings({ remoteControlEnabled: value })}
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-[var(--mc-text-primary)]">Discord</p>
            <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">Send notifications to a Discord channel</p>
          </div>
          <div className="flex items-center gap-3">
            <ToggleSwitch
              ariaLabel="Enable Discord"
              checked={pendingSettings.discordEnabled}
              onChange={(value) => updateSettings({ discordEnabled: value })}
              disabled={!pendingSettings.discordConfigured}
            />
            <button
              type="button"
              onClick={() => setDiscordModalOpen(true)}
              className="text-sm px-3 py-1.5 bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded hover:bg-[var(--mc-bg-hover)] focus-visible:ring-2 focus-visible:ring-[var(--mc-accent)] text-[var(--mc-text-primary)]"
            >
              Configure
            </button>
          </div>
        </div>
      </div>

      <MobileControlSettings embedded />

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

function RemoteControlBadge({ status }: { status: RemoteControlStatus }) {
  if (status === 'disconnected') return null
  const config: Record<string, { color: string; label: string }> = {
    connected: { color: 'text-green-400 bg-green-400/10', label: 'Connected' },
    reconnecting: { color: 'text-yellow-400 bg-yellow-400/10', label: 'Reconnecting' },
    error: { color: 'text-red-400 bg-red-400/10', label: 'Error' },
  }
  const { color, label } = config[status] ?? config.error
  return (
    <span className={`text-[10px] uppercase font-bold ${color} px-1.5 py-0.5 rounded`}>
      {label}
    </span>
  )
}
