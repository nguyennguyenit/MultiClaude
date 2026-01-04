import { useAppStore, useSettingsStore } from '../../stores'
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
            icon="📟"
            label="Terminals"
            active={activeView === 'terminals'}
            collapsed={sidebarCollapsed}
            onClick={() => setActiveView('terminals')}
          />

          <NavigationItem
            icon="🔀"
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
                w-full flex items-center gap-2 px-2 py-2 rounded text-sm
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
            </button>
          </IconWithTooltip>
        </div>
      </div>
    </div>
  )
}
