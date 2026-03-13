import { useEffect, useState } from 'react'
import { useNotificationStore } from '../../stores/notification-store'
import { TelegramConfigModal } from './telegram-config-modal'
import { DiscordConfigModal } from './discord-config-modal'
import { SOUND_PRESETS } from '@shared/constants'
import type { SoundPreset, OutputMode } from '@shared/types'
import { SettingsTitle } from './settings-typography'
import { ToggleSwitch } from './toggle-switch'

export function NotificationSettings() {
  const { settings, loadSettings, updateSettings } = useNotificationStore()
  const [telegramModalOpen, setTelegramModalOpen] = useState(false)
  const [discordModalOpen, setDiscordModalOpen] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const handleTelegramSave = async (botToken: string, chatId: string) => {
    await window.electron.notification.setTelegram(botToken, chatId)
    await loadSettings()
  }

  const handleTelegramClear = async () => {
    await window.electron.notification.clearTelegram()
    await loadSettings()
  }

  const handleDiscordSave = async (webhookUrl: string) => {
    await window.electron.notification.setDiscord(webhookUrl)
    await loadSettings()
  }

  const handleDiscordClear = async () => {
    await window.electron.notification.clearDiscord()
    await loadSettings()
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
          checked={settings.onTaskComplete}
          onChange={(v) => updateSettings({ onTaskComplete: v })}
        />
        <ToggleRow
          label="On Task Failed"
          description="Notify when a task encounters an error"
          checked={settings.onTaskFailed}
          onChange={(v) => updateSettings({ onTaskFailed: v })}
        />
        <ToggleRow
          label="On Review Needed"
          description="Notify when a task requires manual confirmation"
          checked={settings.onReviewNeeded}
          onChange={(v) => updateSettings({ onReviewNeeded: v })}
        />
      </div>

      {/* Behavior card */}
      <div className="settings-card rounded-xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-semibold text-[var(--mc-text-primary)]">Detection Mode</p>
            <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">How the app detects completion</p>
          </div>
          <select
            value={settings.outputMode}
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
          checked={settings.notifyOnlyBackground}
          onChange={(v) => updateSettings({ notifyOnlyBackground: v })}
        />
        <ToggleRow
          label="Include Task Summary"
          description="Show command output summary in the notification"
          checked={settings.includeTaskSummary}
          onChange={(v) => updateSettings({ includeTaskSummary: v })}
        />
        <div className="flex flex-col gap-3">
          <ToggleRow
            label="Enable Sound"
            checked={settings.soundEnabled}
            onChange={(v) => updateSettings({ soundEnabled: v })}
          />
          {settings.soundEnabled && (
            <div className="flex items-center justify-between pl-1">
              <p className="text-sm text-[var(--mc-text-secondary)]">Sound Preset</p>
              <select
                value={settings.soundPreset}
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
                {settings.telegramConfigured && (
                  <span className="text-[10px] uppercase font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">Active</span>
                )}
              </div>
              <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">Send notifications to a Telegram chat</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ToggleSwitch
              checked={settings.telegramEnabled}
              onChange={(v) => updateSettings({ telegramEnabled: v })}
              disabled={!settings.telegramConfigured}
            />
            <button
              onClick={() => setTelegramModalOpen(true)}
              className="text-sm px-3 py-1.5 bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded hover:bg-[var(--mc-bg-hover)] transition-colors text-[var(--mc-text-primary)]"
            >
              Configure
            </button>
          </div>
        </div>

        {/* Discord */}
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center bg-[#5865F2]/10 rounded-lg flex-shrink-0">
            <DiscordIcon />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-[var(--mc-text-primary)]">Discord</p>
              {settings.discordConfigured && (
                <span className="text-[10px] uppercase font-bold text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded">Active</span>
              )}
            </div>
            <p className="text-sm text-[var(--mc-text-muted)] mt-0.5">Send notifications to a Discord channel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ToggleSwitch
            checked={settings.discordEnabled}
            onChange={(v) => updateSettings({ discordEnabled: v })}
            disabled={!settings.discordConfigured}
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
        isConfigured={settings.telegramConfigured}
      />
      <DiscordConfigModal
        isOpen={discordModalOpen}
        onClose={() => setDiscordModalOpen(false)}
        onSave={handleDiscordSave}
        onClear={handleDiscordClear}
        isConfigured={settings.discordConfigured}
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
