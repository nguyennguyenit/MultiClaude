import { useUpdateStore } from '../../stores'

export type SettingsTab = 'appearance' | 'terminals' | 'notifications' | 'updates'

interface SettingsSidebarProps {
  activeTab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
}

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'terminals', label: 'Terminals' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'updates', label: 'Updates' }
]

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  const { state: updateState } = useUpdateStore()
  const hasUpdate = updateState.status === 'available' || updateState.status === 'ready'

  return (
    <div data-testid="settings-sidebar" className="w-48 border-r border-[var(--mc-border)] p-2 flex-shrink-0">
      {TABS.map(tab => {
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            data-testid={`settings-tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={`
              w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-left mb-1 relative
              transition-all
              ${!isActive ? 'hover:bg-[var(--mc-bg-hover)] text-[var(--mc-text-secondary)]' : 'font-medium'}
            `}
            style={isActive ? {
              background: 'color-mix(in srgb, var(--mc-accent) 15%, transparent)',
              color: 'var(--mc-accent)',
              boxShadow: 'inset 2px 0 0 var(--mc-accent)',
            } : undefined}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor: isActive ? 'var(--mc-accent)' : 'var(--mc-text-muted)',
              }}
            />
            <span className="flex-1">{tab.label}</span>
            {tab.id === 'updates' && hasUpdate && !isActive && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--mc-accent)] rounded-full" />
            )}
          </button>
        )
      })}
    </div>
  )
}
