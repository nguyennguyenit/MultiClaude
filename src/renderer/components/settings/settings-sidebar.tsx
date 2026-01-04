export type SettingsTab = 'appearance' | 'terminals' | 'notifications'

interface SettingsSidebarProps {
  activeTab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
}

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'appearance', label: 'Appearance', icon: '🎨' },
  { id: 'terminals', label: 'Terminals', icon: '⌨' },
  { id: 'notifications', label: 'Notifications', icon: '🔔' }
]

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  return (
    <div className="w-48 border-r border-[var(--mc-border)] p-2 flex-shrink-0">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left mb-1
            transition-colors duration-150
            ${activeTab === tab.id
              ? 'bg-[var(--mc-accent)] text-[var(--mc-bg-primary)]'
              : 'hover:bg-[var(--mc-bg-hover)] text-[var(--mc-text-primary)]'}
          `}
        >
          <span>{tab.icon}</span>
          <span className="flex-1">{tab.label}</span>
          {activeTab === tab.id && <span>◀</span>}
        </button>
      ))}
    </div>
  )
}
