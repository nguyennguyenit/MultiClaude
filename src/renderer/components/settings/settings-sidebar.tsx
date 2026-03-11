import { useUpdateStore } from '../../stores'

export type SettingsTab = 'appearance' | 'terminals' | 'notifications' | 'updates'

interface SettingsSidebarProps {
  activeTab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
}

const TABS: { id: SettingsTab; label: string; description: string; icon: React.ReactNode }[] = [
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Customize how MultiClaude looks',
    icon: <PaletteIcon />
  },
  {
    id: 'terminals',
    label: 'Terminal Settings',
    description: 'Configure terminal behavior',
    icon: <TerminalIcon />
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Alert preferences',
    icon: <BellIcon />
  },
  {
    id: 'updates',
    label: 'Updates',
    description: 'MultiClaude updates',
    icon: <UpdateIcon />
  }
]

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
  const { state: updateState } = useUpdateStore()
  const hasUpdate = updateState.status === 'available' || updateState.status === 'ready'

  return (
    <div data-testid="settings-sidebar" className="w-60 border-r border-[var(--mc-border)] py-4 px-3 flex-shrink-0 flex flex-col">
      {/* Section Header */}
      <div className="px-3 mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--mc-text-muted)' }}>
          APP SETTINGS
        </span>
      </div>

      {/* Tab Items */}
      <div className="flex flex-col gap-1">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              data-testid={`settings-tab-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`
                w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left relative
                transition-all
                ${!isActive ? 'hover:bg-[var(--mc-bg-hover)]' : 'font-medium'}
              `}
              style={isActive ? {
                background: 'color-mix(in srgb, var(--mc-accent) 20%, transparent)',
                border: '1px solid color-mix(in srgb, var(--mc-accent) 40%, transparent)',
                color: 'var(--mc-text-primary)',
              } : { background: 'transparent', border: 'none', color: 'var(--mc-text-primary)' }}
            >
              {/* Icon */}
              <span
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center"
                style={{ color: isActive ? 'var(--mc-accent)' : 'var(--mc-text-muted)' }}
              >
                {tab.icon}
              </span>
              {/* Label + Description */}
              <div className="flex-1 min-w-0">
                <span className="block text-sm font-semibold leading-tight">{tab.label}</span>
                <span
                  className="block text-xs leading-tight mt-0.5 truncate"
                  style={{ color: isActive ? 'color-mix(in srgb, var(--mc-accent) 70%, var(--mc-text-muted))' : 'var(--mc-text-muted)' }}
                >
                  {tab.description}
                </span>
              </div>
              {tab.id === 'updates' && hasUpdate && !isActive && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--mc-accent)] rounded-full" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Icons
function PaletteIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
    </svg>
  )
}

function TerminalIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  )
}

function UpdateIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.182-3.182" />
    </svg>
  )
}
