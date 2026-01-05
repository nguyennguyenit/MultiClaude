import { useAppStore, useSettingsStore, useUpdateStore } from '../../stores'
import { SidebarHeader } from './sidebar-header'
import { NavigationItem } from './navigation-item'
import { UserAccountCard } from './user-account-card'

// Tooltip wrapper for collapsed icons
function IconWithTooltip({ tooltip, children, collapsed }: { tooltip: string; children: React.ReactNode; collapsed: boolean }) {
  if (!collapsed) return <>{children}</>
  return (
    <div className="relative group">
      {children}
      <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--mc-bg-tertiary)] text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity">
        {tooltip}
      </div>
    </div>
  )
}

export function Sidebar() {
  const {
    activeProjectId,
    sidebarOpen,
    sidebarCollapsed,
    toggleSidebarCollapse,
    projects,
    activeView,
    setActiveView
  } = useAppStore()

  const { setSettingsModalOpen } = useSettingsStore()
  const { state: updateState } = useUpdateStore()
  const hasUpdate = updateState.status === 'available' || updateState.status === 'ready'
  const activeProject = projects.find(p => p.id === activeProjectId)

  if (!sidebarOpen) return null

  const widthClass = sidebarCollapsed
    ? 'w-[var(--mc-sidebar-width-collapsed)]'
    : 'w-[var(--mc-sidebar-width-expanded)]'

  return (
    <div className={`
      ${widthClass}
      bg-[var(--mc-bg-secondary)] border-r border-[var(--mc-border)] flex flex-col h-full
      transition-[width] duration-[var(--mc-sidebar-transition)]
      overflow-hidden
    `}>
      {/* Sidebar Header */}
      <SidebarHeader collapsed={sidebarCollapsed} onToggle={toggleSidebarCollapse} />

      {/* Main Content - Navigation + Spacer + User Account */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Navigation Section */}
        <div className="px-1 py-2">
          {!sidebarCollapsed && (
            <div className="px-2 py-1 text-xs text-[var(--mc-text-muted)] uppercase whitespace-nowrap">
              Navigation
            </div>
          )}

          <NavigationItem
            icon={
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            label="Terminals"
            active={activeView === 'terminals'}
            collapsed={sidebarCollapsed}
            onClick={() => setActiveView('terminals')}
          />

          <NavigationItem
            icon={
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
            }
            label="GitHub"
            active={activeView === 'github'}
            collapsed={sidebarCollapsed}
            onClick={() => setActiveView('github')}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* User Account Card */}
        <UserAccountCard
          collapsed={sidebarCollapsed}
          projectPath={activeProject?.path}
        />
      </div>

      {/* Settings Section - Bottom */}
      <div className="border-t border-[var(--mc-border)]">
        <div className="p-2">
          <IconWithTooltip tooltip="Settings" collapsed={sidebarCollapsed}>
            <button
              onClick={() => setSettingsModalOpen(true)}
              className={`
                w-full flex items-center gap-2 px-2 py-2 rounded text-sm relative
                transition-colors duration-150
                ${sidebarCollapsed ? 'justify-center' : ''}
                hover:bg-[var(--mc-bg-hover)] text-[var(--mc-text-secondary)]
              `}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {!sidebarCollapsed && <span className="whitespace-nowrap">Settings</span>}
              {hasUpdate && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--mc-accent)] rounded-full" />
              )}
            </button>
          </IconWithTooltip>
        </div>
      </div>
    </div>
  )
}
