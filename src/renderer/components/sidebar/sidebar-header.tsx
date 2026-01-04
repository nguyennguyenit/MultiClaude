interface SidebarHeaderProps {
  collapsed: boolean
  onToggle: () => void
}

export function SidebarHeader({ collapsed, onToggle }: SidebarHeaderProps) {
  return (
    <div className="relative flex items-center justify-between px-3 py-3 border-b border-[var(--mc-border)]">
      {!collapsed && (
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-[var(--mc-accent)]"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
          <span className="font-semibold text-[var(--mc-text-primary)]">MultiClaude</span>
        </div>
      )}
      {collapsed && (
        <svg
          className="w-5 h-5 text-[var(--mc-accent)] mx-auto"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      )}
      <button
        onClick={onToggle}
        className={`
          p-1.5 hover:bg-[var(--mc-bg-hover)] rounded text-[var(--mc-text-secondary)]
          transition-colors duration-150
          ${collapsed ? 'absolute right-2' : ''}
        `}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {collapsed ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          )}
        </svg>
      </button>
    </div>
  )
}
