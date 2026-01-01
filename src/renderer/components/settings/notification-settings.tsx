import { useEffect, useState } from 'react'
import { useNotificationStore } from '../../stores/notification-store'
import { TelegramConfigModal } from './telegram-config-modal'
import { DiscordConfigModal } from './discord-config-modal'
import { SOUND_PRESETS } from '@shared/constants'
import type { SoundPreset } from '@shared/types'

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
    <div className="space-y-4">
      {/* Events Section */}
      <div>
        <div className="text-xs text-[var(--mc-text-muted)] uppercase mb-2">Events</div>
        <div className="space-y-2">
          <ToggleRow
            label="On Task Complete"
            checked={settings.onTaskComplete}
            onChange={(v) => updateSettings({ onTaskComplete: v })}
          />
          <ToggleRow
            label="On Task Failed"
            checked={settings.onTaskFailed}
            onChange={(v) => updateSettings({ onTaskFailed: v })}
          />
          <ToggleRow
            label="On Review Needed"
            checked={settings.onReviewNeeded}
            onChange={(v) => updateSettings({ onReviewNeeded: v })}
          />
        </div>
      </div>

      {/* Sound Section */}
      <div>
        <div className="text-xs text-[var(--mc-text-muted)] uppercase mb-2">Sound</div>
        <div className="space-y-2">
          <ToggleRow
            label="Enable Sound"
            checked={settings.soundEnabled}
            onChange={(v) => updateSettings({ soundEnabled: v })}
          />
          {settings.soundEnabled && (
            <div className="flex items-center justify-between pl-2">
              <span className="text-xs text-[var(--mc-text-secondary)]">Preset</span>
              <select
                value={settings.soundPreset}
                onChange={(e) => updateSettings({ soundPreset: e.target.value as SoundPreset })}
                className="text-xs bg-[var(--mc-bg-primary)] border border-[var(--mc-border)] rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[var(--mc-accent)]"
              >
                {SOUND_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* External Notifications Section */}
      <div>
        <div className="text-xs text-[var(--mc-text-muted)] uppercase mb-2">External</div>
        <div className="space-y-2">
          {/* Telegram */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TelegramIcon />
              <span className="text-xs text-[var(--mc-text-primary)]">Telegram</span>
              {settings.telegramConfigured && (
                <span className="text-[10px] text-green-400 bg-green-400/20 px-1.5 py-0.5 rounded">
                  Configured
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Toggle
                checked={settings.telegramEnabled}
                onChange={(v) => updateSettings({ telegramEnabled: v })}
                disabled={!settings.telegramConfigured}
              />
              <button
                onClick={() => setTelegramModalOpen(true)}
                className="text-xs px-2 py-1 bg-[var(--mc-bg-hover)] rounded hover:bg-[var(--mc-bg-active)]"
              >
                Configure
              </button>
            </div>
          </div>

          {/* Discord */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DiscordIcon />
              <span className="text-xs text-[var(--mc-text-primary)]">Discord</span>
              {settings.discordConfigured && (
                <span className="text-[10px] text-green-400 bg-green-400/20 px-1.5 py-0.5 rounded">
                  Configured
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Toggle
                checked={settings.discordEnabled}
                onChange={(v) => updateSettings({ discordEnabled: v })}
                disabled={!settings.discordConfigured}
              />
              <button
                onClick={() => setDiscordModalOpen(true)}
                className="text-xs px-2 py-1 bg-[var(--mc-bg-hover)] rounded hover:bg-[var(--mc-bg-active)]"
              >
                Configure
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
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

// Toggle component
function Toggle({
  checked,
  onChange,
  disabled
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`
        relative w-8 h-4 rounded-full transition-colors overflow-hidden
        ${checked ? 'bg-[var(--mc-accent)]' : 'bg-[var(--mc-bg-hover)]'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span
        className={`
          absolute left-0.5 top-0.5 w-3 h-3 rounded-full bg-white transition-transform
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `}
      />
    </button>
  )
}

// Toggle row with label
function ToggleRow({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--mc-text-primary)]">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

// Icons
function TelegramIcon() {
  return (
    <svg className="w-4 h-4 text-[#26A5E4]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161l-1.97 9.297c-.146.658-.537.818-1.084.508l-3-2.211-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.332-.373-.119l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.538-.194 1.006.131.833.924z"/>
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg className="w-4 h-4 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  )
}
