import { useState } from 'react'
import { ThemeSelector } from './theme-selector'
import { NotificationSettings } from './notification-settings'
import { TerminalSettings } from './terminal-settings'

type SettingsTab = 'appearance' | 'terminals' | 'notifications'

interface SettingsPanelProps {
  onClose: () => void
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')

  return (
    <div className="border-t border-[var(--mc-border)] bg-[var(--mc-bg-secondary)] p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[var(--mc-text-primary)]">Settings</span>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[var(--mc-bg-hover)] rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-1 mb-3">
        <TabButton
          active={activeTab === 'appearance'}
          onClick={() => setActiveTab('appearance')}
        >
          Appearance
        </TabButton>
        <TabButton
          active={activeTab === 'terminals'}
          onClick={() => setActiveTab('terminals')}
        >
          Terminals
        </TabButton>
        <TabButton
          active={activeTab === 'notifications'}
          onClick={() => setActiveTab('notifications')}
        >
          Notifications
        </TabButton>
      </div>

      {/* Tab content */}
      {activeTab === 'appearance' && <ThemeSelector />}
      {activeTab === 'terminals' && <TerminalSettings />}
      {activeTab === 'notifications' && <NotificationSettings />}
    </div>
  )
}

function TabButton({
  children,
  active,
  onClick
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1 text-xs rounded
        ${active
          ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)]'
          : 'bg-[var(--mc-bg-hover)] text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-active)]'
        }
      `}
    >
      {children}
    </button>
  )
}
