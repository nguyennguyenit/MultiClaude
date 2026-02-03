import { useState, useRef, useEffect } from 'react'
import { useAppStore, useSettingsStore, useUpdateStore } from '../../stores'
import { ActivityBarNavigationItem } from './activity-bar-navigation-item'
import { ActivityBarAccountSection } from './activity-bar-account-section'

export function ActivityBar() {
  const {
    activityBarState,
    setActivityBarState,
    activeProjectId,
    projects,
    terminals,
    activeView,
    setActiveView
  } = useAppStore()

  const { setSettingsModalOpen } = useSettingsStore()
  const { state: updateState } = useUpdateStore()
  const hasUpdate = updateState.status === 'available' || updateState.status === 'ready'

  const activeProject = projects.find(p => p.id === activeProjectId)
  const projectTerminals = activeProjectId
    ? terminals.filter(t => t.projectId === activeProjectId)
    : terminals

  // Hover reveal state for hidden mode
  const [isHovering, setIsHovering] = useState(false)
  const hideTimeoutRef = useRef<number | undefined>(undefined)

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [])

  const collapsed = activityBarState === 'collapsed'
  const hidden = activityBarState === 'hidden'

  // Width based on state
  const width = hidden
    ? 0
    : collapsed
      ? 'var(--mc-activity-bar-width-collapsed)'
      : 'var(--mc-activity-bar-width-expanded)'

  // Hidden state: render reveal button + hover zone
  if (hidden) {
    return (
      <>
        {/* Hover detection zone - wider for easier discovery */}
        <div
          className="activity-bar-hover-zone group"
          onMouseEnter={() => {
            if (hideTimeoutRef.current) {
              clearTimeout(hideTimeoutRef.current)
            }
            setIsHovering(true)
          }}
          onMouseLeave={() => {
            hideTimeoutRef.current = window.setTimeout(() => setIsHovering(false), 300)
          }}
        >
          {/* Reveal button - expand to default */}
          <button
            onClick={() => setActivityBarState('collapsed')}
            className="absolute left-2 top-2 p-1.5 bg-[var(--mc-bg-secondary)] border border-[var(--mc-border)] rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--mc-bg-hover)] transition-all shadow-md"
            title="Show Activity Bar (Ctrl+B)"
          >
            <svg className="w-4 h-4 text-[var(--mc-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Revealed Activity Bar on hover */}
        {isHovering && (
          <div
            className="activity-bar activity-bar-reveal fixed left-0 top-10 bottom-0 z-40"
            style={{ width: 'var(--mc-activity-bar-width-collapsed)' }}
            onMouseEnter={() => {
              if (hideTimeoutRef.current) {
                clearTimeout(hideTimeoutRef.current)
              }
            }}
            onMouseLeave={() => {
              hideTimeoutRef.current = window.setTimeout(() => setIsHovering(false), 300)
            }}
          >
            <ActivityBarContent
              collapsed={true}
              terminalCount={projectTerminals.length}
              activeView={activeView}
              setActiveView={setActiveView}
              hasUpdate={hasUpdate}
              onSettingsClick={() => setSettingsModalOpen(true)}
              projectPath={activeProject?.path}
              activityBarState={activityBarState}
              setActivityBarState={setActivityBarState}
            />
          </div>
        )}
      </>
    )
  }

  // Normal state (collapsed or expanded)
  return (
    <div
      data-testid="activity-bar"
      className="activity-bar bg-[var(--mc-bg-secondary)] border-r border-[var(--mc-border)] flex flex-col h-full overflow-hidden"
      style={{ width }}
    >
      <ActivityBarContent
        collapsed={collapsed}
        terminalCount={projectTerminals.length}
        activeView={activeView}
        setActiveView={setActiveView}
        hasUpdate={hasUpdate}
        onSettingsClick={() => setSettingsModalOpen(true)}
        projectPath={activeProject?.path}
        activityBarState={activityBarState}
        setActivityBarState={setActivityBarState}
      />
    </div>
  )
}

interface ActivityBarContentProps {
  collapsed: boolean
  terminalCount: number
  activeView: 'terminals' | 'github'
  setActiveView: (view: 'terminals' | 'github') => void
  hasUpdate: boolean
  onSettingsClick: () => void
  projectPath?: string
  activityBarState: 'collapsed' | 'expanded' | 'hidden'
  setActivityBarState: (state: 'collapsed' | 'expanded' | 'hidden') => void
}

function ActivityBarContent({
  collapsed,
  terminalCount,
  activeView,
  setActiveView,
  hasUpdate,
  onSettingsClick,
  projectPath,
  activityBarState,
  setActivityBarState
}: ActivityBarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Navigation Section */}
      <div className="px-1 py-2">
        {/* Toggle buttons based on state */}
        {activityBarState === 'expanded' ? (
          // Expanded: Single collapse arrow next to Views
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs text-[var(--mc-text-muted)] uppercase">Views</span>
            <button
              onClick={() => setActivityBarState('collapsed')}
              className="p-1 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)]"
              title="Collapse (Ctrl+B)"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        ) : activityBarState === 'collapsed' ? (
          // Collapsed (default): Double arrows
          <div className="flex items-center justify-center gap-1 py-1 mb-1">
            <button
              onClick={() => setActivityBarState('hidden')}
              className="p-1 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)]"
              title="Hide (Ctrl+B)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setActivityBarState('expanded')}
              className="p-1 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-muted)] hover:text-[var(--mc-text-primary)]"
              title="Expand (Ctrl+B)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        ) : null}

        <ActivityBarNavigationItem
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          label="Terminals"
          badge={terminalCount}
          active={activeView === 'terminals'}
          collapsed={collapsed}
          iconSize={collapsed ? 'lg' : 'sm'}
          onClick={() => setActiveView('terminals')}
        />

        <ActivityBarNavigationItem
          icon={
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
            </svg>
          }
          label="GitHub"
          active={activeView === 'github'}
          collapsed={collapsed}
          iconSize={collapsed ? 'lg' : 'sm'}
          onClick={() => setActiveView('github')}
        />
      </div>

      {/* Spacer - pushes bottom section to bottom */}
      <div className="flex-1" />

      {/* Bottom Section: Account & Settings */}
      <div className="border-t border-[var(--mc-border)]">
        {/* Account Section */}
        <ActivityBarAccountSection
          collapsed={collapsed}
          projectPath={projectPath}
        />

        {/* Settings Button */}
        <div className="px-1 py-2">
          <div className="relative group">
            <button
            data-testid="settings-button"
            onClick={onSettingsClick}
            className={`
              w-full flex items-center gap-3 px-3 py-2 rounded text-sm relative
              transition-colors duration-150
              ${collapsed ? 'justify-center' : ''}
              text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text-primary)]
            `}
            title={collapsed ? 'Settings' : undefined}
          >
            <svg className={`${collapsed ? 'w-6 h-6' : 'w-4 h-4'} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {!collapsed && <span className="whitespace-nowrap">Settings</span>}
            {hasUpdate && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--mc-accent)] rounded-full" />
            )}
          </button>

          {/* Tooltip when collapsed */}
          {collapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--mc-bg-tertiary)] text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-50 pointer-events-none transition-opacity shadow-lg border border-[var(--mc-border)]">
              Settings
              {hasUpdate && <span className="ml-1 text-[var(--mc-accent)]">(Update available)</span>}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}
